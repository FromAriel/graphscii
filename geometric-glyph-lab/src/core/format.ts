import { CELL_HEIGHT, CELL_WIDTH } from "./types.js";

export const GRAPHSCII_FORMAT = "graphscii";
export const GRAPHSCII_FORMAT_VERSION = 1;
export const CELL_ORIENTATION = "8-columns-by-16-rows" as const;

/**
 * Canonical bitmap serialization for GraphSCII v1.
 *
 * - Exactly CELL_HEIGHT bytes, one byte per row.
 * - Rows are serialized from top (y=0) to bottom (y=15).
 * - Within each row, x=0 is bit 0 (least-significant bit).
 * - The stable text key is two lowercase hex digits per row, concatenated.
 */
export const BITMAP_SERIALIZATION =
  "v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex" as const;

export const ASCII_FILLED_PIXEL = "#";
export const ASCII_EMPTY_PIXEL = "-";
export const UNICODE_FILENAME_HEX_WIDTH = 6;

export function assertCanonicalCell(): void {
  if (CELL_WIDTH !== 8 || CELL_HEIGHT !== 16) {
    throw new Error(
      `GraphSCII v1 requires an 8-column × 16-row cell; got ${CELL_WIDTH}×${CELL_HEIGHT}.`,
    );
  }
}

export function formatCodepoint(codepoint: number): string {
  if (!Number.isInteger(codepoint) || codepoint < 0 || codepoint > 0x10ffff) {
    throw new Error(`Invalid Unicode codepoint: ${codepoint}.`);
  }

  return `U+${codepoint.toString(16).toUpperCase().padStart(UNICODE_FILENAME_HEX_WIDTH, "0")}`;
}

export function glyphArtifactStem(codepoint: number): string {
  return formatCodepoint(codepoint);
}
