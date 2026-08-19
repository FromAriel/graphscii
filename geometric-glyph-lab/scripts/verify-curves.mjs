import {
  ALL_FAMILIES,
  CURVE_FIXED_SCALE,
  CURVE_SAMPLE_STEPS,
  generate,
  hasPixel,
  portToPixel,
  rasterizeCurve,
  resolveCurveAgainstStraights,
} from "../dist/core/index.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const straightResult = generate(ALL_FAMILIES);
assert(straightResult.candidates.length === 832, "Straight candidate regression changed.");
assert(straightResult.glyphs.length === 746, "Straight unique regression changed.");
assert(CURVE_FIXED_SCALE === 256, "Curve fixed-point scale must remain 256 units per pixel.");
assert(CURVE_SAMPLE_STEPS === 256, "Curve rasterizer must remain at 256 deterministic samples in 3A.");

const straightEquivalentSpec = {
  start: { edge: "L", index: 8 },
  end: { edge: "R", index: 8 },
  startTangent: "normal",
  endTangent: "normal",
  strength: "normal",
};
const straightEquivalent = rasterizeCurve(straightEquivalentSpec);
const straightResolution = resolveCurveAgainstStraights(straightEquivalent, straightResult.glyphs);
assert(straightEquivalent.validation.valid, "Straight-equivalent curve should be valid.");
assert(straightEquivalent.bitmapKey === "0000000000000000ff00000000000000", "Straight-equivalent curve raster changed.");
assert(straightResolution.visualDisposition === "reuse-existing-straight", "Straight-equivalent curve must reuse the straight visual owner.");
assert(straightResolution.canonicalCodepoint === "U+00E088", "Straight-equivalent curve should resolve to U+00E088.");

const novelSpec = {
  start: { edge: "L", index: 8 },
  end: { edge: "R", index: 8 },
  startTangent: "hard-left",
  endTangent: "hard-left",
  strength: "normal",
};
const novel = rasterizeCurve(novelSpec);
const novelAgain = rasterizeCurve(novelSpec);
const novelResolution = resolveCurveAgainstStraights(novel, straightResult.glyphs);
assert(novel.validation.valid, `Representative novel curve should be valid: ${novel.validation.reasons.join(", ")}`);
assert(novel.bitmapKey === "0000000000000060fb06000000000000", "Representative curve raster changed.");
assert(novel.bitmapKey === novelAgain.bitmapKey, "Curve rasterization must be deterministic.");
assert(novelResolution.visualDisposition === "novel-curve", "Representative curved raster should remain novel against straights.");
assert(novelResolution.canonicalCodepoint === null, "Novel research curves must not receive codepoints in 3A.");

const startPixel = portToPixel(novelSpec.start);
const endPixel = portToPixel(novelSpec.end);
assert(hasPixel(novel.bitmap, startPixel.x, startPixel.y), "Curve raster must include its start port.");
assert(hasPixel(novel.bitmap, endPixel.x, endPixel.y), "Curve raster must include its end port.");

const sameEdge = rasterizeCurve({
  start: { edge: "L", index: 0 },
  end: { edge: "L", index: 1 },
  startTangent: "hard-left",
  endTangent: "hard-left",
  strength: "tight",
});
assert(sameEdge.validation.valid, "Same-edge curves must be supported when geometrically valid.");

const zeroLength = rasterizeCurve({
  start: { edge: "L", index: 0 },
  end: { edge: "T", index: 0 },
  startTangent: "normal",
  endTangent: "normal",
  strength: "normal",
});
assert(!zeroLength.validation.valid, "Coincident semantic ports must be rejected as zero-length geometry.");
assert(zeroLength.validation.reasons.includes("zero-length endpoint geometry"), "Zero-length rejection reason missing.");

console.log("Curve research verification passed.");
console.log(`Straight baseline: ${straightResult.candidates.length} candidates -> ${straightResult.glyphs.length} glyphs`);
console.log(`Exact reuse fixture: ${straightResolution.canonicalCodepoint}`);
console.log(`Novel curve fixture: ${novel.bitmapKey}`);
console.log(`Same-edge fixture: ${sameEdge.bitmapKey}`);
