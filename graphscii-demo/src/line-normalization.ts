import {
  CELL_HEIGHT,
  CELL_WIDTH,
  type GeometryGrid,
  type ObjectCellGeometry,
  type PortEdge,
  type PortName,
} from "./geometry-engine";
import type { DrawingObject, Point } from "./types";

const EPSILON = 1e-9;

export interface StrokeFitResult {
  terminalPorts: Set<string>;
}

function portEdge(port: PortName): PortEdge {
  return port[0] as PortEdge;
}

function portIndex(port: PortName): number {
  return Number.parseInt(port.slice(1), 10);
}

function oppositePort(port: PortName): PortName {
  const edge = portEdge(port);
  const index = portIndex(port);
  switch (edge) {
    case "T": return `B${index}` as PortName;
    case "B": return `T${index}` as PortName;
    case "L": return `R${index}` as PortName;
    case "R": return `L${index}` as PortName;
  }
}

function cellKey(column: number, row: number, columns: number): number {
  return row * columns + column;
}

function keyColumn(key: number, columns: number): number {
  return key % columns;
}

function keyRow(key: number, columns: number): number {
  return Math.floor(key / columns);
}

function terminalKey(key: number, port: PortName): string {
  return `${key}:${port}`;
}

function rebuildCellPorts(grid: GeometryGrid): void {
  for (const [key, cell] of [...grid.cells.entries()]) {
    cell.ports.clear();
    cell.segments = [];
    for (const objectCell of cell.byObject.values()) {
      for (const port of objectCell.ports) cell.ports.add(port);
      cell.segments.push(...objectCell.segments);
    }
    if (cell.byObject.size === 0) grid.cells.delete(key);
  }
}

function portsOnEdge(objectCell: ObjectCellGeometry | undefined, edge: PortEdge): PortName[] {
  if (!objectCell) return [];
  return [...objectCell.ports].filter((port) => portEdge(port) === edge);
}

function replaceEdgePorts(objectCell: ObjectCellGeometry | undefined, edge: PortEdge, port: PortName | null): void {
  if (!objectCell) return;
  for (const existing of [...objectCell.ports]) {
    if (portEdge(existing) === edge) objectCell.ports.delete(existing);
  }
  if (port) objectCell.ports.add(port);
}

function representativeIndex(indices: readonly number[], maximum: number): number {
  if (indices.length === 0) return 0;
  const ordered = [...indices].sort((a, b) => a - b);
  const middle = (ordered.length - 1) / 2;
  const lower = ordered[Math.floor(middle)]!;
  const upper = ordered[Math.ceil(middle)]!;
  return Math.max(0, Math.min(maximum, Math.floor((lower + upper) / 2 + 0.5)));
}

/**
 * Fit every shared edge once per authored object. If a high-resolution path
 * crosses the same seam several times inside one GraphSCII cell neighborhood,
 * all of those crossings become one deterministic representative port and the
 * identical port index is written to both neighboring cells.
 */
function coalesceSharedSeams(grid: GeometryGrid, columns: number, rows: number): void {
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const left = grid.cells.get(cellKey(column, row, columns));
      const right = grid.cells.get(cellKey(column + 1, row, columns));
      const objectIds = new Set<string>([
        ...(left?.byObject.keys() ?? []),
        ...(right?.byObject.keys() ?? []),
      ]);
      for (const objectId of objectIds) {
        const leftObject = left?.byObject.get(objectId);
        const rightObject = right?.byObject.get(objectId);
        const indices = [
          ...portsOnEdge(leftObject, "R").map(portIndex),
          ...portsOnEdge(rightObject, "L").map(portIndex),
        ];
        if (indices.length === 0) continue;
        const index = representativeIndex(indices, CELL_HEIGHT - 1);
        replaceEdgePorts(leftObject, "R", leftObject ? `R${index}` as PortName : null);
        replaceEdgePorts(rightObject, "L", rightObject ? `L${index}` as PortName : null);
      }
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const top = grid.cells.get(cellKey(column, row, columns));
      const bottom = grid.cells.get(cellKey(column, row + 1, columns));
      const objectIds = new Set<string>([
        ...(top?.byObject.keys() ?? []),
        ...(bottom?.byObject.keys() ?? []),
      ]);
      for (const objectId of objectIds) {
        const topObject = top?.byObject.get(objectId);
        const bottomObject = bottom?.byObject.get(objectId);
        const indices = [
          ...portsOnEdge(topObject, "B").map(portIndex),
          ...portsOnEdge(bottomObject, "T").map(portIndex),
        ];
        if (indices.length === 0) continue;
        const index = representativeIndex(indices, CELL_WIDTH - 1);
        replaceEdgePorts(topObject, "B", topObject ? `B${index}` as PortName : null);
        replaceEdgePorts(bottomObject, "T", bottomObject ? `T${index}` as PortName : null);
      }
    }
  }
}

function coalesceOuterEdges(grid: GeometryGrid, columns: number, rows: number): void {
  const fit = (objectCell: ObjectCellGeometry | undefined, edge: PortEdge, maximum: number): void => {
    const ports = portsOnEdge(objectCell, edge);
    if (ports.length <= 1) return;
    const index = representativeIndex(ports.map(portIndex), maximum);
    replaceEdgePorts(objectCell, edge, `${edge}${index}` as PortName);
  };

  for (let row = 0; row < rows; row += 1) {
    const left = grid.cells.get(cellKey(0, row, columns));
    const right = grid.cells.get(cellKey(columns - 1, row, columns));
    for (const objectCell of left?.byObject.values() ?? []) fit(objectCell, "L", CELL_HEIGHT - 1);
    for (const objectCell of right?.byObject.values() ?? []) fit(objectCell, "R", CELL_HEIGHT - 1);
  }
  for (let column = 0; column < columns; column += 1) {
    const top = grid.cells.get(cellKey(column, 0, columns));
    const bottom = grid.cells.get(cellKey(column, rows - 1, columns));
    for (const objectCell of top?.byObject.values() ?? []) fit(objectCell, "T", CELL_WIDTH - 1);
    for (const objectCell of bottom?.byObject.values() ?? []) fit(objectCell, "B", CELL_WIDTH - 1);
  }
}

function snapshotObjectPorts(grid: GeometryGrid, objectId: string): Map<number, Set<PortName>> {
  const snapshot = new Map<number, Set<PortName>>();
  for (const [key, cell] of grid.cells.entries()) {
    const objectCell = cell.byObject.get(objectId);
    if (objectCell) snapshot.set(key, new Set(objectCell.ports));
  }
  return snapshot;
}

function matchingTransition(
  fromKey: number,
  toKey: number,
  snapshot: ReadonlyMap<number, ReadonlySet<PortName>>,
  columns: number,
): [PortName, PortName] | null {
  const fromColumn = keyColumn(fromKey, columns);
  const fromRow = keyRow(fromKey, columns);
  const toColumn = keyColumn(toKey, columns);
  const toRow = keyRow(toKey, columns);
  const dc = toColumn - fromColumn;
  const dr = toRow - fromRow;
  const fromPorts = snapshot.get(fromKey) ?? new Set<PortName>();
  const toPorts = snapshot.get(toKey) ?? new Set<PortName>();

  let edge: PortEdge | null = null;
  if (dc === 1 && dr === 0) edge = "R";
  else if (dc === -1 && dr === 0) edge = "L";
  else if (dc === 0 && dr === 1) edge = "B";
  else if (dc === 0 && dr === -1) edge = "T";

  if (edge) {
    const candidates = [...fromPorts]
      .filter((port) => portEdge(port) === edge)
      .sort((a, b) => portIndex(a) - portIndex(b));
    for (const port of candidates) {
      const opposite = oppositePort(port);
      if (toPorts.has(opposite)) return [port, opposite];
    }
    return null;
  }

  const diagonalCandidates: Array<[PortName, PortName]> = [];
  if (dc === 1 && dr === 1) diagonalCandidates.push(["R15", "L0"], ["B7", "T0"]);
  else if (dc === 1 && dr === -1) diagonalCandidates.push(["R0", "L15"], ["T7", "B0"]);
  else if (dc === -1 && dr === 1) diagonalCandidates.push(["L15", "R0"], ["B0", "T7"]);
  else if (dc === -1 && dr === -1) diagonalCandidates.push(["L0", "R15"], ["T0", "B7"]);
  for (const pair of diagonalCandidates) {
    if (fromPorts.has(pair[0]) && toPorts.has(pair[1])) return pair;
  }
  return null;
}

function pointAt(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function clipSegmentToDocument(
  a: Point,
  b: Point,
  width: number,
  height: number,
): { a: Point; b: Point } | null {
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

function initialCellIndex(value: number, delta: number, size: number, count: number): number {
  const scaled = value / size;
  const nearest = Math.round(scaled);
  let index: number;
  if (Math.abs(scaled - nearest) <= EPSILON) index = delta < 0 ? nearest - 1 : nearest;
  else index = Math.floor(scaled);
  return Math.max(0, Math.min(count - 1, index));
}

/**
 * Produce the same ordered cell traversal as geometry-engine.ts::traverseSegment.
 * This is deliberately DDA-based instead of point sampling: exact boundary and
 * exact-corner decisions must agree with the ports already emitted by the
 * geometry engine or a later semantic lookup would be reasoning about a
 * different path.
 */
function walkSegmentCells(sourceA: Point, sourceB: Point, columns: number, rows: number): number[] {
  const clipped = clipSegmentToDocument(
    sourceA,
    sourceB,
    columns * CELL_WIDTH,
    rows * CELL_HEIGHT,
  );
  if (!clipped) return [];
  const a = clipped.a;
  const b = clipped.b;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) <= EPSILON) return [];

  let column = initialCellIndex(a.x, dx, CELL_WIDTH, columns);
  let row = initialCellIndex(a.y, dy, CELL_HEIGHT, rows);
  let t = 0;
  const cells: number[] = [cellKey(column, row, columns)];

  while (t < 1 - EPSILON) {
    const boundaryX = dx > 0 ? (column + 1) * CELL_WIDTH : column * CELL_WIDTH;
    const boundaryY = dy > 0 ? (row + 1) * CELL_HEIGHT : row * CELL_HEIGHT;
    let tx = Math.abs(dx) <= EPSILON ? Number.POSITIVE_INFINITY : (boundaryX - a.x) / dx;
    let ty = Math.abs(dy) <= EPSILON ? Number.POSITIVE_INFINITY : (boundaryY - a.y) / dy;
    if (tx <= t + EPSILON) tx = Number.POSITIVE_INFINITY;
    if (ty <= t + EPSILON) ty = Number.POSITIVE_INFINITY;
    const nextT = Math.min(1, tx, ty);
    if (nextT >= 1 - EPSILON) break;

    const crossX = Math.abs(tx - nextT) <= EPSILON;
    const crossY = Math.abs(ty - nextT) <= EPSILON;
    if (crossX) column += dx > 0 ? 1 : -1;
    if (crossY) row += dy > 0 ? 1 : -1;
    if (!crossX && !crossY) break;
    if (column < 0 || row < 0 || column >= columns || row >= rows) break;

    const key = cellKey(column, row, columns);
    if (cells[cells.length - 1] !== key) cells.push(key);
    t = nextT;
  }
  return cells;
}

function orderedCellWalk(path: readonly Point[], columns: number, rows: number): number[] {
  const walk: number[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const cells = walkSegmentCells(path[index - 1]!, path[index]!, columns, rows);
    for (const key of cells) {
      if (walk[walk.length - 1] !== key) walk.push(key);
    }
  }
  return walk;
}

function loopEraseWalk(walk: readonly number[]): number[] {
  const result: number[] = [];
  const positions = new Map<number, number>();
  for (const key of walk) {
    const existing = positions.get(key);
    if (existing === undefined) {
      positions.set(key, result.length);
      result.push(key);
      continue;
    }
    while (result.length > existing + 1) {
      const removed = result.pop()!;
      positions.delete(removed);
    }
  }
  return result;
}

function addKeptPort(kept: Map<number, Set<PortName>>, key: number, port: PortName): void {
  const ports = kept.get(key) ?? new Set<PortName>();
  ports.add(port);
  kept.set(key, ports);
}

function portList(snapshot: ReadonlyMap<number, ReadonlySet<PortName>>, key: number): string {
  return [...(snapshot.get(key) ?? [])].sort().join(",") || "none";
}

function rewriteOpenObjectWalk(
  grid: GeometryGrid,
  object: DrawingObject,
  columns: number,
  rows: number,
): void {
  if (object.type === "ellipse") return;
  const paths = grid.pathsByObject.get(object.id) ?? [];
  const snapshot = snapshotObjectPorts(grid, object.id);
  const retained = new Set<number>();
  const keptPorts = new Map<number, Set<PortName>>();

  for (const path of paths) {
    if (path.length < 2) continue;
    const walk = loopEraseWalk(orderedCellWalk(path, columns, rows));
    for (const key of walk) retained.add(key);
    for (let index = 1; index < walk.length; index += 1) {
      const fromKey = walk[index - 1]!;
      const toKey = walk[index]!;
      const transition = matchingTransition(fromKey, toKey, snapshot, columns);
      if (!transition) {
        throw new Error(
          `GraphSCII stroke fitting could not preserve ordered transition ${fromKey} `
          + `(${keyColumn(fromKey, columns)},${keyRow(fromKey, columns)}; ${portList(snapshot, fromKey)}) -> `
          + `${toKey} (${keyColumn(toKey, columns)},${keyRow(toKey, columns)}; ${portList(snapshot, toKey)}) `
          + `for ${object.id}.`,
        );
      }
      addKeptPort(keptPorts, fromKey, transition[0]);
      addKeptPort(keptPorts, toKey, transition[1]);
    }
  }

  for (const [key, cell] of [...grid.cells.entries()]) {
    const objectCell = cell.byObject.get(object.id);
    if (!objectCell) continue;
    if (!retained.has(key)) {
      cell.byObject.delete(object.id);
      continue;
    }
    objectCell.ports = new Set(keptPorts.get(key) ?? []);
  }
  rebuildCellPorts(grid);
}

function rewriteOpenStrokeWalks(
  grid: GeometryGrid,
  objects: readonly DrawingObject[],
  columns: number,
  rows: number,
): void {
  for (const object of objects) rewriteOpenObjectWalk(grid, object, columns, rows);
}

interface RayHit {
  edge: PortEdge;
  index: number;
  distance: number;
}

function endpointCell(point: Point, columns: number, rows: number): { column: number; row: number } {
  const width = columns * CELL_WIDTH;
  const height = rows * CELL_HEIGHT;
  const x = Math.max(0, Math.min(width - EPSILON, point.x));
  const y = Math.max(0, Math.min(height - EPSILON, point.y));
  return {
    column: Math.max(0, Math.min(columns - 1, Math.floor(x / CELL_WIDTH))),
    row: Math.max(0, Math.min(rows - 1, Math.floor(y / CELL_HEIGHT))),
  };
}

function endpointRayHits(point: Point, adjacent: Point, column: number, row: number): RayHit[] {
  const dx = point.x - adjacent.x;
  const dy = point.y - adjacent.y;
  if (Math.hypot(dx, dy) <= EPSILON) return [];
  const x0 = column * CELL_WIDTH;
  const x1 = x0 + CELL_WIDTH;
  const y0 = row * CELL_HEIGHT;
  const y1 = y0 + CELL_HEIGHT;
  const hits: RayHit[] = [];

  const addVertical = (edge: "L" | "R", x: number): void => {
    if (Math.abs(dx) <= EPSILON) return;
    const t = (x - point.x) / dx;
    if (t < -EPSILON) return;
    const y = point.y + t * dy;
    if (y < y0 - EPSILON || y > y1 + EPSILON) return;
    hits.push({
      edge,
      index: Math.max(0, Math.min(CELL_HEIGHT - 1, Math.floor(y - y0 + 0.5))),
      distance: Math.max(0, t) * Math.hypot(dx, dy),
    });
  };
  const addHorizontal = (edge: "T" | "B", y: number): void => {
    if (Math.abs(dy) <= EPSILON) return;
    const t = (y - point.y) / dy;
    if (t < -EPSILON) return;
    const x = point.x + t * dx;
    if (x < x0 - EPSILON || x > x1 + EPSILON) return;
    hits.push({
      edge,
      index: Math.max(0, Math.min(CELL_WIDTH - 1, Math.floor(x - x0 + 0.5))),
      distance: Math.max(0, t) * Math.hypot(dx, dy),
    });
  };

  addVertical("L", x0);
  addVertical("R", x1);
  addHorizontal("T", y0);
  addHorizontal("B", y1);
  return hits.sort((a, b) => a.distance - b.distance || a.edge.localeCompare(b.edge) || a.index - b.index);
}

function addTerminalPort(
  grid: GeometryGrid,
  objectId: string,
  point: Point,
  adjacent: Point,
  columns: number,
  rows: number,
  terminalPorts: Set<string>,
): void {
  const { column, row } = endpointCell(point, columns, rows);
  const key = cellKey(column, row, columns);
  const cell = grid.cells.get(key);
  const objectCell = cell?.byObject.get(objectId);
  if (!cell || !objectCell || objectCell.ports.size >= 2) return;

  const existingEdges = new Set([...objectCell.ports].map(portEdge));
  const hits = endpointRayHits(point, adjacent, column, row);
  const preferred = hits.find((hit) => !existingEdges.has(hit.edge)) ?? hits[0];
  if (!preferred) return;
  const port = `${preferred.edge}${preferred.index}` as PortName;
  objectCell.ports.add(port);
  terminalPorts.add(terminalKey(key, port));
}

function addEndpointCaps(
  grid: GeometryGrid,
  objects: readonly DrawingObject[],
  columns: number,
  rows: number,
  terminalPorts: Set<string>,
): void {
  for (const object of objects) {
    if (object.type === "ellipse") continue;
    const paths = grid.pathsByObject.get(object.id) ?? [];
    for (const path of paths) {
      if (path.length < 2) continue;
      addTerminalPort(grid, object.id, path[0]!, path[1]!, columns, rows, terminalPorts);
      addTerminalPort(grid, object.id, path[path.length - 1]!, path[path.length - 2]!, columns, rows, terminalPorts);
    }
  }
}

/**
 * Fit authored stroke geometry before any glyph is chosen. Shared crossings are
 * coalesced, then every open path is converted through the same direction-aware
 * DDA cell traversal used by the geometry engine and loop-erased at character
 * resolution. This is the only approximation stage for ordinary strokes.
 */
export function fitStrokeGeometry(
  grid: GeometryGrid,
  objects: readonly DrawingObject[],
  columns: number,
  rows: number,
): StrokeFitResult {
  coalesceSharedSeams(grid, columns, rows);
  coalesceOuterEdges(grid, columns, rows);
  rebuildCellPorts(grid);
  rewriteOpenStrokeWalks(grid, objects, columns, rows);
  rebuildCellPorts(grid);

  const terminalPorts = new Set<string>();
  addEndpointCaps(grid, objects, columns, rows, terminalPorts);
  rebuildCellPorts(grid);
  return { terminalPorts };
}

export function validateFittedSharedPorts(
  grid: GeometryGrid,
  columns: number,
  rows: number,
  terminalPorts: ReadonlySet<string>,
): string[] {
  const errors: string[] = [];
  const getPorts = (column: number, row: number): Set<PortName> =>
    grid.cells.get(cellKey(column, row, columns))?.ports ?? new Set<PortName>();

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const leftKey = cellKey(column, row, columns);
      const rightKey = cellKey(column + 1, row, columns);
      const left = getPorts(column, row);
      const right = getPorts(column + 1, row);
      for (let index = 0; index < CELL_HEIGHT; index += 1) {
        const leftPort = `R${index}` as PortName;
        const rightPort = `L${index}` as PortName;
        const l = left.has(leftPort);
        const r = right.has(rightPort);
        if (l === r) continue;
        const terminal = l
          ? terminalPorts.has(terminalKey(leftKey, leftPort))
          : terminalPorts.has(terminalKey(rightKey, rightPort));
        if (!terminal) errors.push(`Vertical seam ${column},${row} R${index}/L${index} disagrees.`);
      }
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const topKey = cellKey(column, row, columns);
      const bottomKey = cellKey(column, row + 1, columns);
      const top = getPorts(column, row);
      const bottom = getPorts(column, row + 1);
      for (let index = 0; index < CELL_WIDTH; index += 1) {
        const topPort = `B${index}` as PortName;
        const bottomPort = `T${index}` as PortName;
        const t = top.has(topPort);
        const b = bottom.has(bottomPort);
        if (t === b) continue;
        const terminal = t
          ? terminalPorts.has(terminalKey(topKey, topPort))
          : terminalPorts.has(terminalKey(bottomKey, bottomPort));
        if (!terminal) errors.push(`Horizontal seam ${column},${row} B${index}/T${index} disagrees.`);
      }
    }
  }
  return errors;
}

export function normalizeStraightBacktracks(
  grid: GeometryGrid,
  objects: readonly DrawingObject[],
  columns: number,
  rows: number,
): void {
  fitStrokeGeometry(grid, objects, columns, rows);
}
