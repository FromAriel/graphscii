import assert from "node:assert/strict";
import {
  ALL_FAMILIES,
  bitmapKey,
  generate,
  generateStraightSolidFills,
} from "../dist/core/index.js";

const straight = generate(ALL_FAMILIES);
const fills = generateStraightSolidFills(straight);

assert.equal(straight.candidates.length, 832, "straight candidate baseline changed");
assert.equal(straight.glyphs.length, 746, "straight glyph baseline changed");

assert.deepEqual(fills.stats, {
  straightMathematicalDefinitions: 832,
  semanticFillCandidates: 1664,
  uniqueFillRasters: 1347,
  straightReuseCandidates: 100,
  straightReuseVisuals: 88,
  fillDuplicateCandidates: 305,
  newFillVisuals: 1259,
  combinedStraightAndFillVisuals: 2005,
});

const uniqueFillKeys = new Set(fills.candidates.map((candidate) => candidate.bitmapKey));
assert.equal(uniqueFillKeys.size, 1347, "unexpected unique fill raster count");

const fullBlockKey = "ff".repeat(16);
const firstFill = fills.candidates[0];
assert.equal(firstFill.aliasKey, "straight-fill:LR:L0>R0:sideA:solid");
assert.equal(firstFill.bitmapKey, fullBlockKey, "top boundary side A should produce full block");
assert.equal(firstFill.visualDisposition, "new-fill-unallocated");
assert.equal(firstFill.canonicalFillVisualId, 0);

const topStrokeReuse = fills.candidates[1];
assert.equal(topStrokeReuse.aliasKey, "straight-fill:LR:L0>R0:sideB:solid");
assert.equal(topStrokeReuse.visualDisposition, "reuse-existing-straight");
assert.equal(topStrokeReuse.canonicalGlyphId, 0);
assert.equal(topStrokeReuse.canonicalCodepoint, "U+00E000");

const bottomFullBlock = fills.candidates[511];
assert.equal(bottomFullBlock.bitmapKey, fullBlockKey);
assert.equal(bottomFullBlock.visualDisposition, "reuse-existing-fill");
assert.equal(bottomFullBlock.canonicalFillVisualId, 0);

for (const fill of fills.candidates) {
  const straightCandidate = straight.candidates[fill.straightCandidateId];
  assert.ok(straightCandidate, `missing straight candidate ${fill.straightCandidateId}`);
  for (let row = 0; row < straightCandidate.bitmap.length; row += 1) {
    assert.equal(
      straightCandidate.bitmap[row] & fill.bitmap[row],
      straightCandidate.bitmap[row],
      `fill ${fill.fillCandidateId} lost boundary pixels on row ${row}`,
    );
  }
  assert.equal(bitmapKey(fill.bitmap), fill.bitmapKey, `fill ${fill.fillCandidateId} bitmap key mismatch`);
}

const nonStraightAliasCount = fills.visuals.reduce((sum, visual) => sum + visual.aliasCount, 0);
assert.equal(
  nonStraightAliasCount,
  fills.stats.semanticFillCandidates - fills.stats.straightReuseCandidates,
  "fill visual alias accounting mismatch",
);

console.log("Straight solid fills verified.");
console.log(JSON.stringify(fills.stats, null, 2));
