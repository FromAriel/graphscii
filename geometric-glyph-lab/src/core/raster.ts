import { CELL_HEIGHT, CELL_WIDTH, type PixelPoint, type Port } from "./types.js";
import { ASCII_EMPTY_PIXEL, ASCII_FILLED_PIXEL } from "./format.js";
import { portToPixel } from "./ports.js";

export function emptyBitmap(): Uint8Array {
  return new Uint8Array(CELL_HEIGHT);
}

export function cloneBitmap(bitmap: Uint8Array): Uint8Array {
  return new Uint8Array(bitmap);
}

export function setPixel(bitmap: Uint8Array, x: number, y: number): void {
  if (x < 0 || x >= CELL_WIDTH || y < 0 || y >= CELL_HEIGHT) {
    return;
  }
  bitmap[y] |= 1 << x;
}

export function hasPixel(bitmap: Uint8Array, x: number, y: number): boolean {
  return (bitmap[y] & (1 << x)) !== 0;
}

export function rasterizeLineBetweenPixels(start: PixelPoint, end: PixelPoint): Uint8Array {
  const bitmap = emptyBitmap();

  let x0 = start.x;
  let y0 = start.y;
  const x1 = end.x;
  const y1 = end.y;

  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  while (true) {
    setPixel(bitmap, x0, y0);
    if (x0 === x1 && y0 === y1) {
      break;
    }

    const doubledError = error * 2;
    if (doubledError >= dy) {
      error += dy;
      x0 += sx;
    }
    if (doubledError <= dx) {
      error += dx;
      y0 += sy;
    }
  }

  return bitmap;
}

export function rasterizePortLine(start: Port, end: Port): Uint8Array {
  return rasterizeLineBetweenPixels(portToPixel(start), portToPixel(end));
}

export function bitmapKey(bitmap: Uint8Array): string {
  return Array.from(bitmap, (row) => row.toString(16).padStart(2, "0")).join("");
}

export function bitmapRows(bitmap: Uint8Array): string[] {
  return Array.from(bitmap, (row) => row.toString(16).padStart(2, "0"));
}

export function bitmapAscii(bitmap: Uint8Array): string {
  const lines: string[] = [];
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    let line = "";
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      line += hasPixel(bitmap, x, y) ? ASCII_FILLED_PIXEL : ASCII_EMPTY_PIXEL;
    }
    lines.push(line);
  }
  return lines.join("\n");
}
