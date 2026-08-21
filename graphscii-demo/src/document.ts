import type { DrawingObject, GraphSCIIDocument, GraphSCIITone, Point } from "./types";

const MIN_COLUMNS = 8;
const MAX_COLUMNS = 240;
const MIN_ROWS = 4;
const MAX_ROWS = 120;
const TONES = new Set<GraphSCIITone>([100, 75, 50, 25]);

export function createDocument(columns = 64, rows = 32): GraphSCIIDocument {
  return {
    format: "GraphSCII-Drawing",
    version: 1,
    columns: clampInteger(columns, MIN_COLUMNS, MAX_COLUMNS),
    rows: clampInteger(rows, MIN_ROWS, MAX_ROWS),
    objects: [],
  };
}

export function cloneDocument(document: GraphSCIIDocument): GraphSCIIDocument {
  return structuredClone(document);
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return typeof point.x === "number" && Number.isFinite(point.x) && typeof point.y === "number" && Number.isFinite(point.y);
}

function isTone(value: unknown): value is GraphSCIITone {
  return typeof value === "number" && TONES.has(value as GraphSCIITone);
}

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isDrawingObject(value: unknown): value is DrawingObject {
  if (!value || typeof value !== "object") return false;
  const object = value as Record<string, unknown>;
  if (typeof object.id !== "string" || object.id.length === 0 || typeof object.type !== "string") return false;
  switch (object.type) {
    case "freehand":
      return Array.isArray(object.points) && object.points.every(isPoint) && positiveNumber(object.width) && isTone(object.tone);
    case "line":
      return isPoint(object.start) && isPoint(object.end) && positiveNumber(object.width) && isTone(object.tone);
    case "bezier":
      return isPoint(object.p0) && isPoint(object.p1) && isPoint(object.p2) && isPoint(object.p3) && positiveNumber(object.width) && isTone(object.tone);
    case "ellipse":
      return isPoint(object.center) && positiveNumber(object.radiusX) && positiveNumber(object.radiusY) &&
        typeof object.rotation === "number" && Number.isFinite(object.rotation) && positiveNumber(object.strokeWidth) &&
        isTone(object.strokeTone) && typeof object.fillEnabled === "boolean" && isTone(object.fillTone);
    default:
      return false;
  }
}

export function parseDocument(json: string): GraphSCIIDocument {
  const raw = JSON.parse(json) as unknown;
  if (!raw || typeof raw !== "object") throw new Error("GraphSCII drawing must be a JSON object.");
  const candidate = raw as Record<string, unknown>;
  if (candidate.format !== "GraphSCII-Drawing" || candidate.version !== 1) throw new Error("Unsupported GraphSCII drawing format/version.");
  if (typeof candidate.columns !== "number" || typeof candidate.rows !== "number") throw new Error("Drawing dimensions are missing.");
  const columns = clampInteger(candidate.columns, MIN_COLUMNS, MAX_COLUMNS);
  const rows = clampInteger(candidate.rows, MIN_ROWS, MAX_ROWS);
  if (columns !== candidate.columns || rows !== candidate.rows) {
    throw new Error(`Drawing dimensions must be ${MIN_COLUMNS}-${MAX_COLUMNS} columns and ${MIN_ROWS}-${MAX_ROWS} rows.`);
  }
  if (!Array.isArray(candidate.objects) || !candidate.objects.every(isDrawingObject)) throw new Error("Drawing contains an invalid object.");
  return {
    format: "GraphSCII-Drawing",
    version: 1,
    columns,
    rows,
    objects: structuredClone(candidate.objects),
  };
}

export class DocumentHistory {
  private undoStack: GraphSCIIDocument[] = [];
  private redoStack: GraphSCIIDocument[] = [];
  readonly limit = 100;

  push(previous: GraphSCIIDocument): void {
    this.undoStack.push(cloneDocument(previous));
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo(current: GraphSCIIDocument): GraphSCIIDocument | null {
    const previous = this.undoStack.pop();
    if (!previous) return null;
    this.redoStack.push(cloneDocument(current));
    return previous;
  }

  redo(current: GraphSCIIDocument): GraphSCIIDocument | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(cloneDocument(current));
    return next;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
