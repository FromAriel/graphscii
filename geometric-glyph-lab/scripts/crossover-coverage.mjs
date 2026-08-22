import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ALL_FAMILIES,
  formatPort,
  generate,
} from "../dist/core/index.js";

const STRAIGHT_OWNER_MAX = 745;
const FILL_OWNER_MIN = 746;
const CONNECTOR_OWNER_MIN = 5796;
const CONNECTOR_OWNER_MAX = 6396;
const EXPECTED_PUBLISHED_OWNERS = 6397;
const EXPECTED_STRAIGHT_DEFINITIONS = 832;
const EXPECTED_STRAIGHT_VISUAL_OWNERS = 746;

const FAMILY_CLASS_ORDER = ["axis+axis", "axis+diagonal", "diagonal+diagonal"];
const AXIS_FAMILIES = new Set(["LR", "TB"]);
const EDGE_ORDER = new Map([["L", 0], ["R", 1], ["T", 2], ["B", 3]]);
const SAMPLE_LIMIT = 12;

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function rounded(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function bitmapKeyOf(rows) {
  return Array.from(rows, (row) => row.toString(16).padStart(2, "0")).join("");
}

function unionBitmap(a, b) {
  const rows = new Uint8Array(a.length);
  for (let y = 0; y < a.length; y += 1) {
    rows[y] = a[y] | b[y];
  }
  return rows;
}

function comparePorts(a, b) {
  return (EDGE_ORDER.get(a.edge) - EDGE_ORDER.get(b.edge)) || (a.index - b.index);
}

function familyClass(familyA, familyB) {
  const axisCount = (AXIS_FAMILIES.has(familyA) ? 1 : 0) + (AXIS_FAMILIES.has(familyB) ? 1 : 0);
  if (axisCount === 2) return "axis+axis";
  if (axisCount === 1) return "axis+diagonal";
  return "diagonal+diagonal";
}

function canonicalizePair(fromPort, toPort) {
  const forward = `${fromPort.edge}${toPort.edge}`;
  if (CANONICAL_FAMILY_SET.has(forward)) return `${formatPort(fromPort)}>${formatPort(toPort)}`;
  const reverse = `${toPort.edge}${fromPort.edge}`;
  if (CANONICAL_FAMILY_SET.has(reverse)) return `${formatPort(toPort)}>${formatPort(fromPort)}`;
  throw new Error(`Illegal straight pair ${formatPort(fromPort)}>${formatPort(toPort)}.`);
}

const CANONICAL_FAMILY_SET = new Set(["LR", "TB", "LT", "LB", "RT", "RB"]);

async function loadPublishedByBitmap(repoRoot) {
  const filename = path.join(
    repoRoot,
    "artifacts",
    "manifest",
    "vocabulary-v1",
    "indexes",
    "by-bitmap.json",
  );
  const buffer = await readFile(filename);
  const payload = JSON.parse(buffer.toString("utf8"));
  if (payload.format !== "graphscii" || payload.index !== "by-bitmap") {
    throw new Error("Unexpected by-bitmap index document.");
  }
  if (payload.entryCount !== EXPECTED_PUBLISHED_OWNERS || Object.keys(payload.entries).length !== EXPECTED_PUBLISHED_OWNERS) {
    throw new Error(`Expected ${EXPECTED_PUBLISHED_OWNERS} published owners in the by-bitmap index.`);
  }
  return { entries: payload.entries, sha256: sha256(buffer) };
}

function classifyOwner(glyphId) {
  if (glyphId == null) return "unresolved";
  if (glyphId <= STRAIGHT_OWNER_MAX) return "straight";
  if (glyphId >= CONNECTOR_OWNER_MIN && glyphId <= CONNECTOR_OWNER_MAX) return "connector";
  if (glyphId >= FILL_OWNER_MIN && glyphId < CONNECTOR_OWNER_MIN) return "fill";
  throw new Error(`Published owner ${glyphId} is outside every known allocation class.`);
}

function emptyBucket() {
  return {
    pairStates: 0,
    straightOwnerHits: 0,
    connectorOwnerHits: 0,
    fillClassCollisions: 0,
    unresolved: 0,
  };
}

function recordHit(bucket, classification) {
  bucket.pairStates += 1;
  if (classification === "straight") bucket.straightOwnerHits += 1;
  else if (classification === "connector") bucket.connectorOwnerHits += 1;
  else if (classification === "fill") bucket.fillClassCollisions += 1;
  else bucket.unresolved += 1;
}

function sortedBuckets(map, order) {
  const keys = order ?? [...map.keys()].sort((a, b) => a.localeCompare(b));
  return keys.map((key) => ({ key, ...map.get(key) }));
}

export async function buildCrossoverCoverageDocuments(repoRoot) {
  const generated = generate(ALL_FAMILIES);
  if (
    generated.candidates.length !== EXPECTED_STRAIGHT_DEFINITIONS ||
    generated.glyphs.length !== EXPECTED_STRAIGHT_VISUAL_OWNERS
  ) {
    throw new Error("Milestone 10A.0 requires the frozen 832-definition / 746-owner straight baseline.");
  }

  const published = await loadPublishedByBitmap(repoRoot);

  for (const candidate of generated.candidates) {
    const canonicalKey = `${formatPort(candidate.start)}>${formatPort(candidate.end)}`;
    const reverseKey = canonicalizePair(candidate.end, candidate.start);
    if (canonicalKey !== reverseKey) {
      throw new Error(`Canonicalization failed for straight definition ${canonicalKey}.`);
    }
    const ownerId = published.entries[candidate.bitmapKey];
    const classification = classifyOwner(ownerId);
    if (ownerId == null || classification !== "straight") {
      throw new Error(`Straight definition ${canonicalKey} is not a published straight owner.`);
    }
  }

  const definitions = generated.candidates.map((candidate) => ({
    key: `${formatPort(candidate.start)}>${formatPort(candidate.end)}`,
    family: candidate.family,
    bitmap: candidate.bitmap,
    bitmapKey: candidate.bitmapKey,
    ports: [candidate.start, candidate.end],
  }));

  const overall = emptyBucket();
  const byFamilyClass = new Map(FAMILY_CLASS_ORDER.map((label) => [label, emptyBucket()]));
  const byDesiredEdges = new Map();
  const byDesiredPortCount = new Map(["2", "3", "4"].map((label) => [label, emptyBucket()]));
  const unresolvedRecords = [];
  const fillRecords = [];
  let subsetUnionPairs = 0;
  const distinctUnresolvedBitmaps = new Set();
  const distinctFillBitmaps = new Set();

  for (let i = 0; i < definitions.length; i += 1) {
    const first = definitions[i];
    for (let j = i + 1; j < definitions.length; j += 1) {
      const second = definitions[j];

      const unionKey = bitmapKeyOf(unionBitmap(first.bitmap, second.bitmap));
      if (unionKey === first.bitmapKey || unionKey === second.bitmapKey) {
        subsetUnionPairs += 1;
      }

      const desiredPorts = [...new Set([...first.ports, ...second.ports])].sort(comparePorts);
      const edgeLabel = [...new Set(desiredPorts.map((port) => port.edge))]
        .sort((a, b) => EDGE_ORDER.get(a) - EDGE_ORDER.get(b))
        .join("");
      const portCount = String(desiredPorts.length);

      const classification = classifyOwner(published.entries[unionKey]);

      overall.pairStates += 1;
      recordHit(byFamilyClass.get(familyClass(first.family, second.family)), classification);

      if (!byDesiredEdges.has(edgeLabel)) byDesiredEdges.set(edgeLabel, emptyBucket());
      recordHit(byDesiredEdges.get(edgeLabel), classification);
      recordHit(byDesiredPortCount.get(portCount), classification);

      if (classification === "straight") overall.straightOwnerHits += 1;
      else if (classification === "connector") overall.connectorOwnerHits += 1;
      else if (classification === "fill") {
        overall.fillClassCollisions += 1;
        distinctFillBitmaps.add(unionKey);
        fillRecords.push({
          stateKey: `${first.key}+${second.key}`,
          unionBitmapKey: unionKey,
        });
      } else {
        overall.unresolved += 1;
        distinctUnresolvedBitmaps.add(unionKey);
        unresolvedRecords.push({
          stateKey: `${first.key}+${second.key}`,
          familyPair: familyClass(first.family, second.family),
          desiredEdges: edgeLabel,
          desiredPortCount: desiredPorts.length,
          unionBitmapKey: unionKey,
        });
      }
    }
  }

  if (overall.pairStates !== (EXPECTED_STRAIGHT_DEFINITIONS * (EXPECTED_STRAIGHT_DEFINITIONS - 1)) / 2) {
    throw new Error(`Pair enumeration produced ${overall.pairStates} states; expected C(832,2).`);
  }
  const classifiedTotal =
    overall.straightOwnerHits +
    overall.connectorOwnerHits +
    overall.fillClassCollisions +
    overall.unresolved;
  if (classifiedTotal !== overall.pairStates) {
    throw new Error("Classification totals do not sum to the measured pair states.");
  }

  const tier0ExactStates = overall.straightOwnerHits + overall.connectorOwnerHits;

  const stats = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-crossover-coverage-stats",
    schemaVersion: 1,
    status: "10A.0-measurement-allocation-free",
    inputs: {
      straightDefinitions: generated.candidates.length,
      straightVisualOwners: generated.glyphs.length,
      publishedByBitmapSha256: published.sha256,
      publishedOwners: EXPECTED_PUBLISHED_OWNERS,
    },
    measuredPairStates: overall.pairStates,
    tier0ExactOwnerStates: tier0ExactStates,
    tier0StraightOwnerStates: overall.straightOwnerHits,
    tier0ConnectorOwnerStates: overall.connectorOwnerHits,
    fillClassCollisionStates: overall.fillClassCollisions,
    unresolvedPairStates: overall.unresolved,
    tier0CoveragePercent: rounded((tier0ExactStates * 100) / overall.pairStates),
    subsetUnionPairs,
    distinctUnresolvedBitmaps: distinctUnresolvedBitmaps.size,
    distinctFillCollisionBitmaps: distinctFillBitmaps.size,
    allocations: 0,
    protectedReserveSlots: 3,
    byFamilyClass: sortedBuckets(byFamilyClass, FAMILY_CLASS_ORDER),
    byDesiredEdges: sortedBuckets(byDesiredEdges),
    byDesiredPortCount: sortedBuckets(byDesiredPortCount, ["2", "3", "4"]),
    unresolvedSamples: unresolvedRecords
      .sort((a, b) => a.stateKey.localeCompare(b.stateKey))
      .slice(0, SAMPLE_LIMIT),
    fillCollisionSamples: fillRecords
      .sort((a, b) => a.stateKey.localeCompare(b.stateKey))
      .slice(0, SAMPLE_LIMIT),
  };

  const report = reportMarkdown(stats);

  return {
    stats,
    texts: {
      "stats.json": jsonText(stats),
      "report.md": report,
    },
  };
}

function percent(part, total) {
  return total === 0 ? "0.000000" : rounded((part * 100) / total).toFixed(6);
}

function bucketTable(title, buckets, total) {
  const lines = [
    title,
    "",
    "family-class / edges / ports   states   exact-straight   exact-connector   fill-collision   unresolved   unresolved%",
    "---------------------------   ------   --------------   ---------------   --------------   ----------   ------------",
  ];
  for (const bucket of buckets) {
    lines.push(
      bucket.key.padEnd(25) +
        String(bucket.pairStates).padStart(8) +
        String(bucket.straightOwnerHits).padStart(17) +
        String(bucket.connectorOwnerHits).padStart(18) +
        String(bucket.fillClassCollisions).padStart(17) +
        String(bucket.unresolved).padStart(13) +
        `${percent(bucket.unresolved, bucket.pairStates).padStart(14)}%`,
    );
  }
  lines.push(
    "-".repeat(25).padEnd(25) +
      String(total).padStart(8),
  );
  return lines.join("\n");
}

function reportMarkdown(stats) {
  const lines = [
    "# Milestone 10A.0 — Crossover Cell Coverage Measurement",
    "",
    "Status: **RESEARCH — ALLOCATION-FREE**",
    "",
    "Measures how often an exact single-glyph resolution (Tier 0 of the crossover",
    "resolution plan) already exists when two legal straight segments occupy one",
    "cell. No codepoints are allocated and no weights are frozen by this document.",
    "",
    "## Method",
    "",
    "- Canonical segment universe: the frozen 832 straight mathematical definitions",
    "  rasterized by the compiled core (`dist/core`), byte-identical to the registry.",
    "- Cell states: all unordered pairs of distinct definitions, C(832,2) =",
    `  ${stats.measuredPairStates.toLocaleString("en-US")} states.`,
    "- Desired state per cell: bitwise OR of both segment bitmaps plus the union of",
    "  endpoint ports.",
    "- Tier 0 test: the union bitmap key is looked up in the published v1",
    "  `by-bitmap.json` index; hits are accepted only for straight owners",
    "  (glyph IDs 0..745) or connector owners (5796..6396). Fill-class owners are",
    "  recorded separately because stroke policy forbids them.",
    `- Published index digest: \`${stats.inputs.publishedByBitmapSha256}\`.`,
    "",
    "## Headline result",
    "",
    "```text",
    `measured pair states            ${String(stats.measuredPairStates).padStart(10)}`,
    `tier 0 exact single-glyph       ${String(stats.tier0ExactOwnerStates).padStart(10)}   (${percent(stats.tier0ExactOwnerStates, stats.measuredPairStates)}%)`,
    `  via straight owners           ${String(stats.tier0StraightOwnerStates).padStart(10)}`,
    `  via connector owners          ${String(stats.tier0ConnectorOwnerStates).padStart(10)}`,
    `fill-class collisions           ${String(stats.fillClassCollisionStates).padStart(10)}   (exact bitmap exists, policy-excluded)`,
    `unresolved (needs Tier 1/2)     ${String(stats.unresolvedPairStates).padStart(10)}   (${percent(stats.unresolvedPairStates, stats.measuredPairStates)}%)`,
    `distinct unresolved bitmaps     ${String(stats.distinctUnresolvedBitmaps).padStart(10)}`,
    "```",
    "",
    "## Breakdowns",
    "",
    bucketTable("### By segment-family class", stats.byFamilyClass, stats.measuredPairStates),
    "",
    bucketTable("### By desired boundary-edge set", stats.byDesiredEdges, stats.measuredPairStates),
    "",
    bucketTable("### By desired port count", stats.byDesiredPortCount, stats.measuredPairStates),
    "",
    "## Findings",
    "",
    "- Exact single-glyph coverage is nearly zero in every family class",
    "  (0.32%..1.02%). The connector vocabulary was built for shared-hub junction",
    "  demand, not arbitrary port-pair crossings, so Tier 1 approximation carries",
    "  almost the entire crossover burden.",
    "- Straight owners supply more exact unions than connector owners do",
    `  (${stats.tier0StraightOwnerStates} vs ${stats.tier0ConnectorOwnerStates}): most Tier 0 states occur when two`,
    "  segments share a lattice region and their union collapses onto yet another",
    "  single straight line.",
    `- The ${stats.fillClassCollisionStates} fill-class collisions confirm that multi-stroke unions can form`,
    "  exact solid-fill boundary bitmaps; they remain policy-excluded.",
    "- No cost weights are frozen by this measurement. Constants are chosen in",
    "  slice 10A.2 after reviewing these breakdowns.",
    "",
    "Next slice: 10A.1/10A.2 — canonical state keys, typed candidate port sets,",
    "and the offline `crossover-resolution.json` artifact.",
    "",
  ];
  return lines.join("\n");
}

export async function generateCrossoverCoverageArtifacts(repoRoot) {
  const built = await buildCrossoverCoverageDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "research", "crossovers", "coverage");
  await mkdir(outputRoot, { recursive: true });
  await writeFile(path.join(outputRoot, "stats.json"), built.texts["stats.json"]);
  await writeFile(path.join(outputRoot, "report.md"), built.texts["report.md"]);
  return built.stats;
}

export async function verifyCrossoverCoverageArtifacts(repoRoot) {
  const built = await buildCrossoverCoverageDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "research", "crossovers", "coverage");
  const checks = [
    [path.join(outputRoot, "stats.json"), built.texts["stats.json"]],
    [path.join(outputRoot, "report.md"), built.texts["report.md"]],
  ];
  for (const [filename, expected] of checks) {
    const actual = await readFile(filename, "utf8");
    if (actual !== expected) {
      throw new Error(`${path.relative(repoRoot, filename)} does not match deterministic Milestone 10A.0 generation.`);
    }
  }
  if (
    built.stats.inputs.straightDefinitions !== EXPECTED_STRAIGHT_DEFINITIONS ||
    built.stats.inputs.straightVisualOwners !== EXPECTED_STRAIGHT_VISUAL_OWNERS ||
    built.stats.inputs.publishedOwners !== EXPECTED_PUBLISHED_OWNERS ||
    built.stats.allocations !== 0 ||
    built.stats.protectedReserveSlots !== 3
  ) {
    throw new Error("Milestone 10A.0 frozen input or allocation-free fixture mismatch.");
  }
  return built.stats;
}
