import type { CellRect, DrawingObject, Point, Rect } from "./types";

const EPSILON = 1e-6;

export function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < EPSILON) return distance(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy });
}

function pointBounds(points: Point[]): Rect {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = points[0]!.x;
  let maxX = minX;
  let minY = points[0]!.y;
  let maxY = minY;
  for (const point of points.slice(1)) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function expandRect(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

export function boundsForObject(object: DrawingObject): Rect {
  switch (object.type) {
    case "freehand":
      return expandRect(pointBounds(object.points), object.width / 2 + 2);
    case "line":
      return expandRect(pointBounds([object.start, object.end]), object.width / 2 + 2);
    case "bezier":
      return expandRect(pointBounds([object.p0, object.p1, object.p2, object.p3]), object.width / 2 + 2);
    case "ellipse": {
      const c = Math.abs(Math.cos(object.rotation));
      const s = Math.abs(Math.sin(object.rotation));
      const halfWidth = object.radiusX * c + object.radiusY * s + object.strokeWidth / 2 + 2;
      const halfHeight = object.radiusX * s + object.radiusY * c + object.strokeWidth / 2 + 2;
      return {
        x: object.center.x - halfWidth,
        y: object.center.y - halfHeight,
        width: halfWidth * 2,
        height: halfHeight * 2,
      };
    }
  }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function translateObject(object: DrawingObject, dx: number, dy: number): DrawingObject {
  const move = (point: Point): Point => ({ x: point.x + dx, y: point.y + dy });
  switch (object.type) {
    case "freehand":
      return { ...object, points: object.points.map(move) };
    case "line":
      return { ...object, start: move(object.start), end: move(object.end) };
    case "bezier":
      return { ...object, p0: move(object.p0), p1: move(object.p1), p2: move(object.p2), p3: move(object.p3) };
    case "ellipse":
      return { ...object, center: move(object.center) };
  }
}

function cubicPoint(object: Extract<DrawingObject, { type: "bezier" }>, t: number): Point {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * object.p0.x + 3 * uu * t * object.p1.x + 3 * u * tt * object.p2.x + ttt * object.p3.x,
    y: uuu * object.p0.y + 3 * uu * t * object.p1.y + 3 * u * tt * object.p2.y + ttt * object.p3.y,
  };
}

export function hitTestObject(object: DrawingObject, point: Point, tolerance = 6): boolean {
  if (!rectsIntersect(expandRect(boundsForObject(object), tolerance), { x: point.x, y: point.y, width: 0, height: 0 })) {
    return false;
  }
  switch (object.type) {
    case "line":
      return distanceToSegment(point, object.start, object.end) <= object.width / 2 + tolerance;
    case "freehand": {
      for (let index = 1; index < object.points.length; index += 1) {
        if (distanceToSegment(point, object.points[index - 1]!, object.points[index]!) <= object.width / 2 + tolerance) return true;
      }
      return object.points.length === 1 && distance(point, object.points[0]!) <= tolerance;
    }
    case "bezier": {
      let previous = object.p0;
      for (let index = 1; index <= 32; index += 1) {
        const current = cubicPoint(object, index / 32);
        if (distanceToSegment(point, previous, current) <= object.width / 2 + tolerance) return true;
        previous = current;
      }
      return false;
    }
    case "ellipse": {
      const cos = Math.cos(-object.rotation);
      const sin = Math.sin(-object.rotation);
      const dx = point.x - object.center.x;
      const dy = point.y - object.center.y;
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      const rx = Math.max(object.radiusX, EPSILON);
      const ry = Math.max(object.radiusY, EPSILON);
      const normalized = Math.sqrt((localX * localX) / (rx * rx) + (localY * localY) / (ry * ry));
      if (object.fillEnabled && normalized <= 1) return true;
      const radialTolerance = tolerance / Math.max(rx, ry);
      return Math.abs(normalized - 1) <= radialTolerance + object.strokeWidth / (2 * Math.max(rx, ry));
    }
  }
}

export function logicalRectToCells(rect: Rect, columns: number, rows: number, marginCells = 1): CellRect {
  const left = Math.max(0, Math.floor(rect.x / 8) - marginCells);
  const top = Math.max(0, Math.floor(rect.y / 16) - marginCells);
  const right = Math.min(columns, Math.ceil((rect.x + rect.width) / 8) + marginCells);
  const bottom = Math.min(rows, Math.ceil((rect.y + rect.height) / 16) + marginCells);
  return {
    column: left,
    row: top,
    columns: Math.max(0, right - left),
    rows: Math.max(0, bottom - top),
  };
}

export function fullCellRect(columns: number, rows: number): CellRect {
  return { column: 0, row: 0, columns, rows };
}

export function cellRectToLogical(rect: CellRect): Rect {
  return { x: rect.column * 8, y: rect.row * 16, width: rect.columns * 8, height: rect.rows * 16 };
}

export function snapAngle(start: Point, end: Point, stepDegrees = 45): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const radius = Math.hypot(dx, dy);
  if (radius < EPSILON) return end;
  const step = (stepDegrees * Math.PI) / 180;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: start.x + Math.cos(angle) * radius, y: start.y + Math.sin(angle) * radius };
}

export function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
