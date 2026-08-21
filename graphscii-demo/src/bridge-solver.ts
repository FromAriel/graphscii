import { GlyphRegistry, popcountByte } from "./registry";
import { GraphSolver } from "./solver";
import type { BoundaryPoint } from "./registry";
import type { CellRect, DrawingObject, GraphGlyph, Point } from "./types";

const CELL_WIDTH = 8;
const CELL_HEIGHT = 16;
const EPSILON = 1e-7;
const CORNER_EPSILON = 1e-5;

interface CenterlineSegment {
  a: Point;
  b: Point;
}

export interface BridgeHint {
  cellKey: number;
  point: BoundaryPoint;
}

function appendSegment(segments: CenterlineSegment[], a: Point, b: Point): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx * dx + dy * dy <= 1e-12) return;
  segments.push({ a: { ...a }, b: { ...b } });
}

function sampleQuadratic(
  segments: CenterlineSegment[],
  p0: Point,
  p1: Point,
  p2: Point,
  steps = 8,
): void {
  let previous = p0;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    const next = {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
    appendSegment(segments, previous, next);
    previous = next;
  }
}

function sampleCubic(
  segments: CenterlineSegment[],
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  steps = 24,
): void {
  let previous = p0;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    const next = {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
    appendSegment(segments, previous, next);
    previous = next;
  }
}

function centerlineSegmentsForObject(object: DrawingObject): CenterlineSegment[] {
  const segments: CenterlineSegment[] = [];
  switch (object.type) {
    case "line":
      appendSegment(segments, object.start, object.end);
      return segments;
    case "freehand": {
      const points = object.points;
      if (points.length < 2) return segments;
      if (points.length === 2) {
        appendSegment(segments, points[0]!, points[1]!);
        return segments;
      }
      let current = points[0]!;
      for (let index = 1; index < points.length - 1; index += 1) {
        const control = points[index]!;
        const next = points[index + 1]!;
        const end = { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 };
        sampleQuadratic(segments, current, control, end);
        current = end;
      }
      const beforeLast = points[points.length - 2]!;
      const last = points[points.length - 1]!;
      sampleQuadratic(segments, current, beforeLast, last);
      return segments;
    }
    case "bezier":
      sampleCubic(segments, object.p0, object.p1, object.p2, object.p3);
      return segments;
    case "ellipse": {
      if (object.strokeWidth <= 0) return segments;
      const steps = 64;
      const cosRotation = Math.cos(object.rotation);
      const sinRotation = Math.sin(object.rotation);
      const pointAt = (angle: number): Point => {
        const localX = object.radiusX * Math.cos(angle);
        const localY = object.radiusY * Math.sin(angle);
        return {
          x: object.center.x + localX * cosRotation - localY * sinRotation,
          y: object.center.y + localX * sinRotation + localY * cosRotation,
        };
      };
      let previous = pointAt(0);
      for (let step = 1; step <= steps; step += 1) {
        const next = pointAt((step / steps) * Math.PI * 2);
        appendSegment(segments, previous, next);
        previous = next;
      }
      return segments;
    }
  }
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function nearGridBoundary(value: number, cellSize: number): boolean {
  const quotient = value / cellSize;
  return Math.abs(quotient - Math.round(quotient)) <= CORNER_EPSILON;
}

function addHint(
  map: Map<number, Map<string, BoundaryPoint>>,
  cellKey: number,
  point: BoundaryPoint,
): void {
  const points = map.get(cellKey) ?? new Map<string, BoundaryPoint>();
  points.set(`${point.x},${point.y}`, point);
  map.set(cellKey, points);
}

/**
 * Convert continuous centerline crossings into canonical shared GraphSCII ports.
 *
 * A vertical grid crossing is calculated once and emitted as Rn on the left cell
 * and Ln on the right cell, using the same n. A horizontal crossing is likewise
 * emitted as Bn/Tn with one shared n. This is the bridge invariant that prevents
 * independently rasterized neighboring cells from rounding the same line crossing
 * to different ports.
 */
export function addSegmentBridgeHints(
  map: Map<number, Map<string, BoundaryPoint>>,
  segment: CenterlineSegment,
  columns: number,
  rows: number,
): void {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;

  if (Math.abs(dx) > EPSILON) {
    const minX = Math.min(segment.a.x, segment.b.x);
    const maxX = Math.max(segment.a.x, segment.b.x);
    const firstBoundary = Math.ceil((minX - EPSILON) / CELL_WIDTH);
    const lastBoundary = Math.floor((maxX + EPSILON) / CELL_WIDTH);
    for (let boundaryColumn = firstBoundary; boundaryColumn <= lastBoundary; boundaryColumn += 1) {
      if (boundaryColumn <= 0 || boundaryColumn >= columns) continue;
      const x = boundaryColumn * CELL_WIDTH;
      const t = (x - segment.a.x) / dx;
      if (t < -EPSILON || t > 1 + EPSILON) continue;
      const y = segment.a.y + t * dy;
      if (y < 0 || y >= rows * CELL_HEIGHT) continue;
      // Exact grid corners are deliberately left to the base topology solver;
      // a corner belongs to four cells and has no unique two-cell bridge owner.
      if (nearGridBoundary(y, CELL_HEIGHT)) continue;
      const row = Math.floor(y / CELL_HEIGHT);
      const portY = clampInteger(y - row * CELL_HEIGHT, 0, CELL_HEIGHT - 1);
      const leftKey = row * columns + boundaryColumn - 1;
      const rightKey = row * columns + boundaryColumn;
      addHint(map, leftKey, { x: CELL_WIDTH - 1, y: portY });
      addHint(map, rightKey, { x: 0, y: portY });
    }
  }

  if (Math.abs(dy) > EPSILON) {
    const minY = Math.min(segment.a.y, segment.b.y);
    const maxY = Math.max(segment.a.y, segment.b.y);
    const firstBoundary = Math.ceil((minY - EPSILON) / CELL_HEIGHT);
    const lastBoundary = Math.floor((maxY + EPSILON) / CELL_HEIGHT);
    for (let boundaryRow = firstBoundary; boundaryRow <= lastBoundary; boundaryRow += 1) {
      if (boundaryRow <= 0 || boundaryRow >= rows) continue;
      const y = boundaryRow * CELL_HEIGHT;
      const t = (y - segment.a.y) / dy;
      if (t < -EPSILON || t > 1 + EPSILON) continue;
      const x = segment.a.x + t * dx;
      if (x < 0 || x >= columns * CELL_WIDTH) continue;
      if (nearGridBoundary(x, CELL_WIDTH)) continue;
      const column = Math.floor(x / CELL_WIDTH);
      const portX = clampInteger(x - column * CELL_WIDTH, 0, CELL_WIDTH - 1);
      const topKey = (boundaryRow - 1) * columns + column;
      const bottomKey = boundaryRow * columns + column;
      addHint(map, topKey, { x: portX, y: CELL_HEIGHT - 1 });
      addHint(map, bottomKey, { x: portX, y: 0 });
    }
  }
}

export function buildBridgeHints(
  objects: DrawingObject[],
  columns: number,
  rows: number,
): Map<number, BoundaryPoint[]> {
  const raw = new Map<number, Map<string, BoundaryPoint>>();
  for (const object of objects) {
    for (const segment of centerlineSegmentsForObject(object)) {
      addSegmentBridgeHints(raw, segment, columns, rows);
    }
  }
  return new Map(
    [...raw.entries()].map(([key, points]) => [
      key,
      [...points.values()].sort((a, b) => a.y - b.y || a.x - b.x),
    ]),
  );
}

function bitmapDistance(first: GraphGlyph, second: GraphGlyph): number {
  let distance = 0;
  for (let row = 0; row < CELL_HEIGHT; row += 1) {
    distance += popcountByte(first.rows[row]! ^ second.rows[row]!);
  }
  return distance;
}

function chooseBridgeGlyph(candidates: GraphGlyph[], current: GraphGlyph | undefined): GraphGlyph | undefined {
  if (candidates.length === 0) return undefined;
  if (!current) return [...candidates].sort((a, b) => a.glyphId - b.glyphId)[0];
  let best = candidates[0]!;
  let bestDistance = bitmapDistance(best, current);
  for (const candidate of candidates.slice(1)) {
    const distance = bitmapDistance(candidate, current);
    if (distance < bestDistance || (distance === bestDistance && candidate.glyphId < best.glyphId)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * GraphSolver plus a deterministic continuity repair pass for ordinary lines.
 *
 * The base solver remains authoritative for semantic family selection, fills,
 * junctions, and endpoint/same-edge fallbacks. This pass only touches blank or
 * already-straight cells for which the authored centerline supplies exactly two
 * canonical boundary crossings. It therefore cannot turn fills into straights or
 * erase real connector junctions.
 */
export class BridgeGraphSolver extends GraphSolver {
  constructor(
    private readonly bridgeRegistry: GlyphRegistry,
    columns: number,
    rows: number,
  ) {
    super(bridgeRegistry, columns, rows);
  }

  override solve(objects: DrawingObject[], cellRect: CellRect): void {
    super.solve(objects, cellRect);
    this.repairLineBridges(objects, cellRect);
  }

  private repairLineBridges(objects: DrawingObject[], cellRect: CellRect): void {
    const hints = buildBridgeHints(objects, this.columns, this.rows);
    const maxColumn = cellRect.column + cellRect.columns;
    const maxRow = cellRect.row + cellRect.rows;

    for (let row = cellRect.row; row < maxRow; row += 1) {
      for (let column = cellRect.column; column < maxColumn; column += 1) {
        const key = row * this.columns + column;
        const points = hints.get(key);
        if (!points || points.length !== 2) continue;

        const currentCodepoint = this.grid[key]!;
        const current = this.bridgeRegistry.byCodepoint.get(currentCodepoint);
        // Never rewrite an encoded fill or a real connector. Blank and straight
        // cells are the only legal repair targets.
        if (current && current.canonicalClass !== "straight") continue;

        const candidates = this.bridgeRegistry.straightCandidatesForBoundaryPoints(points);
        const winner = chooseBridgeGlyph(candidates, current);
        if (winner) this.grid[key] = winner.codepointValue;
      }
    }
  }
}
