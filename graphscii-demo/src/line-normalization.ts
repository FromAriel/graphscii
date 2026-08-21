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

interface CellTransition {
  fromKey: number;
  toKey: number;
  fromPort: PortName;
  toPort: PortName;
}

interface CellWalk {
  nodes: number[];
  edges: CellTransition[];
}

interface TerminalHint {
  objectId: string;
  key: number;
  point?: Point;
  adjacent?: Point;
  port?: PortName;
}

function portEdge(port: PortName): PortEdge {
  return port[0] as PortEdge;
}

function portIndex(port: PortName): number {
  return Number.parseInt(port.slice(1), 10);
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
 * Coalesce raw shared-edge observations before fitted open strokes replace their
 * own ports. This remains authoritative for geometry that is not rewritten as
 * an open stroke (notably ellipse boundaries/fills).
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

function quantize(value: number, maximum: number): number {
  return Math.max(0, Math.min(maximum, Math.floor(value + 0.5)));
}

function normalizedAxisPrefersVertical(dx: number, dy: number): boolean {
  return Math.abs(dx) * CELL_HEIGHT >= Math.abs(dy) * CELL_WIDTH;
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

function transitionAtCrossing(
  column: number,
  row: number,
  dx: number,
  dy: number,
  crossing: Point,
  crossX: boolean,
  crossY: boolean,
  columns: number,
  rows: number,
): CellTransition | null {
  const fromKey = cellKey(column, row, columns);
  let nextColumn = column;
  let nextRow = row;
  let fromPort: PortName;
  let toPort: PortName;

  if (crossX && crossY) {
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    if (normalizedAxisPrefersVertical(dx, dy)) {
      fromPort = `${dx > 0 ? "R" : "L"}${dy > 0 ? 15 : 0}` as PortName;
      toPort = `${dx > 0 ? "L" : "R"}${dy > 0 ? 0 : 15}` as PortName;
    } else {
      fromPort = `${dy > 0 ? "B" : "T"}${dx > 0 ? 7 : 0}` as PortName;
      toPort = `${dy > 0 ? "T" : "B"}${dx > 0 ? 0 : 7}` as PortName;
    }
    nextColumn += stepX;
    nextRow += stepY;
  } else if (crossX) {
    const stepX = dx > 0 ? 1 : -1;
    const localY = crossing.y - row * CELL_HEIGHT;
    const index = quantize(localY, CELL_HEIGHT - 1);
    fromPort = `${dx > 0 ? "R" : "L"}${index}` as PortName;
    toPort = `${dx > 0 ? "L" : "R"}${index}` as PortName;
    nextColumn += stepX;
  } else if (crossY) {
    const stepY = dy > 0 ? 1 : -1;
    const localX = crossing.x - column * CELL_WIDTH;
    const index = quantize(localX, CELL_WIDTH - 1);
    fromPort = `${dy > 0 ? "B" : "T"}${index}` as PortName;
    toPort = `${dy > 0 ? "T" : "B"}${index}` as PortName;
    nextRow += stepY;
  } else {
    return null;
  }

  if (nextColumn < 0 || nextRow < 0 || nextColumn >= columns || nextRow >= rows) return null;
  return {
    fromKey,
    toKey: cellKey(nextColumn, nextRow, columns),
    fromPort,
    toPort,
  };
}

/**
 * Traverse one flattened segment using the same boundary timing, quantization,
 * and exact-corner policy as geometry-engine.ts::traverseSegment, while also
 * retaining the actual port pair for every cell transition.
 */
function walkSegmentCells(sourceA: Point, sourceB: Point, columns: number, rows: number): CellWalk {
  const clipped = clipSegmentToDocument(
    sourceA,
    sourceB,
    columns * CELL_WIDTH,
    rows * CELL_HEIGHT,
  );
  if (!clipped) return { nodes: [], edges: [] };
  const a = clipped.a;
  const b = clipped.b;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) <= EPSILON) return { nodes: [], edges: [] };

  let column = initialCellIndex(a.x, dx, CELL_WIDTH, columns);
  let row = initialCellIndex(a.y, dy, CELL_HEIGHT, rows);
  let t = 0;
  const walk: CellWalk = {
    nodes: [cellKey(column, row, columns)],
    edges: [],
  };

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
    const crossing = pointAt(a, b, nextT);
    const transition = transitionAtCrossing(
      column,
      row,
      dx,
      dy,
      crossing,
      crossX,
      crossY,
      columns,
      rows,
    );
    if (!transition) break;

    walk.edges.push(transition);
    walk.nodes.push(transition.toKey);
    column = keyColumn(transition.toKey, columns);
    row = keyRow(transition.toKey, columns);
    t = nextT;
  }
  return walk;
}

/**
 * A flattened-polyline vertex can itself lie exactly on a grid seam. In that
 * case the preceding segment ends at the seam and the next segment begins there,
 * so neither per-segment traversal owns the crossing. Bridge that one vertex as
 * a first-class transition instead of dropping it.
 */
function transitionAtVertex(
  fromKey: number,
  toKey: number,
  vertex: Point,
  previous: Point,
  next: Point,
  columns: number,
): CellTransition | null {
  const fromColumn = keyColumn(fromKey, columns);
  const fromRow = keyRow(fromKey, columns);
  const toColumn = keyColumn(toKey, columns);
  const toRow = keyRow(toKey, columns);
  const dc = toColumn - fromColumn;
  const dr = toRow - fromRow;

  if (dc === 1 && dr === 0) {
    const index = quantize(vertex.y - fromRow * CELL_HEIGHT, CELL_HEIGHT - 1);
    return { fromKey, toKey, fromPort: `R${index}`, toPort: `L${index}` };
  }
  if (dc === -1 && dr === 0) {
    const index = quantize(vertex.y - fromRow * CELL_HEIGHT, CELL_HEIGHT - 1);
    return { fromKey, toKey, fromPort: `L${index}`, toPort: `R${index}` };
  }
  if (dc === 0 && dr === 1) {
    const index = quantize(vertex.x - fromColumn * CELL_WIDTH, CELL_WIDTH - 1);
    return { fromKey, toKey, fromPort: `B${index}`, toPort: `T${index}` };
  }
  if (dc === 0 && dr === -1) {
    const index = quantize(vertex.x - fromColumn * CELL_WIDTH, CELL_WIDTH - 1);
    return { fromKey, toKey, fromPort: `T${index}`, toPort: `B${index}` };
  }

  if (Math.abs(dc) === 1 && Math.abs(dr) === 1) {
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    if (normalizedAxisPrefersVertical(dx, dy)) {
      const fromPort = `${dc > 0 ? "R" : "L"}${dr > 0 ? 15 : 0}` as PortName;
      const toPort = `${dc > 0 ? "L" : "R"}${dr > 0 ? 0 : 15}` as PortName;
      return { fromKey, toKey, fromPort, toPort };
    }
    const fromPort = `${dr > 0 ? "B" : "T"}${dc > 0 ? 7 : 0}` as PortName;
    const toPort = `${dr > 0 ? "T" : "B"}${dc > 0 ? 0 : 7}` as PortName;
    return { fromKey, toKey, fromPort, toPort };
  }
  return null;
}

function orderedCellWalk(path: readonly Point[], columns: number, rows: number): CellWalk {
  const result: CellWalk = { nodes: [], edges: [] };
  for (let index = 1; index < path.length; index += 1) {
    const segment = walkSegmentCells(path[index - 1]!, path[index]!, columns, rows);
    if (segment.nodes.length === 0) continue;

    if (result.nodes.length === 0) {
      result.nodes.push(...segment.nodes);
      result.edges.push(...segment.edges);
      continue;
    }

    const priorKey = result.nodes[result.nodes.length - 1]!;
    const segmentKey = segment.nodes[0]!;
    if (priorKey !== segmentKey) {
      const previous = path[Math.max(0, index - 2)]!;
      const vertex = path[index - 1]!;
      const next = path[index]!;
      const bridge = transitionAtVertex(priorKey, segmentKey, vertex, previous, next, columns);
      if (!bridge) {
        throw new Error(`GraphSCII DDA could not bridge flattened vertex ${priorKey} -> ${segmentKey}.`);
      }
      result.edges.push(bridge);
      result.nodes.push(segmentKey);
    }

    for (const edge of segment.edges) {
      if (result.nodes[result.nodes.length - 1] !== edge.fromKey) {
        throw new Error(`GraphSCII DDA transition order diverged at ${edge.fromKey} -> ${edge.toKey}.`);
      }
      result.edges.push(edge);
      result.nodes.push(edge.toKey);
    }
  }
  return result;
}

function addKeptPort(kept: Map<number, Set<PortName>>, key: number, port: PortName): void {
  const ports = kept.get(key) ?? new Set<PortName>();
  ports.add(port);
  kept.set(key, ports);
}

/**
 * Preserve every cell on its first authored visit. A revisited cell is a branch
 * decision at character resolution, not permission to erase the loop or emit a
 * connector for one authored stroke. Consecutive first-visit cells remain
 * connected; transitions into already-owned cells terminate the current
 * straight fragment at that boundary, and transitions back out start a new
 * fragment on the newly visited side.
 */
function rewriteOpenObjectWalk(
  grid: GeometryGrid,
  object: DrawingObject,
  columns: number,
  rows: number,
): TerminalHint[] {
  if (object.type === "ellipse") return [];
  const paths = grid.pathsByObject.get(object.id) ?? [];
  const retained = new Set<number>();
  const keptPorts = new Map<number, Set<PortName>>();
  const terminals: TerminalHint[] = [];

  for (const path of paths) {
    if (path.length < 2) continue;
    const walk = orderedCellWalk(path, columns, rows);
    if (walk.nodes.length === 0) continue;

    let currentKey = walk.nodes[0]!;
    let active = !retained.has(currentKey);
    if (active) {
      retained.add(currentKey);
      terminals.push({ objectId: object.id, key: currentKey, point: path[0]!, adjacent: path[1]! });
    }

    for (const edge of walk.edges) {
      if (edge.fromKey !== currentKey) {
        throw new Error(`GraphSCII first-visit cover expected ${currentKey} but transition starts at ${edge.fromKey}.`);
      }

      const destinationIsNew = !retained.has(edge.toKey);
      if (active && destinationIsNew) {
        addKeptPort(keptPorts, edge.fromKey, edge.fromPort);
        addKeptPort(keptPorts, edge.toKey, edge.toPort);
        retained.add(edge.toKey);
        active = true;
      } else if (active) {
        terminals.push({ objectId: object.id, key: edge.fromKey, port: edge.fromPort });
        active = false;
      } else if (destinationIsNew) {
        retained.add(edge.toKey);
        terminals.push({ objectId: object.id, key: edge.toKey, port: edge.toPort });
        active = true;
      }
      currentKey = edge.toKey;
    }

    if (active) {
      terminals.push({
        objectId: object.id,
        key: currentKey,
        point: path[path.length - 1]!,
        adjacent: path[path.length - 2]!,
      });
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
  return terminals;
}

function rewriteOpenStrokeWalks(
  grid: GeometryGrid,
  objects: readonly DrawingObject[],
  columns: number,
  rows: number,
): TerminalHint[] {
  const terminals: TerminalHint[] = [];
  for (const object of objects) terminals.push(...rewriteOpenObjectWalk(grid, object, columns, rows));
  return terminals;
}

interface RayHit {
  edge: PortEdge;
  index: number;
  distance: number;
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
      index: quantize(y - y0, CELL_HEIGHT - 1),
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
      index: quantize(x - x0, CELL_WIDTH - 1),
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
  hint: TerminalHint,
  columns: number,
  terminalPorts: Set<string>,
): void {
  const cell = grid.cells.get(hint.key);
  const objectCell = cell?.byObject.get(hint.objectId);
  if (!cell || !objectCell || objectCell.ports.size >= 2) return;

  if (hint.port) {
    if (!objectCell.ports.has(hint.port)) {
      objectCell.ports.add(hint.port);
      terminalPorts.add(terminalKey(hint.key, hint.port));
    }
    return;
  }
  if (!hint.point || !hint.adjacent) return;

  const column = keyColumn(hint.key, columns);
  const row = keyRow(hint.key, columns);
  const existingEdges = new Set([...objectCell.ports].map(portEdge));
  const hits = endpointRayHits(hint.point, hint.adjacent, column, row);
  const preferred = hits.find((hit) => !existingEdges.has(hit.edge)) ?? hits[0];
  if (!preferred) return;
  const port = `${preferred.edge}${preferred.index}` as PortName;
  if (objectCell.ports.has(port)) return;
  objectCell.ports.add(port);
  terminalPorts.add(terminalKey(hint.key, port));
}

function addEndpointCaps(
  grid: GeometryGrid,
  terminals: readonly TerminalHint[],
  columns: number,
  terminalPorts: Set<string>,
): void {
  for (const hint of terminals) addTerminalPort(grid, hint, columns, terminalPorts);
}

function assertOpenStrokeDegreeTwo(grid: GeometryGrid, objects: readonly DrawingObject[]): void {
  const openObjectIds = new Set(objects.filter((object) => object.type !== "ellipse").map((object) => object.id));
  for (const [key, cell] of grid.cells.entries()) {
    for (const [objectId, objectCell] of cell.byObject.entries()) {
      if (!openObjectIds.has(objectId)) continue;
      if (objectCell.ports.size !== 2) {
        throw new Error(
          `GraphSCII fitted open stroke ${objectId} has ${objectCell.ports.size} boundary ports in cell ${key}: `
          + `${[...objectCell.ports].sort().join(",") || "none"}.`,
        );
      }
    }
  }
}

/**
 * Fit authored stroke geometry before any glyph is chosen. Open paths carry
 * exact DDA crossing ports through a deterministic first-visit fragment cover,
 * including seam crossings that occur exactly at flattened-polyline vertices.
 * Revisited cells split straight fragments instead of erasing authored loops or
 * authorizing connectors. Only after fitted topology exists may the solver ask
 * the published GraphSCII tables for a glyph.
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
  const terminals = rewriteOpenStrokeWalks(grid, objects, columns, rows);
  rebuildCellPorts(grid);

  const terminalPorts = new Set<string>();
  addEndpointCaps(grid, terminals, columns, terminalPorts);
  rebuildCellPorts(grid);
  assertOpenStrokeDegreeTwo(grid, objects);
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
