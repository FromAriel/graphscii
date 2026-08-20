import { formatCodepoint } from "./format.js";
import { ALL_FAMILIES, generate } from "./generator.js";
import {
  BMP_PRIVATE_USE_CAPACITY,
  BMP_PRIVATE_USE_END,
  BMP_PRIVATE_USE_START,
  RENDERER_ONLY_STYLES,
  SELECTED_ALLOCATION_ORDER,
  buildPaletteDecision,
  rasterizePaletteStyle,
  type PaletteResearchStyle,
} from "./palette.js";
import { bitmapKey } from "./raster.js";
import type { CandidateGlyph, GenerationResult, UniqueGlyph } from "./types.js";
import type { StraightFillSide } from "./fill.js";

export const GRAPHSCII_VOCABULARY_SCHEMA_VERSION = 1;
export const GRAPHSCII_VOCABULARY_INDEX_SCHEMA_VERSION = 1;
export const GRAPHSCII_ENCODED_OWNER_COUNT = 5796;
export const GRAPHSCII_RESERVE_START = 0xf6a4;
export const GRAPHSCII_RESERVE_COUNT = 604;
export const GRAPHSCII_LAST_ALLOCATED = GRAPHSCII_RESERVE_START - 1;
export const GRAPHSCII_STRAIGHT_ALIAS_COUNT = 832;
export const GRAPHSCII_FILL_STYLE_ALIAS_COUNT = 1664;
export const GRAPHSCII_ALL_SEMANTIC_ALIAS_COUNT = 10816;
export const GRAPHSCII_RENDERER_ONLY_ALIAS_COUNT = 3392;
export const GRAPHSCII_BOUNDARY_SIDE_STYLE_ALIAS_COUNT = 9984;

export const VOCABULARY_CANONICAL_CLASS_ORDER = [
  "straight",
  "solid-100",
  "medium-75",
  "light-25",
  "half-50",
] as const;

export type VocabularyCanonicalClass = (typeof VOCABULARY_CANONICAL_CLASS_ORDER)[number];
export type VocabularySemanticResolutionKind =
  | "encoded-owner"
  | "renderer-only-exact-reuse"
  | "renderer-only-derived";

export type VocabularyRendererOnlyReason =
  | "palette-style-not-encoded"
  | "one-pixel-half-demotion";

export interface VocabularyOwner {
  glyphId: number;
  codepoint: string;
  codepointValue: number;
  bitmapKey: string;
  canonicalClass: VocabularyCanonicalClass;
  allocationStatus: "published-straight" | "provisional-graphics-v0";
  firstSemanticAlias: string;
  semanticAliases: string[];
}

export interface VocabularySemanticResolution {
  aliasKey: string;
  semanticType: "straight" | "straight-fill";
  family: CandidateGlyph["family"];
  straightCandidateId: number;
  side: StraightFillSide | null;
  style: "straight" | PaletteResearchStyle;
  boundarySideStyleKey: string | null;
  bitmapKey: string;
  resolution: VocabularySemanticResolutionKind;
  glyphId: number | null;
  codepoint: string | null;
  rendererOnlyReason: VocabularyRendererOnlyReason | null;
  fallbackGlyphId: number | null;
  fallbackCodepoint: string | null;
  fallbackBitmapKey: string | null;
  fallbackHammingDistance: 1 | null;
}

export interface VocabularyStats {
  schemaVersion: number;
  encodedOwners: number;
  uniqueEncodedBitmapKeys: number;
  uniqueAllocatedCodepoints: number;
  firstCodepoint: string;
  lastAllocatedCodepoint: string;
  reserveStart: string;
  reserveEnd: string;
  reserveSlots: number;
  bmpPrivateUseCapacity: number;
  straightCodepointsUnchanged: boolean;
  semanticAliases: number;
  encodedSemanticAliases: number;
  rendererOnlySemanticAliases: number;
  rendererOnlyExactReuseAliases: number;
  rendererOnlyDerivedAliases: number;
  rendererOnlyUniqueDerivedBitmaps: number;
  boundarySideStyleAliases: number;
  canonicalClassCounts: Record<VocabularyCanonicalClass, number>;
  styleSemanticCounts: Record<string, number>;
  rendererOnlyByStyle: Record<string, { exactReuse: number; derived: number }>;
}

export interface VocabularyIndex<T> {
  format: "graphscii";
  formatVersion: 1;
  schema: string;
  schemaVersion: number;
  index: string;
  entryCount: number;
  entries: Record<string, T>;
}

export interface VocabularyIndexes {
  byCodepoint: VocabularyIndex<number>;
  byBitmap: VocabularyIndex<number>;
  byAlias: VocabularyIndex<VocabularySemanticResolution>;
  byOwner: VocabularyIndex<{
    codepoint: string;
    bitmapKey: string;
    canonicalClass: VocabularyCanonicalClass;
    semanticAliases: string[];
  }>;
  byBoundarySideStyle: VocabularyIndex<string>;
  rendererOnly: VocabularyIndex<VocabularySemanticResolution>;
}

export interface VocabularyRegistryResult {
  registry: {
    format: "graphscii";
    formatVersion: 1;
    schema: "graphscii-graphics-vocabulary";
    schemaVersion: number;
    status: "provisional-graphics-v0";
    canonicalCell: "8x16";
    bitmapSerialization: "v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex";
    allocation: {
      unicodeStart: string;
      unicodeEnd: string;
      reserveStart: string;
      reserveEnd: string;
      reserveSlots: number;
      rule: string;
      straightStability: string;
    };
    owners: VocabularyOwner[];
  };
  semantics: VocabularySemanticResolution[];
  stats: VocabularyStats;
  indexes: VocabularyIndexes;
}

const EXPECTED_CLASS_COUNTS: Record<VocabularyCanonicalClass, number> = {
  straight: 746,
  "solid-100": 1259,
  "medium-75": 1269,
  "light-25": 1315,
  "half-50": 1207,
};

const CLASS_BY_STYLE: Readonly<Record<"solid" | "medium" | "light" | "half", VocabularyCanonicalClass>> = {
  solid: "solid-100",
  medium: "medium-75",
  light: "light-25",
  half: "half-50",
};

function portLabel(port: CandidateGlyph["start"]): string {
  return `${port.edge}${port.index}`;
}

function straightAliasKey(candidate: CandidateGlyph): string {
  return `straight:${portLabel(candidate.start)}>${portLabel(candidate.end)}`;
}

function fillAliasKey(
  candidate: CandidateGlyph,
  side: StraightFillSide,
  style: PaletteResearchStyle,
): string {
  return `straight-fill:${candidate.family}:${portLabel(candidate.start)}>${portLabel(candidate.end)}:side${side}:${style}`;
}

function boundarySideStyleKey(
  candidate: CandidateGlyph,
  side: StraightFillSide,
  style: PaletteResearchStyle,
): string {
  return `${candidate.family}:${portLabel(candidate.start)}>${portLabel(candidate.end)}:side${side}:${style}`;
}

function ownerFromStraight(glyph: UniqueGlyph): VocabularyOwner {
  const aliases = glyph.aliases.map(straightAliasKey);
  return {
    glyphId: glyph.glyphId,
    codepoint: formatCodepoint(glyph.codepoint),
    codepointValue: glyph.codepoint,
    bitmapKey: glyph.bitmapKey,
    canonicalClass: "straight",
    allocationStatus: "published-straight",
    firstSemanticAlias: aliases[0] ?? `straight-owner:${glyph.glyphId}`,
    semanticAliases: aliases,
  };
}

function semanticResolution(
  candidate: CandidateGlyph,
  side: StraightFillSide | null,
  style: "straight" | PaletteResearchStyle,
  key: string,
  resolution: VocabularySemanticResolutionKind,
  owner: VocabularyOwner | null,
  rendererOnlyReason: VocabularyRendererOnlyReason | null = null,
  fallback: VocabularyOwner | null = null,
  fallbackBitmapKey: string | null = null,
): VocabularySemanticResolution {
  const aliasKey = side === null
    ? straightAliasKey(candidate)
    : fillAliasKey(candidate, side, style as PaletteResearchStyle);
  return {
    aliasKey,
    semanticType: side === null ? "straight" : "straight-fill",
    family: candidate.family,
    straightCandidateId: candidate.candidateId,
    side,
    style,
    boundarySideStyleKey: side === null
      ? null
      : boundarySideStyleKey(candidate, side, style as PaletteResearchStyle),
    bitmapKey: key,
    resolution,
    glyphId: owner?.glyphId ?? null,
    codepoint: owner?.codepoint ?? null,
    rendererOnlyReason,
    fallbackGlyphId: fallback?.glyphId ?? null,
    fallbackCodepoint: fallback?.codepoint ?? null,
    fallbackBitmapKey,
    fallbackHammingDistance: fallback ? 1 : null,
  };
}

function addExactAlias(owner: VocabularyOwner, aliasKey: string): void {
  if (!owner.semanticAliases.includes(aliasKey)) {
    owner.semanticAliases.push(aliasKey);
  }
}

function newOwner(
  owners: VocabularyOwner[],
  key: string,
  canonicalClass: VocabularyCanonicalClass,
  firstAlias: string,
): VocabularyOwner {
  const glyphId = owners.length;
  const codepointValue = BMP_PRIVATE_USE_START + glyphId;
  if (codepointValue >= GRAPHSCII_RESERVE_START) {
    throw new Error(`GraphSCII 4D.1 attempted to allocate inside the reserve at ${formatCodepoint(codepointValue)}.`);
  }
  const owner: VocabularyOwner = {
    glyphId,
    codepoint: formatCodepoint(codepointValue),
    codepointValue,
    bitmapKey: key,
    canonicalClass,
    allocationStatus: "provisional-graphics-v0",
    firstSemanticAlias: firstAlias,
    semanticAliases: [firstAlias],
  };
  owners.push(owner);
  return owner;
}

function makeIndex<T>(index: string, entries: Record<string, T>): VocabularyIndex<T> {
  return {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-vocabulary-index",
    schemaVersion: GRAPHSCII_VOCABULARY_INDEX_SCHEMA_VERSION,
    index,
    entryCount: Object.keys(entries).length,
    entries,
  };
}

function requireUniqueSemanticAliases(semantics: readonly VocabularySemanticResolution[]): void {
  const aliases = new Set<string>();
  const boundaryKeys = new Set<string>();
  for (const semantic of semantics) {
    if (aliases.has(semantic.aliasKey)) {
      throw new Error(`Duplicate GraphSCII semantic alias: ${semantic.aliasKey}.`);
    }
    aliases.add(semantic.aliasKey);
    if (semantic.boundarySideStyleKey) {
      if (boundaryKeys.has(semantic.boundarySideStyleKey)) {
        throw new Error(`Duplicate boundary/side/style key: ${semantic.boundarySideStyleKey}.`);
      }
      boundaryKeys.add(semantic.boundarySideStyleKey);
    }
  }
}

function verifyFrozenCounts(
  owners: readonly VocabularyOwner[],
  semantics: readonly VocabularySemanticResolution[],
  classCounts: Record<VocabularyCanonicalClass, number>,
): void {
  if (owners.length !== GRAPHSCII_ENCODED_OWNER_COUNT) {
    throw new Error(`GraphSCII 4D.1 owner count mismatch: ${owners.length}.`);
  }
  const bitmapCount = new Set(owners.map((owner) => owner.bitmapKey)).size;
  const codepointCount = new Set(owners.map((owner) => owner.codepoint)).size;
  if (bitmapCount !== GRAPHSCII_ENCODED_OWNER_COUNT || codepointCount !== GRAPHSCII_ENCODED_OWNER_COUNT) {
    throw new Error(`GraphSCII 4D.1 uniqueness mismatch: ${bitmapCount} bitmaps / ${codepointCount} codepoints.`);
  }
  if (owners[0]?.codepointValue !== BMP_PRIVATE_USE_START) {
    throw new Error("GraphSCII 4D.1 first allocation is not U+E000.");
  }
  if (owners.at(-1)?.codepointValue !== GRAPHSCII_LAST_ALLOCATED) {
    throw new Error(`GraphSCII 4D.1 last allocation is not ${formatCodepoint(GRAPHSCII_LAST_ALLOCATED)}.`);
  }
  if (semantics.length !== GRAPHSCII_ALL_SEMANTIC_ALIAS_COUNT) {
    throw new Error(`GraphSCII 4D.1 semantic alias count mismatch: ${semantics.length}.`);
  }
  for (const canonicalClass of VOCABULARY_CANONICAL_CLASS_ORDER) {
    if (classCounts[canonicalClass] !== EXPECTED_CLASS_COUNTS[canonicalClass]) {
      throw new Error(
        `GraphSCII 4D.1 ${canonicalClass} count mismatch: ${classCounts[canonicalClass]} !== ${EXPECTED_CLASS_COUNTS[canonicalClass]}.`,
      );
    }
  }
}

export function buildGraphicsVocabularyRegistry(
  straightResult: GenerationResult = generate(ALL_FAMILIES),
): VocabularyRegistryResult {
  if (straightResult.glyphs.length !== 746 || straightResult.candidates.length !== GRAPHSCII_STRAIGHT_ALIAS_COUNT) {
    throw new Error("GraphSCII 4D.1 requires the frozen 746-owner / 832-definition straight baseline.");
  }

  const decision = buildPaletteDecision(straightResult);
  if (
    decision.selected.allocatedVisuals !== GRAPHSCII_ENCODED_OWNER_COUNT ||
    decision.selected.puaReserve !== GRAPHSCII_RESERVE_COUNT ||
    decision.selected.halfOnePixelDemotedVisuals !== 62 ||
    decision.selected.halfOnePixelDemotedSemantics !== 64
  ) {
    throw new Error("GraphSCII 4D.1 palette decision no longer matches the frozen 4C gate.");
  }

  const owners = straightResult.glyphs.map(ownerFromStraight);
  const ownerByBitmap = new Map(owners.map((owner) => [owner.bitmapKey, owner]));
  const semantics: VocabularySemanticResolution[] = [];
  const demotions = new Map(decision.halfDemotions.map((entry) => [entry.bitmapKey, entry]));

  for (const candidate of straightResult.candidates) {
    const owner = ownerByBitmap.get(candidate.bitmapKey);
    if (!owner) {
      throw new Error(`Missing straight owner for candidate ${candidate.candidateId}.`);
    }
    semantics.push(semanticResolution(candidate, null, "straight", candidate.bitmapKey, "encoded-owner", owner));
  }

  for (const style of SELECTED_ALLOCATION_ORDER) {
    const canonicalClass = CLASS_BY_STYLE[style];
    if (!canonicalClass) {
      throw new Error(`Missing canonical class for selected style ${style}.`);
    }
    for (const candidate of straightResult.candidates) {
      for (const side of ["A", "B"] as const) {
        const bitmap = rasterizePaletteStyle(candidate, side, style);
        const key = bitmapKey(bitmap);
        const aliasKey = fillAliasKey(candidate, side, style);
        const existing = ownerByBitmap.get(key);
        if (existing) {
          addExactAlias(existing, aliasKey);
          semantics.push(semanticResolution(candidate, side, style, key, "encoded-owner", existing));
          continue;
        }

        if (style === "half") {
          const demotion = demotions.get(key);
          if (demotion) {
            const fallback = ownerByBitmap.get(demotion.nearestAllocatedBitmapKey);
            if (!fallback) {
              throw new Error(`Half-tone demotion fallback is not encoded: ${demotion.nearestAllocatedBitmapKey}.`);
            }
            semantics.push(semanticResolution(
              candidate,
              side,
              style,
              key,
              "renderer-only-derived",
              null,
              "one-pixel-half-demotion",
              fallback,
              demotion.nearestAllocatedBitmapKey,
            ));
            continue;
          }
        }

        const owner = newOwner(owners, key, canonicalClass, aliasKey);
        ownerByBitmap.set(key, owner);
        semantics.push(semanticResolution(candidate, side, style, key, "encoded-owner", owner));
      }
    }
  }

  for (const style of RENDERER_ONLY_STYLES) {
    for (const candidate of straightResult.candidates) {
      for (const side of ["A", "B"] as const) {
        const bitmap = rasterizePaletteStyle(candidate, side, style);
        const key = bitmapKey(bitmap);
        const aliasKey = fillAliasKey(candidate, side, style);
        const owner = ownerByBitmap.get(key) ?? null;
        if (owner) {
          addExactAlias(owner, aliasKey);
          semantics.push(semanticResolution(
            candidate,
            side,
            style,
            key,
            "renderer-only-exact-reuse",
            owner,
            "palette-style-not-encoded",
          ));
        } else {
          semantics.push(semanticResolution(
            candidate,
            side,
            style,
            key,
            "renderer-only-derived",
            null,
            "palette-style-not-encoded",
          ));
        }
      }
    }
  }

  requireUniqueSemanticAliases(semantics);

  const classCounts = Object.fromEntries(
    VOCABULARY_CANONICAL_CLASS_ORDER.map((canonicalClass) => [
      canonicalClass,
      owners.filter((owner) => owner.canonicalClass === canonicalClass).length,
    ]),
  ) as Record<VocabularyCanonicalClass, number>;
  verifyFrozenCounts(owners, semantics, classCounts);

  for (let glyphId = 0; glyphId < straightResult.glyphs.length; glyphId += 1) {
    const legacy = straightResult.glyphs[glyphId];
    const owner = owners[glyphId];
    if (!legacy || !owner || owner.codepointValue !== legacy.codepoint || owner.bitmapKey !== legacy.bitmapKey) {
      throw new Error(`Published straight owner ${glyphId} was renumbered or changed.`);
    }
  }

  const byCodepointEntries: Record<string, number> = {};
  const byBitmapEntries: Record<string, number> = {};
  const byAliasEntries: Record<string, VocabularySemanticResolution> = {};
  const byOwnerEntries: VocabularyIndexes["byOwner"]["entries"] = {};
  const byBoundaryEntries: Record<string, string> = {};
  const rendererOnlyEntries: Record<string, VocabularySemanticResolution> = {};

  for (const owner of owners) {
    byCodepointEntries[owner.codepoint] = owner.glyphId;
    byBitmapEntries[owner.bitmapKey] = owner.glyphId;
    byOwnerEntries[String(owner.glyphId)] = {
      codepoint: owner.codepoint,
      bitmapKey: owner.bitmapKey,
      canonicalClass: owner.canonicalClass,
      semanticAliases: [...owner.semanticAliases],
    };
  }

  for (const semantic of semantics) {
    byAliasEntries[semantic.aliasKey] = semantic;
    if (semantic.boundarySideStyleKey) {
      byBoundaryEntries[semantic.boundarySideStyleKey] = semantic.aliasKey;
    }
    if (semantic.resolution !== "encoded-owner") {
      rendererOnlyEntries[semantic.aliasKey] = semantic;
    }
  }

  const indexes: VocabularyIndexes = {
    byCodepoint: makeIndex("by-codepoint", byCodepointEntries),
    byBitmap: makeIndex("by-bitmap", byBitmapEntries),
    byAlias: makeIndex("by-alias", byAliasEntries),
    byOwner: makeIndex("by-owner", byOwnerEntries),
    byBoundarySideStyle: makeIndex("by-boundary-side-style", byBoundaryEntries),
    rendererOnly: makeIndex("renderer-only", rendererOnlyEntries),
  };

  if (
    indexes.byCodepoint.entryCount !== GRAPHSCII_ENCODED_OWNER_COUNT ||
    indexes.byBitmap.entryCount !== GRAPHSCII_ENCODED_OWNER_COUNT ||
    indexes.byOwner.entryCount !== GRAPHSCII_ENCODED_OWNER_COUNT ||
    indexes.byAlias.entryCount !== GRAPHSCII_ALL_SEMANTIC_ALIAS_COUNT ||
    indexes.byBoundarySideStyle.entryCount !== GRAPHSCII_BOUNDARY_SIDE_STYLE_ALIAS_COUNT ||
    indexes.rendererOnly.entryCount !== GRAPHSCII_RENDERER_ONLY_ALIAS_COUNT
  ) {
    throw new Error("GraphSCII 4D.1 index cardinality regression.");
  }

  const rendererOnlySemantics = semantics.filter((semantic) => semantic.resolution !== "encoded-owner");
  const rendererOnlyExact = rendererOnlySemantics.filter((semantic) => semantic.resolution === "renderer-only-exact-reuse");
  const rendererOnlyDerived = rendererOnlySemantics.filter((semantic) => semantic.resolution === "renderer-only-derived");
  const styleSemanticCounts: Record<string, number> = {};
  const rendererOnlyByStyle: Record<string, { exactReuse: number; derived: number }> = {};
  for (const semantic of semantics) {
    styleSemanticCounts[semantic.style] = (styleSemanticCounts[semantic.style] ?? 0) + 1;
    if (semantic.resolution !== "encoded-owner") {
      const style = semantic.style;
      const current = rendererOnlyByStyle[style] ?? { exactReuse: 0, derived: 0 };
      if (semantic.resolution === "renderer-only-exact-reuse") {
        current.exactReuse += 1;
      } else {
        current.derived += 1;
      }
      rendererOnlyByStyle[style] = current;
    }
  }

  const stats: VocabularyStats = {
    schemaVersion: GRAPHSCII_VOCABULARY_SCHEMA_VERSION,
    encodedOwners: owners.length,
    uniqueEncodedBitmapKeys: new Set(owners.map((owner) => owner.bitmapKey)).size,
    uniqueAllocatedCodepoints: new Set(owners.map((owner) => owner.codepoint)).size,
    firstCodepoint: formatCodepoint(BMP_PRIVATE_USE_START),
    lastAllocatedCodepoint: formatCodepoint(GRAPHSCII_LAST_ALLOCATED),
    reserveStart: formatCodepoint(GRAPHSCII_RESERVE_START),
    reserveEnd: formatCodepoint(BMP_PRIVATE_USE_END),
    reserveSlots: GRAPHSCII_RESERVE_COUNT,
    bmpPrivateUseCapacity: BMP_PRIVATE_USE_CAPACITY,
    straightCodepointsUnchanged: true,
    semanticAliases: semantics.length,
    encodedSemanticAliases: semantics.length - rendererOnlySemantics.length,
    rendererOnlySemanticAliases: rendererOnlySemantics.length,
    rendererOnlyExactReuseAliases: rendererOnlyExact.length,
    rendererOnlyDerivedAliases: rendererOnlyDerived.length,
    rendererOnlyUniqueDerivedBitmaps: new Set(rendererOnlyDerived.map((semantic) => semantic.bitmapKey)).size,
    boundarySideStyleAliases: indexes.byBoundarySideStyle.entryCount,
    canonicalClassCounts: classCounts,
    styleSemanticCounts,
    rendererOnlyByStyle,
  };

  return {
    registry: {
      format: "graphscii",
      formatVersion: 1,
      schema: "graphscii-graphics-vocabulary",
      schemaVersion: GRAPHSCII_VOCABULARY_SCHEMA_VERSION,
      status: "provisional-graphics-v0",
      canonicalCell: "8x16",
      bitmapSerialization: "v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex",
      allocation: {
        unicodeStart: formatCodepoint(BMP_PRIVATE_USE_START),
        unicodeEnd: formatCodepoint(GRAPHSCII_LAST_ALLOCATED),
        reserveStart: formatCodepoint(GRAPHSCII_RESERVE_START),
        reserveEnd: formatCodepoint(BMP_PRIVATE_USE_END),
        reserveSlots: GRAPHSCII_RESERVE_COUNT,
        rule: "published straights, then novel solid, 75% medium, 25% light, retained 50% half; exact bitmap reuse is global",
        straightStability: "glyph IDs 0..745 and U+E000..U+E2E9 are preserved byte-for-byte from straight-v0",
      },
      owners,
    },
    semantics,
    stats,
    indexes,
  };
}
