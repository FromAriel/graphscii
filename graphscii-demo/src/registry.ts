import { portPoint, type PortName } from "./geometry-engine";
import type { GraphGlyph, GraphSCIITone, Point, RegistryJson } from "./types";

const EXPECTED_OWNER_COUNT = 6397;
const EXPECTED_PAIR_COUNT = 1664;
const EXPECTED_BOUNDARY_STYLE_COUNT = 9984;
const EXPECTED_ALIAS_COUNT = 10816;
const EXPECTED_ORTHOGONAL_SEMANTICS = 640;
const EXPECTED_DIAGONAL_SEMANTICS = 60;

const MASK_ROWS_8: Record<GraphSCIITone, readonly number[]> = {
  100: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
  75: [0x55, 0xff, 0x55, 0xff, 0x55, 0xff, 0x55, 0xff],
  50: [0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa],
  25: [0x55, 0x00, 0x55, 0x00, 0x55, 0x00, 0x55, 0x00],
};

const STYLE_BY_TONE: Record<GraphSCIITone, "solid" | "medium" | "half" | "light"> = {
  100: "solid",
  75: "medium",
  50: "half",
  25: "light",
};

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

interface VocabularyIndex<T> {
  format: "graphscii";
  formatVersion: 1;
  schema: string;
  schemaVersion: number;
  index: string;
  entryCount: number;
  entries: Record<string, T>;
}

interface SemanticResolution {
  aliasKey: string;
  semanticType: "straight" | "straight-fill";
  family: string;
  straightCandidateId: number;
  side: "A" | "B" | null;
  style: string;
  boundarySideStyleKey: string | null;
  bitmapKey: string;
  resolution: "encoded-owner" | "renderer-only-exact-reuse" | "renderer-only-derived";
  glyphId: number | null;
  codepoint: string | null;
  rendererOnlyReason: string | null;
  fallbackGlyphId: number | null;
  fallbackCodepoint: string | null;
  fallbackBitmapKey: string | null;
  fallbackHammingDistance: 1 | null;
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

export interface StraightResolution {
  glyph: GraphGlyph;
  requestedStart: PortName;
  requestedEnd: PortName;
  authoredStart: PortName;
  authoredEnd: PortName;
  family: string;
  candidateId: number;
}

export interface FillResolution {
  glyph: GraphGlyph | null;
  semanticKey: string;
  exact: boolean;
  reason: string | null;
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

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load GraphSCII rule asset ${url.pathname} (${response.status}).`);
  return await response.json() as T;
}

function familyFromPorts(start: PortName, end: PortName): string {
  return `${start[0]}${end[0]}`;
}

function bitmapKeyForTone(tone: GraphSCIITone): string {
  const rows = [...MASK_ROWS_8[tone], ...MASK_ROWS_8[tone]];
  return rows.map((row) => row.toString(16).padStart(2, "0")).join("");
}

function pointSignature(points: readonly Point[]): string {
  const unique = new Map<string, Point>();
  for (const point of points) unique.set(`${point.x},${point.y}`, point);
  return [...unique.values()]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((point) => `${point.x},${point.y}`)
    .join("|");
}

function orthogonalPoints(semantic: OrthogonalSemanticJson): Point[] {
  const points: Point[] = [];
  if (semantic.mask.includes("N")) points.push({ x: semantic.x, y: 0 });
  if (semantic.mask.includes("E")) points.push({ x: 7, y: semantic.y });
  if (semantic.mask.includes("S")) points.push({ x: semantic.x, y: 15 });
  if (semantic.mask.includes("W")) points.push({ x: 0, y: semantic.y });
  return points;
}

function diagonalPoints(semantic: DiagonalSemanticJson): Point[] {
  const { left, right, top, bottom } = semantic.bounds;
  const pointsByLeg: Record<string, Point> = {
    NW: { x: left, y: top },
    NE: { x: right, y: top },
    SE: { x: right, y: bottom },
    SW: { x: left, y: bottom },
  };
  const missing = semantic.mask.startsWith("MISSING_") ? semantic.mask.slice("MISSING_".length) : null;
  return Object.entries(pointsByLeg).filter(([leg]) => leg !== missing).map(([, point]) => point);
}

function crossForAuthoredLine(start: PortName, end: PortName, point: Point): number {
  const a = portPoint(start);
  const b = portPoint(end);
  return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
}

export class GlyphRegistry {
  readonly glyphs: GraphGlyph[];
  readonly byCodepoint = new Map<number, GraphGlyph>();
  readonly toneMasks: Record<GraphSCIITone, Uint8Array>;

  private readonly byGlyphId = new Map<number, GraphGlyph>();
  private readonly byBitmap = new Map<string, GraphGlyph>();
  private readonly pairEntries: Record<string, PairEntry>;
  private readonly boundaryEntries: Record<string, string>;
  private readonly aliasEntries: Record<string, SemanticResolution>;
  private readonly connectorBySignature = new Map<string, GraphGlyph>();

  private constructor(
    glyphs: GraphGlyph[],
    pairIndex: ConnectionPairIndexJson,
    boundaryIndex: VocabularyIndex<string>,
    aliasIndex: VocabularyIndex<SemanticResolution>,
    orthogonal: OrthogonalConnectorsJson,
    diagonal: DiagonalConnectorsJson,
    diagonalSelection: DiagonalSelectionJson,
  ) {
    this.glyphs = glyphs;
    this.pairEntries = pairIndex.entries;
    this.boundaryEntries = boundaryIndex.entries;
    this.aliasEntries = aliasIndex.entries;

    if (pairIndex.index !== "by-connection-pair" || pairIndex.entryCount !== EXPECTED_PAIR_COUNT) {
      throw new Error("GraphSCII straight connection-pair index is not the published 1,664-entry table.");
    }
    if (boundaryIndex.index !== "by-boundary-side-style" || boundaryIndex.entryCount !== EXPECTED_BOUNDARY_STYLE_COUNT) {
      throw new Error("GraphSCII fill index is not the published 9,984-entry boundary/side/style table.");
    }
    if (aliasIndex.index !== "by-alias" || aliasIndex.entryCount !== EXPECTED_ALIAS_COUNT) {
      throw new Error("GraphSCII semantic alias index is not the published 10,816-entry table.");
    }
    if (orthogonal.schema !== "graphscii-orthogonal-connectors" || orthogonal.semantics.length !== EXPECTED_ORTHOGONAL_SEMANTICS) {
      throw new Error("GraphSCII orthogonal connector table is not the published 640-semantic grammar.");
    }
    if (diagonal.schema !== "graphscii-diagonal-connectors"
      || diagonalSelection.schema !== "graphscii-final-diagonal-connector-selection"
      || diagonalSelection.selectedSemanticCount !== EXPECTED_DIAGONAL_SEMANTICS
      || diagonalSelection.selectedSemanticIds.length !== EXPECTED_DIAGONAL_SEMANTICS) {
      throw new Error("GraphSCII diagonal connector table is not the published 60-semantic selection.");
    }

    for (const glyph of glyphs) {
      this.byCodepoint.set(glyph.codepointValue, glyph);
      this.byGlyphId.set(glyph.glyphId, glyph);
      this.byBitmap.set(glyph.bitmapKey, glyph);
    }

    const addConnector = (points: Point[], bitmapKey: string, id: string): void => {
      const signature = pointSignature(points);
      if (signature.split("|").filter(Boolean).length < 3) return;
      const glyph = this.byBitmap.get(bitmapKey);
      if (!glyph) throw new Error(`Connector semantic ${id} has no canonical GraphSCII v1 owner.`);
      const existing = this.connectorBySignature.get(signature);
      if (existing && existing.codepointValue !== glyph.codepointValue) {
        throw new Error(`Connector signature ${signature} is ambiguous between ${existing.label} and ${glyph.label}.`);
      }
      this.connectorBySignature.set(signature, glyph);
    };

    for (const semantic of orthogonal.semantics) addConnector(orthogonalPoints(semantic), semantic.bitmapKey, semantic.id);
    const selected = new Set(diagonalSelection.selectedSemanticIds);
    let selectedCount = 0;
    for (const semantic of diagonal.semantics) {
      if (!selected.has(semantic.id)) continue;
      selectedCount += 1;
      addConnector(diagonalPoints(semantic), semantic.bitmapKey, semantic.id);
    }
    if (selectedCount !== EXPECTED_DIAGONAL_SEMANTICS) {
      throw new Error(`Resolved ${selectedCount} selected diagonal semantics instead of ${EXPECTED_DIAGONAL_SEMANTICS}.`);
    }

    this.toneMasks = {
      100: Uint8Array.from([...MASK_ROWS_8[100], ...MASK_ROWS_8[100]]),
      75: Uint8Array.from([...MASK_ROWS_8[75], ...MASK_ROWS_8[75]]),
      50: Uint8Array.from([...MASK_ROWS_8[50], ...MASK_ROWS_8[50]]),
      25: Uint8Array.from([...MASK_ROWS_8[25], ...MASK_ROWS_8[25]]),
    };
  }

  static async load(url: string): Promise<GlyphRegistry> {
    const registryUrl = new URL(url, window.location.href);
    const baseUrl = new URL("./", registryUrl);
    const [registry, pairIndex, boundaryIndex, aliasIndex, orthogonal, diagonal, diagonalSelection] = await Promise.all([
      fetchJson<RegistryJson>(registryUrl),
      fetchJson<ConnectionPairIndexJson>(new URL("by-connection-pair.json", baseUrl)),
      fetchJson<VocabularyIndex<string>>(new URL("by-boundary-side-style.json", baseUrl)),
      fetchJson<VocabularyIndex<SemanticResolution>>(new URL("by-alias.json", baseUrl)),
      fetchJson<OrthogonalConnectorsJson>(new URL("orthogonal-connectors.json", baseUrl)),
      fetchJson<DiagonalConnectorsJson>(new URL("diagonal-connectors.json", baseUrl)),
      fetchJson<DiagonalSelectionJson>(new URL("diagonal-selection.json", baseUrl)),
    ]);

    if (registry.format !== "graphscii" || !Array.isArray(registry.owners)) throw new Error("Unrecognized GraphSCII registry format.");
    if (registry.owners.length !== EXPECTED_OWNER_COUNT) {
      throw new Error(`Expected ${EXPECTED_OWNER_COUNT} GraphSCII owners; found ${registry.owners.length}.`);
    }
    const glyphs = registry.owners.map(makeGlyph);
    if (new Set(glyphs.map((glyph) => glyph.codepointValue)).size !== EXPECTED_OWNER_COUNT
      || new Set(glyphs.map((glyph) => glyph.bitmapKey)).size !== EXPECTED_OWNER_COUNT) {
      throw new Error("GraphSCII registry violates unique codepoint/bitmap ownership.");
    }
    return new GlyphRegistry(glyphs, pairIndex, boundaryIndex, aliasIndex, orthogonal, diagonal, diagonalSelection);
  }

  resolveStraight(start: PortName, end: PortName): StraightResolution | null {
    if (start === end) return null;
    const entry = this.pairEntries[`${start}>${end}`];
    if (!entry) return null;
    const glyph = this.byGlyphId.get(entry.glyphId);
    if (!glyph) throw new Error(`Straight semantic ${start}>${end} points to missing glyph ${entry.glyphId}.`);
    const authoredStart = (entry.reversed ? end : start) as PortName;
    const authoredEnd = (entry.reversed ? start : end) as PortName;
    const semanticAlias = `straight:${authoredStart}>${authoredEnd}`;
    if (!glyph.label.includes("straight") && glyph.canonicalClass !== "straight") {
      throw new Error(`Straight semantic ${semanticAlias} did not resolve to a straight owner.`);
    }
    return {
      glyph,
      requestedStart: start,
      requestedEnd: end,
      authoredStart,
      authoredEnd,
      family: familyFromPorts(authoredStart, authoredEnd),
      candidateId: entry.candidateId,
    };
  }

  resolveFillForInterior(
    start: PortName,
    end: PortName,
    tone: GraphSCIITone,
    insideLocalPixelCenters: readonly Point[],
  ): FillResolution {
    const straight = this.resolveStraight(start, end);
    if (!straight) return { glyph: null, semanticKey: `${start}>${end}`, exact: false, reason: "unsupported fill boundary" };
    let chosen: Point | null = null;
    let chosenCross = 0;
    for (const point of insideLocalPixelCenters) {
      const cross = crossForAuthoredLine(straight.authoredStart, straight.authoredEnd, point);
      if (Math.abs(cross) > Math.abs(chosenCross)) {
        chosen = point;
        chosenCross = cross;
      }
    }
    if (!chosen || Math.abs(chosenCross) <= 1e-9) {
      return { glyph: null, semanticKey: `${start}>${end}`, exact: false, reason: "fill side is indeterminate" };
    }
    const side = chosenCross > 0 ? "A" : "B";
    const style = STYLE_BY_TONE[tone];
    const key = `${straight.family}:${straight.authoredStart}>${straight.authoredEnd}:side${side}:${style}`;
    const aliasKey = this.boundaryEntries[key];
    if (!aliasKey) return { glyph: null, semanticKey: key, exact: false, reason: "published fill semantic missing" };
    const semantic = this.aliasEntries[aliasKey];
    if (!semantic) return { glyph: null, semanticKey: key, exact: false, reason: "published fill alias missing" };
    if (semantic.glyphId === null || semantic.codepoint === null) {
      return {
        glyph: null,
        semanticKey: key,
        exact: false,
        reason: semantic.rendererOnlyReason ?? semantic.resolution,
      };
    }
    const glyph = this.byGlyphId.get(semantic.glyphId);
    if (!glyph) throw new Error(`Fill semantic ${key} points to missing glyph ${semantic.glyphId}.`);
    if (glyph.bitmapKey !== semantic.bitmapKey) {
      throw new Error(`Fill semantic ${key} is not an exact bitmap reuse of its canonical owner.`);
    }
    return { glyph, semanticKey: key, exact: true, reason: null };
  }

  resolveFullFill(tone: GraphSCIITone): GraphGlyph {
    const key = bitmapKeyForTone(tone);
    const glyph = this.byBitmap.get(key);
    if (!glyph) throw new Error(`GraphSCII ${tone}% full-cell bitmap has no canonical encoded owner.`);
    return glyph;
  }

  resolveConnector(ports: readonly PortName[]): GraphGlyph | null {
    const points = ports.map(portPoint);
    const signature = pointSignature(points);
    if (signature.split("|").filter(Boolean).length < 3) return null;
    return this.connectorBySignature.get(signature) ?? null;
  }
}
