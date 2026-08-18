export const CELL_WIDTH = 8;
export const CELL_HEIGHT = 16;
export const PRIVATE_USE_START = 0xe000;

export type Edge = "L" | "R" | "T" | "B";
export type FamilyId = "LR" | "TB" | "LT" | "LB" | "RT" | "RB";

export interface Port {
  edge: Edge;
  index: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface CandidateGlyph {
  candidateId: number;
  family: FamilyId;
  start: Port;
  end: Port;
  bitmap: Uint8Array;
  bitmapKey: string;
}

export interface UniqueGlyph {
  glyphId: number;
  codepoint: number;
  bitmap: Uint8Array;
  bitmapKey: string;
  aliases: CandidateGlyph[];
}

export interface GenerationResult {
  candidates: CandidateGlyph[];
  glyphs: UniqueGlyph[];
  duplicateCandidates: number;
}

export interface FamilyDefinition {
  id: FamilyId;
  label: string;
  startEdge: Edge;
  endEdge: Edge;
  candidateCount: number;
}
