import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const EXPECTED_TOTAL = 3392;
const EXPECTED_EXACT = 414;
const EXPECTED_DERIVED = 2978;
const EXPECTED_UNIQUE_DERIVED = 2555;
const EXPECTED_DENSE = 1664;
const EXPECTED_SPARSE = 1664;
const EXPECTED_DEMOTED_HALF = 64;
const EXPECTED_STYLE_EXACT = 207;
const EXPECTED_STYLE_DERIVED = 1457;
const EXPECTED_DEMOTED_HALF_UNIQUE = 62;

const OUTPUT_FILES = [
  "dense.json",
  "sparse.json",
  "demoted-half.json",
  "index.json",
  "renderer-only-atlas.md",
];

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function popcountByte(value) {
  let v = value & 0xff;
  let count = 0;
  while (v !== 0) {
    count += v & 1;
    v >>>= 1;
  }
  return count;
}

function hammingDistanceKeys(a, b) {
  if (!/^[0-9a-f]{32}$/u.test(a) || !/^[0-9a-f]{32}$/u.test(b)) {
    throw new Error("Renderer-only bitmap key is not canonical 32-character lowercase hex.");
  }
  let distance = 0;
  for (let offset = 0; offset < 32; offset += 2) {
    distance += popcountByte(Number.parseInt(a.slice(offset, offset + 2), 16) ^ Number.parseInt(b.slice(offset, offset + 2), 16));
  }
  return distance;
}

function publicResolution(entry) {
  const common = {
    aliasKey: entry.aliasKey,
    semanticType: entry.semanticType,
    family: entry.family,
    straightCandidateId: entry.straightCandidateId,
    side: entry.side,
    style: entry.style,
    boundarySideStyleKey: entry.boundarySideStyleKey,
    bitmapKey: entry.bitmapKey,
    rendererOnlyReason: entry.rendererOnlyReason ?? null,
  };

  if (entry.resolution === "renderer-only-exact-reuse") {
    return {
      ...common,
      resolution: "encoded-exact-reuse",
      glyphId: entry.glyphId,
      codepoint: entry.codepoint,
    };
  }

  if (entry.resolution !== "renderer-only-derived") {
    throw new Error(`Unexpected renderer-only resolution ${entry.resolution} for ${entry.aliasKey}.`);
  }

  const result = {
    ...common,
    resolution: "renderer-only-derived",
    glyphId: null,
    codepoint: null,
  };

  if (entry.fallbackCodepoint != null) {
    result.fallback = {
      glyphId: entry.fallbackGlyphId,
      codepoint: entry.fallbackCodepoint,
      bitmapKey: entry.fallbackBitmapKey,
      hammingDistance: entry.fallbackHammingDistance,
    };
  }

  return result;
}

function classify(entry) {
  if (entry.style === "dense") return "dense";
  if (entry.style === "sparse") return "sparse";
  if (entry.style === "half" && entry.rendererOnlyReason === "one-pixel-half-demotion") return "demoted-half";
  throw new Error(`Unclassified renderer-only semantic ${entry.aliasKey}.`);
}

function groupStats(entries) {
  const exact = entries.filter((entry) => entry.resolution === "encoded-exact-reuse");
  const derived = entries.filter((entry) => entry.resolution === "renderer-only-derived");
  const fallbacks = derived.filter((entry) => entry.fallback != null);
  return {
    semanticAliases: entries.length,
    exactEncodedReuses: exact.length,
    derivedAliases: derived.length,
    uniqueDerivedBitmaps: new Set(derived.map((entry) => entry.bitmapKey)).size,
    fallbackAliases: fallbacks.length,
    uniqueFallbackDesiredBitmaps: new Set(fallbacks.map((entry) => entry.bitmapKey)).size,
  };
}

function groupDocument(group, entries) {
  const metadata = {
    dense: { label: "Dense 87.5%", style: "dense" },
    sparse: { label: "Sparse 12.5%", style: "sparse" },
    "demoted-half": { label: "Demoted half 50%", style: "half" },
  }[group];
  return {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-renderer-only-resolution-group",
    schemaVersion: 1,
    status: "provisional-graphics-v0",
    group,
    label: metadata.label,
    requestedStyle: metadata.style,
    stats: groupStats(entries),
    entries,
  };
}

function atlasMarkdown(groups, summary) {
  const lines = [
    "# GraphSCII renderer-only resolution atlas",
    "",
    "This is the human-readable companion to the persistent Milestone 4D.5 renderer-only resolution registry.",
    "",
    "Renderer-only semantics remain valid GraphSCII requests without consuming additional BMP PUA codepoints. Exact bitmap matches resolve to an existing encoded owner; genuinely novel rasters remain algorithmically derived.",
    "",
    "| Group | Semantic aliases | Exact encoded reuse | Derived | Unique derived bitmaps |",
    "| --- | ---: | ---: | ---: | ---: |",
  ];

  for (const [id, document] of Object.entries(groups)) {
    const stats = document.stats;
    lines.push(`| ${document.label} | ${stats.semanticAliases.toLocaleString("en-US")} | ${stats.exactEncodedReuses.toLocaleString("en-US")} | ${stats.derivedAliases.toLocaleString("en-US")} | ${stats.uniqueDerivedBitmaps.toLocaleString("en-US")} |`);
  }

  lines.push(
    "",
    `Total renderer-only semantic aliases: **${summary.semanticAliases.toLocaleString("en-US")}**.`,
    "",
    `Exact encoded reuses: **${summary.exactEncodedReuses.toLocaleString("en-US")}**. Derived aliases: **${summary.derivedAliases.toLocaleString("en-US")}** across **${summary.uniqueDerivedBitmaps.toLocaleString("en-US")} unique derived bitmaps**.`,
    "",
  );

  for (const document of Object.values(groups)) {
    lines.push(`# ${document.label}`, "");
    for (const entry of document.entries) {
      if (entry.resolution === "encoded-exact-reuse") {
        lines.push(`- \`${entry.aliasKey}\` → **EXACT** \`${entry.codepoint}\` / glyph ${entry.glyphId} / bitmap \`${entry.bitmapKey}\``);
      } else if (entry.fallback) {
        lines.push(`- \`${entry.aliasKey}\` → **DERIVED** bitmap \`${entry.bitmapKey}\`; fallback \`${entry.fallback.codepoint}\` / glyph ${entry.fallback.glyphId} / Hamming ${entry.fallback.hammingDistance}`);
      } else {
        lines.push(`- \`${entry.aliasKey}\` → **DERIVED** bitmap \`${entry.bitmapKey}\``);
      }
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function loadInputs(repoRoot) {
  const manifestRoot = path.join(repoRoot, "artifacts", "manifest", "vocabulary");
  const rendererOnly = await readJson(path.join(manifestRoot, "indexes", "renderer-only.json"));
  const byCodepoint = await readJson(path.join(manifestRoot, "indexes", "by-codepoint.json"));
  const registry = await readJson(path.join(manifestRoot, "registry.json"));

  if (rendererOnly.entryCount !== EXPECTED_TOTAL || Object.keys(rendererOnly.entries).length !== EXPECTED_TOTAL) {
    throw new Error(`Milestone 4D.5 requires ${EXPECTED_TOTAL} renderer-only semantic aliases.`);
  }
  if (registry.owners.length !== 5796 || byCodepoint.entryCount !== 5796) {
    throw new Error("Milestone 4D.5 requires the complete 5,796-owner encoded vocabulary.");
  }

  return { rendererOnly, byCodepoint, registry };
}

function validateEncodedReference(entry, inputs, label) {
  const glyphId = inputs.byCodepoint.entries[entry.codepoint];
  const owner = inputs.registry.owners[glyphId];
  if (glyphId !== entry.glyphId || !owner || owner.codepoint !== entry.codepoint || owner.bitmapKey !== entry.bitmapKey) {
    throw new Error(`${label} does not resolve to the claimed encoded owner for ${entry.aliasKey}.`);
  }
}

function validateFallback(entry, inputs) {
  if (!entry.fallback) throw new Error(`Demoted half semantic ${entry.aliasKey} is missing its fallback.`);
  const glyphId = inputs.byCodepoint.entries[entry.fallback.codepoint];
  const owner = inputs.registry.owners[glyphId];
  if (glyphId !== entry.fallback.glyphId || !owner || owner.bitmapKey !== entry.fallback.bitmapKey) {
    throw new Error(`Fallback owner mismatch for ${entry.aliasKey}.`);
  }
  if (entry.bitmapKey === entry.fallback.bitmapKey) {
    throw new Error(`Fallback for ${entry.aliasKey} was incorrectly recorded as exact equality.`);
  }
  const actualDistance = hammingDistanceKeys(entry.bitmapKey, entry.fallback.bitmapKey);
  if (entry.fallback.hammingDistance !== 1 || actualDistance !== 1) {
    throw new Error(`Fallback for ${entry.aliasKey} is not exactly one pixel away.`);
  }
}

async function buildDocuments(repoRoot) {
  const inputs = await loadInputs(repoRoot);
  const buckets = { dense: [], sparse: [], "demoted-half": [] };

  for (const source of Object.values(inputs.rendererOnly.entries)) {
    const entry = publicResolution(source);
    buckets[classify(source)].push(entry);
  }
  for (const entries of Object.values(buckets)) entries.sort((a, b) => a.aliasKey.localeCompare(b.aliasKey));

  if (buckets.dense.length !== EXPECTED_DENSE || buckets.sparse.length !== EXPECTED_SPARSE || buckets["demoted-half"].length !== EXPECTED_DEMOTED_HALF) {
    throw new Error("Milestone 4D.5 renderer-only group cardinality changed.");
  }

  const groups = {
    dense: groupDocument("dense", buckets.dense),
    sparse: groupDocument("sparse", buckets.sparse),
    "demoted-half": groupDocument("demoted-half", buckets["demoted-half"]),
  };

  for (const id of ["dense", "sparse"]) {
    const stats = groups[id].stats;
    if (stats.exactEncodedReuses !== EXPECTED_STYLE_EXACT || stats.derivedAliases !== EXPECTED_STYLE_DERIVED) {
      throw new Error(`Milestone 4D.5 ${id} exact/derived counts changed.`);
    }
  }
  if (
    groups["demoted-half"].stats.exactEncodedReuses !== 0 ||
    groups["demoted-half"].stats.derivedAliases !== EXPECTED_DEMOTED_HALF ||
    groups["demoted-half"].stats.uniqueDerivedBitmaps !== EXPECTED_DEMOTED_HALF_UNIQUE
  ) {
    throw new Error("Milestone 4D.5 demoted-half fixtures changed.");
  }

  const allEntries = [...buckets.dense, ...buckets.sparse, ...buckets["demoted-half"]];
  for (const entry of allEntries) {
    if (entry.resolution === "encoded-exact-reuse") validateEncodedReference(entry, inputs, "Exact renderer-only reuse");
  }
  for (const entry of buckets["demoted-half"]) validateFallback(entry, inputs);

  const derived = allEntries.filter((entry) => entry.resolution === "renderer-only-derived");
  const exact = allEntries.filter((entry) => entry.resolution === "encoded-exact-reuse");
  const summary = {
    semanticAliases: allEntries.length,
    exactEncodedReuses: exact.length,
    derivedAliases: derived.length,
    uniqueDerivedBitmaps: new Set(derived.map((entry) => entry.bitmapKey)).size,
    encodedCodepointsConsumed: 0,
  };
  if (
    summary.semanticAliases !== EXPECTED_TOTAL ||
    summary.exactEncodedReuses !== EXPECTED_EXACT ||
    summary.derivedAliases !== EXPECTED_DERIVED ||
    summary.uniqueDerivedBitmaps !== EXPECTED_UNIQUE_DERIVED
  ) {
    throw new Error("Milestone 4D.5 global renderer-only fixtures changed.");
  }

  const index = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-renderer-only-resolution-index",
    schemaVersion: 1,
    status: "provisional-graphics-v0",
    source: "artifacts/manifest/vocabulary/indexes/renderer-only.json",
    resolutionKinds: ["encoded-exact-reuse", "renderer-only-derived"],
    summary,
    groups: {
      dense: groups.dense.stats,
      sparse: groups.sparse.stats,
      "demoted-half": groups["demoted-half"].stats,
    },
    files: {
      dense: "dense.json",
      sparse: "sparse.json",
      demotedHalf: "demoted-half.json",
      humanAtlas: "renderer-only-atlas.md",
    },
  };

  return {
    files: new Map([
      ["dense.json", jsonText(groups.dense)],
      ["sparse.json", jsonText(groups.sparse)],
      ["demoted-half.json", jsonText(groups["demoted-half"])],
      ["index.json", jsonText(index)],
      ["renderer-only-atlas.md", atlasMarkdown(groups, summary)],
    ]),
    summary: { ...summary, groups: index.groups },
  };
}

async function listFiles(root) {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function generateRendererOnlyResolution(repoRoot) {
  const built = await buildDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "vocabulary", "renderer-only");
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  for (const [name, content] of built.files) {
    await writeFile(path.join(outputRoot, name), content);
  }
  return built.summary;
}

export async function verifyRendererOnlyResolution(repoRoot) {
  const built = await buildDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "vocabulary", "renderer-only");
  const actualNames = await listFiles(outputRoot);
  if (JSON.stringify(actualNames) !== JSON.stringify([...OUTPUT_FILES].sort())) {
    throw new Error(`Milestone 4D.5 file list mismatch: ${actualNames.join(", ")}.`);
  }
  for (const [name, expected] of built.files) {
    const actual = await readFile(path.join(outputRoot, name), "utf8");
    if (actual !== expected) throw new Error(`Milestone 4D.5 bytes differ for ${name}.`);
  }
  return built.summary;
}
