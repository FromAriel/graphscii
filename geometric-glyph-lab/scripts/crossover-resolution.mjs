import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ALL_FAMILIES,
  CELL_HEIGHT,
  formatPort,
  generate,
} from "../dist/core/index.js";

const STRAIGHT_OWNER_MAX = 745;
const FILL_OWNER_MIN = 746;
const CONNECTOR_OWNER_MIN = 5796;
const CONNECTOR_OWNER_MAX = 6396;
const SPECIAL_INTERIOR_GLYPH_ID = 6397;
const EXPECTED_PUBLISHED_OWNERS = 6398;
const EXPECTED_STRAIGHT_DEFINITIONS = 832;
const EXPECTED_STRAIGHT_VISUAL_OWNERS = 746;
const EXPECTED_PAIR_STATES = 345696;

const STATE_KEY_PATTERN = /^([LRTB]\d{1,2})>([LRTB]\d{1,2})$/;

// Normative Milestone 10A cost constants (plan §3.2).
const WEIGHT_MISS = 100;
const WEIGHT_EXTRA = 10;
const HAMMING_EPSILON_DENOMINATOR = 128;

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function rounded(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function bitmapKeyOf(rows) {
  return Array.from(rows, (row) => row.toString(16).padStart(2, "0")).join("");
}

function parseRows(key) {
  const rows = new Uint8Array(CELL_HEIGHT);
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    rows[y] = Number.parseInt(key.slice(y * 2, y * 2 + 2), 16);
  }
  return rows;
}

function unionBitmap(a, b) {
  const rows = new Uint8Array(a.length);
  for (let y = 0; y < a.length; y += 1) {
    rows[y] = a[y] | b[y];
  }
  return rows;
}

const POPCOUNT_16 = (() => {
  const table = new Uint8Array(0x10000);
  for (let value = 0; value < 0x10000; value += 1) {
    let remaining = value;
    let count = 0;
    while (remaining !== 0) {
      count += remaining & 1;
      remaining >>>= 1;
    }
    table[value] = count;
  }
  return table;
})();

const POPCOUNT_8 = (() => {
  const table = new Uint8Array(256);
  for (let value = 0; value < 256; value += 1) {
    let remaining = value;
    let count = 0;
    while (remaining !== 0) {
      count += remaining & 1;
      remaining >>>= 1;
    }
    table[value] = count;
  }
  return table;
})();

function popcountMask(value) {
  // Masks are at most 22 bits wide.
  return POPCOUNT_16[value & 0xffff] + POPCOUNT_16[(value >>> 16) & 0x3f];
}

// Boundary attachment slots (44): top row x=0..7 -> 0..7, right column
// y=1..14 -> 8..21, bottom row x=0..7 -> 22..29, left column y=1..14 ->
// 30..43. Corners belong to exactly one slot each.
function slotForPortLabel(label) {
  const edge = label[0];
  const index = Number(label.slice(1));
  if (edge === "T") return index;
  if (edge === "B") return 22 + index;
  if (edge === "L") {
    if (index === 0) return 0;
    if (index === 15) return 22;
    return 30 + (index - 1);
  }
  if (edge === "R") {
    if (index === 0) return 7;
    if (index === 15) return 29;
    return 8 + (index - 1);
  }
  throw new Error(`Unknown port label ${label}.`);
}

function maskForSlots(slots) {
  let low = 0;
  let high = 0;
  for (const slot of slots) {
    if (slot < 22) low |= 1 << slot;
    else high |= 1 << (slot - 22);
  }
  return { low, high };
}

function boundaryMasks(rows) {
  let low = 0;
  let high = 0;
  for (let x = 0; x < 8; x += 1) {
    if ((rows[0] & (1 << x)) !== 0) low |= 1 << x;
    if ((rows[15] & (1 << x)) !== 0) high |= 1 << x;
  }
  for (let y = 1; y <= 14; y += 1) {
    if ((rows[y] & 0x80) !== 0) low |= 1 << (7 + y);
    if ((rows[y] & 0x01) !== 0) high |= 1 << (7 + y);
  }
  return { low, high };
}

async function loadPublishedByBitmap(repoRoot) {
  const filename = path.join(
    repoRoot,
    "artifacts",
    "manifest",
    "vocabulary-v1.1",
    "indexes",
    "by-bitmap.json",
  );
  const buffer = await readFile(filename);
  const payload = JSON.parse(buffer.toString("utf8"));
  if (payload.format !== "graphscii" || payload.index !== "by-bitmap") {
    throw new Error("Unexpected by-bitmap index document.");
  }
  if (
    payload.entryCount !== EXPECTED_PUBLISHED_OWNERS ||
    Object.keys(payload.entries).length !== EXPECTED_PUBLISHED_OWNERS
  ) {
    throw new Error(`Expected ${EXPECTED_PUBLISHED_OWNERS} published owners in the by-bitmap index.`);
  }
  return { entries: payload.entries, sha256: sha256(buffer) };
}

function classifyOwner(glyphId) {
  if (glyphId <= STRAIGHT_OWNER_MAX) return "straight";
  if (glyphId >= CONNECTOR_OWNER_MIN && glyphId <= CONNECTOR_OWNER_MAX) return "connector";
  if (glyphId >= FILL_OWNER_MIN && glyphId < CONNECTOR_OWNER_MIN) return "fill";
  if (glyphId === SPECIAL_INTERIOR_GLYPH_ID) return "special-interior";
  throw new Error(`Published owner ${glyphId} is outside every known allocation class.`);
}

// Stroke cells may only resolve into straight or connector owners. Fill and
// interior-special classes are category-excluded exactly like fills.
function isStrokeLegalClass(ownerClass) {
  return ownerClass === "straight" || ownerClass === "connector";
}

function buildCandidates(publishedEntries) {
  const candidates = [];
  for (const [key, rawGlyphId] of Object.entries(publishedEntries)) {
    const glyphId = Number(rawGlyphId);
    const ownerClass = classifyOwner(glyphId);
    if (!isStrokeLegalClass(ownerClass)) continue;
    const rows = parseRows(key);
    const { low, high } = boundaryMasks(rows);
    const slots = [];
    for (let slot = 0; slot < 22; slot += 1) {
      if ((low & (1 << slot)) !== 0) slots.push(slot);
      if ((high & (1 << slot)) !== 0) slots.push(slot + 22);
    }
    candidates.push({
      glyphId,
      ownerClass,
      rows,
      low,
      high,
      attachmentCount: popcountMask(low) + popcountMask(high),
      slotKey: slots.join(","),
    });
  }
  candidates.sort(
    (a, b) => a.attachmentCount - b.attachmentCount || a.glyphId - b.glyphId,
  );
  return candidates;
}

function selectCandidate(candidates, desiredLow, desiredHigh, unionRows) {
  let best = null;
  for (const candidate of candidates) {
    const missedPorts =
      popcountMask(desiredLow & ~candidate.low) +
      popcountMask(desiredHigh & ~candidate.high);
    // Lower bound: extra ports and Hamming distance cannot be negative.
    if (best !== null && HAMMING_EPSILON_DENOMINATOR * WEIGHT_MISS * missedPorts > best.costScaled) {
      continue;
    }
    const extraPorts =
      popcountMask(candidate.low & ~desiredLow) +
      popcountMask(candidate.high & ~desiredHigh);
    let hamming = 0;
    for (let y = 0; y < CELL_HEIGHT; y += 1) {
      hamming += POPCOUNT_8[candidate.rows[y] ^ unionRows[y]];
    }
    const costScaled =
      HAMMING_EPSILON_DENOMINATOR * (WEIGHT_MISS * missedPorts + WEIGHT_EXTRA * extraPorts) +
      hamming;
    if (
      best === null ||
      costScaled < best.costScaled ||
      (costScaled === best.costScaled &&
        (candidate.slotKey < best.slotKey ||
          (candidate.slotKey === best.slotKey && candidate.glyphId < best.glyphId)))
    ) {
      best = {
        costScaled,
        slotKey: candidate.slotKey,
        glyphId: candidate.glyphId,
        ownerClass: candidate.ownerClass,
        missedPorts,
        extraPorts,
      };
    }
  }
  if (best === null) throw new Error("Never-empty invariant violated: candidate set is empty.");
  return best;
}

function auditResolutionRecords(records, publishedEntries, definitions) {
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const seen = new Set();
  let previousKey = "";
  for (const record of records) {
    const parts = record.split("\t");
    if (parts.length !== 6) {
      throw new Error(`Malformed resolution record: ${record}`);
    }
    const [stateKey, tierText, glyphIdText, missedText, extraText] = parts;
    if (!(previousKey < stateKey)) {
      throw new Error(`Resolution state keys are not strictly ordered at ${stateKey}.`);
    }
    previousKey = stateKey;
    if (seen.has(stateKey)) {
      throw new Error(`Duplicate resolution state ${stateKey}.`);
    }
    seen.add(stateKey);

    const segments = stateKey.split("+");
    if (segments.length !== 2 || segments[0] >= segments[1]) {
      throw new Error(`State key is not a canonical sorted pair: ${stateKey}`);
    }
    for (const segment of segments) {
      const [fromText, toText] = segment.split(">");
      if (!STATE_KEY_PATTERN.test(segment) || fromText === toText) {
        throw new Error(`Illegal segment in state key: ${segment}`);
      }
    }

    const glyphId = Number(glyphIdText);
    if (
      !Number.isInteger(glyphId) ||
      glyphId < 0 ||
      (glyphId > STRAIGHT_OWNER_MAX && glyphId < CONNECTOR_OWNER_MIN) ||
      glyphId > CONNECTOR_OWNER_MAX
    ) {
      throw new Error(`Resolution winner ${glyphId} is outside the typed candidate set for ${stateKey}.`);
    }

    if (tierText === "0") {
      const first = definitionByKey.get(segments[0]);
      const second = definitionByKey.get(segments[1]);
      if (!first || !second) {
        throw new Error(`Unknown segment in tier-0 state ${stateKey}.`);
      }
      const unionKey = bitmapKeyOf(unionBitmap(first.bitmap, second.bitmap));
      if (publishedEntries[unionKey] !== glyphId) {
        throw new Error(`Tier-0 entry ${stateKey} does not match the published by-bitmap index.`);
      }
      if (missedText !== "0" || extraText !== "0") {
        throw new Error(`Tier-0 entry ${stateKey} carries nonzero approximation counters.`);
      }
    } else if (tierText === "1") {
      const missedPorts = Number(missedText);
      const extraPorts = Number(extraText);
      if (!Number.isInteger(missedPorts) || missedPorts < 0 || missedPorts > 4) {
        throw new Error(`Tier-1 entry ${stateKey} has an impossible missed-port count.`);
      }
      if (!Number.isInteger(extraPorts) || extraPorts < 0 || extraPorts > 44) {
        throw new Error(`Tier-1 entry ${stateKey} has an impossible extra-port count.`);
      }
    } else {
      throw new Error(`Unknown resolution tier ${tierText} for ${stateKey}.`);
    }
  }
}

export async function buildCrossoverResolutionDocuments(repoRoot) {
  const generated = generate(ALL_FAMILIES);
  if (
    generated.candidates.length !== EXPECTED_STRAIGHT_DEFINITIONS ||
    generated.glyphs.length !== EXPECTED_STRAIGHT_VISUAL_OWNERS
  ) {
    throw new Error("Milestone 10A requires the frozen 832-definition / 746-owner straight baseline.");
  }

  const published = await loadPublishedByBitmap(repoRoot);
  const candidates = buildCandidates(published.entries);
  const straightOwnerCount = candidates.filter((c) => c.ownerClass === "straight").length;
  const connectorOwnerCount = candidates.filter((c) => c.ownerClass === "connector").length;

  const definitions = generated.candidates.map((candidate) => ({
    key: `${formatPort(candidate.start)}>${formatPort(candidate.end)}`,
    family: candidate.family,
    bitmap: candidate.bitmap,
    portLabels: [formatPort(candidate.start), formatPort(candidate.end)],
  }));

  const records = [];
  const tierCounts = { tier0: 0, tier1: 0 };
  const winnerClasses = {
    tier0Straight: 0,
    tier0Connector: 0,
    tier1StraightWinner: 0,
    tier1ConnectorWinner: 0,
  };
  const missedHistogram = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  const extraHistogram = {};
  const worstStates = [];
  let tier1CostSum = 0;

  for (let i = 0; i < definitions.length; i += 1) {
    const first = definitions[i];
    for (let j = i + 1; j < definitions.length; j += 1) {
      const second = definitions[j];

      const unionKey = bitmapKeyOf(unionBitmap(first.bitmap, second.bitmap));
      // Plan §4: the segment list inside a state key is sorted so any
      // runtime can rebuild the key from an unordered cell state.
      const stateKey =
        first.key < second.key ? `${first.key}+${second.key}` : `${second.key}+${first.key}`;

      const exactGlyphId = published.entries[unionKey];
      if (exactGlyphId != null && isStrokeLegalClass(classifyOwner(exactGlyphId))) {
        tierCounts.tier0 += 1;
        winnerClasses.tier0Straight +=
          classifyOwner(exactGlyphId) === "straight" ? 1 : 0;
        winnerClasses.tier0Connector +=
          classifyOwner(exactGlyphId) === "connector" ? 1 : 0;
        records.push(`${stateKey}\t0\t${exactGlyphId}\t0\t0\t0`);
        continue;
      }

      const desiredSlots = [];
      for (const label of [...first.portLabels, ...second.portLabels]) {
        desiredSlots.push(slotForPortLabel(label));
      }
      const desired = maskForSlots(desiredSlots);
      const chosen = selectCandidate(candidates, desired.low, desired.high, parseRows(unionKey));

      tierCounts.tier1 += 1;
      winnerClasses[chosen.ownerClass === "straight" ? "tier1StraightWinner" : "tier1ConnectorWinner"] += 1;
      missedHistogram[String(chosen.missedPorts)] = (missedHistogram[String(chosen.missedPorts)] ?? 0) + 1;
      extraHistogram[chosen.extraPorts] = (extraHistogram[chosen.extraPorts] ?? 0) + 1;
      tier1CostSum += chosen.costScaled;
      records.push(
        `${stateKey}\t1\t${chosen.glyphId}\t${chosen.missedPorts}\t${chosen.extraPorts}\t${chosen.costScaled}`,
      );
      worstStates.push({ stateKey, glyphId: chosen.glyphId, costScaled: chosen.costScaled });
      if (worstStates.length > 24) {
        worstStates.sort((a, b) => b.costScaled - a.costScaled || a.stateKey.localeCompare(b.stateKey));
        worstStates.length = 12;
      }
    }
  }

  if (records.length !== EXPECTED_PAIR_STATES) {
    throw new Error(`Resolution produced ${records.length} states; expected C(832,2).`);
  }

  records.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  // Audit the exact emitted order: strictly sorted canonical keys, typed
  // winners only, tier-0 rows consistent with the published index.
  auditResolutionRecords(records, published.entries, definitions);
  worstStates.sort((a, b) => b.costScaled - a.costScaled || a.stateKey.localeCompare(b.stateKey));

  const stats = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-crossover-resolution-stats",
    schemaVersion: 1,
    status: "10A.3-wired-and-promoted",
    weights: {
      W_MISS: WEIGHT_MISS,
      W_EXTRA: WEIGHT_EXTRA,
      hammingEpsilon: `1/${HAMMING_EPSILON_DENOMINATOR}`,
      note: "W_MATE is runtime provenance only (plan §7); offline selection uses miss/extra/hamming.",
    },
    inputs: {
      straightDefinitions: generated.candidates.length,
      straightVisualOwners: generated.glyphs.length,
      publishedByBitmapSha256: published.sha256,
      publishedOwners: EXPECTED_PUBLISHED_OWNERS,
      typedCandidates: candidates.length,
      typedStraightOwners: straightOwnerCount,
      typedConnectorOwners: connectorOwnerCount,
    },
    measuredPairStates: records.length,
    tier0ExactStates: tierCounts.tier0,
    tier1ApproximateStates: tierCounts.tier1,
    winnerClasses,
    fullLegRetentionStates: missedHistogram["0"] ?? 0,
    missedPortHistogram: missedHistogram,
    extraPortHistogram: extraHistogram,
    averageTier1CostScaled: rounded(tier1CostSum / Math.max(1, tierCounts.tier1)),
    worstCostSamples: worstStates.slice(0, 12),
    allocations: 0,
    protectedReserveSlots: 3,
  };

  const report = reportMarkdown(stats);

  return {
    stats,
    texts: {
      "crossover-resolution.tsv": `# graphscii-crossover-resolution-v0\tstateKey\ttier\tglyphId\tmissedPorts\textraPorts\tcostScaled\n${records.join("\n")}\n`,
      "stats.json": jsonText(stats),
      "report.md": report,
    },
  };
}

function reportMarkdown(stats) {
  const lines = [
    "# Milestone 10A.1/10A.2 — Crossover Resolution Table",
    "",
    "Status: **MANIFEST AUTHORITY — WIRED AND VERIFIED**",
    "",
    "Every two-segment cell state resolves to exactly one published glyph under",
    "the never-empty invariant. Tier 0 is an exact single-glyph match; Tier 1 is",
    "a typed best-fit over straight and connector owners only. Fill-class owners",
    "(glyph IDs 746..5795) are excluded by construction. No codepoints are",
    "allocated.",
    "",
    "## Selection rule",
    "",
    "```text",
    "cost(C) = W_MISS*|D\\P(C)| + W_EXTRA*|P(C)\\D| + (1/128)*hamming(bitmap(C), union)",
    `weights  W_MISS=${stats.weights.W_MISS}, W_EXTRA=${stats.weights.W_EXTRA}`,
    "ties     lexicographic attachment-slot list, then lower glyph ID",
    "mates    runtime provenance only; not part of offline selection",
    "```",
    "",
    "## Headline result",
    "",
    "```text",
    `measured pair states            ${String(stats.measuredPairStates).padStart(10)}`,
    `tier 0 exact                    ${String(stats.tier0ExactStates).padStart(10)}`,
    `tier 1 approximate              ${String(stats.tier1ApproximateStates).padStart(10)}`,
    `typed candidate owners          ${String(stats.inputs.typedCandidates).padStart(10)}   (${stats.inputs.typedStraightOwners} straight + ${stats.inputs.typedConnectorOwners} connector)`,
    `full-leg-retention tier 1       ${String(stats.fullLegRetentionStates).padStart(10)}`,
    `average tier-1 scaled cost      ${String(stats.averageTier1CostScaled).padStart(10)}`,
    "```",
    "",
    "## Winner classes",
    "",
    "```text",
    `tier 0 via straight owners      ${String(stats.winnerClasses.tier0Straight).padStart(10)}`,
    `tier 0 via connector owners     ${String(stats.winnerClasses.tier0Connector).padStart(10)}`,
    `tier 1 won by straight owners   ${String(stats.winnerClasses.tier1StraightWinner).padStart(10)}`,
    `tier 1 won by connector owners  ${String(stats.winnerClasses.tier1ConnectorWinner).padStart(10)}`,
    "```",
    "",
    "## Missed-leg histogram (tier 1)",
    "",
    "```text",
    ...Object.keys(stats.missedPortHistogram)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => `missed ${key}: ${stats.missedPortHistogram[key]}`),
    "```",
    "",
    "## Interpretation rules",
    "",
    "- Missed legs mark cells where a stroke will visually lose one connection;",
    "  at runtime these are exactly the mate-loss cases reported as provenance.",
    "- Extra legs are visible stubs; the small W_EXTRA keeps them cheaper than",
    "  losing a leg but more expensive than clean fits.",
    "- The table is the sole authority at runtime; no per-frame search exists.",
    "",
    "Next slice: 10A.4 — compositor v3 runtime swap over this manifest table.",
    "",
  ];
  return lines.join("\n");
}

export async function generateCrossoverResolutionArtifacts(repoRoot) {
  const built = await buildCrossoverResolutionDocuments(repoRoot);
  const manifestRoot = path.join(repoRoot, "artifacts", "manifest", "vocabulary-v1.1");
  await mkdir(manifestRoot, { recursive: true });
  await writeFile(path.join(manifestRoot, "crossover-resolution.tsv"), built.texts["crossover-resolution.tsv"]);
  await writeFile(path.join(manifestRoot, "crossover-resolution-stats.json"), built.texts["stats.json"]);
  await writeFile(path.join(manifestRoot, "crossover-resolution-report.md"), built.texts["report.md"]);
  return built.stats;
}

export async function verifyCrossoverResolutionArtifacts(repoRoot) {
  const built = await buildCrossoverResolutionDocuments(repoRoot);
  const manifestRoot = path.join(repoRoot, "artifacts", "manifest", "vocabulary-v1.1");
  const checks = [
    [path.join(manifestRoot, "crossover-resolution.tsv"), built.texts["crossover-resolution.tsv"]],
    [path.join(manifestRoot, "crossover-resolution-stats.json"), built.texts["stats.json"]],
    [path.join(manifestRoot, "crossover-resolution-report.md"), built.texts["report.md"]],
  ];
  for (const [filename, expected] of checks) {
    const actual = await readFile(filename, "utf8");
    if (actual !== expected) {
      throw new Error(`${path.relative(repoRoot, filename)} does not match deterministic Milestone 10A generation.`);
    }
  }
  if (
    built.stats.inputs.straightDefinitions !== EXPECTED_STRAIGHT_DEFINITIONS ||
    built.stats.allocations !== 0 ||
    built.stats.protectedReserveSlots !== 3
  ) {
    throw new Error("Milestone 10A frozen input or allocation-free fixture mismatch.");
  }
  return built.stats;
}

