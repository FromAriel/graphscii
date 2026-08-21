import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(scriptDir, "..");
const solverPath = path.join(demoRoot, "src", "solver.ts");
const sourceText = await readFile(solverPath, "utf8");
const source = ts.createSourceFile(solverPath, sourceText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

let armCounterSource = null;
for (const statement of source.statements) {
  if (ts.isFunctionDeclaration(statement) && statement.name?.text === "junctionArmCountAtPoint") {
    armCounterSource = statement.getText(source);
    break;
  }
}

if (!armCounterSource) throw new Error("Solver topology contract is missing junctionArmCountAtPoint().");
if (!sourceText.includes("boundaryPoints.length >= 3 && semanticJunction")) {
  throw new Error("Connector selection is no longer gated by both 3+ boundary endpoints and an authored semantic junction.");
}
if (sourceText.includes("boundaryPoints.length >= 3 && topologyHasJunction(topology)")) {
  throw new Error("Connector permission regressed to raster-only junction detection.");
}
if (!sourceText.includes("if (fillTones.length > 0)")) {
  throw new Error("Fill-first semantic gating is missing from solveCell().");
}
if (!sourceText.includes("fillCandidatesForBoundaryPoints(boundaryPoints, tone)")) {
  throw new Error("Boundary fill selection is no longer using the canonical boundary/side/style rule path.");
}

const compiled = ts.transpileModule(`${armCounterSource}\nexport { junctionArmCountAtPoint };`, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`;
const { junctionArmCountAtPoint } = await import(moduleUrl);

function expect(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}.`);
}

const horizontal = { a: { x: 0, y: 8 }, b: { x: 7, y: 8 } };
expect(
  "ordinary straight line has two arms",
  junctionArmCountAtPoint({ x: 3.5, y: 8 }, [horizontal]),
  2,
);

const vHub = { x: 3, y: 0 };
const vPath = [
  { a: { x: 0, y: 8 }, b: vHub },
  { a: vHub, b: { x: 7, y: 8 } },
];
expect(
  "one continuous V touching three cell edges still has only two arms",
  junctionArmCountAtPoint(vHub, vPath),
  2,
);

const cornerHub = { x: 3, y: 8 };
const corner = [
  { a: { x: 0, y: 8 }, b: cornerHub },
  { a: cornerHub, b: { x: 3, y: 15 } },
];
expect(
  "ordinary corner has two arms",
  junctionArmCountAtPoint(cornerHub, corner),
  2,
);

const tHub = { x: 3, y: 8 };
const tJunction = [
  { a: { x: 0, y: 8 }, b: { x: 7, y: 8 } },
  { a: { x: 3, y: 0 }, b: tHub },
];
expect(
  "T junction has three arms",
  junctionArmCountAtPoint(tHub, tJunction),
  3,
);

const xHub = { x: 3.5, y: 7.5 };
const xJunction = [
  { a: { x: 0, y: 0 }, b: { x: 7, y: 15 } },
  { a: { x: 7, y: 0 }, b: { x: 0, y: 15 } },
];
expect(
  "X crossing has four arms",
  junctionArmCountAtPoint(xHub, xJunction),
  4,
);

const threeEndpointsHub = { x: 4, y: 8 };
const threeEndpoints = [
  { a: threeEndpointsHub, b: { x: 4, y: 0 } },
  { a: threeEndpointsHub, b: { x: 0, y: 8 } },
  { a: threeEndpointsHub, b: { x: 7, y: 8 } },
];
expect(
  "three authored endpoints meeting at a hub have three arms",
  junctionArmCountAtPoint(threeEndpointsHub, threeEndpoints),
  3,
);

console.log(
  "GraphSCII solver topology contract verified: fill grammar gates first; V/corner stay two-arm; T/three-endpoint/X junctions qualify as 3/3/4 arms.",
);
