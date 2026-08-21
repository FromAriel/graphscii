// Deterministically rebuild the published GraphSCII straight semantic lookup.
// Browser-facing ES module. This is direct semantic lookup, never shape matching.

const WIDTH = 8;
const HEIGHT = 16;
const PRIVATE_USE_START = 0xE000;

const FAMILIES = [
  ["L", "R"],
  ["T", "B"],
  ["L", "T"],
  ["L", "B"],
  ["R", "T"],
  ["R", "B"],
];

function portCount(edge) {
  return edge === "L" || edge === "R" ? HEIGHT : WIDTH;
}

function portPixel(edge, index) {
  switch (edge) {
    case "L": return [0, index];
    case "R": return [WIDTH - 1, index];
    case "T": return [index, 0];
    case "B": return [index, HEIGHT - 1];
    default: throw new Error(`Unknown GraphSCII edge ${edge}`);
  }
}

function bitmapKey(startEdge, startIndex, endEdge, endIndex) {
  let [x0, y0] = portPixel(startEdge, startIndex);
  const [x1, y1] = portPixel(endEdge, endIndex);
  const rows = new Uint8Array(HEIGHT);

  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  while (true) {
    rows[y0] |= 1 << x0;
    if (x0 === x1 && y0 === y1) break;

    const doubledError = error * 2;
    if (doubledError >= dy) {
      error += dy;
      x0 += sx;
    }
    if (doubledError <= dx) {
      error += dx;
      y0 += sy;
    }
  }

  return [...rows].map((row) => row.toString(16).padStart(2, "0")).join("");
}

function buildStraightLookup() {
  const ownerByBitmap = new Map();
  const byPair = Object.create(null);
  let nextGlyphId = 0;

  for (const [startEdge, endEdge] of FAMILIES) {
    for (let startIndex = 0; startIndex < portCount(startEdge); startIndex += 1) {
      for (let endIndex = 0; endIndex < portCount(endEdge); endIndex += 1) {
        const bitmap = bitmapKey(startEdge, startIndex, endEdge, endIndex);
        let glyphId = ownerByBitmap.get(bitmap);
        if (glyphId === undefined) {
          glyphId = nextGlyphId;
          ownerByBitmap.set(bitmap, glyphId);
          nextGlyphId += 1;
        }

        const forward = `${startEdge}${startIndex}>${endEdge}${endIndex}`;
        const reverse = `${endEdge}${endIndex}>${startEdge}${startIndex}`;
        const codepoint = PRIVATE_USE_START + glyphId;
        byPair[forward] = codepoint;
        byPair[reverse] = codepoint;
      }
    }
  }

  if (Object.keys(byPair).length !== 1664 || nextGlyphId !== 746) {
    throw new Error(
      `GraphSCII straight lookup invariant failed: ${Object.keys(byPair).length} pairs / ${nextGlyphId} owners`,
    );
  }

  return Object.freeze(byPair);
}

export const STRAIGHT_CODEPOINT_BY_PAIR = buildStraightLookup();
export const STRAIGHT_PAIR_COUNT = 1664;
export const STRAIGHT_VISUAL_OWNER_COUNT = 746;
