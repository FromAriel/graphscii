import type { GraphGlyph, GraphSCIITone, RegistryJson } from "./types";

const EXPECTED_OWNER_COUNT = 6397;

// These are the phase-locked masks frozen by GraphSCII's dither.ts/palette.ts sources.
// x=0 is bit 0, matching the registry bitmap serialization. The 8-row masks repeat
// once to cover the full 8x16 GraphSCII cell.
const MASK_ROWS_8: Record<GraphSCIITone, readonly number[]> = {
  100: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
  75: [0x55, 0xff, 0x55, 0xff, 0x55, 0xff, 0x55, 0xff],
  50: [0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa],
  25: [0x55, 0x00, 0x55, 0x00, 0x55, 0x00, 0x55, 0x00],
};

function toneMask(tone: GraphSCIITone): Uint8Array {
  const source = MASK_ROWS_8[tone];
  return Uint8Array.from([...source, ...source]);
}

function popcount8(value: number): number {
  let n = value & 0xff;
  n -= (n >>> 1) & 0x55;
  n = (n & 0x33) + ((n >>> 2) & 0x33);
  return ((n + (n >>> 4)) & 0x0f);
}

function rowsFromBitmapKey(bitmapKey: string): Uint8Array {
  if (!/^[0-9a-f]{32}$/u.test(bitmapKey)) throw new Error(`Invalid GraphSCII bitmap key: ${bitmapKey}`);
  const rows = new Uint8Array(16);
  for (let row = 0; row < 16; row += 1) rows[row] = Number.parseInt(bitmapKey.slice(row * 2, row * 2 + 2), 16);
  return rows;
}

function makeGlyph(owner: RegistryJson["owners"][number]): GraphGlyph {
  const rows = rowsFromBitmapKey(owner.bitmapKey);
  let onCount = 0;
  let leftEdge = 0;
  let rightEdge = 0;
  for (let y = 0; y < 16; y += 1) {
    const row = rows[y]!;
    onCount += popcount8(row);
    if ((row & 0x01) !== 0) leftEdge |= 1 << y;
    if ((row & 0x80) !== 0) rightEdge |= 1 << y;
  }
  return {
    glyphId: owner.glyphId,
    codepointValue: owner.codepointValue,
    bitmapKey: owner.bitmapKey,
    canonicalClass: owner.canonicalClass,
    rows,
    onCount,
    leftEdge,
    rightEdge,
    topEdge: rows[0]!,
    bottomEdge: rows[15]!,
    label: owner.firstSemanticAlias ?? owner.semanticAliases?.[0] ?? owner.canonicalClass,
  };
}

export class GlyphRegistry {
  readonly glyphs: GraphGlyph[];
  readonly byPixelCount: GraphGlyph[][];
  readonly byCodepoint: Map<number, GraphGlyph>;
  readonly toneMasks: Record<GraphSCIITone, Uint8Array>;

  private constructor(glyphs: GraphGlyph[]) {
    this.glyphs = glyphs;
    this.byPixelCount = Array.from({ length: 129 }, () => [] as GraphGlyph[]);
    this.byCodepoint = new Map<number, GraphGlyph>();
    for (const glyph of glyphs) {
      this.byPixelCount[glyph.onCount]!.push(glyph);
      this.byCodepoint.set(glyph.codepointValue, glyph);
    }
    this.toneMasks = {
      100: toneMask(100),
      75: toneMask(75),
      50: toneMask(50),
      25: toneMask(25),
    };
  }

  static async load(url: string): Promise<GlyphRegistry> {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Could not load GraphSCII registry (${response.status}).`);
    const registry = (await response.json()) as RegistryJson;
    if (registry.format !== "graphscii" || !Array.isArray(registry.owners)) throw new Error("Unrecognized GraphSCII registry format.");
    if (registry.owners.length !== EXPECTED_OWNER_COUNT) {
      throw new Error(`Expected ${EXPECTED_OWNER_COUNT.toLocaleString()} GraphSCII owners; found ${registry.owners.length.toLocaleString()}.`);
    }
    const glyphs = registry.owners.map(makeGlyph);
    const codepoints = new Set(glyphs.map((glyph) => glyph.codepointValue));
    const bitmaps = new Set(glyphs.map((glyph) => glyph.bitmapKey));
    if (codepoints.size !== EXPECTED_OWNER_COUNT || bitmaps.size !== EXPECTED_OWNER_COUNT) {
      throw new Error("GraphSCII registry violates unique codepoint/bitmap ownership.");
    }
    return new GlyphRegistry(glyphs);
  }

  candidatesNearPixelCount(target: number, initialRadius = 10): GraphGlyph[] {
    const center = Math.max(0, Math.min(128, Math.round(target)));
    let radius = initialRadius;
    let candidates: GraphGlyph[] = [];
    while (candidates.length < 64 && radius <= 128) {
      candidates = [];
      const low = Math.max(0, center - radius);
      const high = Math.min(128, center + radius);
      for (let count = low; count <= high; count += 1) candidates.push(...this.byPixelCount[count]!);
      radius += 8;
    }
    return candidates.length > 0 ? candidates : this.glyphs;
  }
}

export function popcount16(value: number): number {
  let n = value & 0xffff;
  n -= (n >>> 1) & 0x5555;
  n = (n & 0x3333) + ((n >>> 2) & 0x3333);
  n = (n + (n >>> 4)) & 0x0f0f;
  return (n * 0x0101) >>> 8 & 0x1f;
}

export function popcountByte(value: number): number {
  return popcount8(value);
}
