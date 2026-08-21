import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyShardedJunctionCandidateArtifacts } from "./junction-candidate-storage.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const verified = await verifyShardedJunctionCandidateArtifacts(repoRoot);

assert.equal(verified.semanticUniverse, 22528);
assert.equal(verified.demandedSemantics, 22428);
assert.equal(verified.blindSpotSemantics, 100);
assert.equal(verified.totalWeightedDemand, 928242);
assert.equal(verified.modelCount, 4);
assert.equal(verified.candidateCount, 90112);
assert.equal(verified.validCandidateCount, 90112);
assert.equal(verified.invalidCandidateCount, 0);
assert.equal(verified.uniqueRasterOwners, 82377);
assert.equal(verified.graphicsV0ReuseOwners, 0);
assert.equal(verified.novelJunctionOwners, 82377);
assert.equal(verified.multiSemanticOwnerCount, 1773);
assert.equal(verified.multiModelOwnerCount, 4187);
assert.equal(verified.maximumSemanticAliasesPerOwner, 7);
assert.equal(verified.maximumCandidateAliasesPerOwner, 14);
assert.equal(verified.summedOwnerDemandMultiplicity, 3502010);
assert.deepEqual(verified.byModel, {
  "mathematical-demand-hub": { candidates: 22528, uniqueRasters: 21805, graphicsV0ReuseOwners: 0 },
  "symmetric-half-pixel-center": { candidates: 22528, uniqueRasters: 21499, graphicsV0ReuseOwners: 0 },
  "central-2x2-kernel": { candidates: 22528, uniqueRasters: 21499, graphicsV0ReuseOwners: 0 },
  "port-centroid-midpoint": { candidates: 22528, uniqueRasters: 22011, graphicsV0ReuseOwners: 0 },
});
assert.deepEqual(verified.strategyOwnerCoverage, {
  "demand-top-600": { selectedSemantics: 600, visualOwners: 1558, novelVisualOwners: 1558, graphicsV0ReuseOwners: 0 },
  "even-topology-balanced-600": { selectedSemantics: 600, visualOwners: 1552, novelVisualOwners: 1552, graphicsV0ReuseOwners: 0 },
  "even-space-proportional-600": { selectedSemantics: 600, visualOwners: 1813, novelVisualOwners: 1813, graphicsV0ReuseOwners: 0 },
  "hybrid-even-demand-600": { selectedSemantics: 600, visualOwners: 1619, novelVisualOwners: 1619, graphicsV0ReuseOwners: 0 },
});
assert.equal(verified.storage.candidateShardCount, 4);
assert.equal(verified.storage.candidateShardCandidateTotal, 90112);
assert.equal(verified.storage.ownerShardCount, 16);
assert.equal(verified.storage.ownerShardOwnerTotal, 82377);
assert.equal(verified.junctionAllocations, 0);
assert.equal(verified.protectedReserveSlots, 604);

console.log("GraphSCII Milestone 5A.3 exhaustive junction candidate dedup verified.");
console.log(JSON.stringify(verified, null, 2));
