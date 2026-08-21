import type { CenterlineSegment } from "./geometry-engine";
import type { Point } from "./types";

const POINT_EPSILON = 1e-7;
const CARDINAL_EPSILON = 1e-6;

export type ConnectorFamily = "orthogonal" | "diagonal";

export interface JunctionTopology {
  point: Point;
  arms: number;
  family: ConnectorFamily | null;
}

function pointOnSegment(point: Point, segment: CenterlineSegment): boolean {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= POINT_EPSILON) return false;
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

function armDirections(point: Point, segments: readonly CenterlineSegment[]): Point[] {
  const directions: Point[] = [];
  const addDirection = (dx: number, dy: number): void => {
    const length = Math.hypot(dx, dy);
    if (length <= POINT_EPSILON) return;
    const direction = { x: dx / length, y: dy / length };
    if (directions.some((existing) => existing.x * direction.x + existing.y * direction.y > 0.999999)) return;
    directions.push(direction);
  };

  for (const segment of segments) {
    if (!pointOnSegment(point, segment)) continue;
    addDirection(segment.a.x - point.x, segment.a.y - point.y);
    addDirection(segment.b.x - point.x, segment.b.y - point.y);
  }
  return directions;
}

function classifyFamily(directions: readonly Point[]): ConnectorFamily | null {
  if (directions.length < 3 || directions.length > 4) return null;

  const cardinal = directions.every((direction) =>
    Math.abs(direction.x) <= CARDINAL_EPSILON || Math.abs(direction.y) <= CARDINAL_EPSILON,
  );
  if (cardinal) return "orthogonal";

  const quadrants = new Set<string>();
  for (const direction of directions) {
    if (Math.abs(direction.x) <= CARDINAL_EPSILON || Math.abs(direction.y) <= CARDINAL_EPSILON) return null;
    const horizontal = direction.x < 0 ? "W" : "E";
    const vertical = direction.y < 0 ? "N" : "S";
    quadrants.add(`${vertical}${horizontal}`);
  }
  return quadrants.size === directions.length ? "diagonal" : null;
}

export function junctionTopology(segments: readonly CenterlineSegment[]): JunctionTopology | null {
  if (segments.length < 2) return null;

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

  let best: JunctionTopology | null = null;
  for (const point of hubs.values()) {
    const directions = armDirections(point, segments);
    const arms = directions.length;
    if (arms < 3) continue;
    const candidate: JunctionTopology = { point, arms, family: classifyFamily(directions) };
    if (!best || arms > best.arms || (arms === best.arms && (point.y < best.point.y || (point.y === best.point.y && point.x < best.point.x)))) {
      best = candidate;
    }
  }
  return best;
}
