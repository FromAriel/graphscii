import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyConnectorAllocationArtifacts } from "./connector-allocation.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await verifyConnectorAllocationArtifacts(repoRoot);

assert.equal(stats.baseOwners, 5796);
assert.equal(stats.orthogonalNovelOwners, 544);
assert.equal(stats.diagonalNovelOwners, 57);
assert.equal(stats.connectorOwners, 601);
assert.equal(stats.totalOwners, 6397);
assert.equal(stats.connectorSemanticAliases, 700);
assert.equal(stats.connectorStart, "U+00F6A4");
assert.equal(stats.connectorEnd, "U+00F8FC");
assert.equal(stats.reserveStart, "U+00F8FD");
assert.equal(stats.reserveEnd, "U+00F8FF");
assert.equal(stats.reserveSlots, 3);

console.log("GraphSCII Milestone 5C connector allocation verified.");
console.log(JSON.stringify(stats, null, 2));
