import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyJunctionCandidateArtifacts } from "./junction-candidates.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const verified = await verifyJunctionCandidateArtifacts(repoRoot);

assert.equal(verified.semanticUniverse, 22528);
assert.equal(verified.demandedSemantics, 22428);
assert.equal(verified.blindSpotSemantics, 100);
assert.equal(verified.modelCount, 4);
assert.equal(verified.candidateCount, 90112);
assert.equal(verified.validCandidateCount, 90112);
assert.equal(verified.invalidCandidateCount, 0);
assert.equal(verified.junctionAllocations, 0);
assert.equal(verified.protectedReserveSlots, 604);

console.log("GraphSCII Milestone 5A.3 exhaustive junction candidate dedup verified.");
console.log(JSON.stringify(verified, null, 2));
