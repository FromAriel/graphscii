import type { GraphGlyph, GraphSCIITone, RegistryJson } from "./types";

const EXPECTED_OWNER_COUNT = 6397;
const EXPECTED_STRAIGHT_COUNT = 746;
const EXPECTED_FILL_COUNT = 5050;
const EXPECTED_PAIR_COUNT = 1664;
const EXPECTED_FILL_RULE_COUNT = 6656;
const EXPECTED_ORTHOGONAL_SEMANTICS = 640;
const EXPECTED_DIAGONAL_SEMANTICS = 60;
const STRAIGHT_START = 0xe000;
const STRAIGHT_END = 0xe2e9;
const CONNECTOR_START = 0xf6a4;
const FILL_CLASSES = new Set(["solid-100", "medium-75", "half-50", "light-25"]);

const STYLE_BY_TONE: Record<GraphSCIITone, "solid" | "medium" | "half" | "light"> = {
  100: "solid",
  75: "medium",
  50: "half",
  25: "light",
};

// Frozen GraphSCII phase-locked dither masks. x=0 is bit 0.
const MASK_ROWS_8: Record<GraphSCIITone, readonly number[]> = {
  100: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
  75: [0x55, 0xff, 0x55, 0xff, 0x55, 0xff, 0x55, 0xff],
  50: [0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa],
  25: [0x55, 0x00, 0x55, 0x00, 0x55, 0x00, 0x55, 0x00],
};

export interface BoundaryPoint {
  x: number;
  y: number;
}

interface PairEntry {
  glyphId: number;
  candidateId: number;
  reversed: boolean;
}

interface ConnectionPairIndexJson {
  index: string;
  entryCount: number;
  entries: Record<string, PairEntry>;
}

interface FillRulesJson {
  format: string;
  schema: string;
  entryCount: number;
  fallbackCount: number;
  styleCounts: Record<string, number>;
  entries: Record<string, number>;
}

interface OrthogonalSemanticJson {
  id: string;
  x: number;
  y: number;
  mask: "NESW" | "ESW" | "NSW" | "NEW" | "NSE";
  bitmapKey: string;
}

interface OrthogonalConnectorsJson {
  schema: string;
  semantics: OrthogonalSemanticJson[];
}

interface DiagonalSemanticJson {
  id: string;
  mask: "FULL" | "MISSING_NW" | "MISSING_NE" | "MISSING_SE" | "MISSING_SW";
  bounds: { left: number; right: number; top: number; bottom: number };
  bitmapKey: string;
}

interface DiagonalConnectorsJson {
  schema: string;
  semantics: DiagonalSemanticJson[];
}

interface DiagonalSelectionJson {
  schema: string;
  selectedSemanticCount: number;
  selectedSemanticIds: string[];
}

function toneMask(tone: GraphSCIITone): Uint8Array {
  const source = MASK_ROWS_8[tone];
  return Uint8Array.from([...source, ...source]);
}

function popcount8(value: number): number {
  let n = value & 0xff;
  n -= (n >>> 1) & 0x55;
  n = (n & 0x33) + ((n >>> 2) & 0x33);
  return (n + (n >>> 4)) & 0x0f;
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

function pointKey(point: BoundaryPoint): string {
  return `${point.x},${point.y}`;
}

function normalizePoints(points: readonly BoundaryPoint[]): BoundaryPoint[] {
  const unique = new Map<string, BoundaryPoint>();
  for (const point of points) unique.set(pointKey(point), point);
  return [...unique.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

function pointSignature(points: readonly BoundaryPoint[]): string {
  return normalizePoints(points).map(pointKey).join("|");
}

function orthogonalPoints(semantic: OrthogonalSemanticJson): BoundaryPoint[] {
  const points: BoundaryPoint[] = [];
  if (semantic.mask.includes("N")) points.push({ x: semantic.x, y: 0 });
  if (semantic.mask.includes("E")) points.push({ x: 7, y: semantic.y });
  if (semantic.mask.includes("S")) points.push({ x: semantic.x, y: 15 });
  if (semantic.mask.includes("W")) points.push({ x: 0, y: semantic.y });
  return normalizePoints(points);
}

function diagonalPoints(semantic: DiagonalSemanticJson): BoundaryPoint[] {
  const { left, right, top, bottom } = semantic.bounds;
  const pointsByLeg: Record<string, BoundaryPoint> = {
    NW: { x: left, y: top },
    NE: { x: right, y: top },
    SE: { x: right, y: bottom },
    SW: { x: left, y: bottom },
  };
  const missing = semantic.mask.startsWith("MISSING_") ? semantic.mask.slice("MISSING_".length) : null;
  const points = Object.entries(pointsByLeg)
    .filter(([leg]) => leg !== missing)
    .map(([, point]) => point);
  return normalizePoints(points);
}

function labelsForBoundaryPoint(point: BoundaryPoint): string[] {
  const labels: string[] = [];
  if (point.y === 0 && point.x >= 0 && point.x <= 7) labels.push(`T${point.x}`);
  if (point.y === 15 && point.x >= 0 && point.x <= 7) labels.push(`B${point.x}`);
  if (point.x === 0 && point.y >= 0 && point.y <= 15) labels.push(`L${point.y}`);
  if (point.x === 7 && point.y >= 0 && point.y <= 15) labels.push(`R${point.y}`);
  return labels;
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load GraphSCII rule asset ${url.pathname} (${response.status}).`);
  return await response.json() as T;
}

function emptyBuckets(): GraphGlyph[][] {
  return Array.from({ length: 129 }, () => [] as GraphGlyph[]);
}

function candidatesNearPixelCount(
  buckets: GraphGlyph[][],
  fallback: GraphGlyph[],
  target: number,
  initialRadius = 10,
): GraphGlyph[] {
  const center = Math.max(0, Math.min(128, Math.round(target)));
  let radius = initialRadius;
  let candidates: GraphGlyph[] = [];
  while (candidates.length < 64 && radius <= 128) {
    candidates = [];
    const low = Math.max(0, center - radius);
    const high = Math.min(128, center + radius);
    for (let count = low; count <= high; count += 1) candidates.push(...buckets[count]!);
    radius += 8;
  }
  return candidates.length > 0 ? candidates : fallback;
}

function familyFromAuthoredPorts(start: string, end: string): string {
  return `${start[0] ?? ""}${end[0] ?? ""}`;
}

export class GlyphRegistry {
  readonly glyphs: GraphGlyph[];
  readonly straightGlyphs: GraphGlyph[];
  readonly fillGlyphs: GraphGlyph[];
  readonly byCodepoint = new Map<number, GraphGlyph>();
  readonly toneMasks: Record<GraphSCIITone, Uint8Array>;

  private readonly byGlyphId = new Map<number, GraphGlyph>();
  private readonly byBitmap = new Map<string, GraphGlyph>();
  private readonly straightByPixelCount = emptyBuckets();
  private readonly fillByTone: Record<GraphSCIITone, GraphGlyph[]> = { 100: [], 75: [], 50: [], 25: [] };
  private readonly fillByTonePixelCount: Record<GraphSCIITone, GraphGlyph[][]> = {
    100: emptyBuckets(),
    75: emptyBuckets(),
    50: emptyBuckets(),
    25: emptyBuckets(),
  };
  private readonly pairEntries: Record<string, PairEntry>;
  private readonly fillRuleEntries: Record<string, number>;
  private readonly connectorByBoundarySignature = new Map<string, GraphGlyph[]>();

  private constructor(
    glyphs: GraphGlyph[],
    pairIndex: ConnectionPairIndexJson,
    fillRules: FillRulesJson,
    orthogonal: OrthogonalConnectorsJson,
    diagonal: DiagonalConnectorsJson,
    diagonalSelection: DiagonalSelectionJson,
  ) {
    this.glyphs = glyphs;
    this.straightGlyphs = glyphs.filter((glyph) => glyph.canonicalClass === "straight"
      && glyph.codepointValue >= STRAIGHT_START && glyph.codepointValue <= STRAIGHT_END);
    this.fillGlyphs = glyphs.filter((glyph) => FILL_CLASSES.has(glyph.canonicalClass));
    this.pairEntries = pairIndex.entries;
    this.fillRuleEntries = fillRules.entries;

    if (this.straightGlyphs.length !== EXPECTED_STRAIGHT_COUNT) {
      throw new Error(`Expected ${EXPECTED_STRAIGHT_COUNT} straight GraphSCII owners; found ${this.straightGlyphs.length}.`);
    }
    if (this.fillGlyphs.length !== EXPECTED_FILL_COUNT) {
      throw new Error(`Expected ${EXPECTED_FILL_COUNT} fill GraphSCII owners; found ${this.fillGlyphs.length}.`);
    }
    if (pairIndex.index !== "by-connection-pair" || pairIndex.entryCount !== EXPECTED_PAIR_COUNT) {
      throw new Error("GraphSCII straight connection-pair index is not the published 1,664-entry table.");
    }
    if (fillRules.schema !== "graphscii-demo-fill-rules-v1"
      || fillRules.entryCount !== EXPECTED_FILL_RULE_COUNT
      || Object.keys(fillRules.entries ?? {}).length !== EXPECTED_FILL_RULE_COUNT
      || fillRules.fallbackCount !== 64) {
      throw new Error("GraphSCII runtime fill rules are not the verified 6,656-entry encoded boundary/side/style grammar.");
    }
    for (const style of ["solid", "medium", "half", "light"]) {
      if (fillRules.styleCounts?.[style] !== 1664) {
        throw new Error(`GraphSCII runtime fill grammar has the wrong ${style} rule count.`);
      }
    }
    if (orthogonal.schema !== "graphscii-orthogonal-connectors" || orthogonal.semantics.length !== EXPECTED_ORTHOGONAL_SEMANTICS) {
      throw new Error("GraphSCII orthogonal connector rule table is not the published 640-semantic grammar.");
    }
    if (diagonal.schema !== "graphscii-diagonal-connectors"
      || diagonalSelection.schema !== "graphscii-final-diagonal-connector-selection"
      || diagonalSelection.selectedSemanticCount !== EXPECTED_DIAGONAL_SEMANTICS
      || diagonalSelection.selectedSemanticIds.length !== EXPECTED_DIAGONAL_SEMANTICS) {
      throw new Error("GraphSCII diagonal connector rule table is not the published 60-semantic selection.");
    }

    for (const glyph of glyphs) {
      this.byCodepoint.set(glyph.codepointValue, glyph);
      this.byGlyphId.set(glyph.glyphId, glyph);
      this.byBitmap.set(glyph.bitmapKey, glyph);
    }
    for (const glyph of this.straightGlyphs) this.straightByPixelCount[glyph.onCount]!.push(glyph);

    const toneByStyle: Record<string, GraphSCIITone> = { solid: 100, medium: 75, half: 50, light: 25 };
    const seenByTone: Record<GraphSCIITone, Set<number>> = {
      100: new Set<number>(),
      75: new Set<number>(),
      50: new Set<number>(),
      25: new Set<number>(),
    };
    for (const [ruleKey, glyphId] of Object.entries(this.fillRuleEntries)) {
      const style = ruleKey.slice(ruleKey.lastIndexOf(":") + 1);
      const tone = toneByStyle[style];
      if (!tone) throw new Error(`Unknown GraphSCII encoded fill style in runtime rule: ${style}.`);
      const glyph = this.byGlyphId.get(glyphId);
      if (!glyph || glyph.codepointValue >= CONNECTOR_START) {
        throw new Error(`GraphSCII fill rule ${ruleKey} did not resolve inside the pre-connector vocabulary.`);
      }
      if (!seenByTone[tone].has(glyph.codepointValue)) {
        seenByTone[tone].add(glyph.codepointValue);
        this.fillByTone[tone].push(glyph);
        this.fillByTonePixelCount[tone][glyph.onCount]!.push(glyph);
      }
    }
    for (const tone of [100, 75, 50, 25] as const) {
      if (this.fillByTone[tone].length === 0) throw new Error(`GraphSCII fill grammar produced no ${tone}% candidates.`);
    }

    const addConnectorRule = (points: BoundaryPoint[], bitmapKey: string, semanticId: string): void => {
      const normalized = normalizePoints(points);
      // Two-point visual degeneracies are straight geometry and must resolve through
      // the straight connection-pair table, never through the connector grammar.
      if (normalized.length < 3) return;
      const glyph = this.byBitmap.get(bitmapKey);
      if (!glyph) throw new Error(`Connector semantic ${semanticId} has no canonical v1 bitmap owner.`);
      const signature = pointSignature(normalized);
      const list = this.connectorByBoundarySignature.get(signature) ?? [];
      if (!list.some((candidate) => candidate.codepointValue === glyph.codepointValue)) list.push(glyph);
      this.connectorByBoundarySignature.set(signature, list);
    };

    for (const semantic of orthogonal.semantics) {
      addConnectorRule(orthogonalPoints(semantic), semantic.bitmapKey, semantic.id);
    }

    const selectedIds = new Set(diagonalSelection.selectedSemanticIds);
    const selectedSemantics = diagonal.semantics.filter((semantic) => selectedIds.has(semantic.id));
    if (selectedSemantics.length !== EXPECTED_DIAGONAL_SEMANTICS) {
      throw new Error(`Expected ${EXPECTED_DIAGONAL_SEMANTICS} selected diagonal semantics; resolved ${selectedSemantics.length}.`);
    }
    for (const semantic of selectedSemantics) {
      addConnectorRule(diagonalPoints(semantic), semantic.bitmapKey, semantic.id);
    }

    this.toneMasks = {
      100: toneMask(100),
      75: toneMask(75),
      50: toneMask(50),
      25: toneMask(25),
    };
  }

  static async load(url: string): Promise<GlyphRegistry> {
    const registryUrl = new URL(url, window.location.href);
    const baseUrl = new URL("./", registryUrl);
    const [registry, pairIndex, fillRules, orthogonal, diagonal, diagonalSelection] = await Promise.all([
      fetchJson<RegistryJson>(registryUrl),
      fetchJson<ConnectionPairIndexJson>(new URL("by-connection-pair.json", baseUrl)),
      fetchJson<FillRulesJson>(new URL("fill-rules.json", baseUrl)),
      fetchJson<OrthogonalConnectorsJson>(new URL("orthogonal-connectors.json", baseUrl)),
      fetchJson<DiagonalConnectorsJson>(new URL("diagonal-connectors.json", baseUrl)),
      fetchJson<DiagonalSelectionJson>(new URL("diagonal-selection.json", baseUrl)),
    ]);

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
    return new GlyphRegistry(glyphs, pairIndex, fillRules, orthogonal, diagonal, diagonalSelection);
  }

  straightCandidatesForBoundaryPoints(points: readonly BoundaryPoint[]): GraphGlyph[] {
    const normalized = normalizePoints(points);
    if (normalized.length !== 2) return [];
    const firstLabels = labelsForBoundaryPoint(normalized[0]!);
    const secondLabels = labelsForBoundaryPoint(normalized[1]!);
    const results = new Map<number, GraphGlyph>();
    for (const first of firstLabels) {
      for (const second of secondLabels) {
        const entry = this.pairEntries[`${first}>${second}`];
        if (!entry) continue;
        const glyph = this.byGlyphId.get(entry.glyphId);
        if (!glyph || glyph.canonicalClass !== "straight") {
          throw new Error(`Straight rule ${first}>${second} did not resolve to a straight GraphSCII owner.`);
        }
        results.set(glyph.codepointValue, glyph);
      }
    }
    return [...results.values()];
  }

  fillCandidatesForBoundaryPoints(points: readonly BoundaryPoint[], tone: GraphSCIITone): GraphGlyph[] {
    const normalized = normalizePoints(points);
    if (normalized.length !== 2) return [];
    const firstLabels = labelsForBoundaryPoint(normalized[0]!);
    const secondLabels = labelsForBoundaryPoint(normalized[1]!);
    const style = STYLE_BY_TONE[tone];
    const results = new Map<number, GraphGlyph>();

    for (const first of firstLabels) {
      for (const second of secondLabels) {
        const entry = this.pairEntries[`${first}>${second}`];
        if (!entry) continue;
        const authoredStart = entry.reversed ? second : first;
        const authoredEnd = entry.reversed ? first : second;
        const family = familyFromAuthoredPorts(authoredStart, authoredEnd);
        for (const side of ["A", "B"] as const) {
          const ruleKey = `${family}:${authoredStart}>${authoredEnd}:side${side}:${style}`;
          const glyphId = this.fillRuleEntries[ruleKey];
          if (!Number.isInteger(glyphId)) continue;
          const glyph = this.byGlyphId.get(glyphId);
          if (!glyph) throw new Error(`GraphSCII fill rule ${ruleKey} resolved to missing glyph ${glyphId}.`);
          results.set(glyph.codepointValue, glyph);
        }
      }
    }
    return [...results.values()];
  }

  connectorCandidatesForBoundaryPoints(points: readonly BoundaryPoint[]): GraphGlyph[] {
    const normalized = normalizePoints(points);
    if (normalized.length < 3) return [];
    return this.connectorByBoundarySignature.get(pointSignature(normalized)) ?? [];
  }

  straightCandidatesNearPixelCount(target: number, initialRadius = 10): GraphGlyph[] {
    return candidatesNearPixelCount(this.straightByPixelCount, this.straightGlyphs, target, initialRadius);
  }

  fillCandidatesNearPixelCount(target: number, tone: GraphSCIITone, initialRadius = 10): GraphGlyph[] {
    return candidatesNearPixelCount(this.fillByTonePixelCount[tone], this.fillByTone[tone], target, initialRadius);
  }
}

export function popcount16(value: number): number {
  let n = value & 0xffff;
  n -= (n >>> 1) & 0x5555;
  n = (n & 0x3333) + ((n >>> 2) & 0x3333);
  n = (n + (n >>> 4)) & 0x0f0f;
  return ((n * 0x0101) >>> 8) & 0x1f;
}

export function popcountByte(value: number): number {
  return popcount8(value);
}
