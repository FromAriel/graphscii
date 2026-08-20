import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyJunctionDemandArtifacts } from "./junction-demand.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const verified = await verifyJunctionDemandArtifacts(repoRoot);

assert.equal(verified.straightSemanticDefinitions, 832);
assert.equal(verified.straightVisualOwners, 746);
assert.equal(verified.totalPossiblePairs, 345696);
assert.equal(verified.interiorIntersectingPairs, 129550);
assert.equal(verified.exactHubCount, 70707);
assert.equal(verified.pairSourcesWithDemand, 105546);
assert.equal(verified.pairDemandEvents, 257082);
assert.equal(verified.tripleCombinationsConsidered, 92190);
assert.equal(verified.tripleSourcesWithDemand, 81310);
assert.equal(verified.tripleDemandEvents, 671160);
assert.equal(verified.uniqueDemandSemantics, 22428);
assert.equal(verified.totalDemandMultiplicity, 928242);
assert.equal(verified.theoreticalReferenceSemantics, 22528);
assert.equal(verified.theoreticalSemanticCoveragePercent, 99.556108);
assert.equal(verified.centerHubDemand, 35982);
assert.equal(verified.centerHubDemandSharePercent, 3.87636);
assert.equal(verified.junctionAllocations, 0);
assert.equal(verified.reserveSlots, 604);
assert.deepEqual(verified.topologies, {
  LRT: { semanticCount: 2048, weightedDemand: 263632 },
  LRB: { semanticCount: 2048, weightedDemand: 263632 },
  LTB: { semanticCount: 1024, weightedDemand: 141488 },
  RTB: { semanticCount: 1024, weightedDemand: 141488 },
  LRTB: { semanticCount: 16284, weightedDemand: 118002 },
});

console.log("GraphSCII Milestone 5A.1 junction demand map verified.");
console.log(JSON.stringify(verified, null, 2));
