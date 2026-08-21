import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyJunctionGeometryArtifacts } from "./junction-geometry-sweep.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const verified = await verifyJunctionGeometryArtifacts(repoRoot);

assert.equal(verified.demandedSemantics, 22428);
assert.equal(verified.theoreticalSemantics, 22528);
assert.equal(verified.workingGenericBudget, 600);
assert.equal(verified.protectedReserveSlots, 604);
assert.equal(verified.experimentalSlackSlots, 4);
assert.equal(verified.junctionAllocations, 0);
assert.deepEqual(verified.balancedQuotas, { LRT: 120, LRB: 120, LTB: 120, RTB: 120, LRTB: 120 });
assert.deepEqual(verified.proportionalQuotas, { LRT: 55, LRB: 55, LTB: 27, RTB: 27, LRTB: 436 });

console.log("GraphSCII Milestone 5A.2 geometry and generic lattice sweep verified.");
console.log(JSON.stringify(verified, null, 2));
