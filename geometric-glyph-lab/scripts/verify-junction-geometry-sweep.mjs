import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyJunctionGeometryArtifacts } from "./junction-geometry-sweep.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const verified = await verifyJunctionGeometryArtifacts(repoRoot);

assert.equal(verified.schemaVersion, 2);
assert.equal(verified.demandedSemantics, 22428);
assert.equal(verified.theoreticalSemantics, 22528);
assert.equal(verified.workingGenericBudget, 600);
assert.equal(verified.protectedReserveSlots, 604);
assert.equal(verified.experimentalSlackSlots, 4);
assert.equal(verified.junctionAllocations, 0);
assert.equal(verified.boundarySafeIngress, true);
assert.deepEqual(verified.balancedQuotas, { LRT: 120, LRB: 120, LTB: 120, RTB: 120, LRTB: 120 });
assert.deepEqual(verified.proportionalQuotas, { LRT: 55, LRB: 55, LTB: 27, RTB: 27, LRTB: 436 });
assert.deepEqual(verified.hybridSeedQuotas, { LRT: 27, LRB: 27, LTB: 14, RTB: 14, LRTB: 218 });

const expectedModels = {
  "mathematical-demand-hub": { uniqueRasterBitmaps: 21705 },
  "symmetric-half-pixel-center": { uniqueRasterBitmaps: 21399 },
  "central-2x2-kernel": { uniqueRasterBitmaps: 21399 },
  "port-centroid-midpoint": { uniqueRasterBitmaps: 21911 },
};
for (const [name, expected] of Object.entries(expectedModels)) {
  const model = verified.modelSummary[name];
  assert.equal(model.validSemantics, 22428, `${name} valid semantics`);
  assert.equal(model.invalidSemantics, 0, `${name} invalid semantics`);
  assert.equal(model.weightedValidDemand, 928242, `${name} weighted valid demand`);
  assert.equal(model.weightedDemandCoveragePercent, 100, `${name} demand coverage`);
  assert.equal(model.uniqueRasterBitmaps, expected.uniqueRasterBitmaps, `${name} unique rasters`);
  assert.equal(model.exactGraphicsV0ReuseUniqueBitmaps, 0, `${name} graphics-v0 exact reuse`);
}

const expectedStrategies = {
  "demand-top-600": {
    topologyCounts: { LRT: 164, LRB: 164, LTB: 136, RTB: 134, LRTB: 2 },
    exactWeightedDemandCoveragePercent: 21.358223,
    uniqueCentroidRasters: 438,
    theoreticalAverageNearestPortDelta: 0.560884,
    theoreticalP95NearestPortDelta: 1,
    demandWeightedAverageNearestPortDelta: 0.18192,
  },
  "even-topology-balanced-600": {
    topologyCounts: { LRT: 120, LRB: 120, LTB: 120, RTB: 120, LRTB: 120 },
    exactWeightedDemandCoveragePercent: 15.088953,
    uniqueCentroidRasters: 467,
    theoreticalAverageNearestPortDelta: 0.204765,
    theoreticalP95NearestPortDelta: 0.4,
    demandWeightedAverageNearestPortDelta: 0.126919,
  },
  "even-space-proportional-600": {
    topologyCounts: { LRT: 55, LRB: 55, LTB: 27, RTB: 27, LRTB: 436 },
    exactWeightedDemandCoveragePercent: 7.981755,
    uniqueCentroidRasters: 552,
    theoreticalAverageNearestPortDelta: 0.163349,
    theoreticalP95NearestPortDelta: 0.285714,
    demandWeightedAverageNearestPortDelta: 0.174405,
  },
  "hybrid-even-demand-600": {
    topologyCounts: { LRT: 109, LRB: 110, LTB: 82, RTB: 81, LRTB: 218 },
    exactWeightedDemandCoveragePercent: 17.255414,
    uniqueCentroidRasters: 484,
    theoreticalAverageNearestPortDelta: 0.174906,
    theoreticalP95NearestPortDelta: 0.285714,
    demandWeightedAverageNearestPortDelta: 0.151839,
  },
};
for (const [name, expected] of Object.entries(expectedStrategies)) {
  const strategy = verified.strategySummary[name];
  assert.deepEqual(strategy.topologyCounts, expected.topologyCounts, `${name} topology counts`);
  assert.equal(strategy.exactWeightedDemandCoveragePercent, expected.exactWeightedDemandCoveragePercent, `${name} exact demand`);
  assert.equal(strategy.uniqueCentroidRasters, expected.uniqueCentroidRasters, `${name} unique centroid rasters`);
  assert.equal(strategy.novelCentroidRasterOwners, expected.uniqueCentroidRasters, `${name} novel centroid owners`);
  assert.equal(strategy.invalidCentroidRasters, 0, `${name} invalid centroid rasters`);
  assert.equal(strategy.theoreticalAverageNearestPortDelta, expected.theoreticalAverageNearestPortDelta, `${name} theoretical average distance`);
  assert.equal(strategy.theoreticalP95NearestPortDelta, expected.theoreticalP95NearestPortDelta, `${name} theoretical p95 distance`);
  assert.equal(strategy.demandWeightedAverageNearestPortDelta, expected.demandWeightedAverageNearestPortDelta, `${name} demand-weighted distance`);
}

console.log("GraphSCII Milestone 5A.2 geometry and generic lattice sweep verified.");
console.log(JSON.stringify(verified, null, 2));
