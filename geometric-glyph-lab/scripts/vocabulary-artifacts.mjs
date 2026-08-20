import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { encodeRgbaPng } from "./artifact-pipeline.mjs";

const CELL_WIDTH = 8;
const CELL_HEIGHT = 16;
const EXPECTED_OWNER_COUNT = 5796;
const EXPECTED_FIRST_CODEPOINT = "U+00E000";
const EXPECTED_LAST_CODEPOINT = "U+00F6A3";
const MAX_IO_CONCURRENCY = 48;

function parseBitmapKey(key) {
  if (typeof key !== "string" || !/^[0-9a-f]{32}$/u.test(key)) {
    throw new Error(`Invalid canonical GraphSCII bitmap key: ${key}.`);
  }
  const rows = Buffer.from(key, "hex");
  if (rows.length !== CELL_HEIGHT) {
    throw new Error(`Expected ${CELL_HEIGHT} bitmap rows, got ${rows.length}.`);
  }
  return rows;
}

function asciiForRows(rows) {
  const lines = [];
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    const row = rows[y] ?? 0;
    let line = "";
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      line += (row & (1 << x)) !== 0 ? "#" : "-";
    }
    lines.push(line);
  }
  return `${lines.join("\n")}\n`;
}

function rgbaForRows(rows) {
  const rgba = Buffer.alloc(CELL_WIDTH * CELL_HEIGHT * 4);
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    const row = rows[y] ?? 0;
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      if ((row & (1 << x)) === 0) continue;
      const offset = (y * CELL_WIDTH + x) * 4;
      rgba[offset] = 0;
      rgba[offset + 1] = 0;
      rgba[offset + 2] = 0;
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

function pngForRows(rows) {
  return encodeRgbaPng(CELL_WIDTH, CELL_HEIGHT, rgbaForRows(rows));
}

async function forEachLimited(items, limit, worker) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

function validateRegistry(registry) {
  if (
    registry?.format !== "graphscii" ||
    registry?.formatVersion !== 1 ||
    registry?.schema !== "graphscii-graphics-vocabulary" ||
    registry?.schemaVersion !== 1 ||
    registry?.status !== "provisional-graphics-v0"
  ) {
    throw new Error("Unsupported GraphSCII canonical vocabulary registry.");
  }
  if (!Array.isArray(registry.owners) || registry.owners.length !== EXPECTED_OWNER_COUNT) {
    throw new Error(`Expected ${EXPECTED_OWNER_COUNT} encoded owners.`);
  }

  const seenCodepoints = new Set();
  const seenBitmaps = new Set();
  for (let index = 0; index < registry.owners.length; index += 1) {
    const owner = registry.owners[index];
    if (!owner || owner.glyphId !== index) {
      throw new Error(`Vocabulary owner order mismatch at glyph ${index}.`);
    }
    const expectedCodepointValue = 0xe000 + index;
    const expectedCodepoint = `U+${expectedCodepointValue.toString(16).toUpperCase().padStart(6, "0")}`;
    if (owner.codepoint !== expectedCodepoint || owner.codepointValue !== expectedCodepointValue) {
      throw new Error(`Vocabulary codepoint mismatch for glyph ${index}.`);
    }
    parseBitmapKey(owner.bitmapKey);
    if (seenCodepoints.has(owner.codepoint)) {
      throw new Error(`Duplicate vocabulary codepoint ${owner.codepoint}.`);
    }
    if (seenBitmaps.has(owner.bitmapKey)) {
      throw new Error(`Duplicate vocabulary bitmap ${owner.bitmapKey}.`);
    }
    seenCodepoints.add(owner.codepoint);
    seenBitmaps.add(owner.bitmapKey);
  }

  if (
    registry.owners[0]?.codepoint !== EXPECTED_FIRST_CODEPOINT ||
    registry.owners.at(-1)?.codepoint !== EXPECTED_LAST_CODEPOINT
  ) {
    throw new Error("Vocabulary artifact source does not span U+E000..U+F6A3.");
  }

  return registry.owners;
}

async function loadRegistry(repoRoot) {
  const filename = path.join(repoRoot, "artifacts", "manifest", "vocabulary", "registry.json");
  return validateRegistry(JSON.parse(await readFile(filename, "utf8")));
}

function expectedArtifactNames(owners, extension) {
  return owners.map((owner) => `${owner.codepoint}.${extension}`);
}

function assertExactNames(actualNames, expectedNames, label) {
  const actual = [...actualNames].sort();
  const expected = [...expectedNames].sort();
  if (actual.length !== expected.length) {
    throw new Error(`${label} count mismatch: ${actual.length} !== ${expected.length}.`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) {
      throw new Error(`${label} filename mismatch at ${index}: ${actual[index]} !== ${expected[index]}.`);
    }
  }
}

export async function generateVocabularyGlyphArtifacts(repoRoot) {
  const owners = await loadRegistry(repoRoot);
  const glyphRoot = path.join(repoRoot, "artifacts", "vocabulary", "glyphs");
  const asciiRoot = path.join(glyphRoot, "ascii");
  const pngRoot = path.join(glyphRoot, "png");

  await rm(glyphRoot, { recursive: true, force: true });
  await Promise.all([
    mkdir(asciiRoot, { recursive: true }),
    mkdir(pngRoot, { recursive: true }),
  ]);

  await forEachLimited(owners, MAX_IO_CONCURRENCY, async (owner) => {
    const rows = parseBitmapKey(owner.bitmapKey);
    await Promise.all([
      writeFile(path.join(asciiRoot, `${owner.codepoint}.txt`), asciiForRows(rows)),
      writeFile(path.join(pngRoot, `${owner.codepoint}.png`), pngForRows(rows)),
    ]);
  });

  return {
    encodedOwners: owners.length,
    asciiFiles: owners.length,
    pngFiles: owners.length,
    firstCodepoint: owners[0]?.codepoint,
    lastCodepoint: owners.at(-1)?.codepoint,
  };
}

export async function verifyVocabularyGlyphArtifacts(repoRoot) {
  const owners = await loadRegistry(repoRoot);
  const glyphRoot = path.join(repoRoot, "artifacts", "vocabulary", "glyphs");
  const asciiRoot = path.join(glyphRoot, "ascii");
  const pngRoot = path.join(glyphRoot, "png");

  const [asciiNames, pngNames] = await Promise.all([
    readdir(asciiRoot),
    readdir(pngRoot),
  ]);
  assertExactNames(asciiNames, expectedArtifactNames(owners, "txt"), "Vocabulary ASCII artifact");
  assertExactNames(pngNames, expectedArtifactNames(owners, "png"), "Vocabulary PNG artifact");

  let asciiBytes = 0;
  let pngBytes = 0;
  await forEachLimited(owners, MAX_IO_CONCURRENCY, async (owner) => {
    const rows = parseBitmapKey(owner.bitmapKey);
    const expectedAscii = asciiForRows(rows);
    const expectedPng = pngForRows(rows);
    const [ascii, png] = await Promise.all([
      readFile(path.join(asciiRoot, `${owner.codepoint}.txt`), "utf8"),
      readFile(path.join(pngRoot, `${owner.codepoint}.png`)),
    ]);
    if (ascii !== expectedAscii) {
      throw new Error(`Canonical ASCII artifact mismatch for ${owner.codepoint}.`);
    }
    if (!png.equals(expectedPng)) {
      throw new Error(`Canonical PNG artifact mismatch for ${owner.codepoint}.`);
    }
    asciiBytes += Buffer.byteLength(ascii, "utf8");
    pngBytes += png.length;
  });

  return {
    encodedOwners: owners.length,
    asciiFiles: asciiNames.length,
    pngFiles: pngNames.length,
    asciiBytes,
    pngBytes,
    firstCodepoint: owners[0]?.codepoint,
    lastCodepoint: owners.at(-1)?.codepoint,
  };
}
