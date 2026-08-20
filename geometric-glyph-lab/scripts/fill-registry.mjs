import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ALL_FAMILIES,
  CELL_HEIGHT,
  CELL_WIDTH,
  generate,
  generateStraightSolidFills,
} from "../dist/core/index.js";

export const FILL_REGISTRY_SCHEMA_VERSION = 1;
export const FILL_LOOKUP_SCHEMA_VERSION = 1;

const BITMAP_SERIALIZATION =
  "v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex";

function formatPort(port) {
  return `${port.edge}${port.index}`;
}

function bitmapRecord(bitmap) {
  const rowsHex = Array.from(bitmap, (row) => row.toString(16).padStart(2, "0"));
  return {
    rowsHex,
    key: rowsHex.join(""),
  };
}

function ownerRecord(candidate) {
  if (candidate.visualDisposition === "reuse-existing-straight") {
    return {
      kind: "straight-glyph",
      glyphId: candidate.canonicalGlyphId,
      codepoint: candidate.canonicalCodepoint,
      fillVisualId: null,
      allocationStatus: "allocated-straight-v0",
    };
  }

  return {
    kind: "fill-visual",
    glyphId: null,
    codepoint: null,
    fillVisualId: candidate.canonicalFillVisualId,
    allocationStatus: "unallocated-research",
  };
}

function ownerKey(owner) {
  return owner.kind === "straight-glyph"
    ? `straight-glyph:${owner.glyphId}`
    : `fill-visual:${owner.fillVisualId}`;
}

function serializeCandidate(candidate) {
  const start = formatPort(candidate.start);
  const end = formatPort(candidate.end);
  const owner = ownerRecord(candidate);
  return {
    fillCandidateId: candidate.fillCandidateId,
    straightCandidateId: candidate.straightCandidateId,
    type: "straight-fill",
    style: "solid",
    family: candidate.family,
    start,
    end,
    side: candidate.side,
    aliasKey: candidate.aliasKey,
    boundarySideKey: `${candidate.family}:${start}>${end}:side${candidate.side}`,
    bitmap: bitmapRecord(candidate.bitmap),
    visualDisposition: candidate.visualDisposition,
    owner,
  };
}

function pushObjectArray(object, key, value) {
  if (!object[key]) {
    object[key] = [];
  }
  object[key].push(value);
}

function buildIndexes(candidates) {
  const byAlias = {};
  const byBitmap = {};
  const byBoundarySide = {};
  const byStraightCandidate = {};
  const byOwner = {};

  for (const candidate of candidates) {
    byAlias[candidate.aliasKey] = candidate.fillCandidateId;
    byBoundarySide[candidate.boundarySideKey] = candidate.fillCandidateId;

    const straightKey = String(candidate.straightCandidateId);
    if (!byStraightCandidate[straightKey]) {
      byStraightCandidate[straightKey] = { A: null, B: null };
    }
    byStraightCandidate[straightKey][candidate.side] = candidate.fillCandidateId;

    const owner = ownerKey(candidate.owner);
    pushObjectArray(byOwner, owner, candidate.fillCandidateId);

    if (!byBitmap[candidate.bitmap.key]) {
      byBitmap[candidate.bitmap.key] = {
        owner: candidate.owner,
        fillCandidateIds: [],
      };
    }
    byBitmap[candidate.bitmap.key].fillCandidateIds.push(candidate.fillCandidateId);
  }

  const common = {
    format: "graphscii",
    formatVersion: 1,
    registrySchemaVersion: FILL_REGISTRY_SCHEMA_VERSION,
    lookupSchemaVersion: FILL_LOOKUP_SCHEMA_VERSION,
  };

  return {
    byAlias: {
      ...common,
      index: "fill-by-alias",
      keyFormat: "straight-fill:FAMILY:START>END:sideA|sideB:solid",
      valueFormat: "fillCandidateId",
      entryCount: Object.keys(byAlias).length,
      entries: byAlias,
    },
    byBitmap: {
      ...common,
      index: "fill-by-bitmap",
      keyFormat: BITMAP_SERIALIZATION,
      valueFormat: "{owner,fillCandidateIds[]}",
      entryCount: Object.keys(byBitmap).length,
      entries: byBitmap,
    },
    byBoundarySide: {
      ...common,
      index: "fill-by-boundary-side",
      keyFormat: "FAMILY:START>END:sideA|sideB",
      valueFormat: "fillCandidateId",
      entryCount: Object.keys(byBoundarySide).length,
      entries: byBoundarySide,
    },
    byStraightCandidate: {
      ...common,
      index: "fill-by-straight-candidate",
      keyFormat: "decimal straight candidate ID",
      valueFormat: "{A:fillCandidateId,B:fillCandidateId}",
      entryCount: Object.keys(byStraightCandidate).length,
      entries: byStraightCandidate,
    },
    byOwner: {
      ...common,
      index: "fill-by-owner",
      keyFormat: "straight-glyph:ID or fill-visual:ID",
      valueFormat: "fillCandidateId[]",
      entryCount: Object.keys(byOwner).length,
      entries: byOwner,
    },
  };
}

function buildRegistryData() {
  const straight = generate(ALL_FAMILIES);
  const generated = generateStraightSolidFills(straight);
  const candidates = generated.candidates.map(serializeCandidate);
  const candidateIdsByVisual = new Map();

  for (const candidate of candidates) {
    if (candidate.owner.kind !== "fill-visual") {
      continue;
    }
    const id = candidate.owner.fillVisualId;
    if (!candidateIdsByVisual.has(id)) {
      candidateIdsByVisual.set(id, []);
    }
    candidateIdsByVisual.get(id).push(candidate.fillCandidateId);
  }

  const visuals = generated.visuals.map((visual) => ({
    fillVisualId: visual.visualId,
    allocationStatus: "unallocated-research",
    glyphId: null,
    codepoint: null,
    bitmap: bitmapRecord(visual.bitmap),
    aliasCount: visual.aliasCount,
    firstFillCandidateId: visual.firstFillCandidateId,
    fillCandidateIds: candidateIdsByVisual.get(visual.visualId) ?? [],
  }));

  const indexes = buildIndexes(candidates);
  const stats = {
    format: "graphscii",
    formatVersion: 1,
    registry: "straight-solid-fills",
    registrySchemaVersion: FILL_REGISTRY_SCHEMA_VERSION,
    status: "research-unallocated",
    ...generated.stats,
    lookupIndexes: {
      byAlias: indexes.byAlias.entryCount,
      byBitmap: indexes.byBitmap.entryCount,
      byBoundarySide: indexes.byBoundarySide.entryCount,
      byStraightCandidate: indexes.byStraightCandidate.entryCount,
      byOwner: indexes.byOwner.entryCount,
    },
  };

  const registry = {
    format: "graphscii",
    formatVersion: 1,
    registry: "straight-solid-fills",
    registrySchemaVersion: FILL_REGISTRY_SCHEMA_VERSION,
    status: "research-unallocated",
    generator: "geometric-glyph-lab/fill-registry",
    cell: {
      width: CELL_WIDTH,
      height: CELL_HEIGHT,
      orientation: "8-columns-by-16-rows",
    },
    bitmapSerialization: BITMAP_SERIALIZATION,
    source: {
      class: "straight-lines",
      mathematicalDefinitions: straight.candidates.length,
      canonicalStraightGlyphs: straight.glyphs.length,
      publishedRange: "U+00E000..U+00E2E9",
    },
    appearance: {
      style: "solid",
      sideSemantics: "oriented-cross-product",
      boundaryStroke: "forced-on",
    },
    allocation: {
      status: "unallocated-research",
      codepointsAssigned: 0,
      firstAvailableProvisionalCodepoint: "U+00E2EA",
      note: "Fill visual IDs are stable research identifiers only. Unicode allocation is deferred until the Milestone 4C palette/address-space gate.",
    },
    counts: generated.stats,
    lookupIndexes: {
      byAlias: "manifest/fills/indexes/by-alias.json",
      byBitmap: "manifest/fills/indexes/by-bitmap.json",
      byBoundarySide: "manifest/fills/indexes/by-boundary-side.json",
      byStraightCandidate: "manifest/fills/indexes/by-straight-candidate.json",
      byOwner: "manifest/fills/indexes/by-owner.json",
    },
    candidates,
    visuals,
  };

  return { registry, stats, indexes };
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

async function writeJson(filename, value) {
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`);
}

export async function buildFillRegistry(root) {
  const data = buildRegistryData();
  const fillRoot = path.join(root, "manifest", "fills");
  const indexRoot = path.join(fillRoot, "indexes");
  await mkdir(indexRoot, { recursive: true });

  await Promise.all([
    writeJson(path.join(fillRoot, "registry.json"), data.registry),
    writeJson(path.join(fillRoot, "stats.json"), data.stats),
    writeJson(path.join(indexRoot, "by-alias.json"), data.indexes.byAlias),
    writeJson(path.join(indexRoot, "by-bitmap.json"), data.indexes.byBitmap),
    writeJson(path.join(indexRoot, "by-boundary-side.json"), data.indexes.byBoundarySide),
    writeJson(path.join(indexRoot, "by-straight-candidate.json"), data.indexes.byStraightCandidate),
    writeJson(path.join(indexRoot, "by-owner.json"), data.indexes.byOwner),
  ]);

  return data;
}

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} does not match deterministic regeneration.`);
  }
}

export async function verifyFillRegistry(root) {
  const expected = buildRegistryData();
  const fillRoot = path.join(root, "manifest", "fills");
  const indexRoot = path.join(fillRoot, "indexes");

  const actual = {
    registry: await readJson(path.join(fillRoot, "registry.json")),
    stats: await readJson(path.join(fillRoot, "stats.json")),
    indexes: {
      byAlias: await readJson(path.join(indexRoot, "by-alias.json")),
      byBitmap: await readJson(path.join(indexRoot, "by-bitmap.json")),
      byBoundarySide: await readJson(path.join(indexRoot, "by-boundary-side.json")),
      byStraightCandidate: await readJson(path.join(indexRoot, "by-straight-candidate.json")),
      byOwner: await readJson(path.join(indexRoot, "by-owner.json")),
    },
  };

  assertDeepEqual(actual.registry, expected.registry, "Fill registry");
  assertDeepEqual(actual.stats, expected.stats, "Fill registry stats");
  assertDeepEqual(actual.indexes, expected.indexes, "Fill registry indexes");

  const counts = actual.registry.counts;
  if (
    counts.straightMathematicalDefinitions !== 832 ||
    counts.semanticFillCandidates !== 1664 ||
    counts.uniqueFillRasters !== 1347 ||
    counts.straightReuseCandidates !== 100 ||
    counts.straightReuseVisuals !== 88 ||
    counts.fillDuplicateCandidates !== 305 ||
    counts.newFillVisuals !== 1259 ||
    counts.combinedStraightAndFillVisuals !== 2005
  ) {
    throw new Error("Fill registry regression count mismatch.");
  }

  if (
    actual.indexes.byAlias.entryCount !== 1664 ||
    actual.indexes.byBitmap.entryCount !== 1347 ||
    actual.indexes.byBoundarySide.entryCount !== 1664 ||
    actual.indexes.byStraightCandidate.entryCount !== 832 ||
    actual.indexes.byOwner.entryCount !== 1347
  ) {
    throw new Error("Fill registry lookup count mismatch.");
  }

  if (actual.registry.visuals.some((visual) => visual.codepoint !== null || visual.glyphId !== null)) {
    throw new Error("Research fill visuals must remain unallocated.");
  }

  for (const candidate of actual.registry.candidates) {
    if (actual.indexes.byAlias.entries[candidate.aliasKey] !== candidate.fillCandidateId) {
      throw new Error(`Fill alias lookup mismatch: ${candidate.aliasKey}.`);
    }
    if (actual.indexes.byBoundarySide.entries[candidate.boundarySideKey] !== candidate.fillCandidateId) {
      throw new Error(`Fill boundary-side lookup mismatch: ${candidate.boundarySideKey}.`);
    }
    const pair = actual.indexes.byStraightCandidate.entries[String(candidate.straightCandidateId)];
    if (pair?.[candidate.side] !== candidate.fillCandidateId) {
      throw new Error(`Straight candidate fill lookup mismatch: ${candidate.straightCandidateId} side ${candidate.side}.`);
    }
    const bitmapEntry = actual.indexes.byBitmap.entries[candidate.bitmap.key];
    if (!bitmapEntry?.fillCandidateIds.includes(candidate.fillCandidateId)) {
      throw new Error(`Fill bitmap lookup mismatch: ${candidate.bitmap.key}.`);
    }
  }

  return {
    fills: actual.registry.candidates.length,
    uniqueFillRasters: counts.uniqueFillRasters,
    newFillVisuals: actual.registry.visuals.length,
    straightVisualsReused: counts.straightReuseVisuals,
    combinedVisuals: counts.combinedStraightAndFillVisuals,
    lookups: {
      aliases: actual.indexes.byAlias.entryCount,
      bitmaps: actual.indexes.byBitmap.entryCount,
      boundarySides: actual.indexes.byBoundarySide.entryCount,
      straightCandidates: actual.indexes.byStraightCandidate.entryCount,
      owners: actual.indexes.byOwner.entryCount,
    },
    allocation: actual.registry.allocation.status,
  };
}
