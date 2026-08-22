import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ASCII_COUNT, ASCII_END, ASCII_START, ascii16Rows } from "./font-ascii.mjs";

export const FONT_FAMILY = "GraphSCII";
export const FONT_SUBFAMILY = "Regular";
export const FONT_FULL_NAME = "GraphSCII Regular";
export const FONT_POSTSCRIPT_NAME = "GraphSCII-Regular";
export const FONT_STANDARD_NAME = "Graphical Standard for Computer Information Interchange";
export const FONT_DESIGNER = "Ariel Williams";
export const FONT_VERSION = "1.0";
export const FONT_FILENAME = "GraphSCII-Regular.ttf";

const WIDTH = 8;
const HEIGHT = 16;
const UNITS_PER_PIXEL = 64;
const UNITS_PER_EM = HEIGHT * UNITS_PER_PIXEL;
const ADVANCE_WIDTH = WIDTH * UNITS_PER_PIXEL;
const EXPECTED_PUA_OWNERS = 6398;
const EXPECTED_PUA_START = 0xe000;
const EXPECTED_PUA_END = 0xf8fd;
const EXPECTED_CHARACTER_COUNT = ASCII_COUNT + EXPECTED_PUA_OWNERS;
const EXPECTED_GLYPH_COUNT = 1 + EXPECTED_CHARACTER_COUNT;
const SFNT_CHECKSUM_MAGIC = 0xb1b0afba;

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function pad4(buffer) {
  const padded = (buffer.length + 3) & ~3;
  if (padded === buffer.length) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(padded - buffer.length)]);
}

function checksum32(buffer) {
  const padded = pad4(buffer);
  let sum = 0;
  for (let offset = 0; offset < padded.length; offset += 4) {
    sum = (sum + padded.readUInt32BE(offset)) >>> 0;
  }
  return sum >>> 0;
}

function writeInt16(buffer, offset, value) {
  buffer.writeInt16BE(value, offset);
  return offset + 2;
}

function writeUInt16(buffer, offset, value) {
  buffer.writeUInt16BE(value, offset);
  return offset + 2;
}

function writeUInt32(buffer, offset, value) {
  buffer.writeUInt32BE(value >>> 0, offset);
  return offset + 4;
}

function writeLongDateTime(buffer, offset, value = 0n) {
  buffer.writeBigUInt64BE(BigInt(value), offset);
  return offset + 8;
}

function rowsFromBitmapKey(bitmapKey) {
  if (typeof bitmapKey !== "string" || !/^[0-9a-f]{32}$/u.test(bitmapKey)) {
    throw new Error(`Invalid GraphSCII bitmap key: ${bitmapKey}.`);
  }
  return Uint8Array.from(Buffer.from(bitmapKey, "hex"));
}

function bitmapKeyFromRows(rows) {
  if (!(rows instanceof Uint8Array) || rows.length !== HEIGHT) {
    throw new Error("GraphSCII font raster must be exactly 16 rows.");
  }
  return Buffer.from(rows).toString("hex");
}

function leftSideBearingForRows(rows) {
  for (let x = 0; x < WIDTH; x += 1) {
    for (let y = 0; y < HEIGHT; y += 1) {
      if (((rows[y] ?? 0) & (1 << x)) !== 0) return x * UNITS_PER_PIXEL;
    }
  }
  return 0;
}

function notdefRows() {
  const rows = new Uint8Array(HEIGHT);
  rows[0] = 0xff;
  rows[HEIGHT - 1] = 0xff;
  for (let y = 1; y < HEIGHT - 1; y += 1) {
    rows[y] = 0x81 | (1 << Math.min(6, Math.max(1, Math.floor((y - 1) * 6 / 13))));
  }
  return rows;
}

function runsForRows(rows) {
  const runs = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    const row = rows[y] ?? 0;
    let x = 0;
    while (x < WIDTH) {
      if ((row & (1 << x)) === 0) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < WIDTH && (row & (1 << x)) !== 0) x += 1;
      runs.push({ y, start, endExclusive: x });
    }
  }
  return runs;
}

function buildSimpleGlyph(rows) {
  const runs = runsForRows(rows);
  if (runs.length === 0) return { bytes: Buffer.alloc(0), points: 0, contours: 0, xMin: 0, xMax: 0 };

  const points = [];
  const endPoints = [];
  let xMin = ADVANCE_WIDTH;
  let yMin = UNITS_PER_EM;
  let xMax = 0;
  let yMax = 0;

  for (const run of runs) {
    const left = run.start * UNITS_PER_PIXEL;
    const right = run.endExclusive * UNITS_PER_PIXEL;
    const bottom = (HEIGHT - 1 - run.y) * UNITS_PER_PIXEL;
    const top = (HEIGHT - run.y) * UNITS_PER_PIXEL;
    xMin = Math.min(xMin, left);
    xMax = Math.max(xMax, right);
    yMin = Math.min(yMin, bottom);
    yMax = Math.max(yMax, top);

    points.push(
      { x: left, y: bottom },
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
    );
    endPoints.push(points.length - 1);
  }

  const totalLength = 10 + endPoints.length * 2 + 2 + points.length + points.length * 2 * 2;
  const buffer = Buffer.alloc(totalLength);
  let offset = 0;
  offset = writeInt16(buffer, offset, runs.length);
  offset = writeInt16(buffer, offset, xMin);
  offset = writeInt16(buffer, offset, yMin);
  offset = writeInt16(buffer, offset, xMax);
  offset = writeInt16(buffer, offset, yMax);
  for (const endpoint of endPoints) offset = writeUInt16(buffer, offset, endpoint);
  offset = writeUInt16(buffer, offset, 0);
  for (let i = 0; i < points.length; i += 1) buffer[offset++] = 0x01;

  let previous = 0;
  for (const point of points) {
    offset = writeInt16(buffer, offset, point.x - previous);
    previous = point.x;
  }
  previous = 0;
  for (const point of points) {
    offset = writeInt16(buffer, offset, point.y - previous);
    previous = point.y;
  }
  if (offset !== buffer.length) throw new Error(`Internal glyf length mismatch ${offset} !== ${buffer.length}.`);
  return { bytes: buffer, points: points.length, contours: runs.length, xMin, xMax };
}

function buildGlyfAndLoca(glyphRows) {
  const chunks = [];
  const offsets = [0];
  const horizontalMetrics = [];
  let cursor = 0;
  let maxPoints = 0;
  let maxContours = 0;
  for (const rows of glyphRows) {
    const glyph = buildSimpleGlyph(rows);
    horizontalMetrics.push({ advanceWidth: ADVANCE_WIDTH, leftSideBearing: glyph.xMin });
    maxPoints = Math.max(maxPoints, glyph.points);
    maxContours = Math.max(maxContours, glyph.contours);
    const padded = pad4(glyph.bytes);
    chunks.push(padded);
    cursor += padded.length;
    offsets.push(cursor);
  }
  const glyf = Buffer.concat(chunks);
  const loca = Buffer.alloc(offsets.length * 4);
  offsets.forEach((value, index) => loca.writeUInt32BE(value, index * 4));
  return { glyf, loca, horizontalMetrics, maxPoints, maxContours };
}

function buildHead() {
  const buffer = Buffer.alloc(54);
  let o = 0;
  o = writeUInt32(buffer, o, 0x00010000);
  o = writeUInt32(buffer, o, 0x00010000);
  o = writeUInt32(buffer, o, 0);
  o = writeUInt32(buffer, o, 0x5f0f3cf5);
  o = writeUInt16(buffer, o, 0x0003);
  o = writeUInt16(buffer, o, UNITS_PER_EM);
  o = writeLongDateTime(buffer, o, 0n);
  o = writeLongDateTime(buffer, o, 0n);
  o = writeInt16(buffer, o, 0);
  o = writeInt16(buffer, o, 0);
  o = writeInt16(buffer, o, ADVANCE_WIDTH);
  o = writeInt16(buffer, o, UNITS_PER_EM);
  o = writeUInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, 8);
  o = writeInt16(buffer, o, 2);
  o = writeInt16(buffer, o, 1);
  o = writeInt16(buffer, o, 0);
  if (o !== buffer.length) throw new Error("head table length mismatch.");
  return buffer;
}

function buildHhea(numGlyphs) {
  const buffer = Buffer.alloc(36);
  let o = 0;
  o = writeUInt32(buffer, o, 0x00010000);
  o = writeInt16(buffer, o, UNITS_PER_EM);
  o = writeInt16(buffer, o, 0);
  o = writeInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, ADVANCE_WIDTH);
  o = writeInt16(buffer, o, 0);
  o = writeInt16(buffer, o, 0);
  o = writeInt16(buffer, o, ADVANCE_WIDTH);
  o = writeInt16(buffer, o, 1);
  o = writeInt16(buffer, o, 0);
  o = writeInt16(buffer, o, 0);
  for (let i = 0; i < 4; i += 1) o = writeInt16(buffer, o, 0);
  o = writeInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, numGlyphs);
  if (o !== buffer.length) throw new Error("hhea table length mismatch.");
  return buffer;
}

function buildMaxp(numGlyphs, maxPoints, maxContours) {
  const buffer = Buffer.alloc(32);
  let o = 0;
  o = writeUInt32(buffer, o, 0x00010000);
  o = writeUInt16(buffer, o, numGlyphs);
  o = writeUInt16(buffer, o, maxPoints);
  o = writeUInt16(buffer, o, maxContours);
  o = writeUInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, 1);
  o = writeUInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, 0);
  if (o !== buffer.length) throw new Error("maxp table length mismatch.");
  return buffer;
}

function buildHmtx(horizontalMetrics) {
  const buffer = Buffer.alloc(horizontalMetrics.length * 4);
  for (let i = 0; i < horizontalMetrics.length; i += 1) {
    const metric = horizontalMetrics[i];
    buffer.writeUInt16BE(metric.advanceWidth, i * 4);
    buffer.writeInt16BE(metric.leftSideBearing, i * 4 + 2);
  }
  return buffer;
}

function buildOS2() {
  const buffer = Buffer.alloc(78);
  let o = 0;
  o = writeUInt16(buffer, o, 0);
  o = writeInt16(buffer, o, ADVANCE_WIDTH);
  o = writeUInt16(buffer, o, 400);
  o = writeUInt16(buffer, o, 5);
  o = writeUInt16(buffer, o, 0);
  o = writeInt16(buffer, o, 384);
  o = writeInt16(buffer, o, 512);
  o = writeInt16(buffer, o, 0);
  o = writeInt16(buffer, o, 128);
  o = writeInt16(buffer, o, 384);
  o = writeInt16(buffer, o, 512);
  o = writeInt16(buffer, o, 0);
  o = writeInt16(buffer, o, 384);
  o = writeInt16(buffer, o, 64);
  o = writeInt16(buffer, o, 512);
  o = writeInt16(buffer, o, 0);
  const panose = [2, 11, 5, 9, 2, 2, 2, 2, 2, 3];
  for (const value of panose) buffer[o++] = value;
  o = writeUInt32(buffer, o, 0x00000001);
  o = writeUInt32(buffer, o, 0x10000000);
  o = writeUInt32(buffer, o, 0);
  o = writeUInt32(buffer, o, 0);
  buffer.write("ARWL", o, 4, "ascii"); o += 4;
  o = writeUInt16(buffer, o, 0x0040);
  o = writeUInt16(buffer, o, ASCII_START);
  o = writeUInt16(buffer, o, EXPECTED_PUA_END);
  o = writeInt16(buffer, o, UNITS_PER_EM);
  o = writeInt16(buffer, o, 0);
  o = writeInt16(buffer, o, 0);
  o = writeUInt16(buffer, o, UNITS_PER_EM);
  o = writeUInt16(buffer, o, 0);
  if (o !== buffer.length) throw new Error(`OS/2 table length mismatch ${o}.`);
  return buffer;
}

function buildPost() {
  const buffer = Buffer.alloc(32);
  let o = 0;
  o = writeUInt32(buffer, o, 0x00030000);
  o = writeUInt32(buffer, o, 0);
  o = writeInt16(buffer, o, -128);
  o = writeInt16(buffer, o, 64);
  o = writeUInt32(buffer, o, 1);
  for (let i = 0; i < 4; i += 1) o = writeUInt32(buffer, o, 0);
  if (o !== buffer.length) throw new Error("post table length mismatch.");
  return buffer;
}

function buildCmap() {
  const segCount = 3;
  const format4 = Buffer.alloc(40);
  let o = 0;
  o = writeUInt16(format4, o, 4);
  o = writeUInt16(format4, o, format4.length);
  o = writeUInt16(format4, o, 0);
  o = writeUInt16(format4, o, segCount * 2);
  o = writeUInt16(format4, o, 4);
  o = writeUInt16(format4, o, 1);
  o = writeUInt16(format4, o, 2);
  for (const value of [ASCII_END, EXPECTED_PUA_END, 0xffff]) o = writeUInt16(format4, o, value);
  o = writeUInt16(format4, o, 0);
  for (const value of [ASCII_START, EXPECTED_PUA_START, 0xffff]) o = writeUInt16(format4, o, value);
  for (const value of [(1 - ASCII_START) & 0xffff, (1 + ASCII_COUNT - EXPECTED_PUA_START) & 0xffff, 1]) {
    o = writeUInt16(format4, o, value);
  }
  for (let i = 0; i < segCount; i += 1) o = writeUInt16(format4, o, 0);
  if (o !== format4.length) throw new Error("cmap format 4 length mismatch.");

  const table = Buffer.alloc(20 + format4.length);
  table.writeUInt16BE(0, 0);
  table.writeUInt16BE(2, 2);
  table.writeUInt16BE(0, 4);
  table.writeUInt16BE(3, 6);
  table.writeUInt32BE(20, 8);
  table.writeUInt16BE(3, 12);
  table.writeUInt16BE(1, 14);
  table.writeUInt32BE(20, 16);
  format4.copy(table, 20);
  return table;
}

function utf16be(text) {
  const buffer = Buffer.alloc(text.length * 2);
  for (let i = 0; i < text.length; i += 1) buffer.writeUInt16BE(text.charCodeAt(i), i * 2);
  return buffer;
}

function buildName() {
  const licenseSummary = "Noncommercial use: CC BY-NC-SA 4.0. Commercial use requires separate written permission from Ariel Williams. See FONT-LICENSE.txt.";
  const records = [
    [0, "Copyright © 2026 Ariel Williams. GraphSCII portions licensed under CC BY-NC-SA 4.0 for noncommercial use; separate commercial permission available."],
    [1, FONT_FAMILY],
    [2, FONT_SUBFAMILY],
    [3, `${FONT_FAMILY}-${FONT_SUBFAMILY}-${FONT_VERSION}-ArielWilliams`],
    [4, FONT_FULL_NAME],
    [5, `Version ${FONT_VERSION}`],
    [6, FONT_POSTSCRIPT_NAME],
    [8, FONT_DESIGNER],
    [9, FONT_DESIGNER],
    [10, `${FONT_STANDARD_NAME} — an 8×16 fixed-cell graphical character standard by ${FONT_DESIGNER}.`],
    [13, licenseSummary],
    [14, "https://creativecommons.org/licenses/by-nc-sa/4.0/"],
  ].map(([nameId, text]) => ({ nameId, bytes: utf16be(text) }));

  const stringOffset = 6 + records.length * 12;
  const strings = Buffer.concat(records.map((record) => record.bytes));
  const table = Buffer.alloc(stringOffset + strings.length);
  table.writeUInt16BE(0, 0);
  table.writeUInt16BE(records.length, 2);
  table.writeUInt16BE(stringOffset, 4);
  let recordOffset = 6;
  let stringCursor = 0;
  for (const record of records) {
    table.writeUInt16BE(3, recordOffset);
    table.writeUInt16BE(1, recordOffset + 2);
    table.writeUInt16BE(0x0409, recordOffset + 4);
    table.writeUInt16BE(record.nameId, recordOffset + 6);
    table.writeUInt16BE(record.bytes.length, recordOffset + 8);
    table.writeUInt16BE(stringCursor, recordOffset + 10);
    recordOffset += 12;
    stringCursor += record.bytes.length;
  }
  strings.copy(table, stringOffset);
  return table;
}

function assembleSfnt(tables) {
  const tags = Object.keys(tables).sort();
  const numTables = tags.length;
  const maxPower = 2 ** Math.floor(Math.log2(numTables));
  const searchRange = maxPower * 16;
  const entrySelector = Math.log2(maxPower);
  const rangeShift = numTables * 16 - searchRange;
  const directoryLength = 12 + numTables * 16;

  let cursor = directoryLength;
  const entries = [];
  for (const tag of tags) {
    cursor = (cursor + 3) & ~3;
    const data = tables[tag];
    entries.push({ tag, checksum: checksum32(data), offset: cursor, length: data.length });
    cursor += pad4(data).length;
  }

  const font = Buffer.alloc(cursor);
  font.writeUInt32BE(0x00010000, 0);
  font.writeUInt16BE(numTables, 4);
  font.writeUInt16BE(searchRange, 6);
  font.writeUInt16BE(entrySelector, 8);
  font.writeUInt16BE(rangeShift, 10);
  let directoryOffset = 12;
  for (const entry of entries) {
    font.write(entry.tag, directoryOffset, 4, "ascii");
    font.writeUInt32BE(entry.checksum, directoryOffset + 4);
    font.writeUInt32BE(entry.offset, directoryOffset + 8);
    font.writeUInt32BE(entry.length, directoryOffset + 12);
    pad4(tables[entry.tag]).copy(font, entry.offset);
    directoryOffset += 16;
  }

  const headEntry = entries.find((entry) => entry.tag === "head");
  if (!headEntry) throw new Error("head table missing from sfnt.");
  const sum = checksum32(font);
  const adjustment = (SFNT_CHECKSUM_MAGIC - sum) >>> 0;
  font.writeUInt32BE(adjustment, headEntry.offset + 8);
  if (checksum32(font) !== SFNT_CHECKSUM_MAGIC) throw new Error("TTF checksum adjustment failed.");
  return { bytes: font, entries };
}

function assertRegistry(registry) {
  if (registry?.schema !== "graphscii-graphics-vocabulary-v1" || !Array.isArray(registry.owners)) {
    throw new Error("Font compiler requires the GraphSCII graphics-v1 registry.");
  }
  if (registry.owners.length !== EXPECTED_PUA_OWNERS) {
    throw new Error(`Expected ${EXPECTED_PUA_OWNERS} PUA owners, got ${registry.owners.length}.`);
  }
  for (let index = 0; index < registry.owners.length; index += 1) {
    const owner = registry.owners[index];
    const expectedCodepoint = EXPECTED_PUA_START + index;
    if (owner.glyphId !== index || owner.codepointValue !== expectedCodepoint) {
      throw new Error(`Registry order mismatch at owner ${index}.`);
    }
    rowsFromBitmapKey(owner.bitmapKey);
  }
  if (registry.owners.at(-1)?.codepointValue !== EXPECTED_PUA_END) {
    throw new Error("GraphSCII v1 registry does not end at U+F8FC.");
  }
}

export function buildGraphSCIITrueType(registry) {
  assertRegistry(registry);
  const glyphRows = [notdefRows()];
  for (let cp = ASCII_START; cp <= ASCII_END; cp += 1) glyphRows.push(ascii16Rows(cp));
  for (const owner of registry.owners) glyphRows.push(rowsFromBitmapKey(owner.bitmapKey));
  if (glyphRows.length !== EXPECTED_GLYPH_COUNT) throw new Error("Unexpected font glyph count.");

  const { glyf, loca, horizontalMetrics, maxPoints, maxContours } = buildGlyfAndLoca(glyphRows);
  const tables = {
    "OS/2": buildOS2(),
    cmap: buildCmap(),
    glyf,
    head: buildHead(),
    hhea: buildHhea(glyphRows.length),
    hmtx: buildHmtx(horizontalMetrics),
    loca,
    maxp: buildMaxp(glyphRows.length, maxPoints, maxContours),
    name: buildName(),
    post: buildPost(),
  };
  const sfnt = assembleSfnt(tables);
  return {
    bytes: sfnt.bytes,
    glyphRows,
    tableEntries: sfnt.entries,
    maxPoints,
    maxContours,
  };
}

function tableMap(fontBytes) {
  if (fontBytes.readUInt32BE(0) !== 0x00010000) throw new Error("Not a TrueType sfnt.");
  const numTables = fontBytes.readUInt16BE(4);
  const result = new Map();
  for (let i = 0; i < numTables; i += 1) {
    const offset = 12 + i * 16;
    const tag = fontBytes.toString("ascii", offset, offset + 4);
    result.set(tag, {
      checksum: fontBytes.readUInt32BE(offset + 4),
      offset: fontBytes.readUInt32BE(offset + 8),
      length: fontBytes.readUInt32BE(offset + 12),
    });
  }
  return result;
}

function decodeSimpleGlyphRows(fontBytes, glyfEntry, start, end) {
  const rows = new Uint8Array(HEIGHT);
  if (start === end) return rows;
  const base = glyfEntry.offset + start;
  const numberOfContours = fontBytes.readInt16BE(base);
  if (numberOfContours < 0) throw new Error("Composite glyphs are not allowed in GraphSCII v1 font output.");
  if (numberOfContours === 0) return rows;
  let offset = base + 10;
  const endPoints = [];
  for (let i = 0; i < numberOfContours; i += 1) {
    endPoints.push(fontBytes.readUInt16BE(offset));
    offset += 2;
  }
  const pointCount = endPoints.at(-1) + 1;
  const instructionLength = fontBytes.readUInt16BE(offset); offset += 2;
  offset += instructionLength;
  const flags = [];
  while (flags.length < pointCount) {
    const flag = fontBytes[offset++];
    flags.push(flag);
    if ((flag & 0x08) !== 0) {
      const repeat = fontBytes[offset++];
      for (let i = 0; i < repeat; i += 1) flags.push(flag);
    }
  }
  const xs = [];
  let x = 0;
  for (const flag of flags) {
    let delta = 0;
    if ((flag & 0x02) !== 0) {
      const value = fontBytes[offset++];
      delta = (flag & 0x10) !== 0 ? value : -value;
    } else if ((flag & 0x10) === 0) {
      delta = fontBytes.readInt16BE(offset); offset += 2;
    }
    x += delta;
    xs.push(x);
  }
  const ys = [];
  let y = 0;
  for (const flag of flags) {
    let delta = 0;
    if ((flag & 0x04) !== 0) {
      const value = fontBytes[offset++];
      delta = (flag & 0x20) !== 0 ? value : -value;
    } else if ((flag & 0x20) === 0) {
      delta = fontBytes.readInt16BE(offset); offset += 2;
    }
    y += delta;
    ys.push(y);
  }

  let contourStart = 0;
  for (const contourEnd of endPoints) {
    const count = contourEnd - contourStart + 1;
    if (count !== 4) throw new Error(`Expected rectangular 4-point contour, got ${count}.`);
    const contourXs = xs.slice(contourStart, contourEnd + 1);
    const contourYs = ys.slice(contourStart, contourEnd + 1);
    const left = Math.min(...contourXs);
    const right = Math.max(...contourXs);
    const bottom = Math.min(...contourYs);
    const top = Math.max(...contourYs);
    if ([left, right, bottom, top].some((value) => value % UNITS_PER_PIXEL !== 0)) {
      throw new Error("Font outline escaped the canonical pixel grid.");
    }
    if (top - bottom !== UNITS_PER_PIXEL) throw new Error("Font contour is not exactly one bitmap row high.");
    const row = HEIGHT - 1 - bottom / UNITS_PER_PIXEL;
    const x0 = left / UNITS_PER_PIXEL;
    const x1 = right / UNITS_PER_PIXEL;
    if (row < 0 || row >= HEIGHT || x0 < 0 || x1 > WIDTH || x0 >= x1) throw new Error("Font contour outside canonical cell.");
    for (let px = x0; px < x1; px += 1) rows[row] |= 1 << px;
    contourStart = contourEnd + 1;
  }
  return rows;
}

export function verifyGraphSCIITrueTypeBytes(fontBytes, registry) {
  assertRegistry(registry);
  if (checksum32(fontBytes) !== SFNT_CHECKSUM_MAGIC) throw new Error("Final sfnt checksum is invalid.");
  const tables = tableMap(fontBytes);
  for (const tag of ["OS/2", "cmap", "glyf", "head", "hhea", "hmtx", "loca", "maxp", "name", "post"]) {
    if (!tables.has(tag)) throw new Error(`Required TTF table ${tag} missing.`);
  }
  const head = tables.get("head");
  const maxp = tables.get("maxp");
  const hhea = tables.get("hhea");
  const hmtx = tables.get("hmtx");
  const loca = tables.get("loca");
  const glyf = tables.get("glyf");
  if (fontBytes.readUInt16BE(head.offset + 18) !== UNITS_PER_EM) throw new Error("Unexpected unitsPerEm.");
  if (fontBytes.readInt16BE(head.offset + 50) !== 1) throw new Error("Font must use long loca offsets.");
  if (fontBytes.readUInt16BE(maxp.offset + 4) !== EXPECTED_GLYPH_COUNT) throw new Error("Unexpected maxp.numGlyphs.");
  if (fontBytes.readUInt16BE(hhea.offset + 34) !== EXPECTED_GLYPH_COUNT) throw new Error("Unexpected hhea.numberOfHMetrics.");
  if ((fontBytes.readUInt16BE(head.offset + 16) & 0x0002) === 0) throw new Error("GraphSCII requires head.flags bit 1: left side bearing equals xMin.");
  if (hmtx.length !== EXPECTED_GLYPH_COUNT * 4) throw new Error("Unexpected hmtx length.");
  if (loca.length !== (EXPECTED_GLYPH_COUNT + 1) * 4) throw new Error("Unexpected loca length.");

  const expectedRows = [notdefRows()];
  for (let cp = ASCII_START; cp <= ASCII_END; cp += 1) expectedRows.push(ascii16Rows(cp));
  for (const owner of registry.owners) expectedRows.push(rowsFromBitmapKey(owner.bitmapKey));
  for (let glyphIndex = 0; glyphIndex < EXPECTED_GLYPH_COUNT; glyphIndex += 1) {
    const start = fontBytes.readUInt32BE(loca.offset + glyphIndex * 4);
    const end = fontBytes.readUInt32BE(loca.offset + (glyphIndex + 1) * 4);
    if (start > end || end > glyf.length) throw new Error(`Invalid loca range for glyph ${glyphIndex}.`);
    const actual = decodeSimpleGlyphRows(fontBytes, glyf, start, end);
    const expected = expectedRows[glyphIndex];
    if (bitmapKeyFromRows(actual) !== bitmapKeyFromRows(expected)) {
      throw new Error(`Raster round-trip failed for font glyph ${glyphIndex}.`);
    }

    const metricOffset = hmtx.offset + glyphIndex * 4;
    const advanceWidth = fontBytes.readUInt16BE(metricOffset);
    const leftSideBearing = fontBytes.readInt16BE(metricOffset + 2);
    const expectedLeftSideBearing = leftSideBearingForRows(expected);
    if (advanceWidth !== ADVANCE_WIDTH) {
      throw new Error(`Unexpected advance width for font glyph ${glyphIndex}: ${advanceWidth}.`);
    }
    if (leftSideBearing !== expectedLeftSideBearing) {
      throw new Error(`Left side bearing mismatch for font glyph ${glyphIndex}: ${leftSideBearing} !== ${expectedLeftSideBearing}.`);
    }
    if (start !== end) {
      const glyphXMin = fontBytes.readInt16BE(glyf.offset + start + 2);
      if (leftSideBearing !== glyphXMin) {
        throw new Error(`hmtx/glyf xMin mismatch for font glyph ${glyphIndex}: ${leftSideBearing} !== ${glyphXMin}.`);
      }
    } else if (leftSideBearing !== 0) {
      throw new Error(`Empty font glyph ${glyphIndex} must have zero left side bearing.`);
    }
  }

  const cmap = tables.get("cmap");
  const cmapBase = cmap.offset;
  const numSubtables = fontBytes.readUInt16BE(cmapBase + 2);
  if (numSubtables < 1) throw new Error("cmap has no subtables.");
  const formatOffset = cmapBase + fontBytes.readUInt32BE(cmapBase + 8);
  if (fontBytes.readUInt16BE(formatOffset) !== 4) throw new Error("Expected cmap format 4.");

  return {
    sfntGlyphs: EXPECTED_GLYPH_COUNT,
    encodedCharacters: EXPECTED_CHARACTER_COUNT,
    asciiCharacters: ASCII_COUNT,
    puaCharacters: EXPECTED_PUA_OWNERS,
    unitsPerEm: UNITS_PER_EM,
    advanceWidth: ADVANCE_WIDTH,
    maxPoints: fontBytes.readUInt16BE(maxp.offset + 6),
    maxContours: fontBytes.readUInt16BE(maxp.offset + 8),
  };
}

export async function buildFontDocuments(repoRoot) {
  const registryFilename = path.join(repoRoot, "artifacts", "manifest", "vocabulary-v1.1", "registry.json");
  const registryBytes = await readFile(registryFilename);
  const registry = JSON.parse(registryBytes.toString("utf8"));
  const built = buildGraphSCIITrueType(registry);
  const stats = verifyGraphSCIITrueTypeBytes(built.bytes, registry);
  const manifest = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-font-build-v1",
    schemaVersion: 1,
    status: "milestone-9a-reference-ttf",
    standard: FONT_STANDARD_NAME,
    designer: FONT_DESIGNER,
    fontFamily: FONT_FAMILY,
    subfamily: FONT_SUBFAMILY,
    fullName: FONT_FULL_NAME,
    postScriptName: FONT_POSTSCRIPT_NAME,
    version: FONT_VERSION,
    sourcePublication: "graphscii-graphics-v1.1",
    sourceRegistry: "artifacts/manifest/vocabulary-v1.1/registry.json",
    sourceRegistrySha256: sha256(registryBytes),
    output: `artifacts/fonts/${FONT_FILENAME}`,
    fontSha256: sha256(built.bytes),
    canonicalCell: "8x16",
    unitsPerPixel: UNITS_PER_PIXEL,
    unitsPerEm: UNITS_PER_EM,
    advanceWidth: ADVANCE_WIDTH,
    encodedCharacters: stats.encodedCharacters,
    asciiCharacters: stats.asciiCharacters,
    puaCharacters: stats.puaCharacters,
    sfntGlyphs: stats.sfntGlyphs,
    mandatoryNotdefGlyphs: 1,
    license: {
      nonCommercial: "CC BY-NC-SA 4.0",
      commercial: "separate written permission from Ariel Williams required",
      indie: "ask Ariel Williams; permissions are intended to be friendly and often free or low-cost",
      terms: "FONT-LICENSE.txt",
      commercialInfo: "COMMERCIAL-LICENSE.md",
      indieInfo: "INDIE-LICENSE.md"
    },
    printableAsciiSource: {
      source: "dhepper/font8x8 font8x8_basic.h, IBM VGA-derived",
      status: "Public Domain",
      transformation: "U+0020..U+007E 8x8 rows doubled vertically to the GraphSCII 8x16 cell",
      notice: "THIRD-PARTY-NOTICES.md"
    },
    verification: {
      deterministicRebuild: true,
      sfntChecksum: "0xB1B0AFBA",
      allGlyphRasterRoundTrip: true,
      horizontalMetricsPositionPreserved: true,
      hmtxLeftSideBearingEqualsXMin: true,
      puaRegistryOrderPreserved: true
    }
  };
  return { registry, fontBytes: built.bytes, manifest };
}

export async function generateGraphSCIIFont(repoRoot) {
  const { fontBytes, manifest } = await buildFontDocuments(repoRoot);
  const fontRoot = path.join(repoRoot, "artifacts", "fonts");
  await mkdir(fontRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(fontRoot, FONT_FILENAME), fontBytes),
    writeFile(path.join(fontRoot, "manifest.json"), jsonText(manifest))
  ]);
  return manifest;
}

export async function verifyGraphSCIIFont(repoRoot) {
  const { registry, fontBytes, manifest } = await buildFontDocuments(repoRoot);
  const fontRoot = path.join(repoRoot, "artifacts", "fonts");
  const [actualFont, actualManifest] = await Promise.all([
    readFile(path.join(fontRoot, FONT_FILENAME)),
    readFile(path.join(fontRoot, "manifest.json"), "utf8")
  ]);
  if (!actualFont.equals(fontBytes)) throw new Error("GraphSCII TTF is not byte-identical to deterministic rebuild.");
  if (actualManifest !== jsonText(manifest)) throw new Error("GraphSCII font manifest is not byte-identical to deterministic rebuild.");
  const stats = verifyGraphSCIITrueTypeBytes(actualFont, registry);
  return { ...stats, fontSha256: manifest.fontSha256 };
}
