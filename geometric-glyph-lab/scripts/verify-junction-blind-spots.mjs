import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyJunctionBlindSpots } from "./junction-blind-spots.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const verified = await verifyJunctionBlindSpots(repoRoot);

assert.equal(verified.theoreticalSemanticCount, 22528);
assert.equal(verified.demandedSemanticCount, 22428);
assert.equal(verified.missingSemanticCount, 100);
assert.deepEqual(verified.missingByTopology, { LRT: 0, LRB: 0, LTB: 0, RTB: 0, LRTB: 100 });

console.log("GraphSCII Milestone 5A.1 junction blind spots verified.");
console.log(JSON.stringify(verified, null, 2));
