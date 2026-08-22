import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { verifySpecialsLightInteriorArtifacts } from "./specials-light-interior.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await verifySpecialsLightInteriorArtifacts(repoRoot);

assert.equal(stats.encodedOwners, 6398);
assert.equal(stats.lastAllocatedCodepoint, "U+00F8FD");
assert.equal(stats.reserveSlots, 2);
assert.equal(stats.reserveStart, "U+00F8FE");
assert.equal(stats.special.glyphId, 6397);
assert.equal(stats.special.codepoint, "U+F8FD");
assert.equal(stats.classCounts["light-25"], 1316);

console.log("GraphSCII specials-light-interior v1.1 verified.");
console.log(JSON.stringify(stats, null, 2));
