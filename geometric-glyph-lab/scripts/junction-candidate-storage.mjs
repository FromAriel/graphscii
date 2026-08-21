import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildJunctionCandidateDocuments } from "./junction-candidates.mjs";

const MODEL_ORDER = [
  "mathematical-demand-hub",
  "symmetric-half-pixel-center",
  "central-2x2-kernel",
  "port-centroid-midpoint",
];
const OWNER_PREFIXES = "0123456789abcdef".split("");

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function buildShardedJunctionCandidateDocuments(repoRoot) {
  const base = await buildJunctionCandidateDocuments(repoRoot);
  const candidateDocument = JSON.parse(base.texts["candidates.json"]);
  const ownerDocument = JSON.parse(base.texts["unique-rasters.json"]);

  const candidateShards = {};
  const candidateManifestShards = [];
  for (const model of MODEL_ORDER) {
    const entries = candidateDocument.candidates.filter((candidate) => candidate.model === model);
    const relativePath = `candidates/${model}.json`;
    candidateShards[relativePath] = jsonText({
      format: "graphscii",
      formatVersion: 1,
      schema: "graphscii-junction-candidate-shard",
      schemaVersion: 1,
      model,
      candidateCount: entries.length,
      candidates: entries,
    });
    candidateManifestShards.push({ model, path: relativePath, candidateCount: entries.length });
  }

  const ownerShards = {};
  const ownerManifestShards = [];
  for (const prefix of OWNER_PREFIXES) {
    const entries = ownerDocument.owners.filter((owner) => owner.bitmapKey.startsWith(prefix));
    const relativePath = `unique-rasters/${prefix}.json`;
    ownerShards[relativePath] = jsonText({
      format: "graphscii",
      formatVersion: 1,
      schema: "graphscii-junction-visual-owner-shard",
      schemaVersion: 1,
      bitmapPrefix: prefix,
      ownerCount: entries.length,
      owners: entries,
    });
    ownerManifestShards.push({ bitmapPrefix: prefix, path: relativePath, ownerCount: entries.length });
  }

  const candidateManifest = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-candidates",
    schemaVersion: 2,
    status: "5A.3-research-only-unallocated-sharded",
    candidateCount: candidateDocument.candidateCount,
    shardRule: "one deterministic shard per geometry model",
    shards: candidateManifestShards,
  };
  const ownerManifest = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-visual-owners",
    schemaVersion: 2,
    status: "5A.3-research-only-unallocated-sharded",
    ownerCount: ownerDocument.ownerCount,
    ownerIdentity: ownerDocument.ownerIdentity,
    shardRule: "first lowercase hexadecimal nibble of the 32-character bitmap key",
    shards: ownerManifestShards,
  };

  const rootTexts = { ...base.texts };
  rootTexts["candidates.json"] = jsonText(candidateManifest);
  rootTexts["unique-rasters.json"] = jsonText(ownerManifest);

  return {
    stats: base.stats,
    rootTexts,
    candidateShards,
    ownerShards,
    storage: {
      candidateShardCount: candidateManifestShards.length,
      ownerShardCount: ownerManifestShards.length,
      candidateShardCandidateTotal: candidateManifestShards.reduce((sum, shard) => sum + shard.candidateCount, 0),
      ownerShardOwnerTotal: ownerManifestShards.reduce((sum, shard) => sum + shard.ownerCount, 0),
    },
  };
}

async function writeText(repoRoot, outputRoot, relativePath, content) {
  const target = relativePath.startsWith("spec/") ? path.join(repoRoot, relativePath) : path.join(outputRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

export async function generateShardedJunctionCandidateArtifacts(repoRoot) {
  const built = await buildShardedJunctionCandidateDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "research", "junctions");
  await rm(path.join(outputRoot, "candidates"), { recursive: true, force: true });
  await rm(path.join(outputRoot, "unique-rasters"), { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  for (const [relativePath, content] of Object.entries(built.rootTexts)) {
    await writeText(repoRoot, outputRoot, relativePath, content);
  }
  for (const [relativePath, content] of Object.entries(built.candidateShards)) {
    await writeText(repoRoot, outputRoot, relativePath, content);
  }
  for (const [relativePath, content] of Object.entries(built.ownerShards)) {
    await writeText(repoRoot, outputRoot, relativePath, content);
  }
  return { ...built.stats, storage: built.storage };
}

export async function verifyShardedJunctionCandidateArtifacts(repoRoot) {
  const built = await buildShardedJunctionCandidateDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "research", "junctions");
  const allTexts = {
    ...built.rootTexts,
    ...built.candidateShards,
    ...built.ownerShards,
  };
  for (const [relativePath, expected] of Object.entries(allTexts)) {
    const target = relativePath.startsWith("spec/") ? path.join(repoRoot, relativePath) : path.join(outputRoot, relativePath);
    const actual = await readFile(target, "utf8");
    if (actual !== expected) throw new Error(`${relativePath} is stale or non-deterministic for Milestone 5A.3.`);
  }
  if (built.storage.candidateShardCount !== 4 || built.storage.candidateShardCandidateTotal !== 90112) {
    throw new Error("Milestone 5A.3 candidate shard accounting failed.");
  }
  if (built.storage.ownerShardCount !== 16 || built.storage.ownerShardOwnerTotal !== 82377) {
    throw new Error("Milestone 5A.3 owner shard accounting failed.");
  }
  return { ...built.stats, storage: built.storage };
}
