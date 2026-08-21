import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(demoRoot, "..");

function transpile(sourceText) {
  return ts.transpileModule(sourceText, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      isolatedModules: true,
    },
  }).outputText;
}

function dataUrl(sourceText) {
  return `data:text/javascript;base64,${Buffer.from(sourceText, "utf8").toString("base64")}`;
}

function replaceImport(sourceText, specifier, replacement) {
  const quoted = [`"${specifier}"`, `'${specifier}'`];
  for (const value of quoted) sourceText = sourceText.replaceAll(value, `"${replacement}"`);
  return sourceText;
}

function decodeFixture(encoded) {
  return gunzipSync(Buffer.from(encoded.trim(), "base64")).toString("utf8");
}

function occupiedGraphSciiCount(text) {
  let count = 0;
  for (const character of text) {
    const codepoint = character.codePointAt(0);
    if (codepoint >= 0xe000 && codepoint <= 0xf8fc) count += 1;
  }
  return count;
}

const sourcePaths = {
  geometry: path.join(demoRoot, "src", "geometry-engine.ts"),
  topology: path.join(demoRoot, "src", "connector-topology.ts"),
  normalization: path.join(demoRoot, "src", "line-normalization.ts"),
  registry: path.join(demoRoot, "src", "semantic-registry.ts"),
  solver: path.join(demoRoot, "src", "solver.ts"),
};

const [geometrySource, topologySource, normalizationSource, registrySource, solverSource] = await Promise.all([
  readFile(sourcePaths.geometry, "utf8"),
  readFile(sourcePaths.topology, "utf8"),
  readFile(sourcePaths.normalization, "utf8"),
  readFile(sourcePaths.registry, "utf8"),
  readFile(sourcePaths.solver, "utf8"),
]);

const geometryUrl = dataUrl(transpile(geometrySource));
const topologyUrl = dataUrl(transpile(topologySource));

let normalizationCompiled = transpile(normalizationSource);
normalizationCompiled = replaceImport(normalizationCompiled, "./geometry-engine", geometryUrl);
const normalizationUrl = dataUrl(normalizationCompiled);

let registryCompiled = transpile(registrySource);
registryCompiled = replaceImport(registryCompiled, "./geometry-engine", geometryUrl);
const registryUrl = dataUrl(registryCompiled);

let solverCompiled = transpile(solverSource);
solverCompiled = replaceImport(solverCompiled, "./geometry-engine", geometryUrl);
solverCompiled = replaceImport(solverCompiled, "./connector-topology", topologyUrl);
solverCompiled = replaceImport(solverCompiled, "./line-normalization", normalizationUrl);
solverCompiled = replaceImport(solverCompiled, "./semantic-registry", registryUrl);
const solverUrl = dataUrl(solverCompiled);

const [geometryModule, registryModule, solverModule] = await Promise.all([
  import(geometryUrl),
  import(registryUrl),
  import(solverUrl),
]);
const { buildGeometryGrid } = geometryModule;
const { GlyphRegistry } = registryModule;
const { GraphSolver } = solverModule;

const assetPaths = {
  "/assets/registry.json": path.join(repoRoot, "artifacts", "manifest", "vocabulary-v1", "registry.json"),
  "/assets/by-connection-pair.json": path.join(repoRoot, "artifacts", "manifest", "indexes", "by-connection-pair.json"),
  "/assets/by-boundary-side-style.json": path.join(repoRoot, "artifacts", "manifest", "vocabulary", "indexes", "by-boundary-side-style.json"),
  "/assets/by-alias.json": path.join(repoRoot, "artifacts", "manifest", "vocabulary", "indexes", "by-alias.json"),
  "/assets/orthogonal-connectors.json": path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-connectors.json"),
  "/assets/diagonal-connectors.json": path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-connectors.json"),
  "/assets/diagonal-selection.json": path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-selection.json"),
};

const assetDocuments = new Map();
for (const [urlPath, filePath] of Object.entries(assetPaths)) {
  assetDocuments.set(urlPath, JSON.parse(await readFile(filePath, "utf8")));
}

globalThis.window = { location: { href: "http://graphscii.test/" } };
globalThis.fetch = async (input) => {
  const url = input instanceof URL
    ? input
    : new URL(typeof input === "string" ? input : input.url);
  const document = assetDocuments.get(url.pathname);
  if (!document) {
    return { ok: false, status: 404, json: async () => ({}) };
  }
  return { ok: true, status: 200, json: async () => structuredClone(document) };
};

const registry = await GlyphRegistry.load("http://graphscii.test/assets/registry.json");
if (registry.glyphs.length !== 6397) throw new Error(`Runtime registry loaded ${registry.glyphs.length} owners instead of 6,397.`);

const [fixtureEncoded, invalidOutputEncoded] = await Promise.all([
  readFile(path.join(demoRoot, "fixtures", "regressions", "failing-freehand.graphscii.gz.b64"), "utf8"),
  readFile(path.join(demoRoot, "fixtures", "regressions", "failing-freehand-invalid-output.txt.gz.b64"), "utf8"),
]);
const fixture = JSON.parse(decodeFixture(fixtureEncoded));
const invalidOutput = decodeFixture(invalidOutputEncoded);
const priorOccupied = occupiedGraphSciiCount(invalidOutput);
if (priorOccupied < 1) throw new Error("Invalid-output regression fixture contains no GraphSCII PUA cells.");

const rawGeometry = buildGeometryGrid(fixture.objects, fixture.columns, fixture.rows);
const fixtureObjectId = fixture.objects[0]?.id;
let rawTouched = 0;
for (const cell of rawGeometry.cells.values()) {
  const objectCell = fixtureObjectId ? cell.byObject.get(fixtureObjectId) : null;
  if (objectCell && (objectCell.segments.length > 0 || objectCell.ports.size > 0)) rawTouched += 1;
}
if (rawTouched < 1) throw new Error("Regression fixture authored geometry touched no GraphSCII cells.");

const solver = new GraphSolver(registry, fixture.columns, fixture.rows);
solver.solve(fixture.objects, { column: 0, row: 0, columns: fixture.columns, rows: fixture.rows });

if (solver.issueCount !== 0) {
  const details = solver.conversionIssues.slice(0, 12)
    .map((issue) => `(${issue.column},${issue.row}) ${issue.reason}`)
    .join("; ");
  throw new Error(`End-to-end failing-freehand fixture still has ${solver.issueCount} conversion issue(s): ${details}`);
}

let emitted = 0;
for (let row = 0; row < solver.rows; row += 1) {
  for (let column = 0; column < solver.columns; column += 1) {
    const codepoint = solver.codepointAt(column, row);
    if (codepoint === 0x20) continue;
    emitted += 1;
    const glyph = registry.byCodepoint.get(codepoint);
    if (!glyph) throw new Error(`Solver emitted unregistered codepoint U+${codepoint.toString(16).toUpperCase()}.`);
    if (glyph.canonicalClass !== "straight") {
      throw new Error(
        `Freehand-only regression fixture emitted non-straight glyph U+${codepoint.toString(16).toUpperCase()} (${glyph.canonicalClass}) at ${column},${row}.`,
      );
    }
  }
}
if (emitted !== rawTouched) {
  throw new Error(
    `Regression fixture emitted ${emitted} GraphSCII straight cells from ${rawTouched} authored-touched cells; `
    + `the supplied invalid export occupied ${priorOccupied} cells. Runtime fidelity requires exact authored-cell occupancy.`,
  );
}

const text = solver.toText();
if (!text.trim()) throw new Error("End-to-end fixture produced empty GraphSCII text.");
const exportedOccupied = occupiedGraphSciiCount(text);
if (exportedOccupied !== emitted) {
  throw new Error(`Text export contains ${exportedOccupied} GraphSCII cells but the solved grid contains ${emitted}.`);
}

console.log(
  `GraphSCII runtime engine verified end-to-end: actual registry + actual solver resolved the failing 379-point freehand `
  + `from ${rawTouched} authored-touched cells / ${priorOccupied} occupied invalid-export cells to exactly ${emitted} straight cells `
  + `with zero conversion issues, no fill/connector glyphs, and exact text-export occupancy.`,
);
