import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  FAMILY_DEFINITIONS,
  PRIVATE_USE_START,
} from "../dist/core/index.js";

export const SEMANTIC_MANIFEST_SCHEMA_VERSION = 2;
export const LOOKUP_SCHEMA_VERSION = 1;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const STRAIGHT_ALLOCATION_PATH = path.join(repoRoot, "spec", "straight-allocation.json");

function codepointHex(codepoint) {
  return `U+${codepoint.toString(16).toUpperCase().padStart(6, "0")}`;
}

function parsePort(name) {
  if (!/^[LRTB]\d+$/.test(name)) {
    throw new Error(`Invalid GraphSCII port: ${name}.`);
  }
  const edge = name[0];
  const index = Number(name.slice(1));
  const count = edge === "L" || edge === "R" ? CELL_HEIGHT : CELL_WIDTH;
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error(`GraphSCII port out of range: ${name}.`);
  }
  return { edge, index };
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

async function writeJson(filename, value) {
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`);
}

async function loadAllocation() {
  const allocation = await readJson(STRAIGHT_ALLOCATION_PATH);
  const expectedFamilyOrder = FAMILY_DEFINITIONS.map((family) => family.id);

  if (allocation.schema !== "graphscii-straight-allocation" || allocation.schemaVersion !== 1) {
    throw new Error("Unsupported straight-line allocation schema.");
  }
  if (allocation.status !== "provisional" || allocation.class !== "straight-lines") {
    throw new Error("Expected the provisional straight-lines allocation.");
  }
  if (allocation.formatVersion !== 1) {
    throw new Error("Straight-line allocation format version mismatch.");
  }
  if (allocation.glyphIdStart !== 0 || allocation.glyphIdCount !== 746) {
    throw new Error("Straight-line allocation must cover glyph IDs 0..745.");
  }
  if (allocation.unicodeStart !== PRIVATE_USE_START) {
    throw new Error("Straight-line allocation Unicode base mismatch.");
  }
  if (allocation.unicodeStartHex !== codepointHex(PRIVATE_USE_START)) {
    throw new Error("Straight-line allocation Unicode start label mismatch.");
  }
  const expectedEnd = PRIVATE_USE_START + allocation.glyphIdCount - 1;
  if (allocation.unicodeEndHex !== codepointHex(expectedEnd)) {
    throw new Error("Straight-line allocation Unicode end label mismatch.");
  }
  if (JSON.stringify(allocation.generationOrder) !== JSON.stringify(expectedFamilyOrder)) {
    throw new Error("Straight-line allocation generation order mismatch.");
  }

  return allocation;
}

function enrichedAlias(alias) {
  const start = parsePort(alias.start);
  const end = parsePort(alias.end);
  return {
    candidateId: alias.candidateId,
    aliasKey: `straight:${alias.start}>${alias.end}`,
    type: "straight",
    family: alias.family,
    start: alias.start,
    end: alias.end,
    connections: [start, end],
  };
}

function allocationRecord(allocation, glyphCount) {
  return {
    class: allocation.class,
    status: allocation.status,
    allocationSchemaVersion: allocation.schemaVersion,
    glyphIdStart: allocation.glyphIdStart,
    glyphIdEnd: allocation.glyphIdStart + glyphCount - 1,
    unicodeStart: allocation.unicodeStartHex,
    unicodeEnd: codepointHex(allocation.unicodeStart + glyphCount - 1),
    assignmentRule: allocation.assignmentRule,
    generationOrder: allocation.generationOrder,
    deduplicationRule: allocation.deduplicationRule,
    stability: allocation.stability,
  };
}

function enrichManifest(baseManifest, allocation) {
  if (baseManifest.format !== "graphscii" || baseManifest.formatVersion !== 1) {
    throw new Error("Base GraphSCII manifest format mismatch.");
  }
  if (baseManifest.glyphCount !== 746 || baseManifest.candidateCount !== 832) {
    throw new Error("Base straight-line manifest regression mismatch.");
  }

  const glyphs = baseManifest.glyphs.map((glyph) => {
    const aliases = glyph.aliases.map(enrichedAlias);
    return {
      ...glyph,
      connectivity: {
        semantics: "alternative-alias-pairs",
        aliasCount: aliases.length,
        note: "Each alias describes one valid straight connection pair; ports from different aliases are alternatives, not simultaneous branches.",
      },
      aliases,
    };
  });

  return {
    ...baseManifest,
    manifestSchemaVersion: SEMANTIC_MANIFEST_SCHEMA_VERSION,
    allocation: allocationRecord(allocation, baseManifest.glyphCount),
    aliasCount: glyphs.reduce((sum, glyph) => sum + glyph.aliases.length, 0),
    lookupIndexes: {
      byCodepoint: "manifest/indexes/by-codepoint.json",
      byBitmap: "manifest/indexes/by-bitmap.json",
      byPort: "manifest/indexes/by-port.json",
      byConnectionPair: "manifest/indexes/by-connection-pair.json",
    },
    glyphs,
  };
}

function pushIndexEntry(index, key, entry) {
  if (!index[key]) {
    index[key] = [];
  }
  index[key].push(entry);
}

function baseBitmapSerialization(manifest) {
  return manifest.bitmapSerialization ??
    "v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex";
}

function buildIndexes(manifest) {
  const byCodepoint = {};
  const byBitmap = {};
  const byPort = {};
  const byConnectionPair = {};
  let portEntryCount = 0;
  let connectionPairEntryCount = 0;

  for (const glyph of manifest.glyphs) {
    byCodepoint[glyph.codepointHex] = glyph.glyphId;
    byBitmap[glyph.bitmap.key] = glyph.glyphId;

    for (const alias of glyph.aliases) {
      pushIndexEntry(byPort, alias.start, {
        glyphId: glyph.glyphId,
        candidateId: alias.candidateId,
        otherPort: alias.end,
      });
      pushIndexEntry(byPort, alias.end, {
        glyphId: glyph.glyphId,
        candidateId: alias.candidateId,
        otherPort: alias.start,
      });
      portEntryCount += 2;

      byConnectionPair[`${alias.start}>${alias.end}`] = {
        glyphId: glyph.glyphId,
        candidateId: alias.candidateId,
        reversed: false,
      };
      byConnectionPair[`${alias.end}>${alias.start}`] = {
        glyphId: glyph.glyphId,
        candidateId: alias.candidateId,
        reversed: true,
      };
      connectionPairEntryCount += 2;
    }
  }

  const common = {
    format: "graphscii",
    formatVersion: 1,
    lookupSchemaVersion: LOOKUP_SCHEMA_VERSION,
  };

  return {
    byCodepoint: {
      ...common,
      index: "by-codepoint",
      keyFormat: "U+ plus six uppercase hexadecimal digits",
      valueFormat: "glyphId",
      entryCount: Object.keys(byCodepoint).length,
      entries: byCodepoint,
    },
    byBitmap: {
      ...common,
      index: "by-bitmap",
      keyFormat: baseBitmapSerialization(manifest),
      valueFormat: "glyphId",
      entryCount: Object.keys(byBitmap).length,
      entries: byBitmap,
    },
    byPort: {
      ...common,
      index: "by-port",
      keyFormat: "edge letter plus zero-based port index, e.g. L13",
      valueFormat: "array of {glyphId,candidateId,otherPort}",
      keyCount: Object.keys(byPort).length,
      entryCount: portEntryCount,
      entries: byPort,
    },
    byConnectionPair: {
      ...common,
      index: "by-connection-pair",
      keyFormat: "PORT>PORT; both query orientations are materialized",
      valueFormat: "{glyphId,candidateId,reversed}",
      entryCount: connectionPairEntryCount,
      entries: byConnectionPair,
    },
  };
}

function enrichStats(baseStats, manifest, indexes) {
  return {
    ...baseStats,
    manifestSchemaVersion: SEMANTIC_MANIFEST_SCHEMA_VERSION,
    allocation: manifest.allocation,
    aliasCount: manifest.aliasCount,
    lookupIndexes: {
      byCodepoint: indexes.byCodepoint.entryCount,
      byBitmap: indexes.byBitmap.entryCount,
      byPortKeys: indexes.byPort.keyCount,
      byPortEntries: indexes.byPort.entryCount,
      byConnectionPair: indexes.byConnectionPair.entryCount,
    },
  };
}

export async function buildSemanticRegistry(root) {
  const manifestPath = path.join(root, "manifest", "glyphs.json");
  const statsPath = path.join(root, "manifest", "stats.json");
  const indexRoot = path.join(root, "manifest", "indexes");
  await mkdir(indexRoot, { recursive: true });

  const allocation = await loadAllocation();
  const baseManifest = await readJson(manifestPath);
  const baseStats = await readJson(statsPath);
  const manifest = enrichManifest(baseManifest, allocation);
  const indexes = buildIndexes(manifest);
  const stats = enrichStats(baseStats, manifest, indexes);

  await Promise.all([
    writeJson(manifestPath, manifest),
    writeJson(statsPath, stats),
    writeJson(path.join(indexRoot, "by-codepoint.json"), indexes.byCodepoint),
    writeJson(path.join(indexRoot, "by-bitmap.json"), indexes.byBitmap),
    writeJson(path.join(indexRoot, "by-port.json"), indexes.byPort),
    writeJson(
      path.join(indexRoot, "by-connection-pair.json"),
      indexes.byConnectionPair,
    ),
  ]);

  return { manifest, stats, indexes, allocation };
}

function requirePortIndexEntry(index, port, glyphId, candidateId, otherPort) {
  const found = index.entries[port]?.some(
    (entry) =>
      entry.glyphId === glyphId &&
      entry.candidateId === candidateId &&
      entry.otherPort === otherPort,
  );
  if (!found) {
    throw new Error(
      `Port index missing glyph ${glyphId} candidate ${candidateId}: ${port} ↔ ${otherPort}.`,
    );
  }
}

export async function verifySemanticRegistry(root) {
  const allocation = await loadAllocation();
  const manifest = await readJson(path.join(root, "manifest", "glyphs.json"));
  const stats = await readJson(path.join(root, "manifest", "stats.json"));
  const indexRoot = path.join(root, "manifest", "indexes");
  const indexes = {
    byCodepoint: await readJson(path.join(indexRoot, "by-codepoint.json")),
    byBitmap: await readJson(path.join(indexRoot, "by-bitmap.json")),
    byPort: await readJson(path.join(indexRoot, "by-port.json")),
    byConnectionPair: await readJson(path.join(indexRoot, "by-connection-pair.json")),
  };

  if (manifest.manifestSchemaVersion !== SEMANTIC_MANIFEST_SCHEMA_VERSION) {
    throw new Error("Semantic manifest schema version mismatch.");
  }
  if (manifest.glyphCount !== 746 || manifest.candidateCount !== 832 || manifest.aliasCount !== 832) {
    throw new Error("Semantic straight-line regression mismatch.");
  }
  if (
    manifest.allocation.status !== allocation.status ||
    manifest.allocation.glyphIdStart !== 0 ||
    manifest.allocation.glyphIdEnd !== 745 ||
    manifest.allocation.unicodeStart !== "U+00E000" ||
    manifest.allocation.unicodeEnd !== "U+00E2E9"
  ) {
    throw new Error("Semantic allocation mismatch.");
  }

  if (indexes.byCodepoint.entryCount !== 746 || indexes.byBitmap.entryCount !== 746) {
    throw new Error("Direct semantic lookup count mismatch.");
  }
  if (indexes.byPort.keyCount !== 48 || indexes.byPort.entryCount !== 1664) {
    throw new Error("Port lookup count mismatch.");
  }
  if (indexes.byConnectionPair.entryCount !== 1664) {
    throw new Error("Connection-pair lookup count mismatch.");
  }

  for (const glyph of manifest.glyphs) {
    if (indexes.byCodepoint.entries[glyph.codepointHex] !== glyph.glyphId) {
      throw new Error(`Codepoint lookup mismatch for ${glyph.codepointHex}.`);
    }
    if (indexes.byBitmap.entries[glyph.bitmap.key] !== glyph.glyphId) {
      throw new Error(`Bitmap lookup mismatch for ${glyph.codepointHex}.`);
    }
    if (glyph.connectivity.semantics !== "alternative-alias-pairs") {
      throw new Error(`Connectivity semantics mismatch for ${glyph.codepointHex}.`);
    }
    if (glyph.connectivity.aliasCount !== glyph.aliases.length) {
      throw new Error(`Connectivity alias count mismatch for ${glyph.codepointHex}.`);
    }

    for (const alias of glyph.aliases) {
      const start = parsePort(alias.start);
      const end = parsePort(alias.end);
      if (alias.aliasKey !== `straight:${alias.start}>${alias.end}`) {
        throw new Error(`Alias key mismatch for candidate ${alias.candidateId}.`);
      }
      if (
        alias.connections.length !== 2 ||
        alias.connections[0].edge !== start.edge ||
        alias.connections[0].index !== start.index ||
        alias.connections[1].edge !== end.edge ||
        alias.connections[1].index !== end.index
      ) {
        throw new Error(`Connection metadata mismatch for ${alias.aliasKey}.`);
      }

      const forward = indexes.byConnectionPair.entries[`${alias.start}>${alias.end}`];
      const reverse = indexes.byConnectionPair.entries[`${alias.end}>${alias.start}`];
      if (
        forward?.glyphId !== glyph.glyphId ||
        forward?.candidateId !== alias.candidateId ||
        forward?.reversed !== false
      ) {
        throw new Error(`Forward lookup mismatch for ${alias.aliasKey}.`);
      }
      if (
        reverse?.glyphId !== glyph.glyphId ||
        reverse?.candidateId !== alias.candidateId ||
        reverse?.reversed !== true
      ) {
        throw new Error(`Reverse lookup mismatch for ${alias.aliasKey}.`);
      }

      requirePortIndexEntry(
        indexes.byPort,
        alias.start,
        glyph.glyphId,
        alias.candidateId,
        alias.end,
      );
      requirePortIndexEntry(
        indexes.byPort,
        alias.end,
        glyph.glyphId,
        alias.candidateId,
        alias.start,
      );
    }
  }

  if (
    stats.lookupIndexes?.byCodepoint !== 746 ||
    stats.lookupIndexes?.byBitmap !== 746 ||
    stats.lookupIndexes?.byPortKeys !== 48 ||
    stats.lookupIndexes?.byPortEntries !== 1664 ||
    stats.lookupIndexes?.byConnectionPair !== 1664
  ) {
    throw new Error("Semantic statistics lookup summary mismatch.");
  }

  return {
    glyphs: manifest.glyphCount,
    aliases: manifest.aliasCount,
    allocation: manifest.allocation,
    lookups: {
      codepoints: indexes.byCodepoint.entryCount,
      bitmaps: indexes.byBitmap.entryCount,
      ports: indexes.byPort.keyCount,
      portEntries: indexes.byPort.entryCount,
      connectionPairs: indexes.byConnectionPair.entryCount,
    },
  };
}
