import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(demoRoot, "..");
const geometryPath = path.join(demoRoot, "src", "geometry-engine.ts");
const connectorTopologyPath = path.join(demoRoot, "src", "connector-topology.ts");
const solverPath = path.join(demoRoot, "src", "solver.ts");
const registryPath = path.join(demoRoot, "src", "semantic-registry.ts");
const syncPath = path.join(demoRoot, "scripts", "sync-assets.mjs");
const fixturePath = path.join(demoRoot, "fixtures", "regressions", "failing-freehand.graphscii.gz.b64");
const invalidOutputPath = path.join(demoRoot, "fixtures", "regressions", "failing-freehand-invalid-output.txt.gz.b64");
const pairPath = path.join(repoRoot, "artifacts", "manifest", "indexes", "by-connection-pair.json");

function decodeFixture(encoded) {
  return gunzipSync(Buffer.from(encoded.trim(), "base64")).toString("utf8");
}

const [geometrySource, connectorTopologySource, solverSource, registrySource, syncSource, fixtureEncoded, invalidOutputEncoded, pairIndex] = await Promise.all([
  readFile(geometryPath, "utf8"),
  readFile(connectorTopologyPath, "utf8"),
  readFile(solverPath, "utf8"),
  readFile(registryPath, "utf8"),
  readFile(syncPath, "utf8"),
  readFile(fixturePath, "utf8"),
  readFile(invalidOutputPath, "utf8"),
  readFile(pairPath, "utf8").then(JSON.parse),
]);
const fixture = JSON.parse(decodeFixture(fixtureEncoded));
const invalidOutput = decodeFixture(invalidOutputEncoded);

for (const forbidden of [
  "scoreCandidates",
  "straightCandidatesNearPixelCount",
  "fillCandidatesNearPixelCount",
  "CONTINUITY_WEIGHT",
  "boundaryMismatch",
  "coverageError",
  "Rasterizer",
]) {
  if (solverSource.includes(forbidden)) throw new Error(`Exact solver contains forbidden heuristic path: ${forbidden}.`);
}
for (const required of ["buildGeometryGrid", "validateSharedPorts", "resolveStraight", "resolveFillForInterior", "resolveConnector", "junctionTopology"]) {
  if (!solverSource.includes(required)) throw new Error(`Exact solver is missing required semantic path: ${required}.`);
}
if (!registrySource.includes("connectorsBySignature") || !registrySource.includes("rule.family === family")) {
  throw new Error("Connector registry is not preserving same-port semantic aliases by connector family.");
}
if (registrySource.includes("Connector signature ${signature} is ambiguous")) {
  throw new Error("Connector registry regressed to rejecting valid cross-family signature aliases at startup.");
}
const fillMethodStart = registrySource.indexOf("resolveFillForInterior(");
const fillMethodEnd = registrySource.indexOf("resolveFullFill(", fillMethodStart);
if (fillMethodStart < 0 || fillMethodEnd < 0) throw new Error("Registry exact fill resolver is missing.");
const fillMethod = registrySource.slice(fillMethodStart, fillMethodEnd);
if (fillMethod.includes("fallbackGlyphId") || fillMethod.includes("fallbackCodepoint")) {
  throw new Error("Exact fill resolver must not use renderer-only fallback glyphs.");
}
if (syncSource.includes("fill-rules.json")) {
  throw new Error("Runtime asset sync still derives an approximation-bearing fill-rules table.");
}
if (!syncSource.includes("by-boundary-side-style.json") || !syncSource.includes("by-alias.json")) {
  throw new Error("Runtime asset sync is not copying the canonical fill semantic indexes directly.");
}

function compileModule(sourceText, label) {
  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  if (/from\s+["']\.\/(types|geometry-engine)["']/u.test(compiled)) {
    throw new Error(`${label} runtime unexpectedly retained a type-only local import.`);
  }
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

const geometry = await compileModule(geometrySource, "geometry-engine");
const connectorTopology = await compileModule(connectorTopologySource, "connector-topology");
const { buildGeometryGrid, validateSharedPorts, maxJunctionArms } = geometry;
const { junctionTopology } = connectorTopology;

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function cellSignature(grid) {
  return [...grid.cells.entries()]
    .map(([key, cell]) => [key, [...cell.ports].sort().join("|")])
    .filter(([, ports]) => ports.length > 0)
    .sort((a, b) => a[0] - b[0]);
}

const forwardLine = { id: "line", type: "line", start: { x: 1.25, y: 5.5 }, end: { x: 55.75, y: 35.25 }, width: 9, tone: 25 };
const reverseLine = { ...forwardLine, start: forwardLine.end, end: forwardLine.start };
const forwardGrid = buildGeometryGrid([forwardLine], 16, 8);
const reverseGrid = buildGeometryGrid([reverseLine], 16, 8);
expect(validateSharedPorts(forwardGrid, 16, 8).length === 0, "Forward line produced an impossible shared seam mismatch.");
expect(validateSharedPorts(reverseGrid, 16, 8).length === 0, "Reverse line produced an impossible shared seam mismatch.");
expect(JSON.stringify(cellSignature(forwardGrid)) === JSON.stringify(cellSignature(reverseGrid)), "Reversing one line changed its GraphSCII port semantics.");

const tSegments = [
  { a: { x: 0, y: 8 }, b: { x: 7, y: 8 }, objectId: "a", objectType: "line" },
  { a: { x: 3, y: 0 }, b: { x: 3, y: 8 }, objectId: "b", objectType: "line" },
];
const xSegments = [
  { a: { x: 0, y: 0 }, b: { x: 7, y: 15 }, objectId: "a", objectType: "line" },
  { a: { x: 7, y: 0 }, b: { x: 0, y: 15 }, objectId: "b", objectType: "line" },
];
expect(maxJunctionArms(tSegments) === 3, "Authored T junction did not classify as three arms.");
expect(maxJunctionArms(xSegments) === 4, "Authored X junction did not classify as four arms.");
expect(junctionTopology(tSegments)?.family === "orthogonal", "Authored T junction did not resolve to the orthogonal connector family.");
expect(junctionTopology(xSegments)?.family === "diagonal", "Authored X junction did not resolve to the diagonal connector family.");

expect(fixture?.format === "GraphSCII-Drawing" && fixture?.objects?.length === 1 && fixture.objects[0]?.type === "freehand", "Regression fixture is not the supplied failing freehand drawing.");
expect(fixture.columns === 64 && fixture.rows === 32, "Regression fixture dimensions changed.");
expect(fixture.objects[0].points?.length === 379 && fixture.objects[0].width === 2 && fixture.objects[0].tone === 100, "Regression fixture source geometry changed.");
expect(invalidOutput.length > 1000 && [...invalidOutput].some((character) => character.codePointAt(0) >= 0xe000), "Invalid-output regression fixture is missing its GraphSCII PUA text.");

const fixtureGrid = buildGeometryGrid(fixture.objects, fixture.columns, fixture.rows);
const fixtureSeams = validateSharedPorts(fixtureGrid, fixture.columns, fixture.rows);
expect(fixtureSeams.length === 0, `Supplied failing drawing still has a constructed seam mismatch: ${fixtureSeams[0] ?? "unknown"}.`);
let checkedStraightCells = 0;
for (const cell of fixtureGrid.cells.values()) {
  const ports = [...cell.ports].sort();
  if (maxJunctionArms(cell.segments) >= 3 || ports.length !== 2) continue;
  checkedStraightCells += 1;
  if (!pairIndex.entries?.[`${ports[0]}>${ports[1]}`] && !pairIndex.entries?.[`${ports[1]}>${ports[0]}`]) {
    throw new Error(`Regression fixture produced a two-port cell outside the published straight table: ${ports.join(" ↔ ")}.`);
  }
}
expect(checkedStraightCells >= 250, `Regression fixture exercised only ${checkedStraightCells} exact two-port cells; expected a substantial straight-path corpus.`);

console.log(
  `GraphSCII exact semantic engine verified: shared seams are single events; reverse geometry is invariant; `
  + `T/X classify as orthogonal/diagonal 3/4-arm junctions; failing freehand fixture exercises ${checkedStraightCells} `
  + `published two-port cells with zero seam mismatches.`,
);
