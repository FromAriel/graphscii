import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const EXPECTED_OWNER_COUNT = 5796;
const EXPECTED_RENDERER_ONLY_ALIASES = 3392;
const EXPECTED_RENDERER_ONLY_DERIVED_ALIASES = 2978;
const EXPECTED_RENDERER_ONLY_UNIQUE_DERIVED = 2555;
const EXPECTED_RESERVE_COUNT = 604;
const EXPECTED_ATLAS_FILE_COUNT = 126;
const PAGE_SIZE = 256;

const CATEGORY_DEFINITIONS = [
  { id: "straight", label: "STRAIGHT", canonicalClass: "straight", symbol: "ST", expectedCount: 746 },
  { id: "solid", label: "SOLID 100%", canonicalClass: "solid-100", symbol: "SO", expectedCount: 1259 },
  { id: "medium", label: "MEDIUM 75%", canonicalClass: "medium-75", symbol: "M ", expectedCount: 1269 },
  { id: "half", label: "HALF 50%", canonicalClass: "half-50", symbol: "H ", expectedCount: 1207 },
  { id: "light", label: "LIGHT 25%", canonicalClass: "light-25", symbol: "L ", expectedCount: 1315 },
];

const MASTER_FILENAMES = [
  "master-text-atlas.md",
  "master-text-atlas.txt",
  "master-page-atlas.md",
  "master-page-atlas.txt",
  "master-layout-map.md",
  "straight-text-atlas.md",
  "solid-text-atlas.md",
  "medium-text-atlas.md",
  "half-text-atlas.md",
  "light-text-atlas.md",
];

function formatCodepoint(value) {
  return `U+${value.toString(16).toUpperCase().padStart(6, "0")}`;
}

function shortCodepoint(value) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

function splitPages(entries) {
  const pages = [];
  for (let start = 0; start < entries.length; start += PAGE_SIZE) {
    pages.push(entries.slice(start, start + PAGE_SIZE));
  }
  return pages;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

async function readTextPages(directory) {
  const names = (await readdir(directory))
    .filter((name) => /^page-\d+\.txt$/u.test(name))
    .sort();
  const pages = [];
  for (const name of names) {
    pages.push({ name, text: await readFile(path.join(directory, name), "utf8") });
  }
  return pages;
}

function categoryMarkdown(definition, stats, pages) {
  const lines = [
    `# GraphSCII ${definition.label} text atlas`,
    "",
    `Encoded owners: **${stats.owners.toLocaleString("en-US")}**`,
    "",
    `Paged source: \`artifacts/vocabulary/atlases/${definition.id}/\``,
    "",
    "The entries below preserve canonical codepoint order. Each entry contains the codepoint, glyph ID, canonical class, bitmap key, alias count, representative semantic alias, and exact 8×16 bitmap.",
    "",
  ];
  pages.forEach((page, index) => {
    lines.push(`## Page ${index + 1} — ${page.name}`, "", "```text", page.text.trimEnd(), "```", "");
  });
  return `${lines.join("\n")}\n`;
}

function masterTextMarkdown(state) {
  const lines = [
    "# GraphSCII master text atlas",
    "",
    "Status: **provisional graphics vocabulary v0**",
    "",
    `This is the single human-readable master reference for all **${state.registry.owners.length.toLocaleString("en-US")} encoded PUA graphics**, the renderer-only visual reference, and the protected ${EXPECTED_RESERVE_COUNT}-slot BMP PUA reserve.`,
    "",
    "Canonical encoded entries are grouped by semantic class rather than by allocation-range order. Within each encoded category, codepoint order is authoritative.",
    "",
    "Master category order:",
    "",
    "1. STRAIGHT",
    "2. SOLID 100%",
    "3. MEDIUM 75%",
    "4. HALF 50%",
    "5. LIGHT 25%",
    "6. RENDERER-ONLY REFERENCE",
    "7. RESERVED PUA MAP",
    "",
  ];

  state.categories.forEach((category, index) => {
    lines.push(`# ${index + 1}. ${category.definition.label}`, "");
    lines.push(`Encoded owners: **${category.stats.owners.toLocaleString("en-US")}**`, "");
    category.pages.forEach((page, pageIndex) => {
      lines.push(`## ${category.definition.label} page ${pageIndex + 1}`, "", "```text", page.text.trimEnd(), "```", "");
    });
  });

  lines.push(
    "# 6. RENDERER-ONLY REFERENCE",
    "",
    `Renderer-only semantic aliases: **${state.atlasStats.rendererOnly.semanticAliases.toLocaleString("en-US")}**`,
    "",
    `Exact encoded reuse aliases: **${state.atlasStats.rendererOnly.exactReuseAliases.toLocaleString("en-US")}**. These semantics deliberately do not duplicate an encoded visual in the atlas.`,
    "",
    `Derived aliases: **${state.atlasStats.rendererOnly.derivedAliases.toLocaleString("en-US")}** across **${state.atlasStats.rendererOnly.uniqueDerivedBitmaps.toLocaleString("en-US")}** unique derived bitmaps.`,
    "",
  );
  state.rendererPages.forEach((page, pageIndex) => {
    lines.push(`## Renderer-only page ${pageIndex + 1}`, "", "```text", page.text.trimEnd(), "```", "");
  });

  lines.push(
    "# 7. RESERVED PUA MAP",
    "",
    `Protected range: \`${state.atlasStats.reserve.start}\` .. \`${state.atlasStats.reserve.end}\` — **${state.atlasStats.reserve.slots.toLocaleString("en-US")} unallocated slots**.`,
    "",
  );
  state.reservePages.forEach((page, pageIndex) => {
    lines.push(`## Reserve page ${pageIndex + 1}`, "", "```text", page.text.trimEnd(), "```", "");
  });

  return `${lines.join("\n")}\n`;
}

function masterTextPlain(state) {
  const lines = [
    "GRAPHSCII MASTER TEXT ATLAS",
    "PROVISIONAL GRAPHICS VOCABULARY V0",
    "",
    `ENCODED PUA GRAPHICS: ${state.registry.owners.length}`,
    `RENDERER-ONLY SEMANTIC ALIASES: ${state.atlasStats.rendererOnly.semanticAliases}`,
    `PROTECTED RESERVE SLOTS: ${state.atlasStats.reserve.slots}`,
    "",
    "CATEGORY ORDER: STRAIGHT / SOLID 100% / MEDIUM 75% / HALF 50% / LIGHT 25% / RENDERER-ONLY / RESERVED",
    "",
  ];

  state.categories.forEach((category, index) => {
    lines.push("=".repeat(80), `${index + 1}. ${category.definition.label}`, `ENCODED OWNERS=${category.stats.owners}`, "=".repeat(80), "");
    category.pages.forEach((page) => lines.push(page.text.trimEnd(), ""));
  });

  lines.push(
    "=".repeat(80),
    "6. RENDERER-ONLY REFERENCE",
    `SEMANTIC ALIASES=${state.atlasStats.rendererOnly.semanticAliases}`,
    `EXACT ENCODED REUSE ALIASES=${state.atlasStats.rendererOnly.exactReuseAliases}`,
    `DERIVED ALIASES=${state.atlasStats.rendererOnly.derivedAliases}`,
    `UNIQUE DERIVED BITMAPS=${state.atlasStats.rendererOnly.uniqueDerivedBitmaps}`,
    "=".repeat(80),
    "",
  );
  state.rendererPages.forEach((page) => lines.push(page.text.trimEnd(), ""));

  lines.push(
    "=".repeat(80),
    "7. RESERVED PUA MAP",
    `RANGE=${state.atlasStats.reserve.start}..${state.atlasStats.reserve.end}`,
    `SLOTS=${state.atlasStats.reserve.slots}`,
    "=".repeat(80),
    "",
  );
  state.reservePages.forEach((page) => lines.push(page.text.trimEnd(), ""));

  return `${lines.join("\n")}\n`;
}

function pageComposition(entries) {
  const counts = new Map();
  for (const owner of entries) {
    counts.set(owner.canonicalClass, (counts.get(owner.canonicalClass) ?? 0) + 1);
  }
  return CATEGORY_DEFINITIONS
    .map((definition) => [definition, counts.get(definition.canonicalClass) ?? 0])
    .filter(([, count]) => count > 0)
    .map(([definition, count]) => `${definition.label}=${count}`)
    .join(", ");
}

function pageGrid(entries, pageIndex) {
  const byValue = new Map(entries.map((owner) => [owner.codepointValue, owner]));
  const pageStart = 0xe000 + pageIndex * PAGE_SIZE;
  const rows = [];
  for (let y = 0; y < 16; y += 1) {
    const cells = [];
    for (let x = 0; x < 16; x += 1) {
      const value = pageStart + y * 16 + x;
      const owner = byValue.get(value);
      if (!owner) {
        cells.push("----/--");
        continue;
      }
      const definition = CATEGORY_DEFINITIONS.find((entry) => entry.canonicalClass === owner.canonicalClass);
      cells.push(`${shortCodepoint(value)}/${definition?.symbol ?? "??"}`);
    }
    rows.push(cells.join(" "));
  }
  return rows.join("\n");
}

function buildMasterPageAtlas(state, markdown) {
  const owners = [...state.registry.owners].sort((a, b) => a.glyphId - b.glyphId);
  const pages = splitPages(owners);
  const lines = markdown
    ? [
        "# GraphSCII master page atlas",
        "",
        `The encoded vocabulary occupies **${pages.length} Unicode/codepoint pages** of up to ${PAGE_SIZE} slots each. This atlas mirrors the 4D.3 combined PNG page neighborhoods without reproducing every bitmap inline.`,
        "",
        "Cell legend: `ST` straight, `SO` solid 100%, `M` medium 75%, `H` half 50%, `L` light 25%, `--` unallocated.",
        "",
      ]
    : [
        "GRAPHSCII MASTER PAGE ATLAS",
        "",
        `PAGES=${pages.length} SLOTS_PER_PAGE=${PAGE_SIZE}`,
        "LEGEND: ST=STRAIGHT SO=SOLID100 M=MEDIUM75 H=HALF50 L=LIGHT25 --=UNALLOCATED",
        "",
      ];

  pages.forEach((entries, pageIndex) => {
    const start = entries[0];
    const end = entries.at(-1);
    const title = `Page ${pageIndex + 1} / ${pages.length} — ${start.codepoint}..${end.codepoint}`;
    if (markdown) {
      lines.push(`## ${title}`, "", `Owners: **${entries.length}**`, "", `Composition: ${pageComposition(entries)}`, "", "```text", pageGrid(entries, pageIndex), "```", "");
    } else {
      lines.push("=".repeat(80), title, `OWNERS=${entries.length}`, `COMPOSITION=${pageComposition(entries)}`, "=".repeat(80), pageGrid(entries, pageIndex), "");
    }
  });

  return `${lines.join("\n")}\n`;
}

function masterLayoutMap(state) {
  const lines = [
    "# GraphSCII master layout map",
    "",
    "GraphSCII graphics use the full BMP Private Use Area as a deterministic address space. Printable ASCII remains at its normal Unicode positions and does not consume PUA slots.",
    "",
    "| Segment | Unicode range | Count | Status |",
    "| --- | --- | ---: | --- |",
    "| Printable ASCII | `U+0020..U+007E` | 95 | normal Unicode, outside PUA |",
    "| Straight | `U+E000..U+E2E9` | 746 | encoded |",
    "| Solid 100% | `U+E2EA..U+E7D4` | 1,259 | encoded |",
    "| Medium 75% | `U+E7D5..U+ECC9` | 1,269 | encoded |",
    "| Light 25% | `U+ECCA..U+F1EC` | 1,315 | encoded |",
    "| Half 50% | `U+F1ED..U+F6A3` | 1,207 | encoded |",
    "| Reserve | `U+F6A4..U+F8FF` | 604 | **unallocated / protected** |",
    "",
    `Encoded PUA graphics: **${state.registry.owners.length.toLocaleString("en-US")}**`,
    "",
    `Minimum physical font population when printable ASCII is included: **${(state.registry.owners.length + 95).toLocaleString("en-US")} glyphs**.`,
    "",
    `Renderer-only semantics remain outside the PUA allocation: **${state.atlasStats.rendererOnly.semanticAliases.toLocaleString("en-US")} aliases**, including **${state.atlasStats.rendererOnly.exactReuseAliases.toLocaleString("en-US")} exact encoded reuses** and **${state.atlasStats.rendererOnly.derivedAliases.toLocaleString("en-US")} derived aliases** across **${state.atlasStats.rendererOnly.uniqueDerivedBitmaps.toLocaleString("en-US")} unique derived bitmaps.`,
    "",
    "The master text atlas is intentionally ordered STRAIGHT → SOLID → MEDIUM → HALF → LIGHT for conceptual readability. The actual allocation range places LIGHT before HALF, as shown above; codepoints are authoritative.",
  ];
  return `${lines.join("\n")}\n`;
}

async function loadState(repoRoot) {
  const atlasRoot = path.join(repoRoot, "artifacts", "vocabulary", "atlases");
  const registryRoot = path.join(repoRoot, "artifacts", "manifest", "vocabulary");
  const registry = await readJson(path.join(registryRoot, "registry.json"));
  const atlasStats = await readJson(path.join(atlasRoot, "stats.json"));

  if (registry.owners.length !== EXPECTED_OWNER_COUNT || atlasStats.encodedOwners !== EXPECTED_OWNER_COUNT) {
    throw new Error(`Milestone 4D.4 requires exactly ${EXPECTED_OWNER_COUNT} encoded owners.`);
  }
  if (atlasStats.generatedFiles !== EXPECTED_ATLAS_FILE_COUNT) {
    throw new Error(`Milestone 4D.4 requires the complete 4D.3 atlas tree (${EXPECTED_ATLAS_FILE_COUNT} generated files).`);
  }
  if (
    atlasStats.rendererOnly.semanticAliases !== EXPECTED_RENDERER_ONLY_ALIASES ||
    atlasStats.rendererOnly.derivedAliases !== EXPECTED_RENDERER_ONLY_DERIVED_ALIASES ||
    atlasStats.rendererOnly.uniqueDerivedBitmaps !== EXPECTED_RENDERER_ONLY_UNIQUE_DERIVED
  ) {
    throw new Error("Milestone 4D.4 renderer-only fixture mismatch.");
  }
  if (atlasStats.reserve.slots !== EXPECTED_RESERVE_COUNT || atlasStats.reserve.start !== "U+00F6A4" || atlasStats.reserve.end !== "U+00F8FF") {
    throw new Error("Milestone 4D.4 reserve fixture mismatch.");
  }

  const owners = [...registry.owners].sort((a, b) => a.glyphId - b.glyphId);
  owners.forEach((owner, index) => {
    const expectedValue = 0xe000 + index;
    if (owner.glyphId !== index || owner.codepointValue !== expectedValue || owner.codepoint !== formatCodepoint(expectedValue)) {
      throw new Error(`Milestone 4D.4 canonical codepoint continuity failed at glyph ${index}.`);
    }
  });

  const categories = [];
  for (const definition of CATEGORY_DEFINITIONS) {
    const stats = atlasStats.categories[definition.id];
    if (!stats || stats.owners !== definition.expectedCount) {
      throw new Error(`Milestone 4D.4 ${definition.label} count mismatch.`);
    }
    const pages = await readTextPages(path.join(atlasRoot, definition.id));
    if (pages.length !== stats.pages) {
      throw new Error(`Milestone 4D.4 ${definition.label} page-count mismatch.`);
    }
    categories.push({ definition, stats, pages });
  }

  const rendererPages = await readTextPages(path.join(atlasRoot, "renderer-only"));
  const reservePages = await readTextPages(path.join(atlasRoot, "reserve-layout"));
  if (rendererPages.length !== atlasStats.rendererOnly.pages || reservePages.length !== atlasStats.reserve.pages) {
    throw new Error("Milestone 4D.4 renderer/reserve page-count mismatch.");
  }

  return { atlasRoot, registry, atlasStats, categories, rendererPages, reservePages };
}

async function buildMasterFiles(repoRoot) {
  const state = await loadState(repoRoot);
  const files = new Map();
  files.set("master-text-atlas.md", masterTextMarkdown(state));
  files.set("master-text-atlas.txt", masterTextPlain(state));
  files.set("master-page-atlas.md", buildMasterPageAtlas(state, true));
  files.set("master-page-atlas.txt", buildMasterPageAtlas(state, false));
  files.set("master-layout-map.md", masterLayoutMap(state));
  for (const category of state.categories) {
    files.set(`${category.definition.id}-text-atlas.md`, categoryMarkdown(category.definition, category.stats, category.pages));
  }
  if (files.size !== MASTER_FILENAMES.length) {
    throw new Error(`Milestone 4D.4 expected ${MASTER_FILENAMES.length} master files; built ${files.size}.`);
  }
  return { state, files };
}

export async function generateVocabularyMasterAtlas(repoRoot) {
  const { state, files } = await buildMasterFiles(repoRoot);
  for (const [name, content] of files) {
    await writeFile(path.join(state.atlasRoot, name), content);
  }
  return {
    encodedOwners: state.registry.owners.length,
    categoryFiles: CATEGORY_DEFINITIONS.length,
    masterFiles: files.size,
    combinedCodepointPages: Math.ceil(state.registry.owners.length / PAGE_SIZE),
    rendererOnlyUniqueDerivedBitmaps: state.atlasStats.rendererOnly.uniqueDerivedBitmaps,
    reserveSlots: state.atlasStats.reserve.slots,
  };
}

export async function verifyVocabularyMasterAtlas(repoRoot) {
  const { state, files } = await buildMasterFiles(repoRoot);
  for (const name of MASTER_FILENAMES) {
    const expected = files.get(name);
    const actual = await readFile(path.join(state.atlasRoot, name), "utf8");
    if (actual !== expected) {
      throw new Error(`${name} does not match deterministic Milestone 4D.4 generation.`);
    }
  }

  const masterText = files.get("master-text-atlas.md");
  const categoryPositions = CATEGORY_DEFINITIONS.map((definition, index) => masterText.indexOf(`# ${index + 1}. ${definition.label}`));
  const rendererPosition = masterText.indexOf("# 6. RENDERER-ONLY REFERENCE");
  const reservePosition = masterText.indexOf("# 7. RESERVED PUA MAP");
  const positions = [...categoryPositions, rendererPosition, reservePosition];
  if (positions.some((position) => position < 0) || positions.some((position, index) => index > 0 && position <= positions[index - 1])) {
    throw new Error("Milestone 4D.4 master category ordering changed.");
  }

  const pageAtlas = files.get("master-page-atlas.txt");
  if (!pageAtlas.includes("Page 1 / 23 — U+00E000..U+00E0FF") || !pageAtlas.includes("Page 23 / 23 — U+00F600..U+00F6A3")) {
    throw new Error("Milestone 4D.4 master page atlas boundary fixture mismatch.");
  }

  return {
    encodedOwners: state.registry.owners.length,
    masterFiles: files.size,
    combinedCodepointPages: Math.ceil(state.registry.owners.length / PAGE_SIZE),
    rendererOnlySemanticAliases: state.atlasStats.rendererOnly.semanticAliases,
    rendererOnlyUniqueDerivedBitmaps: state.atlasStats.rendererOnly.uniqueDerivedBitmaps,
    reserveSlots: state.atlasStats.reserve.slots,
  };
}
