import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(scriptDir, "..");
const solverPath = path.join(demoRoot, "src", "solver.ts");
const sourceText = await readFile(solverPath, "utf8");
const source = ts.createSourceFile(solverPath, sourceText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

const requiredVariables = new Set(["CELL_WIDTH", "CELL_HEIGHT", "JUNCTION_THRESHOLD", "JUNCTION_RING"]);
const extracted = [];
let foundFunction = false;

for (const statement of source.statements) {
  if (ts.isVariableStatement(statement)) {
    const names = statement.declarationList.declarations
      .map((declaration) => ts.isIdentifier(declaration.name) ? declaration.name.text : null)
      .filter(Boolean);
    if (names.some((name) => requiredVariables.has(name))) extracted.push(statement.getText(source));
  }
  if (ts.isFunctionDeclaration(statement) && statement.name?.text === "topologyHasJunction") {
    extracted.push(statement.getText(source));
    foundFunction = true;
  }
}

for (const name of requiredVariables) {
  if (!extracted.some((text) => text.includes(name))) throw new Error(`Solver topology contract is missing ${name}.`);
}
if (!foundFunction) throw new Error("Solver topology contract is missing topologyHasJunction().");
if (!sourceText.includes("boundaryPoints.length >= 3 && topologyHasJunction(topology)")) {
  throw new Error("Connector selection is no longer gated by both 3+ endpoints and a real centerline junction.");
}
if (!sourceText.includes("if (fillTones.length > 0)")) {
  throw new Error("Fill-first semantic gating is missing from solveCell().");
}

const compiled = ts.transpileModule(`${extracted.join("\n\n")}\nexport { topologyHasJunction };`, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`;
const { topologyHasJunction } = await import(moduleUrl);

const WIDTH = 8;
const HEIGHT = 16;
function blank() {
  return new Float32Array(WIDTH * HEIGHT);
}
function setPixel(grid, x, y) {
  if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) grid[y * WIDTH + x] = 1;
}
function line(grid, x0, y0, x1, y1) {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    setPixel(grid, x, y);
    if (x === x1 && y === y1) break;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
  }
}
function expect(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}.`);
}

const straight = blank();
line(straight, 0, 8, 7, 8);
expect("ordinary straight line is not a connector", topologyHasJunction(straight), false);

const bentThreeEdgePath = blank();
line(bentThreeEdgePath, 0, 8, 3, 0);
line(bentThreeEdgePath, 3, 0, 7, 8);
expect("one continuous path touching three edges is not a connector", topologyHasJunction(bentThreeEdgePath), false);

const tJunction = blank();
line(tJunction, 0, 8, 7, 8);
line(tJunction, 3, 0, 3, 8);
expect("real three-arm T junction is a connector", topologyHasJunction(tJunction), true);

const corner = blank();
line(corner, 0, 8, 3, 8);
line(corner, 3, 8, 3, 15);
expect("ordinary two-arm corner is not a connector", topologyHasJunction(corner), false);

console.log("GraphSCII solver topology contract verified: fills gate first; non-branching paths reject connectors; real 3-arm junctions qualify.");
