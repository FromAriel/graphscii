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
assert.equal(verified.theoreticalReferenceSemantics, 22528);
assert.equal(verified.junctionAllocations, 0);
assert.equal(verified.reserveSlots, 604);

console.log("GraphSCII Milestone 5A.1 junction demand map verified.");
console.log(JSON.stringify(verified, null, 2));
