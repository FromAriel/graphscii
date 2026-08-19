import { deflateSync } from "node:zlib";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ALL_FAMILIES,
  CELL_HEIGHT,
  CELL_WIDTH,
  PRIVATE_USE_START,
  bitmapRows,
  formatPort,
  generate,
  hasPixel,
} from "../dist/core/index.js";

export const FORMAT = "graphscii";
export const FORMAT_VERSION = 1;
export const BITMAP_SERIALIZATION =
  "v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex";
export const ASCII_FILLED = "#";
export const ASCII_EMPTY = "-";

function codepointHex(codepoint) {
  return `U+${codepoint.toString(16).toUpperCase().padStart(6, "0")}`;
}

function glyphHex(glyphId) {
  return glyphId.toString(16).toUpperCase().padStart(3, "0");
}

function asciiFor(bitmap) {
  const lines = [];
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    let line = "";
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      line += hasPixel(bitmap, x, y) ? ASCII_FILLED : ASCII_EMPTY;
    }
    lines.push(line);
  }
  return `${lines.join("\n")}\n`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

export function encodeRgbaPng(width, height, rgba) {
  if (rgba.length !== width * height * 4) {
    throw new Error("RGBA buffer length does not match dimensions.");
  }

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0;
    rgba.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function bitmapToRgba(bitmap) {
  const rgba = Buffer.alloc(CELL_WIDTH * CELL_HEIGHT * 4);
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      if (!hasPixel(bitmap, x, y)) continue;
      const offset = (y * CELL_WIDTH + x) * 4;
      rgba[offset] = 0;
      rgba[offset + 1] = 0;
      rgba[offset + 2] = 0;
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

function renderAtlas(glyphs, start, count, columns = 16) {
  const slice = glyphs.slice(start, start + count);
  const rows = Math.max(1, Math.ceil(count / columns));
  const width = columns * CELL_WIDTH;
  const height = rows * CELL_HEIGHT;
  const rgba = Buffer.alloc(width * height * 4);

  for (let localIndex = 0; localIndex < slice.length; localIndex += 1) {
    const glyph = slice[localIndex];
    const cellX = localIndex % columns;
    const cellY = Math.floor(localIndex / columns);

    for (let y = 0; y < CELL_HEIGHT; y += 1) {
      for (let x = 0; x < CELL_WIDTH; x += 1) {
        if (!hasPixel(glyph.bitmap, x, y)) continue;
        const px = cellX * CELL_WIDTH + x;
        const py = cellY * CELL_HEIGHT + y;
        const offset = (py * width + px) * 4;
        rgba[offset] = 0;
        rgba[offset + 1] = 0;
        rgba[offset + 2] = 0;
        rgba[offset + 3] = 255;
      }
    }
  }

  return encodeRgbaPng(width, height, rgba);
}

function manifestFor(result) {
  const maxAliases = Math.max(...result.glyphs.map((glyph) => glyph.aliases.length));
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    generator: "geometric-glyph-lab/artifact-pipeline",
    cell: {
      width: CELL_WIDTH,
      height: CELL_HEIGHT,
      orientation: "8-columns-by-16-rows",
    },
    bitmapSerialization: BITMAP_SERIALIZATION,
    codepointBase: codepointHex(PRIVATE_USE_START),
    candidateCount: result.candidates.length,
    glyphCount: result.glyphs.length,
    duplicateCandidateCount: result.duplicateCandidates,
    maxAliases,
    glyphs: result.glyphs.map((glyph) => {
      const stem = codepointHex(glyph.codepoint);
      const families = [...new Set(glyph.aliases.map((alias) => alias.family))];
      return {
        glyphId: glyph.glyphId,
        glyphIdHex: glyphHex(glyph.glyphId),
        codepoint: glyph.codepoint,
        codepointHex: stem,
        character: String.fromCodePoint(glyph.codepoint),
        families,
        bitmap: {
          rowsHex: bitmapRows(glyph.bitmap),
          key: glyph.bitmapKey,
        },
        aliases: glyph.aliases.map((alias) => ({
          candidateId: alias.candidateId,
          family: alias.family,
          start: formatPort(alias.start),
          end: formatPort(alias.end),
        })),
        artifacts: {
          ascii: `glyphs/ascii/${stem}.txt`,
          png: `glyphs/png/${stem}.png`,
        },
      };
    }),
  };
}

async function ensureDirs(root) {
  await Promise.all([
    mkdir(path.join(root, "manifest"), { recursive: true }),
    mkdir(path.join(root, "glyphs", "ascii"), { recursive: true }),
    mkdir(path.join(root, "glyphs", "png"), { recursive: true }),
    mkdir(path.join(root, "atlases"), { recursive: true }),
  ]);
}

export async function buildArtifacts(root, { clean = true } = {}) {
  if (clean) {
    await rm(root, { recursive: true, force: true });
  }
  await ensureDirs(root);

  const result = generate(ALL_FAMILIES);
  const manifest = manifestFor(result);

  await writeFile(
    path.join(root, "manifest", "glyphs.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(
    path.join(root, "manifest", "stats.json"),
    `${JSON.stringify({
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      cell: manifest.cell,
      candidateCount: manifest.candidateCount,
      glyphCount: manifest.glyphCount,
      duplicateCandidateCount: manifest.duplicateCandidateCount,
      maxAliases: manifest.maxAliases,
      compressionRatio: Number(
        (result.duplicateCandidates / result.candidates.length).toFixed(6),
      ),
    }, null, 2)}\n`,
  );

  await Promise.all(
    result.glyphs.flatMap((glyph) => {
      const stem = codepointHex(glyph.codepoint);
      return [
        writeFile(
          path.join(root, "glyphs", "ascii", `${stem}.txt`),
          asciiFor(glyph.bitmap),
        ),
        writeFile(
          path.join(root, "glyphs", "png", `${stem}.png`),
          encodeRgbaPng(CELL_WIDTH, CELL_HEIGHT, bitmapToRgba(glyph.bitmap)),
        ),
      ];
    }),
  );

  await writeFile(
    path.join(root, "atlases", "all.png"),
    renderAtlas(result.glyphs, 0, result.glyphs.length),
  );

  const pageCount = Math.ceil(result.glyphs.length / 256);
  for (let page = 0; page < pageCount; page += 1) {
    await writeFile(
      path.join(root, "atlases", `page-${page.toString(16).toUpperCase()}.png`),
      renderAtlas(result.glyphs, page * 256, 256),
    );
  }

  return { root, result, manifest, pageCount };
}

function readPngDimensions(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, 8).equals(signature)) {
    throw new Error("Invalid PNG signature.");
  }
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("PNG missing IHDR.");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export async function verifyArtifacts(root) {
  const expected = generate(ALL_FAMILIES);
  const manifest = JSON.parse(
    await readFile(path.join(root, "manifest", "glyphs.json"), "utf8"),
  );

  if (manifest.format !== FORMAT || manifest.formatVersion !== FORMAT_VERSION) {
    throw new Error("Manifest format mismatch.");
  }
  if (manifest.cell.width !== CELL_WIDTH || manifest.cell.height !== CELL_HEIGHT) {
    throw new Error("Manifest cell mismatch.");
  }
  if (manifest.glyphCount !== expected.glyphs.length || manifest.glyphCount !== 746) {
    throw new Error("Glyph count mismatch.");
  }
  if (
    manifest.candidateCount !== 832 ||
    manifest.duplicateCandidateCount !== 86 ||
    manifest.maxAliases !== 4
  ) {
    throw new Error("Straight baseline mismatch.");
  }

  const asciiNames = await readdir(path.join(root, "glyphs", "ascii"));
  const pngNames = await readdir(path.join(root, "glyphs", "png"));
  if (asciiNames.length !== expected.glyphs.length) {
    throw new Error(`Expected ${expected.glyphs.length} ASCII files, got ${asciiNames.length}.`);
  }
  if (pngNames.length !== expected.glyphs.length) {
    throw new Error(`Expected ${expected.glyphs.length} PNG files, got ${pngNames.length}.`);
  }

  for (const glyph of expected.glyphs) {
    const stem = codepointHex(glyph.codepoint);
    const ascii = await readFile(
      path.join(root, "glyphs", "ascii", `${stem}.txt`),
      "utf8",
    );
    if (ascii !== asciiFor(glyph.bitmap)) {
      throw new Error(`ASCII mismatch for ${stem}.`);
    }

    const png = await readFile(path.join(root, "glyphs", "png", `${stem}.png`));
    const dimensions = readPngDimensions(png);
    if (dimensions.width !== CELL_WIDTH || dimensions.height !== CELL_HEIGHT) {
      throw new Error(`PNG dimensions mismatch for ${stem}.`);
    }

    const expectedPng = encodeRgbaPng(
      CELL_WIDTH,
      CELL_HEIGHT,
      bitmapToRgba(glyph.bitmap),
    );
    if (!png.equals(expectedPng)) {
      throw new Error(`PNG bytes are not reproducible for ${stem}.`);
    }
  }

  const atlas = readPngDimensions(
    await readFile(path.join(root, "atlases", "all.png")),
  );
  if (
    atlas.width !== 16 * CELL_WIDTH ||
    atlas.height !== Math.ceil(expected.glyphs.length / 16) * CELL_HEIGHT
  ) {
    throw new Error(`Unexpected all-atlas size ${atlas.width}x${atlas.height}.`);
  }

  return {
    glyphs: expected.glyphs.length,
    asciiFiles: asciiNames.length,
    pngFiles: pngNames.length,
    atlas,
  };
}
