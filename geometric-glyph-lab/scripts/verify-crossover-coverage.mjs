import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyCrossoverCoverageArtifacts } from "./crossover-coverage.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const verified = await verifyCrossoverCoverageArtifacts(repoRoot);

assert.equal(verified.inputs.straightDefinitions, 832);
assert.equal(verified.inputs.straightVisualOwners, 746);
assert.equal(verified.inputs.publishedOwners, 6398);
assert.equal(verified.inputs.publishedByBitmapSha256, "1ebaead7a86c9c4b9b9ade4ab83482d95ffd68b66ba2b52910e3b49ffb29413b");

assert.equal(verified.measuredPairStates, 345696);
assert.equal(verified.tier0ExactOwnerStates, 2177);
assert.equal(verified.tier0StraightOwnerStates, 1700);
assert.equal(verified.tier0ConnectorOwnerStates, 477);
assert.equal(verified.fillClassCollisionStates, 642);
assert.equal(verified.unresolvedPairStates, 342877);
assert.equal(verified.tier0CoveragePercent, 0.629744);
assert.equal(verified.subsetUnionPairs, 1348);
assert.equal(verified.distinctUnresolvedBitmaps, 267771);
assert.equal(verified.distinctFillCollisionBitmaps, 119);

assert.deepEqual(
  Object.fromEntries(verified.byFamilyClass.map((entry) => [entry.key, entry.pairStates])),
  { "axis+axis": 51040, "axis+diagonal": 163840, "diagonal+diagonal": 130816 },
);
assert.deepEqual(
  Object.fromEntries(verified.byFamilyClass.map((entry) => [entry.key, entry.unresolved])),
  { "axis+axis": 50860, "axis+diagonal": 163064, "diagonal+diagonal": 128953 },
);
assert.equal(verified.byFamilyClass.reduce((sum, entry) => sum + entry.pairStates, 0), verified.measuredPairStates);
assert.equal(verified.byDesiredEdges.reduce((sum, entry) => sum + entry.pairStates, 0), verified.measuredPairStates);
assert.equal(verified.byDesiredPortCount.reduce((sum, entry) => sum + entry.pairStates, 0), verified.measuredPairStates);
assert.equal(verified.allocations, 0);
assert.equal(verified.protectedReserveSlots, 3);

console.log("GraphSCII Milestone 10A.0 crossover coverage verified.");
console.log(JSON.stringify(verified, null, 2));
