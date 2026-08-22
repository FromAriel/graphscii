import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyCrossoverResolutionArtifacts } from "./crossover-resolution.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const verified = await verifyCrossoverResolutionArtifacts(repoRoot);

assert.equal(verified.inputs.straightDefinitions, 832);
assert.equal(verified.inputs.straightVisualOwners, 746);
assert.equal(verified.inputs.publishedOwners, 6397);
assert.equal(verified.inputs.typedCandidates, 1347);
assert.equal(verified.inputs.typedStraightOwners, 746);
assert.equal(verified.inputs.typedConnectorOwners, 601);
assert.equal(verified.measuredPairStates, 345696);

assert.equal(verified.tier0ExactStates, 2177);
assert.equal(verified.tier1ApproximateStates, 343519);
assert.equal(verified.winnerClasses.tier0Straight, 1700);
assert.equal(verified.winnerClasses.tier0Connector, 477);
assert.equal(verified.winnerClasses.tier1StraightWinner, 201321);
assert.equal(verified.winnerClasses.tier1ConnectorWinner, 142198);
assert.equal(
  verified.tier0ExactStates + verified.tier1ApproximateStates,
  verified.measuredPairStates,
);

assert.equal(verified.fullLegRetentionStates, 41521);
assert.deepEqual(verified.missedPortHistogram, {
  0: 41521,
  1: 174349,
  2: 127649,
  3: 0,
  4: 0,
});

assert.equal(verified.allocations, 0);
assert.equal(verified.protectedReserveSlots, 3);

console.log("GraphSCII Milestone 10A.1/10A.2 crossover resolution verified.");
console.log(JSON.stringify(verified, null, 2));
