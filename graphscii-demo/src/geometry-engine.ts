import type { DrawingObject, EllipseObject, Point } from "./types";

export const CELL_WIDTH = 8;
export const CELL_HEIGHT = 16;
const EPSILON = 1e-9;
const FLATNESS = 0.05;
const MAX_SUBDIVISION_DEPTH = 18;

export type PortEdge = "T" | "B" | "L" | "R";
export type PortName = `${PortEdge}${number}`;

export interface CenterlineSegment {
  a: Point;
  b: Point;
  objectId: string;
  objectType: DrawingObject["type"];
}

export interface ObjectCellGeometry {
  ports: Set<PortName>;
  segments: CenterlineSegment[];
}

export interface CellGeometry {
  ports: Set<PortName>;
  segments: CenterlineSegment[];
  byObject: Map<string, ObjectCellGeometry>;
}

export interface GeometryGrid {
  cells: Map<number, CellGeometry>;
  pathsByObject: Map<string, Point[][]>;
}

function clone(point: Point): Point {
  return { x: point.x, y: point.y };
}

function distanceToLine(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length <= EPSILON) return Math.hypot(point.x - a.x, point.y - a.y);
  return Math.abs(dx * (a.y - point.y) - (a.x - point.x) * dy) / length;
}

function appendUnique(points: Point[], point: Point): void {
  const previous = points[points.length - 1];
  if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) <= 1e-10) return;
  points.push(clone(point));
}

function flattenQuadraticRecursive(
  p0: Point,
  p1: Point,
  p2: Point,
  output: Point[],
  depth: number,
): void {
  if (depth >= MAX_SUBDIVISION_DEPTH || distanceToLine(p1, p0, p2) <= FLATNESS) {
    appendUnique(output, p2);
    return;
  }
  const p01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const p12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const p012 = { x: (p01.x + p12.x) / 2, y: (p01.y + p12.y) / 2 };
  flattenQuadraticRecursive(p0, p01, p012, output, depth + 1);
  flattenQuadraticRecursive(p012, p12, p2, output, depth + 1);
}

function flattenCubicRecursive(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  output: Point[],
  depth: number,
): void {
  const flatness = Math.max(distanceToLine(p1, p0, p3), distanceToLine(p2, p0, p3));
  if (depth >= MAX_SUBDIVISION_DEPTH || flatness <= FLATNESS) {
    appendUnique(output, p3);
    return;
  }
  const p01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const p12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const p23 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
  const p012 = { x: (p01.x + p12.x) / 2, y: (p01.y + p12.y) / 2 };
  const p123 = { x: (p12.x + p23.x) / 2, y: (p12.y + p23.y) / 2 };
  const p0123 = { x: (p012.x + p123.x) / 2, y: (p012.y + p123.y) / 2 };
  flattenCubicRecursive(p0, p01, p012, p0123, output, depth + 1);
  flattenCubicRecursive(p0123, p123, p23, p3, output, depth + 1);
}

function flattenFreehand(object: Extract<DrawingObject, { type: "freehand" }>): Point[] {
  const source = object.points;
  if (source.length === 0) return [];
  if (source.length === 1) return [clone(source[0]!)];
  if (source.length === 2) return [clone(source[0]!), clone(source[1]!)];

  const output: Point[] = [clone(source[0]!)];
  let current = source[0]!;
  for (let index = 1; index < source.length - 1; index += 1) {
    const control = source[index]!;
    const next = source[index + 1]!;
    const end = { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 };
    flattenQuadraticRecursive(current, control, end, output, 0);
    current = end;
  }
  flattenQuadraticRecursive(current, source[source.length - 2]!, source[source.length - 1]!, output, 0);
  return output;
}

function flattenBezier(object: Extract<DrawingObject, { type: "bezier" }>): Point[] {
  const output: Point[] = [clone(object.p0)];
  flattenCubicRecursive(object.p0, object.p1, object.p2, object.p3, output, 0);
  return output;
}

function ellipsePoint(object: EllipseObject, angle: number): Point {
  const cosRotation = Math.cos(object.rotation);
  const sinRotation = Math.sin(object.rotation);
  const localX = object.radiusX * Math.cos(angle);
  const localY = object.radiusY * Math.sin(angle);
  return {
    x: object.center.x + localX * cosRotation - localY * sinRotation,
    y: object.center.y + localX * sinRotation + localY * cosRotation,
  };
}

function flattenEllipse(object: EllipseObject): Point[] {
  if (object.radiusX <= EPSILON || object.radiusY <= EPSILON) return [];
  const radius = Math.max(object.radiusX, object.radiusY);
  const ratio = Math.max(-1, Math.min(1, 1 - FLATNESS / Math.max(radius, FLATNESS)));
  const stepAngle = 2 * Math.acos(ratio);
  const steps = Math.max(32, Math.min(4096, Math.ceil((Math.PI * 2) / Math.max(stepAngle, Math.PI / 2048))));
  const points: Point[] = [];
  for (let step = 0; step <= steps; step += 1) {
    points.push(ellipsePoint(object, (step / steps) * Math.PI * 2));
  }
  return points;
}

export function flattenObjectPaths(object: DrawingObject): Point[][] {
  switch (object.type) {
    case "line":
      return [[clone(object.start), clone(object.end)]];
    case "freehand": {
      const path = flattenFreehand(object);
      return path.length >= 2 ? [path] : [];
    }
    case "bezier": {
      const path = flattenBezier(object);
      return path.length >= 2 ? [path] : [];
    }
    case "ellipse": {
      if (object.strokeWidth <= 0 && !object.fillEnabled) return [];
      const path = flattenEllipse(object);
      return path.length >= 2 ? [path] : [];
    }
  }
}

function quantize(value: number, maximum: number): number {
  return Math.max(0, Math.min(maximum, Math.floor(value + 0.5)));
}

export function portPoint(port: PortName): Point {
  const edge = port[0] as PortEdge;
  const index = Number.parseInt(port.slice(1), 10);
  switch (edge) {
    case "T": return { x: index, y: 0 };
    case "B": return { x: index, y: 15 };
    case "L": return { x: 0, y: index };
    case "R": return { x: 7, y: index };
  }
}

function normalizedAxisPrefersVertical(dx: number, dy: number): boolean {
  return Math.abs(dx) * CELL_HEIGHT >= Math.abs(dy) * CELL_WIDTH;
}

function initialCellIndex(value: number, delta: number, size: number, count: number): number {
  const scaled = value / size;
  const nearest = Math.round(scaled);
  let index: number;
  if (Math.abs(scaled - nearest) <= EPSILON) index = delta < 0 ? nearest - 1 : nearest;
  else index = Math.floor(scaled);
  return Math.max(0, Math.min(count - 1, index));
}

function cellKey(column: number, row: number, columns: number): number {
  return row * columns + column;
}

function ensureCell(grid: GeometryGrid, column: number, row: number, columns: number): CellGeometry {
  const key = cellKey(column, row, columns);
  let cell = grid.cells.get(key);
  if (!cell) {
    cell = { ports: new Set<PortName>(), segments: [], byObject: new Map<string, ObjectCellGeometry>() };
    grid.cells.set(key, cell);
  }
  return cell;
}

function ensureObjectCell(cell: CellGeometry, objectId: string): ObjectCellGeometry {
  let objectCell = cell.byObject.get(objectId);
  if (!objectCell) {
    objectCell = { ports: new Set<PortName>(), segments: [] };
    cell.byObject.set(objectId, objectCell);
  }
  return objectCell;
}

function addPort(
  grid: GeometryGrid,
  column: number,
  row: number,
  columns: number,
  objectId: string,
  port: PortName,
): void {
  const cell = ensureCell(grid, column, row, columns);
  cell.ports.add(port);
  ensureObjectCell(cell, objectId).ports.add(port);
}

function addPiece(
  grid: GeometryGrid,
  column: number,
  row: number,
  columns: number,
  segment: CenterlineSegment,
): void {
  if (Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y) <= EPSILON) return;
  const cell = ensureCell(grid, column, row, columns);
  cell.segments.push(segment);
  ensureObjectCell(cell, segment.objectId).segments.push(segment);
}

function pointAt(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function clipSegmentToDocument(a: Point, b: Point, width: number, height: number): { a: Point; b: Point } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const tests: Array<[number, number]> = [
    [-dx, a.x],
    [dx, width - a.x],
    [-dy, a.y],
    [dy, height - a.y],
  ];
  for (const [p, q] of tests) {
    if (Math.abs(p) <= EPSILON) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 - t1 > EPSILON) return null;
  }
  return { a: pointAt(a, b, t0), b: pointAt(a, b, t1) };
}

function traverseSegment(
  sourceA: Point,
  sourceB: Point,
  object: DrawingObject,
  grid: GeometryGrid,
  columns: number,
  rows: number,
): void {
  const documentWidth = columns * CELL_WIDTH;
  const documentHeight = rows * CELL_HEIGHT;
  const clipped = clipSegmentToDocument(sourceA, sourceB, documentWidth, documentHeight);
  if (!clipped) return;
  const a = clipped.a;
  const b = clipped.b;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) <= EPSILON) return;

  let column = initialCellIndex(a.x, dx, CELL_WIDTH, columns);
  let row = initialCellIndex(a.y, dy, CELL_HEIGHT, rows);
  let t = 0;

  while (t < 1 - EPSILON) {
    const boundaryX = dx > 0 ? (column + 1) * CELL_WIDTH : column * CELL_WIDTH;
    const boundaryY = dy > 0 ? (row + 1) * CELL_HEIGHT : row * CELL_HEIGHT;
    let tx = Math.abs(dx) <= EPSILON ? Number.POSITIVE_INFINITY : (boundaryX - a.x) / dx;
    let ty = Math.abs(dy) <= EPSILON ? Number.POSITIVE_INFINITY : (boundaryY - a.y) / dy;
    if (tx <= t + EPSILON) tx = Number.POSITIVE_INFINITY;
    if (ty <= t + EPSILON) ty = Number.POSITIVE_INFINITY;
    const nextT = Math.min(1, tx, ty);
    const start = pointAt(a, b, t);
    const end = pointAt(a, b, nextT);
    addPiece(grid, column, row, columns, {
      a: start,
      b: end,
      objectId: object.id,
      objectType: object.type,
    });

    if (nextT >= 1 - EPSILON) break;
    const crossX = Math.abs(tx - nextT) <= EPSILON;
    const crossY = Math.abs(ty - nextT) <= EPSILON;

    if (crossX && crossY) {
      const stepX = dx > 0 ? 1 : -1;
      const stepY = dy > 0 ? 1 : -1;
      if (normalizedAxisPrefersVertical(dx, dy)) {
        const currentPort = `${dx > 0 ? "R" : "L"}${dy > 0 ? 15 : 0}` as PortName;
        const nextPort = `${dx > 0 ? "L" : "R"}${dy > 0 ? 0 : 15}` as PortName;
        addPort(grid, column, row, columns, object.id, currentPort);
        if (column + stepX >= 0 && column + stepX < columns && row + stepY >= 0 && row + stepY < rows) {
          addPort(grid, column + stepX, row + stepY, columns, object.id, nextPort);
        }
      } else {
        const currentPort = `${dy > 0 ? "B" : "T"}${dx > 0 ? 7 : 0}` as PortName;
        const nextPort = `${dy > 0 ? "T" : "B"}${dx > 0 ? 0 : 7}` as PortName;
        addPort(grid, column, row, columns, object.id, currentPort);
        if (column + stepX >= 0 && column + stepX < columns && row + stepY >= 0 && row + stepY < rows) {
          addPort(grid, column + stepX, row + stepY, columns, object.id, nextPort);
        }
      }
      column += stepX;
      row += stepY;
    } else if (crossX) {
      const stepX = dx > 0 ? 1 : -1;
      const crossing = end;
      const localY = crossing.y - row * CELL_HEIGHT;
      const index = quantize(localY, CELL_HEIGHT - 1);
      const currentPort = `${dx > 0 ? "R" : "L"}${index}` as PortName;
      const nextPort = `${dx > 0 ? "L" : "R"}${index}` as PortName;
      addPort(grid, column, row, columns, object.id, currentPort);
      if (column + stepX >= 0 && column + stepX < columns) {
        addPort(grid, column + stepX, row, columns, object.id, nextPort);
      }
      column += stepX;
    } else if (crossY) {
      const stepY = dy > 0 ? 1 : -1;
      const crossing = end;
      const localX = crossing.x - column * CELL_WIDTH;
      const index = quantize(localX, CELL_WIDTH - 1);
      const currentPort = `${dy > 0 ? "B" : "T"}${index}` as PortName;
      const nextPort = `${dy > 0 ? "T" : "B"}${index}` as PortName;
      addPort(grid, column, row, columns, object.id, currentPort);
      if (row + stepY >= 0 && row + stepY < rows) {
        addPort(grid, column, row + stepY, columns, object.id, nextPort);
      }
      row += stepY;
    } else {
      break;
    }

    if (column < 0 || column >= columns || row < 0 || row >= rows) break;
    t = nextT;
  }
}

function pointOnGridBoundary(value: number, size: number): boolean {
  return Math.abs(value / size - Math.round(value / size)) <= EPSILON;
}

function addPathEndpoint(
  point: Point,
  adjacent: Point,
  isStart: boolean,
  object: DrawingObject,
  grid: GeometryGrid,
  columns: number,
  rows: number,
): void {
  const dxTravel = isStart ? adjacent.x - point.x : point.x - adjacent.x;
  const dyTravel = isStart ? adjacent.y - point.y : point.y - adjacent.y;
  if (!pointOnGridBoundary(point.x, CELL_WIDTH) && !pointOnGridBoundary(point.y, CELL_HEIGHT)) return;
  const directionX = isStart ? dxTravel : -dxTravel;
  const directionY = isStart ? dyTravel : -dyTravel;
  const column = initialCellIndex(point.x, directionX, CELL_WIDTH, columns);
  const row = initialCellIndex(point.y, directionY, CELL_HEIGHT, rows);
  const localX = point.x - column * CELL_WIDTH;
  const localY = point.y - row * CELL_HEIGHT;
  const onVertical = pointOnGridBoundary(point.x, CELL_WIDTH);
  const onHorizontal = pointOnGridBoundary(point.y, CELL_HEIGHT);

  let port: PortName;
  if (onVertical && onHorizontal) {
    if (normalizedAxisPrefersVertical(dxTravel, dyTravel)) {
      port = `${localX <= EPSILON ? "L" : "R"}${quantize(localY, CELL_HEIGHT - 1)}` as PortName;
    } else {
      port = `${localY <= EPSILON ? "T" : "B"}${quantize(localX, CELL_WIDTH - 1)}` as PortName;
    }
  } else if (onVertical) {
    port = `${localX <= EPSILON ? "L" : "R"}${quantize(localY, CELL_HEIGHT - 1)}` as PortName;
  } else {
    port = `${localY <= EPSILON ? "T" : "B"}${quantize(localX, CELL_WIDTH - 1)}` as PortName;
  }
  addPort(grid, column, row, columns, object.id, port);
}

export function buildGeometryGrid(objects: readonly DrawingObject[], columns: number, rows: number): GeometryGrid {
  const grid: GeometryGrid = { cells: new Map<number, CellGeometry>(), pathsByObject: new Map<string, Point[][]>() };
  for (const object of objects) {
    const paths = flattenObjectPaths(object);
    grid.pathsByObject.set(object.id, paths);
    for (const path of paths) {
      if (path.length < 2) continue;
      addPathEndpoint(path[0]!, path[1]!, true, object, grid, columns, rows);
      for (let index = 1; index < path.length; index += 1) {
        traverseSegment(path[index - 1]!, path[index]!, object, grid, columns, rows);
      }
      addPathEndpoint(path[path.length - 1]!, path[path.length - 2]!, false, object, grid, columns, rows);
    }
  }
  return grid;
}

function pointOnSegment(point: Point, segment: CenterlineSegment): boolean {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return false;
  const px = point.x - segment.a.x;
  const py = point.y - segment.a.y;
  const cross = Math.abs(dx * py - dy * px);
  if (cross > 1e-6 * Math.max(1, Math.sqrt(lengthSquared))) return false;
  const dot = px * dx + py * dy;
  return dot >= -1e-6 && dot <= lengthSquared + 1e-6;
}

function intersection(first: CenterlineSegment, second: CenterlineSegment): Point | null {
  const rx = first.b.x - first.a.x;
  const ry = first.b.y - first.a.y;
  const sx = second.b.x - second.a.x;
  const sy = second.b.y - second.a.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) <= 1e-10) return null;
  const qx = second.a.x - first.a.x;
  const qy = second.a.y - first.a.y;
  const t = (qx * sy - qy * sx) / denominator;
  const u = (qx * ry - qy * rx) / denominator;
  if (t < -1e-8 || t > 1 + 1e-8 || u < -1e-8 || u > 1 + 1e-8) return null;
  return { x: first.a.x + t * rx, y: first.a.y + t * ry };
}

export function armCountAtPoint(point: Point, segments: readonly CenterlineSegment[]): number {
  const directions: Point[] = [];
  const addDirection = (dx: number, dy: number): void => {
    const length = Math.hypot(dx, dy);
    if (length <= 1e-7) return;
    const direction = { x: dx / length, y: dy / length };
    if (directions.some((existing) => existing.x * direction.x + existing.y * direction.y > 0.999999)) return;
    directions.push(direction);
  };
  for (const segment of segments) {
    if (!pointOnSegment(point, segment)) continue;
    addDirection(segment.a.x - point.x, segment.a.y - point.y);
    addDirection(segment.b.x - point.x, segment.b.y - point.y);
  }
  return directions.length;
}

export function maxJunctionArms(segments: readonly CenterlineSegment[]): number {
  if (segments.length < 2) return 0;
  const hubs = new Map<string, Point>();
  const addHub = (point: Point): void => {
    const key = `${Math.round(point.x * 1e7)},${Math.round(point.y * 1e7)}`;
    hubs.set(key, point);
  };
  for (const segment of segments) {
    addHub(segment.a);
    addHub(segment.b);
  }
  for (let first = 0; first < segments.length; first += 1) {
    for (let second = first + 1; second < segments.length; second += 1) {
      const hit = intersection(segments[first]!, segments[second]!);
      if (hit) addHub(hit);
    }
  }
  let maximum = 0;
  for (const hub of hubs.values()) maximum = Math.max(maximum, armCountAtPoint(hub, segments));
  return maximum;
}

export function ellipseContainsPoint(object: EllipseObject, point: Point): boolean {
  if (object.radiusX <= EPSILON || object.radiusY <= EPSILON) return false;
  const cos = Math.cos(-object.rotation);
  const sin = Math.sin(-object.rotation);
  const dx = point.x - object.center.x;
  const dy = point.y - object.center.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return (localX * localX) / (object.radiusX * object.radiusX)
    + (localY * localY) / (object.radiusY * object.radiusY) <= 1 + 1e-12;
}

export interface CellFillSample {
  insideCount: number;
  insideLocalPixelCenters: Point[];
}

export function sampleEllipseCellFill(object: EllipseObject, column: number, row: number): CellFillSample {
  let insideCount = 0;
  const insideLocalPixelCenters: Point[] = [];
  const x0 = column * CELL_WIDTH;
  const y0 = row * CELL_HEIGHT;
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      const local = { x: x + 0.5, y: y + 0.5 };
      const global = { x: x0 + local.x, y: y0 + local.y };
      if (!ellipseContainsPoint(object, global)) continue;
      insideCount += 1;
      insideLocalPixelCenters.push(local);
    }
  }
  return { insideCount, insideLocalPixelCenters };
}

export function validateSharedPorts(grid: GeometryGrid, columns: number, rows: number): string[] {
  const errors: string[] = [];
  const getPorts = (column: number, row: number): Set<PortName> => grid.cells.get(cellKey(column, row, columns))?.ports ?? new Set<PortName>();
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const left = getPorts(column, row);
      const right = getPorts(column + 1, row);
      for (let index = 0; index < CELL_HEIGHT; index += 1) {
        const l = left.has(`R${index}` as PortName);
        const r = right.has(`L${index}` as PortName);
        if (l !== r) errors.push(`Vertical seam ${column},${row} R${index}/L${index} disagrees.`);
      }
    }
  }
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const top = getPorts(column, row);
      const bottom = getPorts(column, row + 1);
      for (let index = 0; index < CELL_WIDTH; index += 1) {
        const t = top.has(`B${index}` as PortName);
        const b = bottom.has(`T${index}` as PortName);
        if (t !== b) errors.push(`Horizontal seam ${column},${row} B${index}/T${index} disagrees.`);
      }
    }
  }
  return errors;
}
