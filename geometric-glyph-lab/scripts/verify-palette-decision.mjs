import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPaletteDecisionArtifacts } from "./palette-decision.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const verified = await verifyPaletteDecisionArtifacts(repoRoot);

assert.deepEqual(verified.encodedStyles, ["solid", "medium", "half", "light"]);
assert.deepEqual(verified.rendererOnlyStyles, ["dense", "sparse"]);
assert.equal(verified.exactUncompressedVisuals, 5858);
assert.equal(verified.demotedHalfVisuals, 62);
assert.equal(verified.allocatedVisuals, 5796);
assert.equal(verified.puaReserve, 604);
assert.equal(verified.candidatePalettes, 20);
assert.equal(verified.allocationStatus, "decision-complete-unallocated");

console.log("GraphSCII Milestone 4C palette decision verified.");
console.log(JSON.stringify(verified, null, 2));
