import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(scriptDir, "font-compiler.mjs");
let source = await readFile(target, "utf8");

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Patch target is ambiguous: ${label}`);
  }
  source = `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

replaceOnce(
  "bitmap LSB helper",
  `function bitmapKeyFromRows(rows) {\n  if (!(rows instanceof Uint8Array) || rows.length !== HEIGHT) {\n    throw new Error("GraphSCII font raster must be exactly 16 rows.");\n  }\n  return Buffer.from(rows).toString("hex");\n}\n`,
  `function bitmapKeyFromRows(rows) {\n  if (!(rows instanceof Uint8Array) || rows.length !== HEIGHT) {\n    throw new Error("GraphSCII font raster must be exactly 16 rows.");\n  }\n  return Buffer.from(rows).toString("hex");\n}\n\nfunction leftSideBearingForRows(rows) {\n  for (let x = 0; x < WIDTH; x += 1) {\n    for (let y = 0; y < HEIGHT; y += 1) {\n      if (((rows[y] ?? 0) & (1 << x)) !== 0) return x * UNITS_PER_PIXEL;\n    }\n  }\n  return 0;\n}\n`,
);

replaceOnce(
  "empty glyph metrics",
  `  if (runs.length === 0) return { bytes: Buffer.alloc(0), points: 0, contours: 0 };`,
  `  if (runs.length === 0) return { bytes: Buffer.alloc(0), points: 0, contours: 0, xMin: 0, xMax: 0 };`,
);

replaceOnce(
  "simple glyph metrics return",
  `  return { bytes: buffer, points: points.length, contours: runs.length };\n}\n\nfunction buildGlyfAndLoca(glyphRows) {\n  const chunks = [];\n  const offsets = [0];`,
  `  return { bytes: buffer, points: points.length, contours: runs.length, xMin, xMax };\n}\n\nfunction buildGlyfAndLoca(glyphRows) {\n  const chunks = [];\n  const offsets = [0];\n  const horizontalMetrics = [];`,
);

replaceOnce(
  "collect horizontal metrics",
  `    const glyph = buildSimpleGlyph(rows);\n    maxPoints = Math.max(maxPoints, glyph.points);`,
  `    const glyph = buildSimpleGlyph(rows);\n    horizontalMetrics.push({ advanceWidth: ADVANCE_WIDTH, leftSideBearing: glyph.xMin });\n    maxPoints = Math.max(maxPoints, glyph.points);`,
);

replaceOnce(
  "return horizontal metrics",
  `  return { glyf, loca, maxPoints, maxContours };\n}\n\nfunction buildHead() {`,
  `  return { glyf, loca, horizontalMetrics, maxPoints, maxContours };\n}\n\nfunction buildHead() {`,
);

replaceOnce(
  "hmtx builder",
  `function buildHmtx(numGlyphs) {\n  const buffer = Buffer.alloc(numGlyphs * 4);\n  for (let i = 0; i < numGlyphs; i += 1) {\n    buffer.writeUInt16BE(ADVANCE_WIDTH, i * 4);\n    buffer.writeInt16BE(0, i * 4 + 2);\n  }\n  return buffer;\n}`,
  `function buildHmtx(horizontalMetrics) {\n  const buffer = Buffer.alloc(horizontalMetrics.length * 4);\n  for (let i = 0; i < horizontalMetrics.length; i += 1) {\n    const metric = horizontalMetrics[i];\n    buffer.writeUInt16BE(metric.advanceWidth, i * 4);\n    buffer.writeInt16BE(metric.leftSideBearing, i * 4 + 2);\n  }\n  return buffer;\n}`,
);

replaceOnce(
  "font build metric plumbing",
  `  const { glyf, loca, maxPoints, maxContours } = buildGlyfAndLoca(glyphRows);`,
  `  const { glyf, loca, horizontalMetrics, maxPoints, maxContours } = buildGlyfAndLoca(glyphRows);`,
);

replaceOnce(
  "font hmtx table",
  `    hmtx: buildHmtx(glyphRows.length),`,
  `    hmtx: buildHmtx(horizontalMetrics),`,
);

replaceOnce(
  "verifier hmtx table handle",
  `  const hhea = tables.get("hhea");\n  const loca = tables.get("loca");`,
  `  const hhea = tables.get("hhea");\n  const hmtx = tables.get("hmtx");\n  const loca = tables.get("loca");`,
);

replaceOnce(
  "verifier metric table invariants",
  `  if (fontBytes.readUInt16BE(hhea.offset + 34) !== EXPECTED_GLYPH_COUNT) throw new Error("Unexpected hhea.numberOfHMetrics.");\n  if (loca.length !== (EXPECTED_GLYPH_COUNT + 1) * 4) throw new Error("Unexpected loca length.");`,
  `  if (fontBytes.readUInt16BE(hhea.offset + 34) !== EXPECTED_GLYPH_COUNT) throw new Error("Unexpected hhea.numberOfHMetrics.");\n  if ((fontBytes.readUInt16BE(head.offset + 16) & 0x0002) === 0) throw new Error("GraphSCII requires head.flags bit 1: left side bearing equals xMin.");\n  if (hmtx.length !== EXPECTED_GLYPH_COUNT * 4) throw new Error("Unexpected hmtx length.");\n  if (loca.length !== (EXPECTED_GLYPH_COUNT + 1) * 4) throw new Error("Unexpected loca length.");`,
);

replaceOnce(
  "per-glyph hmtx verification",
  `    const actual = decodeSimpleGlyphRows(fontBytes, glyf, start, end);\n    const expected = expectedRows[glyphIndex];\n    if (bitmapKeyFromRows(actual) !== bitmapKeyFromRows(expected)) {\n      throw new Error(\`Raster round-trip failed for font glyph \${glyphIndex}.\`);\n    }`,
  `    const actual = decodeSimpleGlyphRows(fontBytes, glyf, start, end);\n    const expected = expectedRows[glyphIndex];\n    if (bitmapKeyFromRows(actual) !== bitmapKeyFromRows(expected)) {\n      throw new Error(\`Raster round-trip failed for font glyph \${glyphIndex}.\`);\n    }\n\n    const metricOffset = hmtx.offset + glyphIndex * 4;\n    const advanceWidth = fontBytes.readUInt16BE(metricOffset);\n    const leftSideBearing = fontBytes.readInt16BE(metricOffset + 2);\n    const expectedLeftSideBearing = leftSideBearingForRows(expected);\n    if (advanceWidth !== ADVANCE_WIDTH) {\n      throw new Error(\`Unexpected advance width for font glyph \${glyphIndex}: \${advanceWidth}.\`);\n    }\n    if (leftSideBearing !== expectedLeftSideBearing) {\n      throw new Error(\`Left side bearing mismatch for font glyph \${glyphIndex}: \${leftSideBearing} !== \${expectedLeftSideBearing}.\`);\n    }\n    if (start !== end) {\n      const glyphXMin = fontBytes.readInt16BE(glyf.offset + start + 2);\n      if (leftSideBearing !== glyphXMin) {\n        throw new Error(\`hmtx/glyf xMin mismatch for font glyph \${glyphIndex}: \${leftSideBearing} !== \${glyphXMin}.\`);\n      }\n    } else if (leftSideBearing !== 0) {\n      throw new Error(\`Empty font glyph \${glyphIndex} must have zero left side bearing.\`);\n    }`,
);

replaceOnce(
  "manifest horizontal metrics verification",
  `      allGlyphRasterRoundTrip: true,\n      puaRegistryOrderPreserved: true`,
  `      allGlyphRasterRoundTrip: true,\n      horizontalMetricsPositionPreserved: true,\n      hmtxLeftSideBearingEqualsXMin: true,\n      puaRegistryOrderPreserved: true`,
);

await writeFile(target, source);
console.log("Patched GraphSCII font compiler horizontal metrics and verification.");
