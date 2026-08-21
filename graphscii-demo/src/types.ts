export type GraphSCIITone = 100 | 75 | 50 | 25;
export type Tool = "select" | "freehand" | "line" | "bezier" | "ellipse" | "eraser";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BaseObject {
  id: string;
}

export interface FreehandStroke extends BaseObject {
  type: "freehand";
  points: Point[];
  width: number;
  tone: GraphSCIITone;
}

export interface LineObject extends BaseObject {
  type: "line";
  start: Point;
  end: Point;
  width: number;
  tone: GraphSCIITone;
}

export interface BezierObject extends BaseObject {
  type: "bezier";
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
  width: number;
  tone: GraphSCIITone;
}

export interface EllipseObject extends BaseObject {
  type: "ellipse";
  center: Point;
  radiusX: number;
  radiusY: number;
  rotation: number;
  strokeWidth: number;
  strokeTone: GraphSCIITone;
  fillEnabled: boolean;
  fillTone: GraphSCIITone;
}

export type DrawingObject = FreehandStroke | LineObject | BezierObject | EllipseObject;

export interface GraphSCIIDocument {
  format: "GraphSCII-Drawing";
  version: 1;
  columns: number;
  rows: number;
  objects: DrawingObject[];
}

export interface GlyphOwnerJson {
  glyphId: number;
  codepoint: string;
  codepointValue: number;
  bitmapKey: string;
  canonicalClass: string;
  semanticAliases?: string[];
  firstSemanticAlias?: string | null;
}

export interface RegistryJson {
  format: string;
  schema: string;
  owners: GlyphOwnerJson[];
}

export interface GraphGlyph {
  glyphId: number;
  codepointValue: number;
  bitmapKey: string;
  canonicalClass: string;
  rows: Uint8Array;
  onCount: number;
  leftEdge: number;
  rightEdge: number;
  topEdge: number;
  bottomEdge: number;
  label: string;
}

export interface CellRect {
  column: number;
  row: number;
  columns: number;
  rows: number;
}
