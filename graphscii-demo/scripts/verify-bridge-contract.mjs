import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(scriptDir, "..");
const sourcePath = path.join(demoRoot, "src", "bridge-solver.ts");
const sourceText = await readFile(sourcePath, "utf8");
const source = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

const requiredVariables = new Set(["CELL_WIDTH", "CELL_HEIGHT", "EPSILON", "CORNER_EPSILON"]);
const requiredFunctions = new Set(["clampInteger", "nearGridBoundary", "addHint", "addSegmentBridgeHints"]);
const extracted = [];
const foundVariables = new Set();
const foundFunctions = new Set();

for (const statement of source.statements) {
  if (ts.isVariableStatement(statement)) {
    const names = statement.declarationList.declarations
      .map((declaration) => ts.isIdentifier(declaration.name) ? declaration.name.text : null)
      .filter(Boolean);
    if (names.some((name) => requiredVariables.has(name))) {
      extracted.push(statement.getText(source));
      for (const name of names) if (requiredVariables.has(name)) foundVariables.add(name);
    }
  }
  if (ts.isFunctionDeclaration(statement) && statement.name && requiredFunctions.has(statement.name.text)) {
    extracted.push(statement.getText(source));
    foundFunctions.add(statement.name.text);
  }
}

for (const name of requiredVariables) {
  if (!foundVariables.has(name)) throw new Error(`Bridge contract is missing ${name}.`);
}
for (const name of requiredFunctions) {
  if (!foundFunctions.has(name)) throw new Error(`Bridge contract is missing ${name}().`);
}
if (!sourceText.includes("extends GraphSolver") || !sourceText.includes("super.solve(objects, cellRect)")) {
  throw new Error("BridgeGraphSolver no longer wraps the semantic GraphSolver.");
}
if (!sourceText.includes("current.canonicalClass !== \"straight\"")) {
  throw new Error("Bridge repair is no longer restricted to blank/straight cells.");
}
if (!sourceText.includes("straightCandidatesForBoundaryPoints(points)")) {
  throw new Error("Bridge repair no longer resolves through the published straight connection table.");
}

const compiled = ts.transpileModule(
  `${extracted.join("\n\n")}\nexport { addSegmentBridgeHints };`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } },
).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`;
const { addSegmentBridgeHints } = await import(moduleUrl);

function pointsAt(map, key) {
  return [...(map.get(key)?.values() ?? [])].sort((a, b) => a.y - b.y || a.x - b.x);
}
function expectPoint(label, actual, expected) {
  if (!actual || actual.x !== expected.x || actual.y !== expected.y) {
    throw new Error(`${label}: expected (${expected.x},${expected.y}), received ${actual ? `(${actual.x},${actual.y})` : "none"}.`);
  }
}

// Vertical seam: the continuous crossing is y=7.6, so both cells must use port 8.
{
  const map = new Map();
  addSegmentBridgeHints(map, { a: { x: 4, y: 6.8 }, b: { x: 12, y: 8.4 } }, 4, 4);
  expectPoint("left side of vertical bridge", pointsAt(map, 0)[0], { x: 7, y: 8 });
  expectPoint("right side of vertical bridge", pointsAt(map, 1)[0], { x: 0, y: 8 });
}

// The same segment drawn in reverse must produce the identical canonical ports.
{
  const map = new Map();
  addSegmentBridgeHints(map, { a: { x: 12, y: 8.4 }, b: { x: 4, y: 6.8 } }, 4, 4);
  expectPoint("reverse left vertical bridge", pointsAt(map, 0)[0], { x: 7, y: 8 });
  expectPoint("reverse right vertical bridge", pointsAt(map, 1)[0], { x: 0, y: 8 });
}

// Horizontal seam: crossing x=4.6 is rounded once to port 5 and shared B5/T5.
{
  const map = new Map();
  addSegmentBridgeHints(map, { a: { x: 3.2, y: 12 }, b: { x: 6, y: 20 } }, 4, 4);
  expectPoint("top side of horizontal bridge", pointsAt(map, 0)[0], { x: 5, y: 15 });
  expectPoint("bottom side of horizontal bridge", pointsAt(map, 4)[0], { x: 5, y: 0 });
}

// Exact four-cell corners are intentionally not guessed by the two-cell bridge heuristic.
{
  const map = new Map();
  addSegmentBridgeHints(map, { a: { x: 4, y: 12 }, b: { x: 12, y: 20 } }, 4, 4);
  if (map.size !== 0) throw new Error("Exact grid-corner crossing must be left to the semantic topology solver.");
}

console.log("GraphSCII line bridge contract verified: shared seams use one canonical port on both cells; direction does not change the result.");
