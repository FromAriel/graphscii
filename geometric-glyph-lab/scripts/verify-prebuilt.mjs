import {
  ALL_FAMILIES,
  ASCII_EMPTY_PIXEL,
  ASCII_FILLED_PIXEL,
  BITMAP_SERIALIZATION,
  CELL_HEIGHT,
  CELL_ORIENTATION,
  CELL_WIDTH,
  GRAPHSCII_FORMAT_VERSION,
  PRIVATE_USE_START,
  bitmapAscii,
  bitmapKey,
  formatCodepoint,
  generate,
  glyphArtifactStem,
} from "../dist/core/index.js";

const result = generate(ALL_FAMILIES);

const expected = {
  candidates: 832,
  unique: 746,
  duplicates: 86,
  maxAliases: 4,
};

const actual = {
  candidates: result.candidates.length,
  unique: result.glyphs.length,
  duplicates: result.duplicateCandidates,
  maxAliases: Math.max(...result.glyphs.map((glyph) => glyph.aliases.length)),
};

for (const [key, expectedValue] of Object.entries(expected)) {
  if (actual[key] !== expectedValue) {
    throw new Error(`Expected ${key}=${expectedValue}, got ${actual[key]}.`);
  }
}

if (CELL_WIDTH !== 8 || CELL_HEIGHT !== 16) {
  throw new Error(`Expected canonical cell 8×16, got ${CELL_WIDTH}×${CELL_HEIGHT}.`);
}
if (CELL_ORIENTATION !== "8-columns-by-16-rows") {
  throw new Error(`Unexpected cell orientation: ${CELL_ORIENTATION}.`);
}
if (GRAPHSCII_FORMAT_VERSION !== 1) {
  throw new Error(`Unexpected GraphSCII format version: ${GRAPHSCII_FORMAT_VERSION}.`);
}
if (!BITMAP_SERIALIZATION.startsWith("v1:")) {
  throw new Error(`Unexpected bitmap serialization contract: ${BITMAP_SERIALIZATION}.`);
}

const firstGlyph = result.glyphs[0];
if (!firstGlyph) {
  throw new Error("Expected at least one generated glyph.");
}

const key = bitmapKey(firstGlyph.bitmap);
if (!/^[0-9a-f]{32}$/.test(key)) {
  throw new Error(`Bitmap key must be exactly 32 lowercase hex characters; got ${key}.`);
}

const ascii = bitmapAscii(firstGlyph.bitmap);
const asciiRows = ascii.split("\n");
if (asciiRows.length !== CELL_HEIGHT || asciiRows.some((row) => row.length !== CELL_WIDTH)) {
  throw new Error("ASCII bitmap dimensions do not match the canonical 8×16 cell.");
}
const allowedAscii = new Set([ASCII_FILLED_PIXEL, ASCII_EMPTY_PIXEL]);
for (const character of ascii.replaceAll("\n", "")) {
  if (!allowedAscii.has(character)) {
    throw new Error(`Unexpected ASCII bitmap character: ${character}.`);
  }
}

if (formatCodepoint(PRIVATE_USE_START) !== "U+00E000") {
  throw new Error(`Unexpected codepoint formatting: ${formatCodepoint(PRIVATE_USE_START)}.`);
}
if (glyphArtifactStem(PRIVATE_USE_START) !== "U+00E000") {
  throw new Error(`Unexpected artifact filename stem: ${glyphArtifactStem(PRIVATE_USE_START)}.`);
}

console.log("GraphSCII Milestone 0 verification passed.");
console.log(JSON.stringify({
  cell: `${CELL_WIDTH}x${CELL_HEIGHT}`,
  orientation: CELL_ORIENTATION,
  bitmapSerialization: BITMAP_SERIALIZATION,
  artifactStemExample: glyphArtifactStem(PRIVATE_USE_START),
  ...actual,
}, null, 2));
