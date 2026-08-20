import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { encodeRgbaPng } from "./artifact-pipeline.mjs";

const CELL_WIDTH = 8;
const CELL_HEIGHT = 16;
const PAGE_SIZE = 256;
const PAGE_COLUMNS = 16;
const PAGE_ROWS = 16;
const PAGE_WIDTH = PAGE_COLUMNS * CELL_WIDTH;
const PAGE_HEIGHT = PAGE_ROWS * CELL_HEIGHT;
const EXPECTED_OWNER_COUNT = 5796;
const EXPECTED_RENDERER_ONLY_ALIASES = 3392;
const EXPECTED_RENDERER_ONLY_DERIVED_ALIASES = 2978;
const EXPECTED_RENDERER_ONLY_UNIQUE_DERIVED = 2555;
const RESERVE_START = 0xf6a4;
const RESERVE_END = 0xf8ff;
const RESERVE_COUNT = 604;

const CATEGORY_DEFINITIONS = [
  { id: "straight", label: "STRAIGHT", canonicalClass: "straight", expectedCount: 746 },
  { id: "solid", label: "SOLID 100%", canonicalClass: "solid-100", expectedCount: 1259 },
  { id: "medium", label: "MEDIUM 75%", canonicalClass: "medium-75", expectedCount: 1269 },
  { id: "half", label: "HALF 50%", canonicalClass: "half-50", expectedCount: 1207 },
  { id: "light", label: "LIGHT 25%", canonicalClass: "light-25", expectedCount: 1315 },
];

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function bitmapFromKey(key) {
  if (!/^[0-9a-f]{32}$/u.test(key)) {
    throw new Error(`Invalid GraphSCII bitmap key: ${key}.`);
  }
  return Uint8Array.from({ length: CELL_HEIGHT }, (_, row) => Number.parseInt(key.slice(row * 2, row * 2 + 2), 16));
}

function hasPixel(bitmap, x, y) {
  return ((bitmap[y] ?? 0) & (1 << x)) !== 0;
}

function asciiForBitmap(bitmap) {
  const rows = [];
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    let row = "";
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      row += hasPixel(bitmap, x, y) ? "#" : "-";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

function renderBitmapPage(entries) {
  const rgba = Buffer.alloc(PAGE_WIDTH * PAGE_HEIGHT * 4);
  entries.forEach((entry, localIndex) => {
    const bitmap = bitmapFromKey(entry.bitmapKey);
    const cellX = localIndex % PAGE_COLUMNS;
    const cellY = Math.floor(localIndex / PAGE_COLUMNS);
    for (let y = 0; y < CELL_HEIGHT; y += 1) {
      for (let x = 0; x < CELL_WIDTH; x += 1) {
        if (!hasPixel(bitmap, x, y)) continue;
        const px = cellX * CELL_WIDTH + x;
        const py = cellY * CELL_HEIGHT + y;
        const offset = (py * PAGE_WIDTH + px) * 4;
        rgba[offset] = 0;
        rgba[offset + 1] = 0;
        rgba[offset + 2] = 0;
        rgba[offset + 3] = 255;
      }
    }
  });
  return encodeRgbaPng(PAGE_WIDTH, PAGE_HEIGHT, rgba);
}

function pageName(page) {
  return `page-${page.toString().padStart(2, "0")}`;
}

function splitPages(entries) {
  const pages = [];
  for (let start = 0; start < entries.length; start += PAGE_SIZE) {
    pages.push(entries.slice(start, start + PAGE_SIZE));
  }
  return pages;
}

function encodedTextPage(label, page, entries) {
  const start = entries[0]?.codepoint ?? "—";
  const end = entries.at(-1)?.codepoint ?? "—";
  const lines = [
    `GraphSCII ${label} — page ${page + 1}`,
    `count=${entries.length} range=${start}..${end}`,
    "",
  ];
  for (const owner of entries) {
    lines.push(
      `${owner.codepoint}  glyphId=${owner.glyphId}  class=${owner.canonicalClass}`,
      `bitmap=${owner.bitmapKey}`,
      `aliases=${owner.semanticAliases.length}`,
      `first=${owner.firstSemanticAlias}`,
      asciiForBitmap(bitmapFromKey(owner.bitmapKey)),
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

function encodedIndexMarkdown(label, owners, pageCount) {
  const first = owners[0];
  const last = owners.at(-1);
  return `# GraphSCII ${label} atlas\n\n` +
    `- Encoded owners: **${owners.length.toLocaleString("en-US")}**\n` +
    `- Codepoint range: \`${first?.codepoint ?? "—"}\` .. \`${last?.codepoint ?? "—"}\`\n` +
    `- Pages: **${pageCount}** at ${PAGE_SIZE} slots/page\n` +
    `- PNG page geometry: **${PAGE_WIDTH}×${PAGE_HEIGHT}** pixels (${PAGE_COLUMNS}×${PAGE_ROWS} cells)\n` +
    `- Ordering: canonical codepoint/glyph ID order\n\n` +
    `Each text page records codepoint, glyph ID, canonical class, bitmap key, alias count, representative semantic alias, and the exact 8×16 \`#\`/\`-\` bitmap.\n`;
}

function aggregateRendererOnly(rendererOnlyEntries) {
  const byBitmap = new Map();
  let exactReuseAliases = 0;
  let derivedAliases = 0;
  for (const semantic of rendererOnlyEntries) {
    if (semantic.resolution === "renderer-only-exact-reuse") {
      exactReuseAliases += 1;
      continue;
    }
    if (semantic.resolution !== "renderer-only-derived") {
      throw new Error(`Unexpected renderer-only resolution: ${semantic.resolution}.`);
    }
    derivedAliases += 1;
    let entry = byBitmap.get(semantic.bitmapKey);
    if (!entry) {
      entry = {
        bitmapKey: semantic.bitmapKey,
        aliases: [],
        styles: new Set(),
        reasons: new Set(),
        fallbacks: new Map(),
      };
      byBitmap.set(semantic.bitmapKey, entry);
    }
    entry.aliases.push(semantic.aliasKey);
    entry.styles.add(semantic.style);
    if (semantic.rendererOnlyReason) entry.reasons.add(semantic.rendererOnlyReason);
    if (semantic.fallbackCodepoint) {
      entry.fallbacks.set(semantic.fallbackCodepoint, {
        codepoint: semantic.fallbackCodepoint,
        bitmapKey: semantic.fallbackBitmapKey,
        hammingDistance: semantic.fallbackHammingDistance,
      });
    }
  }

  const entries = [...byBitmap.values()]
    .sort((a, b) => a.bitmapKey.localeCompare(b.bitmapKey))
    .map((entry, index) => ({
      rendererVisualId: `R${index.toString().padStart(4, "0")}`,
      bitmapKey: entry.bitmapKey,
      aliases: entry.aliases.sort(),
      styles: [...entry.styles].sort(),
      reasons: [...entry.reasons].sort(),
      fallbacks: [...entry.fallbacks.values()].sort((a, b) => a.codepoint.localeCompare(b.codepoint)),
    }));

  return { entries, exactReuseAliases, derivedAliases };
}

function rendererTextPage(page, entries) {
  const lines = [
    `GraphSCII RENDERER-ONLY DERIVED REFERENCE — page ${page + 1}`,
    `count=${entries.length}`,
    "",
  ];
  for (const entry of entries) {
    lines.push(
      `${entry.rendererVisualId}  styles=${entry.styles.join(",")}`,
      `bitmap=${entry.bitmapKey}`,
      `aliases=${entry.aliases.length}`,
      `reasons=${entry.reasons.join(",")}`,
      `first=${entry.aliases[0] ?? "—"}`,
    );
    if (entry.fallbacks.length > 0) {
      lines.push(`fallbacks=${entry.fallbacks.map((fallback) => `${fallback.codepoint}@h${fallback.hammingDistance}`).join(",")}`);
    }
    lines.push(asciiForBitmap(bitmapFromKey(entry.bitmapKey)), "");
  }
  return `${lines.join("\n")}\n`;
}

function rendererIndexMarkdown(summary, pageCount) {
  return `# GraphSCII renderer-only reference atlas\n\n` +
    `Renderer-only semantics are preserved without consuming additional PUA codepoints. Exact-reuse semantics are counted here but are not duplicated visually because their bitmap already has an encoded owner.\n\n` +
    `- Renderer-only semantic aliases: **${summary.totalAliases.toLocaleString("en-US")}**\n` +
    `- Exact encoded reuse aliases: **${summary.exactReuseAliases.toLocaleString("en-US")}**\n` +
    `- Derived aliases: **${summary.derivedAliases.toLocaleString("en-US")}**\n` +
    `- Unique derived bitmaps shown: **${summary.uniqueDerivedBitmaps.toLocaleString("en-US")}**\n` +
    `- Pages: **${pageCount}**\n` +
    `- Ordering: deterministic bitmap-key order\n\n` +
    `Each shown renderer-only visual has a stable research ID (\`R0000\`, …), style/reason metadata, semantic aliases, optional Hamming-distance fallback metadata, and its exact 8×16 bitmap.\n`;
}

function reserveCodepoint(value) {
  return `U+${value.toString(16).toUpperCase().padStart(6, "0")}`;
}

function reserveTextPage(page, codepoints) {
  const lines = [
    `GraphSCII RESERVED BMP PUA — page ${page + 1}`,
    `count=${codepoints.length} range=${codepoints[0] ?? "—"}..${codepoints.at(-1) ?? "—"}`,
    "",
  ];
  for (let start = 0; start < codepoints.length; start += 16) {
    lines.push(codepoints.slice(start, start + 16).join("  "));
  }
  return `${lines.join("\n")}\n`;
}

function reserveIndexMarkdown(pageCount) {
  return `# GraphSCII reserved BMP PUA layout\n\n` +
    `- Reserved range: \`${reserveCodepoint(RESERVE_START)}\` .. \`${reserveCodepoint(RESERVE_END)}\`\n` +
    `- Reserved slots: **${RESERVE_COUNT}**\n` +
    `- Pages: **${pageCount}**\n` +
    `- Allocation status: **UNALLOCATED / PROTECTED**\n\n` +
    `No canonical glyph bitmap exists for these codepoints. This directory is a textual address-space map only; it deliberately contains no PNG glyph atlas.\n`;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

async function loadCanonicalInputs(repoRoot) {
  const vocabularyRoot = path.join(repoRoot, "artifacts", "manifest", "vocabulary");
  const registry = await readJson(path.join(vocabularyRoot, "registry.json"));
  const rendererOnly = await readJson(path.join(vocabularyRoot, "indexes", "renderer-only.json"));
  if (registry.owners.length !== EXPECTED_OWNER_COUNT) {
    throw new Error(`Milestone 4D.3 requires ${EXPECTED_OWNER_COUNT} encoded owners; got ${registry.owners.length}.`);
  }
  if (rendererOnly.entryCount !== EXPECTED_RENDERER_ONLY_ALIASES) {
    throw new Error(`Milestone 4D.3 renderer-only alias count mismatch: ${rendererOnly.entryCount}.`);
  }
  return { registry, rendererOnly };
}

function buildAtlasFiles(registry, rendererOnlyIndex) {
  const files = new Map();
  const categoryStats = {};

  for (const definition of CATEGORY_DEFINITIONS) {
    const owners = registry.owners
      .filter((owner) => owner.canonicalClass === definition.canonicalClass)
      .sort((a, b) => a.glyphId - b.glyphId);
    if (owners.length !== definition.expectedCount) {
      throw new Error(`${definition.label} owner count mismatch: ${owners.length}.`);
    }
    const pages = splitPages(owners);
    categoryStats[definition.id] = { owners: owners.length, pages: pages.length };
    files.set(`${definition.id}/index.md`, encodedIndexMarkdown(definition.label, owners, pages.length));
    pages.forEach((entries, page) => {
      files.set(`${definition.id}/${pageName(page)}.png`, renderBitmapPage(entries));
      files.set(`${definition.id}/${pageName(page)}.txt`, encodedTextPage(definition.label, page, entries));
    });
  }

  const combinedOwners = [...registry.owners].sort((a, b) => a.glyphId - b.glyphId);
  const combinedPages = splitPages(combinedOwners);
  files.set("combined/index.md", encodedIndexMarkdown("COMBINED ENCODED VOCABULARY", combinedOwners, combinedPages.length));
  combinedPages.forEach((entries, page) => {
    files.set(`combined/${pageName(page)}.png`, renderBitmapPage(entries));
    files.set(`combined/${pageName(page)}.txt`, encodedTextPage("COMBINED ENCODED VOCABULARY", page, entries));
  });

  const rendererSummary = aggregateRendererOnly(Object.values(rendererOnlyIndex.entries));
  if (rendererSummary.derivedAliases !== EXPECTED_RENDERER_ONLY_DERIVED_ALIASES) {
    throw new Error(`Renderer-only derived alias mismatch: ${rendererSummary.derivedAliases}.`);
  }
  if (rendererSummary.entries.length !== EXPECTED_RENDERER_ONLY_UNIQUE_DERIVED) {
    throw new Error(`Renderer-only unique derived bitmap mismatch: ${rendererSummary.entries.length}.`);
  }
  const rendererPages = splitPages(rendererSummary.entries);
  files.set("renderer-only/index.md", rendererIndexMarkdown({
    totalAliases: rendererOnlyIndex.entryCount,
    exactReuseAliases: rendererSummary.exactReuseAliases,
    derivedAliases: rendererSummary.derivedAliases,
    uniqueDerivedBitmaps: rendererSummary.entries.length,
  }, rendererPages.length));
  rendererPages.forEach((entries, page) => {
    files.set(`renderer-only/${pageName(page)}.png`, renderBitmapPage(entries));
    files.set(`renderer-only/${pageName(page)}.txt`, rendererTextPage(page, entries));
  });

  const reserve = Array.from({ length: RESERVE_COUNT }, (_, index) => reserveCodepoint(RESERVE_START + index));
  const reservePages = splitPages(reserve);
  files.set("reserve-layout/index.md", reserveIndexMarkdown(reservePages.length));
  reservePages.forEach((entries, page) => {
    files.set(`reserve-layout/${pageName(page)}.txt`, reserveTextPage(page, entries));
  });

  const stats = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-vocabulary-atlas-stats",
    schemaVersion: 1,
    status: "provisional-graphics-v0",
    page: {
      slots: PAGE_SIZE,
      columns: PAGE_COLUMNS,
      rows: PAGE_ROWS,
      cellWidth: CELL_WIDTH,
      cellHeight: CELL_HEIGHT,
      pixelWidth: PAGE_WIDTH,
      pixelHeight: PAGE_HEIGHT,
    },
    encodedOwners: registry.owners.length,
    categories: categoryStats,
    combined: { owners: combinedOwners.length, pages: combinedPages.length },
    rendererOnly: {
      semanticAliases: rendererOnlyIndex.entryCount,
      exactReuseAliases: rendererSummary.exactReuseAliases,
      derivedAliases: rendererSummary.derivedAliases,
      uniqueDerivedBitmaps: rendererSummary.entries.length,
      pages: rendererPages.length,
    },
    reserve: {
      start: reserveCodepoint(RESERVE_START),
      end: reserveCodepoint(RESERVE_END),
      slots: RESERVE_COUNT,
      pages: reservePages.length,
      pngPages: 0,
    },
    generatedFiles: files.size + 1,
  };
  files.set("stats.json", jsonText(stats));
  return { files, stats };
}

async function writeFiles(root, files) {
  for (const [relative, content] of files) {
    const filename = path.join(root, ...relative.split("/"));
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, content);
  }
}

async function listFilesRecursive(root, prefix = "") {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFilesRecursive(root, relative));
    else files.push(relative);
  }
  return files.sort();
}

export async function generateVocabularyAtlases(repoRoot) {
  const { registry, rendererOnly } = await loadCanonicalInputs(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "vocabulary", "atlases");
  const built = buildAtlasFiles(registry, rendererOnly);
  await mkdir(outputRoot, { recursive: true });
  const managedDirectories = [
    ...CATEGORY_DEFINITIONS.map((definition) => definition.id),
    "combined",
    "renderer-only",
    "reserve-layout",
  ];
  for (const directory of managedDirectories) {
    await rm(path.join(outputRoot, directory), { recursive: true, force: true });
  }
  await rm(path.join(outputRoot, "stats.json"), { force: true });
  await writeFiles(outputRoot, built.files);
  return built.stats;
}

export async function verifyVocabularyAtlases(repoRoot) {
  const { registry, rendererOnly } = await loadCanonicalInputs(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "vocabulary", "atlases");
  const expected = buildAtlasFiles(registry, rendererOnly);
  const expectedNames = [...expected.files.keys()].sort();
  const managedDirectories = new Set([
    ...CATEGORY_DEFINITIONS.map((definition) => definition.id),
    "combined",
    "renderer-only",
    "reserve-layout",
  ]);
  const actualNames = (await listFilesRecursive(outputRoot)).filter((relative) => {
    if (relative === "stats.json") return true;
    const [topLevel] = relative.split("/");
    return managedDirectories.has(topLevel);
  });
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`Milestone 4D.3 managed atlas file list mismatch: expected ${expectedNames.length}, got ${actualNames.length}.`);
  }
  for (const relative of expectedNames) {
    const expectedContent = expected.files.get(relative);
    const actual = await readFile(path.join(outputRoot, ...relative.split("/")));
    const wanted = Buffer.isBuffer(expectedContent) ? expectedContent : Buffer.from(expectedContent, "utf8");
    if (!actual.equals(wanted)) {
      throw new Error(`Milestone 4D.3 atlas bytes differ for ${relative}.`);
    }
  }
  if (
    expected.stats.categories.straight.pages !== 3 ||
    expected.stats.categories.solid.pages !== 5 ||
    expected.stats.categories.medium.pages !== 5 ||
    expected.stats.categories.half.pages !== 5 ||
    expected.stats.categories.light.pages !== 6 ||
    expected.stats.combined.pages !== 23 ||
    expected.stats.rendererOnly.pages !== 10 ||
    expected.stats.reserve.pages !== 3
  ) {
    throw new Error("Milestone 4D.3 frozen page-count gate changed.");
  }
  return expected.stats;
}
