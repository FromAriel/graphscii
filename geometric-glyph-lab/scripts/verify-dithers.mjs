import assert from "node:assert/strict";
import {
  ALL_FAMILIES,
  STRAIGHT_FILL_STYLE_DEFINITIONS,
  STRAIGHT_FILL_STYLE_ORDER,
  bitmapKey,
  ditherMaskHasPixel,
  generate,
  generateStraightDitherSweep,
  generateStraightSolidFills,
} from "../dist/core/index.js";

const straight = generate(ALL_FAMILIES);
const solid = generateStraightSolidFills(straight);
const sweep = generateStraightDitherSweep(straight, solid);

assert.equal(straight.candidates.length, 832, "straight candidate baseline changed");
assert.equal(straight.glyphs.length, 746, "straight glyph baseline changed");
assert.equal(solid.candidates.length, 1664, "solid semantic baseline changed");
assert.equal(solid.visuals.length, 1259, "solid visual baseline changed");

assert.deepEqual(
  {
    straightMathematicalDefinitions: sweep.stats.straightMathematicalDefinitions,
    sideSemantics: sweep.stats.sideSemantics,
    fillStyles: sweep.stats.fillStyles,
    styledSemanticCandidates: sweep.stats.styledSemanticCandidates,
    uniqueStyledRasters: sweep.stats.uniqueStyledRasters,
    publishedStraightVisuals: sweep.stats.publishedStraightVisuals,
    straightVisualsReusedAcrossStyles: sweep.stats.straightVisualsReusedAcrossStyles,
    novelSolidVisuals: sweep.stats.novelSolidVisuals,
    novelDitherVisuals: sweep.stats.novelDitherVisuals,
    combinedStraightSolidAndDitherVisuals: sweep.stats.combinedStraightSolidAndDitherVisuals,
    ditherSemanticCandidates: sweep.stats.ditherSemanticCandidates,
    ditherStraightReuseCandidates: sweep.stats.ditherStraightReuseCandidates,
    ditherSolidReuseCandidates: sweep.stats.ditherSolidReuseCandidates,
    ditherSameStyleDuplicateCandidates: sweep.stats.ditherSameStyleDuplicateCandidates,
    ditherCrossStyleReuseCandidates: sweep.stats.ditherCrossStyleReuseCandidates,
  },
  {
    straightMathematicalDefinitions: 832,
    sideSemantics: 1664,
    fillStyles: 5,
    styledSemanticCandidates: 8320,
    uniqueStyledRasters: 6500,
    publishedStraightVisuals: 746,
    straightVisualsReusedAcrossStyles: 164,
    novelSolidVisuals: 1259,
    novelDitherVisuals: 5077,
    combinedStraightSolidAndDitherVisuals: 7082,
    ditherSemanticCandidates: 6656,
    ditherStraightReuseCandidates: 539,
    ditherSolidReuseCandidates: 139,
    ditherSameStyleDuplicateCandidates: 840,
    ditherCrossStyleReuseCandidates: 61,
  },
  "Milestone 4B global regression counts changed",
);

const expectedStyles = {
  solid: {
    maskOnCells: 64,
    semanticCandidates: 1664,
    uniqueRasters: 1347,
    straightReuseCandidates: 100,
    straightReuseVisuals: 88,
    solidReuseCandidates: 0,
    solidReuseVisuals: 0,
    sameStyleDuplicateCandidates: 305,
    priorDitherStyleReuseCandidates: 0,
    priorDitherStyleReuseByStyle: {},
    newVisuals: 1259,
  },
  dense: {
    maskOnCells: 56,
    semanticCandidates: 1664,
    uniqueRasters: 1393,
    straightReuseCandidates: 102,
    straightReuseVisuals: 90,
    solidReuseCandidates: 81,
    solidReuseVisuals: 76,
    sameStyleDuplicateCandidates: 254,
    priorDitherStyleReuseCandidates: 0,
    priorDitherStyleReuseByStyle: {},
    newVisuals: 1227,
  },
  medium: {
    maskOnCells: 48,
    semanticCandidates: 1664,
    uniqueRasters: 1409,
    straightReuseCandidates: 102,
    straightReuseVisuals: 90,
    solidReuseCandidates: 54,
    solidReuseVisuals: 50,
    sameStyleDuplicateCandidates: 238,
    priorDitherStyleReuseCandidates: 24,
    priorDitherStyleReuseByStyle: { dense: 24 },
    newVisuals: 1246,
  },
  light: {
    maskOnCells: 16,
    semanticCandidates: 1664,
    uniqueRasters: 1466,
    straightReuseCandidates: 154,
    straightReuseVisuals: 138,
    solidReuseCandidates: 2,
    solidReuseVisuals: 2,
    sameStyleDuplicateCandidates: 180,
    priorDitherStyleReuseCandidates: 13,
    priorDitherStyleReuseByStyle: { dense: 2, medium: 11 },
    newVisuals: 1315,
  },
  sparse: {
    maskOnCells: 8,
    semanticCandidates: 1664,
    uniqueRasters: 1478,
    straightReuseCandidates: 181,
    straightReuseVisuals: 164,
    solidReuseCandidates: 2,
    solidReuseVisuals: 2,
    sameStyleDuplicateCandidates: 168,
    priorDitherStyleReuseCandidates: 24,
    priorDitherStyleReuseByStyle: { medium: 2, light: 22 },
    newVisuals: 1289,
  },
};

for (const style of sweep.stats.styles) {
  const expected = expectedStyles[style.style];
  assert.ok(expected, `unexpected style ${style.style}`);
  assert.deepEqual(
    {
      maskOnCells: style.maskOnCells,
      semanticCandidates: style.semanticCandidates,
      uniqueRasters: style.uniqueRasters,
      straightReuseCandidates: style.straightReuseCandidates,
      straightReuseVisuals: style.straightReuseVisuals,
      solidReuseCandidates: style.solidReuseCandidates,
      solidReuseVisuals: style.solidReuseVisuals,
      sameStyleDuplicateCandidates: style.sameStyleDuplicateCandidates,
      priorDitherStyleReuseCandidates: style.priorDitherStyleReuseCandidates,
      priorDitherStyleReuseByStyle: style.priorDitherStyleReuseByStyle,
      newVisuals: style.newVisuals,
    },
    expected,
    `style regression changed for ${style.style}`,
  );
}

for (const definition of STRAIGHT_FILL_STYLE_DEFINITIONS) {
  let onCells = 0;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      if (ditherMaskHasPixel(definition.id, x, y)) {
        onCells += 1;
      }
      assert.equal(
        ditherMaskHasPixel(definition.id, x, y),
        ditherMaskHasPixel(definition.id, x, y + 8),
        `${definition.id} mask phase does not repeat after 8 rows`,
      );
    }
  }
  assert.equal(onCells, definition.onCells, `${definition.id} mask density changed`);
}

assert.equal(sweep.candidates.length, 1664 * STRAIGHT_FILL_STYLE_ORDER.length);
for (const candidate of sweep.candidates) {
  const straightCandidate = straight.candidates[candidate.straightCandidateId];
  assert.ok(straightCandidate, `missing straight candidate ${candidate.straightCandidateId}`);
  assert.equal(bitmapKey(candidate.bitmap), candidate.bitmapKey, `bitmap key mismatch for ${candidate.aliasKey}`);
  for (let row = 0; row < straightCandidate.bitmap.length; row += 1) {
    assert.equal(
      straightCandidate.bitmap[row] & candidate.bitmap[row],
      straightCandidate.bitmap[row],
      `${candidate.aliasKey} lost a forced boundary pixel on row ${row}`,
    );
  }

  if (candidate.visualDisposition === "new-dither-unallocated") {
    assert.equal(candidate.canonicalGlyphId, null);
    assert.equal(candidate.canonicalCodepoint, null);
    assert.equal(candidate.canonicalFillVisualId, null);
    assert.notEqual(candidate.canonicalDitherVisualId, null);
  }
}

for (let fillCandidateId = 0; fillCandidateId < solid.candidates.length; fillCandidateId += 1) {
  assert.equal(
    sweep.candidates[fillCandidateId]?.bitmapKey,
    solid.candidates[fillCandidateId]?.bitmapKey,
    `solid sweep candidate ${fillCandidateId} no longer matches Milestone 4A`,
  );
}

const straightKeys = new Set(straight.glyphs.map((glyph) => glyph.bitmapKey));
const solidKeys = new Set(solid.visuals.map((visual) => visual.bitmapKey));
const ditherKeys = new Set();
for (const visual of sweep.visuals) {
  assert.ok(!straightKeys.has(visual.bitmapKey), `dither visual ${visual.visualId} duplicates a straight owner`);
  assert.ok(!solidKeys.has(visual.bitmapKey), `dither visual ${visual.visualId} duplicates a solid owner`);
  assert.ok(!ditherKeys.has(visual.bitmapKey), `duplicate dither owner for ${visual.bitmapKey}`);
  ditherKeys.add(visual.bitmapKey);
}
assert.equal(ditherKeys.size, 5077, "dither owner count changed");

const adjacentHamming = {
  "solid>dense": { exactMatches: 181, withinOnePixel: 299, withinTwoPixels: 423, minDistance: 0, maxDistance: 16, meanDistance: 7.31851 },
  "dense>medium": { exactMatches: 180, withinOnePixel: 298, withinTwoPixels: 418, minDistance: 0, maxDistance: 16, meanDistance: 7.332332 },
  "medium>light": { exactMatches: 117, withinOnePixel: 141, withinTwoPixels: 175, minDistance: 0, maxDistance: 64, meanDistance: 29.292067 },
  "light>sparse": { exactMatches: 180, withinOnePixel: 298, withinTwoPixels: 418, minDistance: 0, maxDistance: 16, meanDistance: 7.326322 },
};
for (const comparison of sweep.hammingComparisons) {
  const expected = adjacentHamming[`${comparison.styleA}>${comparison.styleB}`];
  if (!expected) {
    continue;
  }
  assert.deepEqual(
    {
      exactMatches: comparison.exactMatches,
      withinOnePixel: comparison.withinOnePixel,
      withinTwoPixels: comparison.withinTwoPixels,
      minDistance: comparison.minDistance,
      maxDistance: comparison.maxDistance,
      meanDistance: comparison.meanDistance,
    },
    expected,
    `Hamming regression changed for ${comparison.styleA}>${comparison.styleB}`,
  );
}

console.log("GraphSCII Milestone 4B phase-locked dither sweep verified.");
console.log(JSON.stringify(sweep.stats, null, 2));
