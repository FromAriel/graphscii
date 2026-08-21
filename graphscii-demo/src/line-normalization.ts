import {
  CELL_HEIGHT,
  CELL_WIDTH,
  portPoint,
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

function neighborForEdge(column: number, row: number, edge: PortEdge): { column: number; row: number } {
  switch (edge) {
    case "T": return { column, row: row - 1 };
    case "B": return { column, row: row + 1 };
    case "L": return { column: column - 1, row };
    case "R": return { column: column + 1, row };
  }
}

function cellKey(column: number, row: number, columns: number): number {
  return row * columns + column;
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
 * Every physical shared seam gets at most one fitted crossing per authored object.
 * Multiple nearby passes are merged before semantic lookup, and the identical
 * fitted index is written to both adjacent cells. Glyph selection never repairs
 * or re-rounds this decision later.
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

function endpointRayHits(
  point: Point,
  adjacent: Point,
  column: number,
  row: number,
): RayHit[] {
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
  if (!cell || !objectCell) return;

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
  const objectsById = new Map(objects.map((object) => [object.id, object]));
  for (const [objectId, paths] of grid.pathsByObject.entries()) {
    const object = objectsById.get(objectId);
    if (!object) continue;
    if (object.type === "ellipse") continue;
    for (const path of paths) {
      if (path.length < 2) continue;
      addTerminalPort(grid, objectId, path[0]!, path[1]!, columns, rows, terminalPorts);
      addTerminalPort(grid, objectId, path[path.length - 1]!, path[path.length - 2]!, columns, rows, terminalPorts);
    }
  }
}

function removeMatchingNeighborPort(
  grid: GeometryGrid,
  objectId: string,
  column: number,
  row: number,
  port: PortName,
  columns: number,
  rows: number,
): void {
  const neighbor = neighborForEdge(column, row, portEdge(port));
  if (neighbor.column < 0 || neighbor.row < 0 || neighbor.column >= columns || neighbor.row >= rows) return;
  const neighborCell = grid.cells.get(cellKey(neighbor.column, neighbor.row, columns));
  neighborCell?.byObject.get(objectId)?.ports.delete(oppositePort(port));
}

function squaredDistanceToLine(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const denominator = dx * dx + dy * dy;
  if (denominator <= EPSILON) return Number.POSITIVE_INFINITY;
  const cross = dx * (a.y - point.y) - (a.x - point.x) * dy;
  return (cross * cross) / denominator;
}

function pairFitScore(
  first: PortName,
  second: PortName,
  objectCell: ObjectCellGeometry,
  column: number,
  row: number,
): number {
  const a = portPoint(first);
  const b = portPoint(second);
  let score = 0;
  let sampleCount = 0;
  for (const segment of objectCell.segments) {
    const samples = [
      segment.a,
      { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 },
      segment.b,
    ];
    for (const sample of samples) {
      const local = {
        x: sample.x - column * CELL_WIDTH,
        y: sample.y - row * CELL_HEIGHT,
      };
      score += squaredDistanceToLine(local, a, b);
      sampleCount += 1;
    }
  }
  return sampleCount > 0 ? score / sampleCount : Number.POSITIVE_INFINITY;
}

function fitSingleObjectMultiPortCells(
  grid: GeometryGrid,
  objects: readonly DrawingObject[],
  columns: number,
  rows: number,
  terminalPorts: ReadonlySet<string>,
): boolean {
  const objectsById = new Map(objects.map((object) => [object.id, object]));
  let changed = false;

  for (const [key, cell] of [...grid.cells.entries()]) {
    if (cell.byObject.size !== 1) continue;
    const column = key % columns;
    const row = Math.floor(key / columns);
    const [entry] = [...cell.byObject.entries()];
    if (!entry) continue;
    const [objectId, objectCell] = entry;
    const object = objectsById.get(objectId);
    if (!object || (object.type === "ellipse" && object.fillEnabled)) continue;

    const ports = [...objectCell.ports];
    if (ports.length <= 2) continue;
    const required = ports.filter((port) => terminalPorts.has(terminalKey(key, port)));
    let best: { first: PortName; second: PortName; score: number; key: string } | null = null;

    for (let firstIndex = 0; firstIndex < ports.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < ports.length; secondIndex += 1) {
        const first = ports[firstIndex]!;
        const second = ports[secondIndex]!;
        if (portEdge(first) === portEdge(second)) continue;
        if (required.some((port) => port !== first && port !== second)) continue;
        const pairKey = [first, second].sort().join(">");
        const score = pairFitScore(first, second, objectCell, column, row);
        if (!best || score < best.score - 1e-12 || (Math.abs(score - best.score) <= 1e-12 && pairKey < best.key)) {
          best = { first, second, score, key: pairKey };
        }
      }
    }

    if (!best) continue;
    const keep = new Set<PortName>([best.first, best.second]);
    for (const port of [...objectCell.ports]) {
      if (keep.has(port)) continue;
      removeMatchingNeighborPort(grid, objectId, column, row, port, columns, rows);
      objectCell.ports.delete(port);
      changed = true;
    }
  }

  return changed;
}

function pruneNonterminalSpurs(
  grid: GeometryGrid,
  objects: readonly DrawingObject[],
  columns: number,
  rows: number,
  terminalPorts: Set<string>,
): boolean {
  const objectsById = new Map(objects.map((object) => [object.id, object]));
  let changedAny = false;
  const maximumPasses = Math.max(1, columns * rows * 2);

  for (let pass = 0; pass < maximumPasses; pass += 1) {
    let changed = false;
    for (const [key, cell] of [...grid.cells.entries()]) {
      if (cell.byObject.size !== 1) continue;
      const column = key % columns;
      const row = Math.floor(key / columns);
      for (const [objectId, objectCell] of [...cell.byObject.entries()]) {
        const object = objectsById.get(objectId);
        if (!object || (object.type === "ellipse" && object.fillEnabled)) continue;
        if (objectCell.ports.size !== 1) continue;
        const port = [...objectCell.ports][0]!;
        if (terminalPorts.has(terminalKey(key, port))) continue;

        removeMatchingNeighborPort(grid, objectId, column, row, port, columns, rows);
        cell.byObject.delete(objectId);
        changed = true;
        changedAny = true;
      }
    }
    if (!changed) break;
    rebuildCellPorts(grid);
  }
  return changedAny;
}

/**
 * Fit authored centerlines to GraphSCII's one-port-per-edge cell language before
 * any glyph is chosen. This is the only approximation stage for stroke geometry:
 * crossings are merged as shared seam facts, endpoint caps are projected along
 * the authored tangent, single-object revisits are fitted to one straight cell
 * traversal, and nonterminal one-port spurs are removed.
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

  const terminalPorts = new Set<string>();
  addEndpointCaps(grid, objects, columns, rows, terminalPorts);
  rebuildCellPorts(grid);

  const maximumPasses = Math.max(1, columns * rows * 2);
  for (let pass = 0; pass < maximumPasses; pass += 1) {
    const fitChanged = fitSingleObjectMultiPortCells(grid, objects, columns, rows, terminalPorts);
    rebuildCellPorts(grid);
    const pruneChanged = pruneNonterminalSpurs(grid, objects, columns, rows, terminalPorts);
    rebuildCellPorts(grid);
    if (!fitChanged && !pruneChanged) break;
  }

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

// Kept as a compatibility alias for older callers; the implementation is the
// complete pre-semantic stroke fitter above, not the removed backtrack patch.
export function normalizeStraightBacktracks(
  grid: GeometryGrid,
  objects: readonly DrawingObject[],
  columns: number,
  rows: number,
): void {
  fitStrokeGeometry(grid, objects, columns, rows);
}
