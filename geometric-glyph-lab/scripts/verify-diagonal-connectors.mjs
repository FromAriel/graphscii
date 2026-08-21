import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyDiagonalConnectorArtifacts } from "./diagonal-connectors.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await verifyDiagonalConnectorArtifacts(repoRoot);

assert.equal(stats.reasonedXRules, 24);
assert.equal(stats.semanticCount, 120);
assert.equal(stats.invalidSemanticCount, 0);
assert.equal(stats.junctionAllocations, 0);
assert.equal(stats.remainingBudgetAfterOrthogonal, 60);

console.log("GraphSCII Milestone 5B.2 deterministic diagonal connector swatch verified.");
console.log(JSON.stringify(stats, null, 2));
