import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyOrthogonalConnectorArtifacts } from "./orthogonal-connectors.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await verifyOrthogonalConnectorArtifacts(repoRoot);

assert.equal(stats.semanticCount, 640);
assert.equal(stats.uniqueRasterOwners, 548);
assert.equal(stats.junctionAllocations, 0);
assert.equal(stats.protectedReserveSlots, 604);
assert.equal(stats.fitsReserve, true);

console.log("GraphSCII Milestone 5B.1 orthogonal generic connector basis verified.");
console.log(JSON.stringify(stats, null, 2));
