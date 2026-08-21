import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyDiagonalSelectionArtifacts } from "./diagonal-selection.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const selection = await verifyDiagonalSelectionArtifacts(repoRoot);

assert.equal(selection.selectedSemanticCount, 60);
assert.equal(selection.orthogonalNovelOwners, 544);
assert.ok(selection.selectedIncrementalNovelOwners <= 60);
assert.ok(selection.finalReserveRemaining >= 0);

console.log("GraphSCII final deterministic diagonal connector selection verified.");
console.log(JSON.stringify(selection, null, 2));
