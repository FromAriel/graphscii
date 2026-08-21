import { boundsForObject, cellRectToLogical, rectsIntersect } from "./geometry";
import { GlyphRegistry, popcount16, popcountByte } from "./registry";
import type { BoundaryPoint } from "./registry";
import type { CellRect, DrawingObject, GraphGlyph, GraphSCIITone, Point, Rect } from "./types";

const SUPERSAMPLE = 4;
const CELL_WIDTH = 8;
const CELL_HEIGHT = 16;
const CONTINUITY_WEIGHT = 0.075;
const BLANK_CODEPOINT = 0x20;
const TOPOLOGY_THRESHOLD = 0.08;
const TOPOLOGY_LINE_WIDTH = 1;
const TONES: GraphSCIITone[] = [100, 75, 50, 25];

function traceFreehand(
  ctx: CanvasRenderingContext2D,
  object: Extract<DrawingObject, { type: "freehand" }>,
  width = object.width,
): void {
  const points = object.points;
  if (points.length === 0) return;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0]!.x, points[0]!.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  if (points.length === 2) {
    ctx.lineTo(points[1]!.x, points[1]!.y);
  } else {
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index]!;
      const next = points[index + 1]!;
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      ctx.quadraticCurveTo(current.x, current.y, midX, midY);
    }
    const beforeLast = points[points.length - 2]!;
    const last = points[points.length - 1]!;
    ctx.quadraticCurveTo(beforeLast.x, beforeLast.y, last.x, last.y);
  }
  ctx.stroke();
}

function drawObjectForTone(ctx: CanvasRenderingContext2D, object: DrawingObject, tone: GraphSCIITone): void {
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (object.type) {
    case "freehand":
      if (object.tone !== tone) return;
      traceFreehand(ctx, object, object.width);
      return;
    case "line":
      if (object.tone !== tone) return;
      ctx.lineWidth = object.width;
      ctx.beginPath();
      ctx.moveTo(object.start.x, object.start.y);
      ctx.lineTo(object.end.x, object.end.y);
      ctx.stroke();
      return;
    case "bezier":
      if (object.tone !== tone) return;
      ctx.lineWidth = object.width;
      ctx.beginPath();
      ctx.moveTo(object.p0.x, object.p0.y);
      ctx.bezierCurveTo(object.p1.x, object.p1.y, object.p2.x, object.p2.y, object.p3.x, object.p3.y);
      ctx.stroke();
      return;
    case "ellipse": {
      const drawFill = object.fillEnabled && object.fillTone === tone;
      const drawStroke = object.strokeTone === tone && object.strokeWidth > 0;
      if (!drawFill && !drawStroke) return;
      ctx.beginPath();
      ctx.ellipse(object.center.x, object.center.y, object.radiusX, object.radiusY, object.rotation, 0, Math.PI * 2);
      if (drawFill) ctx.fill();
      if (drawStroke) {
        ctx.lineWidth = object.strokeWidth;
        ctx.stroke();
      }
      return;
    }
  }
}

function drawStrokeTopology(ctx: CanvasRenderingContext2D, object: DrawingObject): void {
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (object.type) {
    case "freehand":
      traceFreehand(ctx, object, TOPOLOGY_LINE_WIDTH);
      return;
    case "line":
      ctx.lineWidth = TOPOLOGY_LINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(object.start.x, object.start.y);
      ctx.lineTo(object.end.x, object.end.y);
      ctx.stroke();
      return;
    case "bezier":
      ctx.lineWidth = TOPOLOGY_LINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(object.p0.x, object.p0.y);
      ctx.bezierCurveTo(object.p1.x, object.p1.y, object.p2.x, object.p2.y, object.p3.x, object.p3.y);
      ctx.stroke();
      return;
    case "ellipse":
      // A filled ellipse has a semantic boundary even when its visible outline is disabled.
      // That boundary is what selects GraphSCII side-fill rules.
      if (object.strokeWidth <= 0 && !object.fillEnabled) return;
      ctx.lineWidth = TOPOLOGY_LINE_WIDTH;
      ctx.beginPath();
      ctx.ellipse(object.center.x, object.center.y, object.radiusX, object.radiusY, object.rotation, 0, Math.PI * 2);
      ctx.stroke();
      return;
  }
}

function componentUsesTone(object: DrawingObject, tone: GraphSCIITone): boolean {
  switch (object.type) {
    case "ellipse":
      return object.strokeTone === tone || (object.fillEnabled && object.fillTone === tone);
    default:
      return object.tone === tone;
  }
}

function alphaCoverage(
  image: Uint8ClampedArray,
  sampleWidth: number,
  logicalX: number,
  logicalY: number,
): number {
  let alpha = 0;
  const sampleX = logicalX * SUPERSAMPLE;
  const sampleY = logicalY * SUPERSAMPLE;
  for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
    const rowOffset = (sampleY + sy) * sampleWidth;
    for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
      alpha += image[((rowOffset + sampleX + sx) * 4) + 3]!;
    }
  }
  return alpha / (255 * SUPERSAMPLE * SUPERSAMPLE);
}

export class Rasterizer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement("canvas");
    const context = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D is required for GraphSCII drawing.");
    this.ctx = context;
  }

  private prepare(logicalRect: Rect): { x0: number; y0: number; width: number; height: number } {
    const x0 = Math.floor(logicalRect.x);
    const y0 = Math.floor(logicalRect.y);
    const width = Math.max(0, Math.ceil(logicalRect.width));
    const height = Math.max(0, Math.ceil(logicalRect.height));
    this.canvas.width = width * SUPERSAMPLE;
    this.canvas.height = height * SUPERSAMPLE;
    return { x0, y0, width, height };
  }

  render(objects: DrawingObject[], logicalRect: Rect, registry: GlyphRegistry): Float32Array {
    const { x0, y0, width, height } = this.prepare(logicalRect);
    const target = new Float32Array(width * height);
    if (width === 0 || height === 0 || objects.length === 0) return target;

    const clippedRect: Rect = { x: x0, y: y0, width, height };
    const relevant = objects.filter((object) => rectsIntersect(boundsForObject(object), clippedRect));
    if (relevant.length === 0) return target;

    for (const tone of TONES) {
      const toneObjects = relevant.filter((object) => componentUsesTone(object, tone));
      if (toneObjects.length === 0) continue;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.setTransform(SUPERSAMPLE, 0, 0, SUPERSAMPLE, -x0 * SUPERSAMPLE, -y0 * SUPERSAMPLE);
      for (const object of toneObjects) drawObjectForTone(this.ctx, object, tone);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      const image = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
      const mask = registry.toneMasks[tone];

      for (let y = 0; y < height; y += 1) {
        const globalY = y0 + y;
        const maskRow = mask[((globalY % CELL_HEIGHT) + CELL_HEIGHT) % CELL_HEIGHT]!;
        for (let x = 0; x < width; x += 1) {
          const globalX = x0 + x;
          const bit = 1 << (((globalX % CELL_WIDTH) + CELL_WIDTH) % CELL_WIDTH);
          if ((maskRow & bit) === 0) continue;
          const coverage = alphaCoverage(image, this.canvas.width, x, y);
          const index = y * width + x;
          if (coverage > target[index]!) target[index] = coverage;
        }
      }
    }
    return target;
  }

  renderStrokeTopology(objects: DrawingObject[], logicalRect: Rect): Float32Array {
    const { x0, y0, width, height } = this.prepare(logicalRect);
    const target = new Float32Array(width * height);
    if (width === 0 || height === 0 || objects.length === 0) return target;

    const clippedRect: Rect = { x: x0, y: y0, width, height };
    const relevant = objects.filter((object) => rectsIntersect(boundsForObject(object), clippedRect));
    if (relevant.length === 0) return target;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(SUPERSAMPLE, 0, 0, SUPERSAMPLE, -x0 * SUPERSAMPLE, -y0 * SUPERSAMPLE);
    for (const object of relevant) drawStrokeTopology(this.ctx, object);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    const image = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) target[y * width + x] = alphaCoverage(image, this.canvas.width, x, y);
    }
    return target;
  }
}

interface Neighbors {
  left?: GraphGlyph;
  top?: GraphGlyph;
  right?: GraphGlyph;
  bottom?: GraphGlyph;
}

function edgePenalty(glyph: GraphGlyph, neighbors: Neighbors): number {
  let mismatch = 0;
  if (neighbors.left) mismatch += popcount16(glyph.leftEdge ^ neighbors.left.rightEdge);
  if (neighbors.right) mismatch += popcount16(glyph.rightEdge ^ neighbors.right.leftEdge);
  if (neighbors.top) mismatch += popcountByte(glyph.topEdge ^ neighbors.top.bottomEdge);
  if (neighbors.bottom) mismatch += popcountByte(glyph.bottomEdge ^ neighbors.bottom.topEdge);
  return mismatch * CONTINUITY_WEIGHT;
}

function buildRowLookup(coverage: Float32Array): number[][] {
  const lookup = Array.from({ length: CELL_HEIGHT }, () => new Array<number>(256).fill(0));
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    const row = lookup[y]!;
    for (let mask = 1; mask < 256; mask += 1) {
      const leastBit = mask & -mask;
      const bitIndex = 31 - Math.clz32(leastBit);
      row[mask] = row[mask ^ leastBit]! + coverage[y * CELL_WIDTH + bitIndex]!;
    }
  }
  return lookup;
}

function scoreCandidates(candidates: GraphGlyph[], coverage: Float32Array, neighbors: Neighbors): GraphGlyph | null {
  if (candidates.length === 0) return null;
  let sum = 0;
  for (const value of coverage) sum += value;
  const rowLookup = buildRowLookup(coverage);
  let best: GraphGlyph | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const glyph of candidates) {
    let coveredOn = 0;
    for (let y = 0; y < CELL_HEIGHT; y += 1) coveredOn += rowLookup[y]![glyph.rows[y]!]!;
    const pixelError = sum + glyph.onCount - 2 * coveredOn;
    const score = pixelError + edgePenalty(glyph, neighbors);
    if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && glyph.glyphId < (best?.glyphId ?? Number.MAX_SAFE_INTEGER))) {
      best = glyph;
      bestScore = score;
    }
  }
  return best;
}

function pointInsideFilledEllipse(
  object: Extract<DrawingObject, { type: "ellipse" }>,
  x: number,
  y: number,
): boolean {
  if (!object.fillEnabled || object.radiusX <= 0 || object.radiusY <= 0) return false;
  const cos = Math.cos(-object.rotation);
  const sin = Math.sin(-object.rotation);
  const dx = x - object.center.x;
  const dy = y - object.center.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return (localX * localX) / (object.radiusX * object.radiusX)
    + (localY * localY) / (object.radiusY * object.radiusY) <= 1;
}

function fillTonesForCell(objects: DrawingObject[], column: number, row: number): GraphSCIITone[] {
  const cellRect: Rect = { x: column * CELL_WIDTH, y: row * CELL_HEIGHT, width: CELL_WIDTH, height: CELL_HEIGHT };
  const tones = new Set<GraphSCIITone>();

  for (const object of objects) {
    if (object.type !== "ellipse" || !object.fillEnabled) continue;
    if (!rectsIntersect(boundsForObject(object), cellRect)) continue;

    let found = false;
    for (let sy = 0; sy < CELL_HEIGHT * SUPERSAMPLE && !found; sy += 1) {
      const y = cellRect.y + (sy + 0.5) / SUPERSAMPLE;
      for (let sx = 0; sx < CELL_WIDTH * SUPERSAMPLE; sx += 1) {
        const x = cellRect.x + (sx + 0.5) / SUPERSAMPLE;
        if (pointInsideFilledEllipse(object, x, y)) {
          found = true;
          break;
        }
      }
    }
    if (found) tones.add(object.fillTone);
  }

  return [...tones];
}

type BoundaryEdge = "T" | "B" | "L" | "R";

interface BoundaryHit {
  edge: BoundaryEdge;
  point: BoundaryPoint;
  strength: number;
}

function edgeClusters(values: number[], edge: BoundaryEdge): BoundaryHit[] {
  const hits: BoundaryHit[] = [];
  let index = 0;
  while (index < values.length) {
    if (values[index]! < TOPOLOGY_THRESHOLD) {
      index += 1;
      continue;
    }
    let weightedIndex = 0;
    let strength = 0;
    while (index < values.length && values[index]! >= TOPOLOGY_THRESHOLD) {
      const value = values[index]!;
      weightedIndex += index * value;
      strength += value;
      index += 1;
    }
    const center = Math.max(0, Math.min(values.length - 1, Math.round(weightedIndex / Math.max(strength, 1e-9))));
    const point: BoundaryPoint = edge === "T" ? { x: center, y: 0 }
      : edge === "B" ? { x: center, y: 15 }
        : edge === "L" ? { x: 0, y: center }
          : { x: 7, y: center };
    hits.push({ edge, point, strength });
  }
  return hits;
}

function mergeCornerHits(hits: BoundaryHit[]): BoundaryHit[] {
  const result = [...hits];
  const corners: Array<{
    point: BoundaryPoint;
    first: BoundaryEdge;
    second: BoundaryEdge;
    nearFirst: (point: BoundaryPoint) => boolean;
    nearSecond: (point: BoundaryPoint) => boolean;
  }> = [
    { point: { x: 0, y: 0 }, first: "T", second: "L", nearFirst: (p) => p.y === 0 && p.x <= 1, nearSecond: (p) => p.x === 0 && p.y <= 1 },
    { point: { x: 7, y: 0 }, first: "T", second: "R", nearFirst: (p) => p.y === 0 && p.x >= 6, nearSecond: (p) => p.x === 7 && p.y <= 1 },
    { point: { x: 0, y: 15 }, first: "B", second: "L", nearFirst: (p) => p.y === 15 && p.x <= 1, nearSecond: (p) => p.x === 0 && p.y >= 14 },
    { point: { x: 7, y: 15 }, first: "B", second: "R", nearFirst: (p) => p.y === 15 && p.x >= 6, nearSecond: (p) => p.x === 7 && p.y >= 14 },
  ];

  for (const corner of corners) {
    const firstIndex = result.findIndex((hit) => hit.edge === corner.first && corner.nearFirst(hit.point));
    const secondIndex = result.findIndex((hit) => hit.edge === corner.second && corner.nearSecond(hit.point));
    if (firstIndex < 0 || secondIndex < 0) continue;
    const firstHit = result[firstIndex]!;
    const secondHit = result[secondIndex]!;
    const remove = [firstIndex, secondIndex].sort((a, b) => b - a);
    for (const removeIndex of remove) result.splice(removeIndex, 1);
    result.push({
      edge: firstHit.strength >= secondHit.strength ? firstHit.edge : secondHit.edge,
      point: corner.point,
      strength: Math.max(firstHit.strength, secondHit.strength),
    });
  }
  return result;
}

function boundaryPointsFromTopology(topology: Float32Array): BoundaryPoint[] {
  const top = Array.from({ length: CELL_WIDTH }, (_, x) => topology[x]!);
  const bottom = Array.from({ length: CELL_WIDTH }, (_, x) => topology[(CELL_HEIGHT - 1) * CELL_WIDTH + x]!);
  const left = Array.from({ length: CELL_HEIGHT }, (_, y) => topology[y * CELL_WIDTH]!);
  const right = Array.from({ length: CELL_HEIGHT }, (_, y) => topology[y * CELL_WIDTH + (CELL_WIDTH - 1)]!);
  const hits = mergeCornerHits([
    ...edgeClusters(top, "T"),
    ...edgeClusters(bottom, "B"),
    ...edgeClusters(left, "L"),
    ...edgeClusters(right, "R"),
  ]);
  const unique = new Map<string, BoundaryPoint>();
  for (const hit of hits) unique.set(`${hit.point.x},${hit.point.y}`, hit.point);
  return [...unique.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

interface CenterlineSegment {
  a: Point;
  b: Point;
}

function appendSegment(segments: CenterlineSegment[], a: Point, b: Point): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx * dx + dy * dy <= 1e-12) return;
  segments.push({ a: { ...a }, b: { ...b } });
}

function sampleQuadratic(segments: CenterlineSegment[], p0: Point, p1: Point, p2: Point, steps = 8): void {
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

function sampleCubic(segments: CenterlineSegment[], p0: Point, p1: Point, p2: Point, p3: Point, steps = 24): void {
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
      if (object.strokeWidth <= 0 && !object.fillEnabled) return segments;
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

function junctionArmCountAtPoint(hub: Point, segments: readonly CenterlineSegment[]): number {
  const pointTolerance = 1e-4;
  const angularCosineTolerance = Math.cos(3 * Math.PI / 180);
  const directions: Array<{ x: number; y: number }> = [];

  const addDirection = (dx: number, dy: number): void => {
    const length = Math.hypot(dx, dy);
    if (length <= pointTolerance) return;
    const unit = { x: dx / length, y: dy / length };
    if (directions.some((existing) => existing.x * unit.x + existing.y * unit.y >= angularCosineTolerance)) return;
    directions.push(unit);
  };

  for (const segment of segments) {
    const abX = segment.b.x - segment.a.x;
    const abY = segment.b.y - segment.a.y;
    const lengthSquared = abX * abX + abY * abY;
    if (lengthSquared <= pointTolerance * pointTolerance) continue;
    const ahX = hub.x - segment.a.x;
    const ahY = hub.y - segment.a.y;
    const cross = Math.abs(abX * ahY - abY * ahX);
    if (cross > pointTolerance * Math.max(1, Math.sqrt(lengthSquared))) continue;
    const dot = ahX * abX + ahY * abY;
    if (dot < -pointTolerance || dot > lengthSquared + pointTolerance) continue;

    addDirection(segment.a.x - hub.x, segment.a.y - hub.y);
    addDirection(segment.b.x - hub.x, segment.b.y - hub.y);
  }

  return directions.length;
}

function segmentIntersectionPoint(first: CenterlineSegment, second: CenterlineSegment): Point | null {
  const rX = first.b.x - first.a.x;
  const rY = first.b.y - first.a.y;
  const sX = second.b.x - second.a.x;
  const sY = second.b.y - second.a.y;
  const denominator = rX * sY - rY * sX;
  if (Math.abs(denominator) <= 1e-9) return null;

  const qX = second.a.x - first.a.x;
  const qY = second.a.y - first.a.y;
  const t = (qX * sY - qY * sX) / denominator;
  const u = (qX * rY - qY * rX) / denominator;
  const epsilon = 1e-7;
  if (t < -epsilon || t > 1 + epsilon || u < -epsilon || u > 1 + epsilon) return null;
  return { x: first.a.x + t * rX, y: first.a.y + t * rY };
}

function semanticJunctionCells(objects: DrawingObject[], cellRect: CellRect, totalColumns: number): Set<number> {
  const buckets = new Map<number, CenterlineSegment[]>();
  const epsilon = 1e-6;
  const maxColumn = cellRect.column + cellRect.columns - 1;
  const maxRow = cellRect.row + cellRect.rows - 1;

  for (const object of objects) {
    for (const segment of centerlineSegmentsForObject(object)) {
      const minColumn = Math.max(cellRect.column, Math.floor((Math.min(segment.a.x, segment.b.x) - epsilon) / CELL_WIDTH));
      const maxSegmentColumn = Math.min(maxColumn, Math.floor((Math.max(segment.a.x, segment.b.x) + epsilon) / CELL_WIDTH));
      const minRow = Math.max(cellRect.row, Math.floor((Math.min(segment.a.y, segment.b.y) - epsilon) / CELL_HEIGHT));
      const maxSegmentRow = Math.min(maxRow, Math.floor((Math.max(segment.a.y, segment.b.y) + epsilon) / CELL_HEIGHT));
      if (minColumn > maxSegmentColumn || minRow > maxSegmentRow) continue;
      for (let row = minRow; row <= maxSegmentRow; row += 1) {
        for (let column = minColumn; column <= maxSegmentColumn; column += 1) {
          const key = row * totalColumns + column;
          const list = buckets.get(key) ?? [];
          list.push(segment);
          buckets.set(key, list);
        }
      }
    }
  }

  const junctions = new Set<number>();
  for (const [key, segments] of buckets) {
    if (segments.length < 2) continue;
    const column = key % totalColumns;
    const row = Math.floor(key / totalColumns);
    const x0 = column * CELL_WIDTH;
    const y0 = row * CELL_HEIGHT;
    const x1 = x0 + CELL_WIDTH;
    const y1 = y0 + CELL_HEIGHT;
    const hubs = new Map<string, Point>();
    const addHub = (point: Point): void => {
      if (point.x < x0 - epsilon || point.x > x1 + epsilon || point.y < y0 - epsilon || point.y > y1 + epsilon) return;
      const hubKey = `${Math.round(point.x * 100000)},${Math.round(point.y * 100000)}`;
      hubs.set(hubKey, point);
    };

    for (const segment of segments) {
      addHub(segment.a);
      addHub(segment.b);
    }
    for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
        const intersection = segmentIntersectionPoint(segments[firstIndex]!, segments[secondIndex]!);
        if (intersection) addHub(intersection);
      }
    }

    for (const hub of hubs.values()) {
      if (junctionArmCountAtPoint(hub, segments) >= 3) {
        junctions.add(key);
        break;
      }
    }
  }

  return junctions;
}

function targetSum(coverage: Float32Array): number {
  let sum = 0;
  for (const value of coverage) sum += value;
  return sum;
}

function uniqueCandidates(groups: readonly GraphGlyph[][]): GraphGlyph[] {
  const unique = new Map<number, GraphGlyph>();
  for (const group of groups) {
    for (const glyph of group) unique.set(glyph.codepointValue, glyph);
  }
  return [...unique.values()];
}

function solveCell(
  registry: GlyphRegistry,
  coverage: Float32Array,
  topology: Float32Array,
  neighbors: Neighbors,
  fillTones: readonly GraphSCIITone[],
  semanticJunction: boolean,
): number {
  const sum = targetSum(coverage);
  if (sum < 0.45) return BLANK_CODEPOINT;

  const boundaryPoints = boundaryPointsFromTopology(topology);

  // Filled geometry is semantic fill geometry first. It never falls through to
  // connector selection. Boundary cells use the published boundary+side+style
  // table; interior/unsupported boundary cases remain locked to the requested
  // GraphSCII tonal family.
  if (fillTones.length > 0) {
    if (boundaryPoints.length === 2) {
      const exactFill = uniqueCandidates(
        fillTones.map((tone) => registry.fillCandidatesForBoundaryPoints(boundaryPoints, tone)),
      );
      const exactWinner = scoreCandidates(exactFill, coverage, neighbors);
      if (exactWinner) return exactWinner.codepointValue;
    }

    const fillFallback = uniqueCandidates(
      fillTones.map((tone) => registry.fillCandidatesNearPixelCount(sum, tone, 10)),
    );
    const fillWinner = scoreCandidates(fillFallback, coverage, neighbors);
    return fillWinner?.codepointValue ?? BLANK_CODEPOINT;
  }

  // A non-junction stroke with exactly two boundary ports is a straight, full stop.
  if (boundaryPoints.length === 2) {
    const exactStraights = registry.straightCandidatesForBoundaryPoints(boundaryPoints);
    const straight = scoreCandidates(exactStraights, coverage, neighbors);
    if (straight) return straight.codepointValue;
  }

  // Connectors require an authored centerline junction with 3+ real outgoing arms,
  // plus an exact published connector boundary signature. Raster edge count alone
  // never grants connector eligibility.
  if (boundaryPoints.length >= 3 && semanticJunction) {
    const connectorCandidates = registry.connectorCandidatesForBoundaryPoints(boundaryPoints);
    const connector = scoreCandidates(connectorCandidates, coverage, neighbors);
    if (connector) return connector.codepointValue;
  }

  // End caps, same-edge curves, loops, non-branching multi-edge paths, and any
  // unsupported topology degrade only within the straight vocabulary.
  const fallback = scoreCandidates(registry.straightCandidatesNearPixelCount(sum, 10), coverage, neighbors);
  return fallback?.codepointValue ?? BLANK_CODEPOINT;
}

export class GraphSolver {
  readonly grid: Uint32Array;
  private readonly rasterizer = new Rasterizer();

  constructor(
    private readonly registry: GlyphRegistry,
    readonly columns: number,
    readonly rows: number,
  ) {
    this.grid = new Uint32Array(columns * rows);
    this.grid.fill(BLANK_CODEPOINT);
  }

  clear(): void {
    this.grid.fill(BLANK_CODEPOINT);
  }

  solve(objects: DrawingObject[], cellRect: CellRect): void {
    if (cellRect.columns <= 0 || cellRect.rows <= 0) return;
    const logicalRect = cellRectToLogical(cellRect);
    const target = this.rasterizer.render(objects, logicalRect, this.registry);
    const topologyTarget = this.rasterizer.renderStrokeTopology(objects, logicalRect);
    const targetWidth = logicalRect.width;
    const fillToneCache = new Map<number, GraphSCIITone[]>();
    const junctionCells = semanticJunctionCells(objects, cellRect, this.columns);

    const extractCell = (source: Float32Array, column: number, row: number): Float32Array => {
      const cell = new Float32Array(CELL_WIDTH * CELL_HEIGHT);
      const localX = (column - cellRect.column) * CELL_WIDTH;
      const localY = (row - cellRect.row) * CELL_HEIGHT;
      for (let y = 0; y < CELL_HEIGHT; y += 1) {
        const sourceStart = (localY + y) * targetWidth + localX;
        for (let x = 0; x < CELL_WIDTH; x += 1) cell[y * CELL_WIDTH + x] = source[sourceStart + x]!;
      }
      return cell;
    };

    const fillTonesAt = (column: number, row: number): GraphSCIITone[] => {
      const key = row * this.columns + column;
      const cached = fillToneCache.get(key);
      if (cached) return cached;
      const tones = fillTonesForCell(objects, column, row);
      fillToneCache.set(key, tones);
      return tones;
    };

    for (let row = cellRect.row; row < cellRect.row + cellRect.rows; row += 1) {
      for (let column = cellRect.column; column < cellRect.column + cellRect.columns; column += 1) {
        const coverage = extractCell(target, column, row);
        const topology = extractCell(topologyTarget, column, row);
        const key = row * this.columns + column;
        const neighbors: Neighbors = {
          left: this.glyphAt(column - 1, row),
          top: this.glyphAt(column, row - 1),
        };
        this.grid[key] = solveCell(
          this.registry,
          coverage,
          topology,
          neighbors,
          fillTonesAt(column, row),
          junctionCells.has(key),
        );
      }
    }

    // Reverse relaxation can change only visual tie-breaking. Semantic family
    // selection remains fixed by fill/straight/junction topology.
    for (let row = cellRect.row + cellRect.rows - 1; row >= cellRect.row; row -= 1) {
      for (let column = cellRect.column + cellRect.columns - 1; column >= cellRect.column; column -= 1) {
        const coverage = extractCell(target, column, row);
        const topology = extractCell(topologyTarget, column, row);
        const key = row * this.columns + column;
        const neighbors: Neighbors = {
          left: this.glyphAt(column - 1, row),
          top: this.glyphAt(column, row - 1),
          right: this.glyphAt(column + 1, row),
          bottom: this.glyphAt(column, row + 1),
        };
        this.grid[key] = solveCell(
          this.registry,
          coverage,
          topology,
          neighbors,
          fillTonesAt(column, row),
          junctionCells.has(key),
        );
      }
    }
  }

  codepointAt(column: number, row: number): number {
    if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) return BLANK_CODEPOINT;
    return this.grid[row * this.columns + column]!;
  }

  toText(): string {
    const lines: string[] = [];
    for (let row = 0; row < this.rows; row += 1) {
      let line = "";
      for (let column = 0; column < this.columns; column += 1) line += String.fromCodePoint(this.codepointAt(column, row));
      lines.push(line.replace(/ +$/u, ""));
    }
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return `${lines.join("\n")}\n`;
  }

  private glyphAt(column: number, row: number): GraphGlyph | undefined {
    const codepoint = this.codepointAt(column, row);
    return codepoint === BLANK_CODEPOINT ? undefined : this.registry.byCodepoint.get(codepoint);
  }
}
