import { bitmapRows, hasPixel } from "./raster.js";
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  PRIVATE_USE_START,
  type GenerationResult,
} from "./types.js";
import { formatPort } from "./ports.js";
import {
  BITMAP_SERIALIZATION,
  CELL_ORIENTATION,
  GRAPHSCII_FORMAT,
  GRAPHSCII_FORMAT_VERSION,
  formatCodepoint,
  glyphArtifactStem,
} from "./format.js";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportJson(result: GenerationResult): void {
  const payload = {
    format: GRAPHSCII_FORMAT,
    formatVersion: GRAPHSCII_FORMAT_VERSION,
    cell: { width: CELL_WIDTH, height: CELL_HEIGHT, orientation: CELL_ORIENTATION },
    bitmapSerialization: BITMAP_SERIALIZATION,
    codepointStart: formatCodepoint(PRIVATE_USE_START),
    candidateCount: result.candidates.length,
    uniqueGlyphCount: result.glyphs.length,
    duplicateCandidateCount: result.duplicateCandidates,
    glyphs: result.glyphs.map((glyph) => ({
      id: glyph.glyphId,
      hexId: glyph.glyphId.toString(16).toUpperCase().padStart(3, "0"),
      codepoint: formatCodepoint(glyph.codepoint),
      artifactStem: glyphArtifactStem(glyph.codepoint),
      bitmapRowsHex: bitmapRows(glyph.bitmap),
      bitmapKey: glyph.bitmapKey,
      aliases: glyph.aliases.map((alias) => ({
        family: alias.family,
        start: formatPort(alias.start),
        end: formatPort(alias.end),
      })),
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, "geometric-glyphs.json");
}

export function exportAtlasPng(result: GenerationResult, scale = 4): void {
  const columns = 16;
  const rows = Math.max(1, Math.ceil(result.glyphs.length / columns));
  const canvas = document.createElement("canvas");
  canvas.width = columns * CELL_WIDTH * scale;
  canvas.height = rows * CELL_HEIGHT * scale;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is not available.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.imageSmoothingEnabled = false;

  result.glyphs.forEach((glyph, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const originX = column * CELL_WIDTH * scale;
    const originY = row * CELL_HEIGHT * scale;

    for (let y = 0; y < CELL_HEIGHT; y += 1) {
      for (let x = 0; x < CELL_WIDTH; x += 1) {
        if (hasPixel(glyph.bitmap, x, y)) {
          context.fillRect(originX + x * scale, originY + y * scale, scale, scale);
        }
      }
    }
  });

  canvas.toBlob((blob) => {
    if (!blob) {
      throw new Error("PNG export failed.");
    }
    downloadBlob(blob, "geometric-glyph-atlas.png");
  }, "image/png");
}
