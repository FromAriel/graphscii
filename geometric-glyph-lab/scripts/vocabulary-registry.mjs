import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  GRAPHSCII_ALL_SEMANTIC_ALIAS_COUNT,
  GRAPHSCII_BOUNDARY_SIDE_STYLE_ALIAS_COUNT,
  GRAPHSCII_ENCODED_OWNER_COUNT,
  GRAPHSCII_RENDERER_ONLY_ALIAS_COUNT,
  GRAPHSCII_RESERVE_COUNT,
  buildGraphicsVocabularyRegistry,
} from "../dist/core/index.js";

const INDEX_FILENAMES = {
  byCodepoint: "by-codepoint.json",
  byBitmap: "by-bitmap.json",
  byAlias: "by-alias.json",
  byOwner: "by-owner.json",
  byBoundarySideStyle: "by-boundary-side-style.json",
  rendererOnly: "renderer-only.json",
};

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function withRegistryLinks(result) {
  return {
    ...result.registry,
    semanticAliasCount: result.stats.semanticAliases,
    indexes: {
      byCodepoint: "indexes/by-codepoint.json",
      byBitmap: "indexes/by-bitmap.json",
      byAlias: "indexes/by-alias.json",
      byOwner: "indexes/by-owner.json",
      byBoundarySideStyle: "indexes/by-boundary-side-style.json",
      rendererOnly: "indexes/renderer-only.json",
    },
  };
}

function withStatsEnvelope(result) {
  return {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-graphics-vocabulary-stats",
    schemaVersion: 1,
    status: "provisional-graphics-v0",
    ...result.stats,
  };
}

export function buildVocabularyDocuments() {
  const result = buildGraphicsVocabularyRegistry();
  return {
    result,
    registry: withRegistryLinks(result),
    stats: withStatsEnvelope(result),
    indexes: result.indexes,
  };
}

export async function generateVocabularyRegistry(repoRoot) {
  const outputRoot = path.join(repoRoot, "artifacts", "manifest", "vocabulary");
  const indexRoot = path.join(outputRoot, "indexes");
  await mkdir(indexRoot, { recursive: true });

  const documents = buildVocabularyDocuments();
  const writes = [
    writeFile(path.join(outputRoot, "registry.json"), jsonText(documents.registry)),
    writeFile(path.join(outputRoot, "stats.json"), jsonText(documents.stats)),
  ];
  for (const [name, filename] of Object.entries(INDEX_FILENAMES)) {
    writes.push(writeFile(path.join(indexRoot, filename), jsonText(documents.indexes[name])));
  }
  await Promise.all(writes);

  return {
    encodedOwners: documents.result.stats.encodedOwners,
    semanticAliases: documents.result.stats.semanticAliases,
    rendererOnlySemanticAliases: documents.result.stats.rendererOnlySemanticAliases,
    reserveSlots: documents.result.stats.reserveSlots,
  };
}

function assertJsonEqual(actual, expected, label) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) {
    throw new Error(`${label} does not match deterministic Milestone 4D.1 generation.`);
  }
}

export async function verifyVocabularyRegistry(repoRoot) {
  const outputRoot = path.join(repoRoot, "artifacts", "manifest", "vocabulary");
  const indexRoot = path.join(outputRoot, "indexes");
  const expected = buildVocabularyDocuments();

  const registry = await readJson(path.join(outputRoot, "registry.json"));
  const stats = await readJson(path.join(outputRoot, "stats.json"));
  assertJsonEqual(registry, expected.registry, "Vocabulary registry");
  assertJsonEqual(stats, expected.stats, "Vocabulary stats");

  const indexes = {};
  for (const [name, filename] of Object.entries(INDEX_FILENAMES)) {
    indexes[name] = await readJson(path.join(indexRoot, filename));
    assertJsonEqual(indexes[name], expected.indexes[name], `Vocabulary index ${name}`);
  }

  if (
    stats.encodedOwners !== GRAPHSCII_ENCODED_OWNER_COUNT ||
    stats.uniqueEncodedBitmapKeys !== GRAPHSCII_ENCODED_OWNER_COUNT ||
    stats.uniqueAllocatedCodepoints !== GRAPHSCII_ENCODED_OWNER_COUNT
  ) {
    throw new Error("Milestone 4D.1 encoded-owner cardinality mismatch.");
  }
  if (
    stats.firstCodepoint !== "U+00E000" ||
    stats.lastAllocatedCodepoint !== "U+00F6A3" ||
    stats.reserveStart !== "U+00F6A4" ||
    stats.reserveEnd !== "U+00F8FF" ||
    stats.reserveSlots !== GRAPHSCII_RESERVE_COUNT
  ) {
    throw new Error("Milestone 4D.1 PUA boundary mismatch.");
  }
  if (!stats.straightCodepointsUnchanged) {
    throw new Error("Milestone 4D.1 changed a published straight allocation.");
  }
  if (
    stats.semanticAliases !== GRAPHSCII_ALL_SEMANTIC_ALIAS_COUNT ||
    stats.rendererOnlySemanticAliases !== GRAPHSCII_RENDERER_ONLY_ALIAS_COUNT ||
    stats.boundarySideStyleAliases !== GRAPHSCII_BOUNDARY_SIDE_STYLE_ALIAS_COUNT
  ) {
    throw new Error("Milestone 4D.1 semantic/index cardinality mismatch.");
  }
  if (
    stats.canonicalClassCounts.straight !== 746 ||
    stats.canonicalClassCounts["solid-100"] !== 1259 ||
    stats.canonicalClassCounts["medium-75"] !== 1269 ||
    stats.canonicalClassCounts["light-25"] !== 1315 ||
    stats.canonicalClassCounts["half-50"] !== 1207
  ) {
    throw new Error("Milestone 4D.1 canonical class count mismatch.");
  }
  if (
    indexes.byCodepoint.entryCount !== 5796 ||
    indexes.byBitmap.entryCount !== 5796 ||
    indexes.byOwner.entryCount !== 5796 ||
    indexes.byAlias.entryCount !== 10816 ||
    indexes.byBoundarySideStyle.entryCount !== 9984 ||
    indexes.rendererOnly.entryCount !== 3392
  ) {
    throw new Error("Milestone 4D.1 persisted index count mismatch.");
  }

  for (let glyphId = 0; glyphId < 746; glyphId += 1) {
    const expectedCodepoint = `U+${(0xe000 + glyphId).toString(16).toUpperCase().padStart(6, "0")}`;
    const owner = registry.owners[glyphId];
    if (!owner || owner.glyphId !== glyphId || owner.codepoint !== expectedCodepoint || owner.canonicalClass !== "straight") {
      throw new Error(`Published straight owner ${glyphId} changed during 4D.1.`);
    }
  }

  const reserveLeak = registry.owners.some((owner) => owner.codepointValue >= 0xf6a4);
  if (reserveLeak) {
    throw new Error("Milestone 4D.1 allocated a glyph inside the 604-slot reserve.");
  }

  return {
    encodedOwners: stats.encodedOwners,
    semanticAliases: stats.semanticAliases,
    rendererOnlySemanticAliases: stats.rendererOnlySemanticAliases,
    rendererOnlyExactReuseAliases: stats.rendererOnlyExactReuseAliases,
    rendererOnlyDerivedAliases: stats.rendererOnlyDerivedAliases,
    reserveSlots: stats.reserveSlots,
    lastAllocatedCodepoint: stats.lastAllocatedCodepoint,
  };
}
