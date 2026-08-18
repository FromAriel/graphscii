import { ALL_FAMILIES, generate } from "../dist/core/generator.js";

const result = generate(ALL_FAMILIES);

const expectedCandidates = 832;
const expectedUnique = 746;
const expectedDuplicates = 86;

const actual = {
  candidates: result.candidates.length,
  unique: result.glyphs.length,
  duplicates: result.duplicateCandidates,
  maxAliases: Math.max(...result.glyphs.map((glyph) => glyph.aliases.length)),
};

if (actual.candidates !== expectedCandidates) {
  throw new Error(`Expected ${expectedCandidates} candidates, got ${actual.candidates}.`);
}
if (actual.unique !== expectedUnique) {
  throw new Error(`Expected ${expectedUnique} unique glyphs, got ${actual.unique}.`);
}
if (actual.duplicates !== expectedDuplicates) {
  throw new Error(`Expected ${expectedDuplicates} duplicate candidates, got ${actual.duplicates}.`);
}

console.log("Geometric Glyph Lab core verification passed.");
console.log(JSON.stringify(actual, null, 2));
