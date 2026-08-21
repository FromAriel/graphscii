import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { encodeRgbaPng } from "./artifact-pipeline.mjs";

const WIDTH = 8;
const HEIGHT = 16;
const BASE_OWNER_COUNT = 5796;
const ORTHOGONAL_NOVEL_COUNT = 544;
const DIAGONAL_NOVEL_COUNT = 57;
const CONNECTOR_NOVEL_COUNT = 601;
const TOTAL_OWNER_COUNT = BASE_OWNER_COUNT + CONNECTOR_NOVEL_COUNT;
const CONNECTOR_START = 0xf6a4;
const CONNECTOR_END = 0xf8fc;
const RESERVE_START = 0xf8fd;
const RESERVE_END = 0xf8ff;
const RESERVE_COUNT = 3;
const ATLAS_PAGE_SIZE = 256;
const ATLAS_COLUMNS = 16;
const ATLAS_ROWS = 16;
const MAX_IO_CONCURRENCY = 48;

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function formatCodepoint(value) {
  return `U+${value.toString(16).toUpperCase().padStart(6, "0")}`;
}

function parseBitmapKey(key) {
  if (typeof key !== "string" || !/^[0-9a-f]{32}$/u.test(key)) {
    throw new Error(`Invalid GraphSCII bitmap key: ${key}.`);
  }
  const rows = Buffer.from(key, "hex");
  if (rows.length !== HEIGHT) throw new Error(`Invalid GraphSCII bitmap row count for ${key}.`);
  return rows;
}

function asciiForRows(rows) {
  const lines = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    let line = "";
    const row = rows[y] ?? 0;
    for (let x = 0; x < WIDTH; x += 1) line += (row & (1 << x)) !== 0 ? "#" : "-";
    lines.push(line);
  }
  return `${lines.join("\n")}\n`;
}

function rgbaForRows(rows) {
  const rgba = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    const row = rows[y] ?? 0;
    for (let x = 0; x < WIDTH; x += 1) {
      if ((row & (1 << x)) === 0) continue;
      const offset = (y * WIDTH + x) * 4;
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

function pngForRows(rows) {
  return encodeRgbaPng(WIDTH, HEIGHT, rgbaForRows(rows));
}

function atlasPng(owners) {
  const atlasWidth = ATLAS_COLUMNS * WIDTH;
  const atlasHeight = ATLAS_ROWS * HEIGHT;
  const rgba = Buffer.alloc(atlasWidth * atlasHeight * 4);
  for (let index = 0; index < owners.length; index += 1) {
    const owner = owners[index];
    const rows = parseBitmapKey(owner.bitmapKey);
    const cellX = index % ATLAS_COLUMNS;
    const cellY = Math.floor(index / ATLAS_COLUMNS);
    for (let y = 0; y < HEIGHT; y += 1) {
      const row = rows[y] ?? 0;
      for (let x = 0; x < WIDTH; x += 1) {
        if ((row & (1 << x)) === 0) continue;
        const px = cellX * WIDTH + x;
        const py = cellY * HEIGHT + y;
        rgba[(py * atlasWidth + px) * 4 + 3] = 255;
      }
    }
  }
  return encodeRgbaPng(atlasWidth, atlasHeight, rgba);
}

function atlasText(pageIndex, owners) {
  const lines = [`# GraphSCII Connector Atlas — Page ${pageIndex + 1}`, ""];
  for (const owner of owners) {
    lines.push(`## ${owner.codepoint} — glyph ${owner.glyphId}`);
    lines.push("");
    lines.push(`Class: \`${owner.canonicalClass}\``);
    lines.push(`Source: \`${owner.sourceOwnerId}\``);
    lines.push(`Aliases: ${owner.semanticAliases.join(", ")}`);
    lines.push("");
    lines.push("```text");
    lines.push(asciiForRows(parseBitmapKey(owner.bitmapKey)).trimEnd());
    lines.push("```");
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function forEachLimited(items, limit, worker) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

function makeIndex(index, entries) {
  return {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-vocabulary-v1-index",
    schemaVersion: 1,
    index,
    entryCount: Object.keys(entries).length,
    entries,
  };
}

function masterLayoutMap(stats) {
  return `# GraphSCII Graphics Vocabulary v1 Layout\n\n` +
    `Status: **PROVISIONAL CONNECTOR ALLOCATION**\n\n` +
    `\`\`\`text\n` +
    `U+E000..U+E2E9      746   straight\n` +
    `U+E2EA..U+E7D4    1,259   solid 100%\n` +
    `U+E7D5..U+ECC9    1,269   medium 75%\n` +
    `U+ECCA..U+F1EC    1,315   light 25%\n` +
    `U+F1ED..U+F6A3    1,207   half 50%\n` +
    `U+F6A4..U+F8FC      601   generic connectors\n` +
    `U+F8FD..U+F8FF        3   reserve\n` +
    `                         -----\n` +
    `total encoded          ${stats.totalOwners.toLocaleString("en-US")}\n` +
    `\`\`\`\n\n` +
    `The existing 5,796 graphics-v0 owners retain their glyph IDs and codepoints unchanged. ` +
    `Connector allocation begins at U+F6A4 and follows deterministic semantic-rule order: orthogonal basis first, then the selected diagonal basis.\n`;
}

function connectorReport(stats) {
  return `# Generic Connector Allocation v1\n\n` +
    `Status: **GENERATED — PROVISIONAL ALLOCATION**\n\n` +
    `\`\`\`text\n` +
    `graphics-v0 owners              ${String(stats.baseOwners).padStart(4)}\n` +
    `new orthogonal connector owners ${String(stats.orthogonalNovelOwners).padStart(4)}\n` +
    `new diagonal connector owners   ${String(stats.diagonalNovelOwners).padStart(4)}\n` +
    `new connector owners total      ${String(stats.connectorOwners).padStart(4)}\n` +
    `v1 encoded owners total         ${String(stats.totalOwners).padStart(4)}\n` +
    `connector allocation            ${stats.connectorStart}..${stats.connectorEnd}\n` +
    `remaining reserve               ${stats.reserveStart}..${stats.reserveEnd} (${stats.reserveSlots})\n` +
    `connector semantic aliases      ${String(stats.connectorSemanticAliases).padStart(4)}\n` +
    `\`\`\`\n\n` +
    `All 5,796 graphics-v0 owners are preserved. Exact connector bitmap reuses resolve to existing owners and consume no new codepoint.\n`;
}

export async function buildConnectorAllocationDocuments(repoRoot) {
  const [baseRegistry, orthogonalConnectors, orthogonalOwners, orthogonalStats, diagonalConnectors, diagonalOwners, diagonalSelection] = await Promise.all([
    readJson(path.join(repoRoot, "artifacts", "manifest", "vocabulary", "registry.json")),
    readJson(path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-connectors.json")),
    readJson(path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-owners.json")),
    readJson(path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-stats.json")),
    readJson(path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-connectors.json")),
    readJson(path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-owners.json")),
    readJson(path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-selection.json")),
  ]);

  if (baseRegistry?.owners?.length !== BASE_OWNER_COUNT || baseRegistry?.allocation?.reserveSlots !== 604) {
    throw new Error("Frozen graphics-v0 registry no longer matches the 5,796-owner / 604-reserve baseline.");
  }
  if (orthogonalStats.novelOwnersRequired !== ORTHOGONAL_NOVEL_COUNT) {
    throw new Error(`Expected ${ORTHOGONAL_NOVEL_COUNT} novel orthogonal owners.`);
  }
  if (diagonalSelection.selectedIncrementalNovelOwners !== DIAGONAL_NOVEL_COUNT) {
    throw new Error(`Expected ${DIAGONAL_NOVEL_COUNT} novel selected diagonal owners.`);
  }

  const baseByBitmap = new Map(baseRegistry.owners.map((owner) => [owner.bitmapKey, owner]));
  const orthOwnerByBitmap = new Map(orthogonalOwners.owners.map((owner) => [owner.bitmapKey, owner]));
  const diagonalOwnerByBitmap = new Map(diagonalOwners.owners.map((owner) => [owner.bitmapKey, owner]));
  const diagonalSemanticById = new Map(diagonalConnectors.semantics.map((semantic) => [semantic.id, semantic]));

  const connectorSemanticRows = [];
  const selectedBitmapOrder = [];
  const selectedBitmapClass = new Map();
  const selectedBitmapSourceOwner = new Map();
  const selectedBitmapAliases = new Map();

  function addNovelBitmap(key, canonicalClass, sourceOwnerId) {
    if (baseByBitmap.has(key) || selectedBitmapClass.has(key)) return;
    selectedBitmapClass.set(key, canonicalClass);
    selectedBitmapSourceOwner.set(key, sourceOwnerId);
    selectedBitmapOrder.push(key);
  }

  function addAlias(key, alias) {
    const aliases = selectedBitmapAliases.get(key) ?? [];
    if (!aliases.includes(alias)) aliases.push(alias);
    selectedBitmapAliases.set(key, aliases);
  }

  for (const semantic of orthogonalConnectors.semantics) {
    const sourceOwner = orthOwnerByBitmap.get(semantic.bitmapKey);
    if (!sourceOwner) throw new Error(`Missing orthogonal owner for ${semantic.id}.`);
    if (sourceOwner.novel) addNovelBitmap(semantic.bitmapKey, "connector-orthogonal", sourceOwner.ownerId);
    addAlias(semantic.bitmapKey, semantic.id);
    connectorSemanticRows.push({
      id: semantic.id,
      semanticType: "orthogonal-connector",
      bitmapKey: semantic.bitmapKey,
      x: semantic.x,
      y: semantic.y,
      mask: semantic.mask,
      family: semantic.family,
    });
  }

  if (selectedBitmapOrder.length !== ORTHOGONAL_NOVEL_COUNT) {
    throw new Error(`Orthogonal semantic-order dedup produced ${selectedBitmapOrder.length} novel owners.`);
  }

  for (const semanticId of diagonalSelection.selectedSemanticIds) {
    const semantic = diagonalSemanticById.get(semanticId);
    if (!semantic) throw new Error(`Missing selected diagonal semantic ${semanticId}.`);
    const sourceOwner = diagonalOwnerByBitmap.get(semantic.bitmapKey);
    if (!sourceOwner) throw new Error(`Missing diagonal owner for ${semanticId}.`);
    if (!baseByBitmap.has(semantic.bitmapKey) && !orthOwnerByBitmap.get(semantic.bitmapKey)?.novel) {
      throw new Error(`Selected diagonal semantic ${semanticId} has inconsistent reuse metadata.`);
    }
    if (sourceOwner.incrementalNovel) addNovelBitmap(semantic.bitmapKey, "connector-diagonal", sourceOwner.ownerId);
    addAlias(semantic.bitmapKey, semantic.id);
    connectorSemanticRows.push({
      id: semantic.id,
      semanticType: "diagonal-connector",
      bitmapKey: semantic.bitmapKey,
      ruleId: semantic.ruleId,
      axis: semantic.axis,
      level: semantic.level,
      mask: semantic.mask,
      missingLeg: semantic.missingLeg,
      reducedSlope: semantic.reducedSlope,
      bounds: semantic.bounds,
    });
  }

  if (selectedBitmapOrder.length !== CONNECTOR_NOVEL_COUNT) {
    throw new Error(`Expected ${CONNECTOR_NOVEL_COUNT} total novel connector owners, found ${selectedBitmapOrder.length}.`);
  }

  const newOwners = selectedBitmapOrder.map((bitmapKey, index) => {
    const glyphId = BASE_OWNER_COUNT + index;
    const codepointValue = CONNECTOR_START + index;
    const aliases = selectedBitmapAliases.get(bitmapKey) ?? [];
    return {
      glyphId,
      codepoint: formatCodepoint(codepointValue),
      codepointValue,
      bitmapKey,
      canonicalClass: selectedBitmapClass.get(bitmapKey),
      allocationStatus: "provisional-connectors-v1",
      sourceOwnerId: selectedBitmapSourceOwner.get(bitmapKey),
      firstSemanticAlias: aliases[0] ?? null,
      semanticAliases: aliases,
    };
  });

  if (newOwners.at(-1)?.codepointValue !== CONNECTOR_END) {
    throw new Error(`Connector allocation does not end at ${formatCodepoint(CONNECTOR_END)}.`);
  }

  const fullOwners = [...baseRegistry.owners, ...newOwners];
  if (fullOwners.length !== TOTAL_OWNER_COUNT) throw new Error(`Unexpected v1 owner count ${fullOwners.length}.`);
  if (new Set(fullOwners.map((owner) => owner.bitmapKey)).size !== TOTAL_OWNER_COUNT) {
    throw new Error("v1 registry contains duplicate bitmap owners.");
  }
  if (new Set(fullOwners.map((owner) => owner.codepoint)).size !== TOTAL_OWNER_COUNT) {
    throw new Error("v1 registry contains duplicate codepoints.");
  }
  for (let index = 0; index < BASE_OWNER_COUNT; index += 1) {
    const base = baseRegistry.owners[index];
    const extended = fullOwners[index];
    if (base.glyphId !== extended.glyphId || base.codepoint !== extended.codepoint || base.bitmapKey !== extended.bitmapKey) {
      throw new Error(`graphics-v0 owner ${index} changed during v1 extension.`);
    }
  }

  const ownerByBitmap = new Map(fullOwners.map((owner) => [owner.bitmapKey, owner]));
  const semanticResolutions = connectorSemanticRows.map((semantic) => {
    const owner = ownerByBitmap.get(semantic.bitmapKey);
    if (!owner) throw new Error(`No encoded owner resolves connector semantic ${semantic.id}.`);
    return {
      ...semantic,
      glyphId: owner.glyphId,
      codepoint: owner.codepoint,
      resolution: owner.glyphId < BASE_OWNER_COUNT ? "graphics-v0-exact-reuse" : "connector-v1-owner",
      canonicalClass: owner.canonicalClass,
    };
  });

  if (semanticResolutions.length !== 700 || new Set(semanticResolutions.map((row) => row.id)).size !== 700) {
    throw new Error(`Expected 700 unique generic connector semantics, found ${semanticResolutions.length}.`);
  }

  const byCodepointEntries = {};
  const byBitmapEntries = {};
  for (const owner of fullOwners) {
    byCodepointEntries[owner.codepoint] = owner.glyphId;
    byBitmapEntries[owner.bitmapKey] = owner.glyphId;
  }
  const byConnectorAliasEntries = {};
  for (const semantic of semanticResolutions) byConnectorAliasEntries[semantic.id] = semantic;

  const stats = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-v1-connector-allocation-stats",
    schemaVersion: 1,
    status: "5C-provisional-allocation",
    baseOwners: BASE_OWNER_COUNT,
    orthogonalNovelOwners: ORTHOGONAL_NOVEL_COUNT,
    diagonalNovelOwners: DIAGONAL_NOVEL_COUNT,
    connectorOwners: CONNECTOR_NOVEL_COUNT,
    totalOwners: TOTAL_OWNER_COUNT,
    connectorSemanticAliases: semanticResolutions.length,
    connectorStart: formatCodepoint(CONNECTOR_START),
    connectorEnd: formatCodepoint(CONNECTOR_END),
    reserveStart: formatCodepoint(RESERVE_START),
    reserveEnd: formatCodepoint(RESERVE_END),
    reserveSlots: RESERVE_COUNT,
    straightCodepointsUnchanged: true,
  };

  const registry = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-graphics-vocabulary-v1",
    schemaVersion: 1,
    status: "provisional-graphics-v1",
    basePublication: "graphscii-graphics-v0",
    canonicalCell: "8x16",
    bitmapSerialization: "v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex",
    allocation: {
      unicodeStart: formatCodepoint(0xe000),
      unicodeEnd: formatCodepoint(CONNECTOR_END),
      connectorStart: formatCodepoint(CONNECTOR_START),
      connectorEnd: formatCodepoint(CONNECTOR_END),
      reserveStart: formatCodepoint(RESERVE_START),
      reserveEnd: formatCodepoint(RESERVE_END),
      reserveSlots: RESERVE_COUNT,
      rule: "preserve graphics-v0 exactly; allocate 544 novel orthogonal owners in semantic-rule order, then 57 selected novel diagonal owners in selected semantic-rule order; exact bitmap reuse remains global",
    },
    owners: fullOwners,
  };

  const spec = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-generic-connector-allocation-v1",
    schemaVersion: 1,
    status: "provisional-allocation",
    baseOwnerCount: BASE_OWNER_COUNT,
    connectorOwnerCount: CONNECTOR_NOVEL_COUNT,
    totalOwnerCount: TOTAL_OWNER_COUNT,
    connectorRange: [formatCodepoint(CONNECTOR_START), formatCodepoint(CONNECTOR_END)],
    finalReserveRange: [formatCodepoint(RESERVE_START), formatCodepoint(RESERVE_END)],
    finalReserveSlots: RESERVE_COUNT,
    connectorSemanticCount: semanticResolutions.length,
    allocationOrder: ["orthogonal-semantic-rule-order", "diagonal-selected-semantic-rule-order"],
  };

  return {
    stats,
    registry,
    semantics: {
      format: "graphscii",
      formatVersion: 1,
      schema: "graphscii-generic-connector-semantics-v1",
      schemaVersion: 1,
      status: "provisional-graphics-v1",
      semanticCount: semanticResolutions.length,
      semantics: semanticResolutions,
    },
    indexes: {
      byCodepoint: makeIndex("by-codepoint", byCodepointEntries),
      byBitmap: makeIndex("by-bitmap", byBitmapEntries),
      byConnectorAlias: makeIndex("by-connector-alias", byConnectorAliasEntries),
    },
    spec,
    newOwners,
    report: connectorReport(stats),
    layoutMap: masterLayoutMap(stats),
  };
}

async function writeConnectorArtifacts(repoRoot, docs) {
  const manifestRoot = path.join(repoRoot, "artifacts", "manifest", "vocabulary-v1");
  const connectorRoot = path.join(repoRoot, "artifacts", "vocabulary", "connectors");
  const glyphRoot = path.join(connectorRoot, "glyphs");
  const asciiRoot = path.join(glyphRoot, "ascii");
  const pngRoot = path.join(glyphRoot, "png");
  const atlasRoot = path.join(repoRoot, "artifacts", "vocabulary", "atlases", "connectors");
  const masterLayoutFilename = path.join(repoRoot, "artifacts", "vocabulary", "atlases", "master-layout-map-v1.md");
  const specFilename = path.join(repoRoot, "spec", "generic-connector-allocation-v1.json");

  await Promise.all([
    rm(manifestRoot, { recursive: true, force: true }),
    rm(connectorRoot, { recursive: true, force: true }),
    rm(atlasRoot, { recursive: true, force: true }),
  ]);
  await Promise.all([
    mkdir(path.join(manifestRoot, "indexes"), { recursive: true }),
    mkdir(asciiRoot, { recursive: true }),
    mkdir(pngRoot, { recursive: true }),
    mkdir(atlasRoot, { recursive: true }),
    mkdir(path.dirname(specFilename), { recursive: true }),
  ]);

  await Promise.all([
    writeFile(path.join(manifestRoot, "registry.json"), jsonText(docs.registry)),
    writeFile(path.join(manifestRoot, "semantics.json"), jsonText(docs.semantics)),
    writeFile(path.join(manifestRoot, "stats.json"), jsonText(docs.stats)),
    writeFile(path.join(manifestRoot, "report.md"), docs.report),
    writeFile(path.join(manifestRoot, "indexes", "by-codepoint.json"), jsonText(docs.indexes.byCodepoint)),
    writeFile(path.join(manifestRoot, "indexes", "by-bitmap.json"), jsonText(docs.indexes.byBitmap)),
    writeFile(path.join(manifestRoot, "indexes", "by-connector-alias.json"), jsonText(docs.indexes.byConnectorAlias)),
    writeFile(masterLayoutFilename, docs.layoutMap),
    writeFile(specFilename, jsonText(docs.spec)),
  ]);

  await forEachLimited(docs.newOwners, MAX_IO_CONCURRENCY, async (owner) => {
    const rows = parseBitmapKey(owner.bitmapKey);
    await Promise.all([
      writeFile(path.join(asciiRoot, `${owner.codepoint}.txt`), asciiForRows(rows)),
      writeFile(path.join(pngRoot, `${owner.codepoint}.png`), pngForRows(rows)),
    ]);
  });

  const pageCount = Math.ceil(docs.newOwners.length / ATLAS_PAGE_SIZE);
  const atlasIndex = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-connector-atlas-index",
    schemaVersion: 1,
    ownerCount: docs.newOwners.length,
    pageSize: ATLAS_PAGE_SIZE,
    pageCount,
    rasterSize: `${ATLAS_COLUMNS * WIDTH}x${ATLAS_ROWS * HEIGHT}`,
    pages: [],
  };
  for (let page = 0; page < pageCount; page += 1) {
    const start = page * ATLAS_PAGE_SIZE;
    const owners = docs.newOwners.slice(start, start + ATLAS_PAGE_SIZE);
    const stem = `page-${String(page).padStart(2, "0")}`;
    await Promise.all([
      writeFile(path.join(atlasRoot, `${stem}.png`), atlasPng(owners)),
      writeFile(path.join(atlasRoot, `${stem}.md`), atlasText(page, owners)),
    ]);
    atlasIndex.pages.push({
      page,
      firstGlyphId: owners[0]?.glyphId ?? null,
      lastGlyphId: owners.at(-1)?.glyphId ?? null,
      firstCodepoint: owners[0]?.codepoint ?? null,
      lastCodepoint: owners.at(-1)?.codepoint ?? null,
      count: owners.length,
      png: `${stem}.png`,
      text: `${stem}.md`,
    });
  }
  await writeFile(path.join(atlasRoot, "index.json"), jsonText(atlasIndex));
}

export async function generateConnectorAllocationArtifacts(repoRoot) {
  const docs = await buildConnectorAllocationDocuments(repoRoot);
  await writeConnectorArtifacts(repoRoot, docs);
  return docs.stats;
}

function assertExactNames(actual, expected, label) {
  const a = [...actual].sort();
  const e = [...expected].sort();
  if (a.length !== e.length) throw new Error(`${label} count mismatch: ${a.length} !== ${e.length}.`);
  for (let index = 0; index < e.length; index += 1) {
    if (a[index] !== e[index]) throw new Error(`${label} filename mismatch at ${index}: ${a[index]} !== ${e[index]}.`);
  }
}

export async function verifyConnectorAllocationArtifacts(repoRoot) {
  const docs = await buildConnectorAllocationDocuments(repoRoot);
  const manifestRoot = path.join(repoRoot, "artifacts", "manifest", "vocabulary-v1");
  const asciiRoot = path.join(repoRoot, "artifacts", "vocabulary", "connectors", "glyphs", "ascii");
  const pngRoot = path.join(repoRoot, "artifacts", "vocabulary", "connectors", "glyphs", "png");
  const atlasRoot = path.join(repoRoot, "artifacts", "vocabulary", "atlases", "connectors");

  const expectedTextFiles = new Map([
    [path.join(manifestRoot, "registry.json"), jsonText(docs.registry)],
    [path.join(manifestRoot, "semantics.json"), jsonText(docs.semantics)],
    [path.join(manifestRoot, "stats.json"), jsonText(docs.stats)],
    [path.join(manifestRoot, "report.md"), docs.report],
    [path.join(manifestRoot, "indexes", "by-codepoint.json"), jsonText(docs.indexes.byCodepoint)],
    [path.join(manifestRoot, "indexes", "by-bitmap.json"), jsonText(docs.indexes.byBitmap)],
    [path.join(manifestRoot, "indexes", "by-connector-alias.json"), jsonText(docs.indexes.byConnectorAlias)],
    [path.join(repoRoot, "artifacts", "vocabulary", "atlases", "master-layout-map-v1.md"), docs.layoutMap],
    [path.join(repoRoot, "spec", "generic-connector-allocation-v1.json"), jsonText(docs.spec)],
  ]);
  for (const [filename, expected] of expectedTextFiles) {
    const actual = await readFile(filename, "utf8");
    if (actual !== expected) throw new Error(`Connector allocation artifact mismatch: ${path.relative(repoRoot, filename)}.`);
  }

  assertExactNames(await readdir(asciiRoot), docs.newOwners.map((owner) => `${owner.codepoint}.txt`), "Connector ASCII artifacts");
  assertExactNames(await readdir(pngRoot), docs.newOwners.map((owner) => `${owner.codepoint}.png`), "Connector PNG artifacts");

  await forEachLimited(docs.newOwners, MAX_IO_CONCURRENCY, async (owner) => {
    const rows = parseBitmapKey(owner.bitmapKey);
    const [ascii, png] = await Promise.all([
      readFile(path.join(asciiRoot, `${owner.codepoint}.txt`), "utf8"),
      readFile(path.join(pngRoot, `${owner.codepoint}.png`)),
    ]);
    if (ascii !== asciiForRows(rows)) throw new Error(`Connector ASCII mismatch for ${owner.codepoint}.`);
    if (!png.equals(pngForRows(rows))) throw new Error(`Connector PNG mismatch for ${owner.codepoint}.`);
  });

  const pageCount = Math.ceil(docs.newOwners.length / ATLAS_PAGE_SIZE);
  const atlasIndex = JSON.parse(await readFile(path.join(atlasRoot, "index.json"), "utf8"));
  if (atlasIndex.pageCount !== pageCount || atlasIndex.ownerCount !== CONNECTOR_NOVEL_COUNT) {
    throw new Error("Connector atlas index count mismatch.");
  }
  const expectedAtlasNames = ["index.json"];
  for (let page = 0; page < pageCount; page += 1) {
    const stem = `page-${String(page).padStart(2, "0")}`;
    expectedAtlasNames.push(`${stem}.png`, `${stem}.md`);
    const owners = docs.newOwners.slice(page * ATLAS_PAGE_SIZE, (page + 1) * ATLAS_PAGE_SIZE);
    const [png, text] = await Promise.all([
      readFile(path.join(atlasRoot, `${stem}.png`)),
      readFile(path.join(atlasRoot, `${stem}.md`), "utf8"),
    ]);
    if (!png.equals(atlasPng(owners))) throw new Error(`Connector atlas PNG mismatch for page ${page}.`);
    if (text !== atlasText(page, owners)) throw new Error(`Connector atlas text mismatch for page ${page}.`);
  }
  assertExactNames(await readdir(atlasRoot), expectedAtlasNames, "Connector atlas artifacts");

  if (
    docs.stats.connectorOwners !== CONNECTOR_NOVEL_COUNT ||
    docs.stats.totalOwners !== TOTAL_OWNER_COUNT ||
    docs.stats.connectorStart !== formatCodepoint(CONNECTOR_START) ||
    docs.stats.connectorEnd !== formatCodepoint(CONNECTOR_END) ||
    docs.stats.reserveStart !== formatCodepoint(RESERVE_START) ||
    docs.stats.reserveSlots !== RESERVE_COUNT ||
    docs.stats.connectorSemanticAliases !== 700
  ) {
    throw new Error("Connector allocation hard-count gate failed.");
  }

  return docs.stats;
}
