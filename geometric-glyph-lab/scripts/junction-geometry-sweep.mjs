import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  bitmapKey,
  emptyBitmap,
  hasPixel,
  portToPixel,
  rasterizeLineBetweenPixels,
  setPixel,
} from "../dist/core/index.js";

const TOPOLOGY_ORDER = ["LRT", "LRB", "LTB", "RTB", "LRTB"];
const TOPOLOGY_EDGES = {
  LRT: ["L", "R", "T"],
  LRB: ["L", "R", "B"],
  LTB: ["L", "T", "B"],
  RTB: ["R", "T", "B"],
  LRTB: ["L", "R", "T", "B"],
};
const PORT_COUNTS = { L: 16, R: 16, T: 8, B: 8 };
const PORT_PRIORITY = {
  L: [0, 15, 7, 8, 3, 4, 11, 12, 1, 2, 5, 6, 9, 10, 13, 14],
  R: [0, 15, 7, 8, 3, 4, 11, 12, 1, 2, 5, 6, 9, 10, 13, 14],
  T: [0, 7, 3, 4, 1, 2, 5, 6],
  B: [0, 7, 3, 4, 1, 2, 5, 6],
};
const THEORETICAL_COUNTS = { LRT: 2048, LRB: 2048, LTB: 1024, RTB: 1024, LRTB: 16384 };
const THEORETICAL_TOTAL = 22528;
const WORKING_BUDGET = 600;
const RESERVE_SLOTS = 604;
const MODEL_ORDER = [
  "mathematical-demand-hub",
  "symmetric-half-pixel-center",
  "central-2x2-kernel",
  "port-centroid-midpoint",
];
const STRATEGY_ORDER = [
  "demand-top-600",
  "even-topology-balanced-600",
  "even-space-proportional-600",
  "hybrid-even-demand-600",
];

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function rounded(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parsePort(label) {
  const edge = label[0];
  const index = Number(label.slice(1));
  if (!PORT_COUNTS[edge] || !Number.isInteger(index) || index < 0 || index >= PORT_COUNTS[edge]) {
    throw new Error(`Invalid GraphSCII port ${label}.`);
  }
  return { edge, index, label };
}

function canonicalKey(ports) {
  const byEdge = new Map(ports.map((port) => [port.edge, port]));
  return ["L", "R", "T", "B"].filter((edge) => byEdge.has(edge)).map((edge) => byEdge.get(edge).label).join(",");
}

function makeSemantic(topology, indices) {
  const ports = TOPOLOGY_EDGES[topology].map((edge, position) => ({ edge, index: indices[position], label: `${edge}${indices[position]}` }));
  return {
    key: canonicalKey(ports),
    topology,
    ports,
    indices: Object.fromEntries(ports.map((port) => [port.edge, port.index])),
  };
}

function buildTheoreticalUniverse() {
  const result = [];
  for (const topology of TOPOLOGY_ORDER) {
    const edges = TOPOLOGY_EDGES[topology];
    const indices = new Array(edges.length).fill(0);
    const visit = (depth) => {
      if (depth === edges.length) {
        result.push(makeSemantic(topology, [...indices]));
        return;
      }
      for (let index = 0; index < PORT_COUNTS[edges[depth]]; index += 1) {
        indices[depth] = index;
        visit(depth + 1);
      }
    };
    visit(0);
  }
  if (result.length !== THEORETICAL_TOTAL) throw new Error(`Theoretical universe changed: ${result.length}.`);
  return result;
}

const PRIORITY_RANK = Object.fromEntries(Object.entries(PORT_PRIORITY).map(([edge, order]) => {
  const ranks = new Map();
  order.forEach((index, rank) => ranks.set(index, rank));
  return [edge, ranks];
}));

function rankLevel(rank) {
  if (rank < 2) return 0;
  return Math.floor(Math.log2(rank));
}

function stableHash(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function latticeRank(semantic) {
  const values = semantic.ports.map((port) => {
    const rank = PRIORITY_RANK[port.edge].get(port.index);
    return {
      rank,
      level: rankLevel(rank),
      normalizedRank: rank / (PORT_COUNTS[port.edge] - 1),
    };
  });
  return {
    maxLevel: Math.max(...values.map((value) => value.level)),
    levelSum: values.reduce((sum, value) => sum + value.level, 0),
    maxNormalizedRank: Math.max(...values.map((value) => value.normalizedRank)),
    normalizedRankSum: values.reduce((sum, value) => sum + value.normalizedRank, 0),
    tieHash: stableHash(semantic.key),
  };
}

function compareLattice(a, b) {
  const ar = a.latticeRank;
  const br = b.latticeRank;
  return ar.maxLevel - br.maxLevel ||
    ar.levelSum - br.levelSum ||
    ar.maxNormalizedRank - br.maxNormalizedRank ||
    ar.normalizedRankSum - br.normalizedRankSum ||
    ar.tieHash - br.tieHash ||
    a.key.localeCompare(b.key);
}

function quotaLargestRemainder(budget) {
  const rows = TOPOLOGY_ORDER.map((topology) => ({ topology, exact: budget * THEORETICAL_COUNTS[topology] / THEORETICAL_TOTAL }));
  const quotas = Object.fromEntries(rows.map((row) => [row.topology, Math.floor(row.exact)]));
  let used = Object.values(quotas).reduce((sum, value) => sum + value, 0);
  rows.sort((a, b) => (b.exact % 1) - (a.exact % 1) || TOPOLOGY_ORDER.indexOf(a.topology) - TOPOLOGY_ORDER.indexOf(b.topology));
  for (let index = 0; used < budget; index += 1) {
    quotas[rows[index % rows.length].topology] += 1;
    used += 1;
  }
  return quotas;
}

function selectByQuotas(universe, quotas) {
  const selected = [];
  for (const topology of TOPOLOGY_ORDER) {
    const candidates = universe.filter((entry) => entry.topology === topology).sort(compareLattice);
    selected.push(...candidates.slice(0, quotas[topology]));
  }
  return selected;
}

function mergeBitmap(target, source) {
  for (let y = 0; y < CELL_HEIGHT; y += 1) target[y] |= source[y];
}

function pointKey(point) {
  return `${point.x},${point.y}`;
}

function uniquePoints(points) {
  return [...new Map(points.map((point) => [pointKey(point), point])).values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

function nearestIntegerValues(value, min, max) {
  const low = clamp(Math.floor(value), min, max);
  const high = clamp(Math.ceil(value), min, max);
  if (low === high) return [low];
  const dl = Math.abs(value - low);
  const dh = Math.abs(high - value);
  if (Math.abs(dl - dh) < 1e-12) return [low, high];
  return dl < dh ? [low] : [high];
}

function nearestInteriorKernel(x, y) {
  const xs = nearestIntegerValues(x, 1, CELL_WIDTH - 2);
  const ys = nearestIntegerValues(y, 1, CELL_HEIGHT - 2);
  const points = [];
  for (const yy of ys) for (const xx of xs) points.push({ x: xx, y: yy });
  return uniquePoints(points);
}

function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function nearestAnchor(point, anchors) {
  return [...anchors].sort((a, b) => distanceSquared(point, a) - distanceSquared(point, b) || a.y - b.y || a.x - b.x)[0];
}

function inwardPixel(port) {
  const point = portToPixel(port);
  if (port.edge === "L") return { x: 1, y: clamp(point.y, 1, CELL_HEIGHT - 2) };
  if (port.edge === "R") return { x: CELL_WIDTH - 2, y: clamp(point.y, 1, CELL_HEIGHT - 2) };
  if (port.edge === "T") return { x: clamp(point.x, 1, CELL_WIDTH - 2), y: 1 };
  return { x: clamp(point.x, 1, CELL_WIDTH - 2), y: CELL_HEIGHT - 2 };
}

function rasterizePortFan(ports, hubPoints) {
  const bitmap = emptyBitmap();
  const hubs = uniquePoints(hubPoints);
  for (const hub of hubs) setPixel(bitmap, hub.x, hub.y);
  for (const port of ports) {
    const boundary = portToPixel(port);
    const inward = inwardPixel(port);
    const anchor = nearestAnchor(inward, hubs);
    setPixel(bitmap, boundary.x, boundary.y);
    setPixel(bitmap, inward.x, inward.y);
    mergeBitmap(bitmap, rasterizeLineBetweenPixels(inward, anchor));
  }
  if (hubs.length > 1) {
    const root = hubs[0];
    for (const hub of hubs.slice(1)) mergeBitmap(bitmap, rasterizeLineBetweenPixels(root, hub));
  }
  return { bitmap, hubPoints: hubs };
}

function parseFraction(text) {
  const [n, d] = text.split("/").map(Number);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) throw new Error(`Invalid rational ${text}.`);
  return n / d;
}

function parseHubKey(key) {
  const [x, y] = key.split(",");
  return { x: parseFraction(x), y: parseFraction(y) };
}

function centroidForPorts(ports) {
  const points = ports.map((port) => portToPixel(port));
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function fixedCenterKernel() {
  return [{ x: 3, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 8 }, { x: 4, y: 8 }];
}

function rasterizeModel(model, semantic) {
  const ports = semantic.ports.map((port) => parsePort(port.label ?? `${port.edge}${port.index}`));
  if (model === "mathematical-demand-hub") {
    const hubKey = semantic.topHubs?.[0]?.key;
    const point = hubKey ? parseHubKey(hubKey) : centroidForPorts(ports);
    return { ...rasterizePortFan(ports, nearestInteriorKernel(point.x, point.y)), hub: { x: point.x, y: point.y, source: hubKey ? "top-demand-exact-hub" : "centroid-fallback" } };
  }
  if (model === "symmetric-half-pixel-center") {
    const kernel = fixedCenterKernel();
    const anchors = uniquePoints(ports.map((port) => nearestAnchor(inwardPixel(port), kernel)));
    return { ...rasterizePortFan(ports, anchors), hub: { x: 3.5, y: 7.5, source: "directional-half-pixel-center" } };
  }
  if (model === "central-2x2-kernel") {
    return { ...rasterizePortFan(ports, fixedCenterKernel()), hub: { x: 3.5, y: 7.5, source: "full-central-2x2-kernel" } };
  }
  if (model === "port-centroid-midpoint") {
    const centroid = centroidForPorts(ports);
    return { ...rasterizePortFan(ports, nearestInteriorKernel(centroid.x, centroid.y)), hub: { x: centroid.x, y: centroid.y, source: "boundary-port-centroid-interior-clamped" } };
  }
  throw new Error(`Unknown model ${model}.`);
}

function allBoundaryPixels() {
  const result = new Map();
  for (let x = 0; x < CELL_WIDTH; x += 1) {
    result.set(`${x},0`, { x, y: 0 });
    result.set(`${x},${CELL_HEIGHT - 1}`, { x, y: CELL_HEIGHT - 1 });
  }
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    result.set(`0,${y}`, { x: 0, y });
    result.set(`${CELL_WIDTH - 1},${y}`, { x: CELL_WIDTH - 1, y });
  }
  return [...result.values()];
}

const BOUNDARY_PIXELS = allBoundaryPixels();

function countPixels(bitmap) {
  let count = 0;
  for (let y = 0; y < CELL_HEIGHT; y += 1) for (let x = 0; x < CELL_WIDTH; x += 1) if (hasPixel(bitmap, x, y)) count += 1;
  return count;
}

function connected8(bitmap) {
  const foreground = [];
  for (let y = 0; y < CELL_HEIGHT; y += 1) for (let x = 0; x < CELL_WIDTH; x += 1) if (hasPixel(bitmap, x, y)) foreground.push({ x, y });
  if (foreground.length === 0) return false;
  const queue = [foreground[0]];
  const seen = new Set([pointKey(foreground[0])]);
  while (queue.length > 0) {
    const current = queue.shift();
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const x = current.x + dx;
        const y = current.y + dy;
        if (x < 0 || x >= CELL_WIDTH || y < 0 || y >= CELL_HEIGHT || !hasPixel(bitmap, x, y)) continue;
        const key = `${x},${y}`;
        if (!seen.has(key)) {
          seen.add(key);
          queue.push({ x, y });
        }
      }
    }
  }
  return seen.size === foreground.length;
}

function validateRaster(bitmap, ports, hubPoints) {
  const declared = new Set(ports.map((port) => pointKey(portToPixel(port))));
  const reasons = [];
  for (const coordinate of declared) {
    const [x, y] = coordinate.split(",").map(Number);
    if (!hasPixel(bitmap, x, y)) reasons.push(`declared-boundary-off:${coordinate}`);
  }
  for (const point of BOUNDARY_PIXELS) {
    if (hasPixel(bitmap, point.x, point.y) && !declared.has(pointKey(point))) reasons.push(`undeclared-boundary-on:${pointKey(point)}`);
  }
  if (!connected8(bitmap)) reasons.push("foreground-disconnected");
  for (const hub of hubPoints) if (!hasPixel(bitmap, hub.x, hub.y)) reasons.push(`hub-pixel-off:${pointKey(hub)}`);
  return {
    valid: reasons.length === 0,
    reasons,
    boundaryPortCollisionCount: ports.length - declared.size,
  };
}

function rasterRecord(model, semantic, bitmapIndex) {
  const rasterized = rasterizeModel(model, semantic);
  const ports = semantic.ports.map((port) => parsePort(port.label ?? `${port.edge}${port.index}`));
  const validation = validateRaster(rasterized.bitmap, ports, rasterized.hubPoints);
  const key = bitmapKey(rasterized.bitmap);
  return {
    key,
    valid: validation.valid,
    reasons: validation.reasons,
    pixelCount: countPixels(rasterized.bitmap),
    boundaryPortCollisionCount: validation.boundaryPortCollisionCount,
    hub: {
      source: rasterized.hub.source,
      x: rounded(rasterized.hub.x),
      y: rounded(rasterized.hub.y),
      rasterPixels: rasterized.hubPoints,
    },
    exactGraphicsV0GlyphId: bitmapIndex[key] ?? null,
  };
}

function buildModelSweep(demandMap, bitmapIndex) {
  const result = {};
  for (const model of MODEL_ORDER) {
    const unique = new Map();
    const exactReuse = new Set();
    let valid = 0;
    let weightedDemand = 0;
    let exactReuseSemantics = 0;
    let collisions = 0;
    const invalidKeys = [];
    for (const semantic of demandMap.semantics) {
      const record = rasterRecord(model, semantic, bitmapIndex);
      collisions += record.boundaryPortCollisionCount;
      if (!record.valid) {
        if (invalidKeys.length < 24) invalidKeys.push({ key: semantic.key, reasons: record.reasons });
        continue;
      }
      valid += 1;
      weightedDemand += semantic.demandMultiplicity;
      unique.set(record.key, (unique.get(record.key) ?? 0) + 1);
      if (record.exactGraphicsV0GlyphId !== null) {
        exactReuseSemantics += 1;
        exactReuse.add(record.key);
      }
    }
    result[model] = {
      semanticCount: demandMap.semanticCount,
      validSemantics: valid,
      invalidSemantics: demandMap.semanticCount - valid,
      weightedValidDemand: weightedDemand,
      weightedDemandCoveragePercent: rounded(weightedDemand * 100 / demandMap.totalDemandMultiplicity),
      uniqueRasterBitmaps: unique.size,
      semanticToRasterCompression: rounded(valid / Math.max(1, unique.size)),
      exactGraphicsV0ReuseSemantics: exactReuseSemantics,
      exactGraphicsV0ReuseUniqueBitmaps: exactReuse.size,
      novelUniqueBitmaps: unique.size - exactReuse.size,
      boundaryPortCollisions: collisions,
      sampleInvalid: invalidKeys,
    };
  }
  return result;
}

function topologyCounts(entries) {
  return Object.fromEntries(TOPOLOGY_ORDER.map((topology) => [topology, entries.filter((entry) => entry.topology === topology).length]));
}

function semanticDistance(a, b) {
  let max = 0;
  let sum = 0;
  for (const edge of TOPOLOGY_EDGES[a.topology]) {
    const delta = Math.abs(a.indices[edge] - b.indices[edge]) / (PORT_COUNTS[edge] - 1);
    max = Math.max(max, delta);
    sum += delta;
  }
  return { max, mean: sum / TOPOLOGY_EDGES[a.topology].length };
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
}

function weightedQuantile(entries, q) {
  const sorted = entries.filter((entry) => entry.weight > 0).sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, entry) => sum + entry.weight, 0);
  if (total === 0) return 0;
  let cumulative = 0;
  const target = total * q;
  for (const entry of sorted) {
    cumulative += entry.weight;
    if (cumulative >= target) return entry.value;
  }
  return sorted.at(-1).value;
}

function distanceCoverage(selection, universe, demandWeights) {
  const selectedByTopology = Object.fromEntries(TOPOLOGY_ORDER.map((topology) => [topology, selection.filter((entry) => entry.topology === topology)]));
  const maxValues = [];
  const meanValues = [];
  const weightedValues = [];
  let weightedSum = 0;
  let totalWeight = 0;
  const worst = [];
  for (const semantic of universe) {
    let best = null;
    for (const candidate of selectedByTopology[semantic.topology]) {
      const distance = semanticDistance(semantic, candidate);
      if (!best || distance.max < best.max - 1e-12 || (Math.abs(distance.max - best.max) < 1e-12 && distance.mean < best.mean - 1e-12) || (Math.abs(distance.max - best.max) < 1e-12 && Math.abs(distance.mean - best.mean) < 1e-12 && candidate.key < best.key)) {
        best = { ...distance, key: candidate.key };
      }
    }
    if (!best) throw new Error(`No selected ${semantic.topology} connector.`);
    maxValues.push(best.max);
    meanValues.push(best.mean);
    const weight = demandWeights.get(semantic.key) ?? 0;
    if (weight > 0) {
      weightedValues.push({ value: best.max, weight });
      weightedSum += best.max * weight;
      totalWeight += weight;
    }
    worst.push({ key: semantic.key, topology: semantic.topology, nearest: best.key, max: best.max, mean: best.mean, demandMultiplicity: weight });
  }
  worst.sort((a, b) => b.max - a.max || b.demandMultiplicity - a.demandMultiplicity || a.key.localeCompare(b.key));
  return {
    theoretical: {
      averageMaxNormalizedPortDelta: rounded(maxValues.reduce((sum, value) => sum + value, 0) / maxValues.length),
      averageMeanNormalizedPortDelta: rounded(meanValues.reduce((sum, value) => sum + value, 0) / meanValues.length),
      p50MaxNormalizedPortDelta: rounded(quantile(maxValues, 0.5)),
      p90MaxNormalizedPortDelta: rounded(quantile(maxValues, 0.9)),
      p95MaxNormalizedPortDelta: rounded(quantile(maxValues, 0.95)),
      p99MaxNormalizedPortDelta: rounded(quantile(maxValues, 0.99)),
      worstMaxNormalizedPortDelta: rounded(Math.max(...maxValues)),
    },
    demandWeighted: {
      averageMaxNormalizedPortDelta: rounded(weightedSum / Math.max(1, totalWeight)),
      p50MaxNormalizedPortDelta: rounded(weightedQuantile(weightedValues, 0.5)),
      p90MaxNormalizedPortDelta: rounded(weightedQuantile(weightedValues, 0.9)),
      p95MaxNormalizedPortDelta: rounded(weightedQuantile(weightedValues, 0.95)),
      p99MaxNormalizedPortDelta: rounded(weightedQuantile(weightedValues, 0.99)),
    },
    worstCases: worst.slice(0, 24).map((entry) => ({
      key: entry.key,
      topology: entry.topology,
      nearest: entry.nearest,
      maxNormalizedPortDelta: rounded(entry.max),
      meanNormalizedPortDelta: rounded(entry.mean),
      demandMultiplicity: entry.demandMultiplicity,
    })),
  };
}

function evaluateStrategy(name, selection, universe, demandWeights, bitmapIndex, totalDemand) {
  if (selection.length !== WORKING_BUDGET || new Set(selection.map((entry) => entry.key)).size !== WORKING_BUDGET) {
    throw new Error(`${name} did not produce exactly 600 unique semantics.`);
  }
  let exactDemand = 0;
  let demandedSelected = 0;
  let invalidRasters = 0;
  let collisions = 0;
  let exactReuseSemantics = 0;
  const unique = new Map();
  const exactReuse = new Set();
  const selections = [];
  for (const semantic of selection) {
    const demand = demandWeights.get(semantic.key) ?? 0;
    if (demand > 0) demandedSelected += 1;
    exactDemand += demand;
    const record = rasterRecord("port-centroid-midpoint", semantic, bitmapIndex);
    collisions += record.boundaryPortCollisionCount;
    if (!record.valid) invalidRasters += 1;
    unique.set(record.key, (unique.get(record.key) ?? 0) + 1);
    if (record.exactGraphicsV0GlyphId !== null) {
      exactReuseSemantics += 1;
      exactReuse.add(record.key);
    }
    selections.push({
      key: semantic.key,
      topology: semantic.topology,
      ports: semantic.ports.map((port) => port.label),
      demandMultiplicity: demand,
      latticeRank: semantic.latticeRank ?? null,
      centroidRaster: {
        bitmapKey: record.key,
        valid: record.valid,
        pixelCount: record.pixelCount,
        hub: record.hub,
        exactGraphicsV0GlyphId: record.exactGraphicsV0GlyphId,
      },
    });
  }
  return {
    name,
    selectedSemantics: selection.length,
    topologyCounts: topologyCounts(selection),
    exactTheoreticalSemanticCoveragePercent: rounded(selection.length * 100 / THEORETICAL_TOTAL),
    demandedSelectedSemantics: demandedSelected,
    exactWeightedDemandCovered: exactDemand,
    exactWeightedDemandCoveragePercent: rounded(exactDemand * 100 / totalDemand),
    uniqueCentroidRasters: unique.size,
    centroidSemanticToRasterCompression: rounded(selection.length / unique.size),
    exactGraphicsV0ReuseSemantics: exactReuseSemantics,
    exactGraphicsV0ReuseUniqueBitmaps: exactReuse.size,
    novelCentroidRasterOwners: unique.size - exactReuse.size,
    invalidCentroidRasters: invalidRasters,
    boundaryPortCollisions: collisions,
    nearestPortCoverage: distanceCoverage(selection, universe, demandWeights),
    selections: selections.sort((a, b) => TOPOLOGY_ORDER.indexOf(a.topology) - TOPOLOGY_ORDER.indexOf(b.topology) || a.key.localeCompare(b.key)),
  };
}

function reportMarkdown(modelSweep, strategies) {
  const modelRows = MODEL_ORDER.map((model) => {
    const value = modelSweep[model];
    return `| ${model} | ${value.validSemantics.toLocaleString("en-US")} | ${value.uniqueRasterBitmaps.toLocaleString("en-US")} | ${value.exactGraphicsV0ReuseUniqueBitmaps.toLocaleString("en-US")} | ${value.novelUniqueBitmaps.toLocaleString("en-US")} | ${value.weightedDemandCoveragePercent.toFixed(3)}% |`;
  }).join("\n");
  const strategyRows = STRATEGY_ORDER.map((name) => {
    const value = strategies[name];
    return `| ${name} | ${Object.values(value.topologyCounts).join("/")} | ${value.exactWeightedDemandCoveragePercent.toFixed(3)}% | ${value.nearestPortCoverage.theoretical.averageMaxNormalizedPortDelta.toFixed(4)} | ${value.nearestPortCoverage.theoretical.p95MaxNormalizedPortDelta.toFixed(4)} | ${value.nearestPortCoverage.demandWeighted.averageMaxNormalizedPortDelta.toFixed(4)} | ${value.novelCentroidRasterOwners} |`;
  }).join("\n");
  return `# Milestone 5A.2 Junction Geometry and Generic 600-Lattice Sweep\n\n` +
    `Status: **GENERATED RESEARCH — ALLOCATION-FREE**\n\n` +
    `The 600-lattice experiment walks edge ports in a dyadic order: extremes, center pair, quarter-region points, then remaining midpoints. Every spoke now leaves its declared boundary port immediately through an interior ingress pixel, preventing shallow Bresenham lines from accidentally activating neighboring boundary ports. No PUA allocation occurs.\n\n` +
    `## Geometry-model sweep\n\n| Raster model | Valid demanded semantics | Unique rasters | graphics-v0 exact reuse | Novel rasters | Weighted demand valid |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${modelRows}\n\n` +
    `## 600-connector strategy comparison\n\nTopology counts are LRT/LRB/LTB/RTB/LRTB. Nearest-port distance is normalized to each edge length.\n\n| Strategy | Topology counts | Exact weighted demand | Avg theoretical nearest Δ | P95 theoretical nearest Δ | Demand-weighted nearest Δ | Novel centroid rasters |\n| --- | --- | ---: | ---: | ---: | ---: | ---: |\n${strategyRows}\n\n` +
    `The even-topology strategy tests 120 connectors per family. The proportional strategy uses 55/55/27/27/436. The hybrid seeds 300 proportional lattice entries, then fills to 600 with the strongest remaining measured demand. The demand-top strategy is the pure search baseline.\n\n` +
    `Nearest-port coverage is an explicit routing approximation metric only; nearby semantic tuples are never declared identical. Milestone 5A.3 can now generate and globally deduplicate exhaustive visual candidates using these measured baselines.\n`;
}

export async function buildJunctionGeometryDocuments(repoRoot) {
  const demandMap = await readJson(path.join(repoRoot, "artifacts", "research", "junctions", "demand-map.json"));
  const demandStats = await readJson(path.join(repoRoot, "artifacts", "research", "junctions", "stats.json"));
  const blindSpots = await readJson(path.join(repoRoot, "artifacts", "research", "junctions", "blind-spots.json"));
  const bitmapIndexDocument = await readJson(path.join(repoRoot, "artifacts", "manifest", "vocabulary", "indexes", "by-bitmap.json"));
  if (demandMap.schemaVersion !== 2 || demandMap.semanticCount !== 22428 || demandMap.totalDemandMultiplicity !== 928242) throw new Error("Frozen 5A.1 demand fixture changed.");
  if (demandStats.reserveSlots !== RESERVE_SLOTS || demandStats.junctionAllocations !== 0) throw new Error("5A.2 must remain allocation-free.");
  if (blindSpots.missingSemanticCount !== 100 || blindSpots.theoreticalSemanticCount !== THEORETICAL_TOTAL) throw new Error("5A.1 blind-spot fixture changed.");

  const bitmapIndex = bitmapIndexDocument.entries;
  const universe = buildTheoreticalUniverse().map((semantic) => ({ ...semantic, latticeRank: latticeRank(semantic) }));
  const universeByKey = new Map(universe.map((semantic) => [semantic.key, semantic]));
  const demandWeights = new Map(demandMap.semantics.map((semantic) => [semantic.key, semantic.demandMultiplicity]));
  const modelSweep = buildModelSweep(demandMap, bitmapIndex);

  const demandTop = [...demandMap.semantics]
    .sort((a, b) => b.demandMultiplicity - a.demandMultiplicity || a.key.localeCompare(b.key))
    .slice(0, WORKING_BUDGET)
    .map((semantic) => universeByKey.get(semantic.key));

  const balancedQuotas = Object.fromEntries(TOPOLOGY_ORDER.map((topology) => [topology, 120]));
  const proportionalQuotas = quotaLargestRemainder(WORKING_BUDGET);
  const balanced = selectByQuotas(universe, balancedQuotas);
  const proportional = selectByQuotas(universe, proportionalQuotas);

  const hybridSeedBudget = 300;
  const hybridSeedQuotas = quotaLargestRemainder(hybridSeedBudget);
  const hybrid = selectByQuotas(universe, hybridSeedQuotas);
  const hybridKeys = new Set(hybrid.map((entry) => entry.key));
  for (const semantic of [...demandMap.semantics].sort((a, b) => b.demandMultiplicity - a.demandMultiplicity || a.key.localeCompare(b.key))) {
    if (hybrid.length >= WORKING_BUDGET) break;
    if (hybridKeys.has(semantic.key)) continue;
    hybrid.push(universeByKey.get(semantic.key));
    hybridKeys.add(semantic.key);
  }

  const strategies = {
    "demand-top-600": evaluateStrategy("demand-top-600", demandTop, universe, demandWeights, bitmapIndex, demandMap.totalDemandMultiplicity),
    "even-topology-balanced-600": evaluateStrategy("even-topology-balanced-600", balanced, universe, demandWeights, bitmapIndex, demandMap.totalDemandMultiplicity),
    "even-space-proportional-600": evaluateStrategy("even-space-proportional-600", proportional, universe, demandWeights, bitmapIndex, demandMap.totalDemandMultiplicity),
    "hybrid-even-demand-600": evaluateStrategy("hybrid-even-demand-600", hybrid, universe, demandWeights, bitmapIndex, demandMap.totalDemandMultiplicity),
  };

  const strategySummary = Object.fromEntries(STRATEGY_ORDER.map((name) => {
    const value = strategies[name];
    return [name, {
      topologyCounts: value.topologyCounts,
      exactWeightedDemandCoveragePercent: value.exactWeightedDemandCoveragePercent,
      uniqueCentroidRasters: value.uniqueCentroidRasters,
      novelCentroidRasterOwners: value.novelCentroidRasterOwners,
      invalidCentroidRasters: value.invalidCentroidRasters,
      theoreticalAverageNearestPortDelta: value.nearestPortCoverage.theoretical.averageMaxNormalizedPortDelta,
      theoreticalP95NearestPortDelta: value.nearestPortCoverage.theoretical.p95MaxNormalizedPortDelta,
      demandWeightedAverageNearestPortDelta: value.nearestPortCoverage.demandWeighted.averageMaxNormalizedPortDelta,
    }];
  }));

  const stats = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-geometry-stats",
    schemaVersion: 2,
    status: "5A.2-allocation-free",
    demandedSemantics: demandMap.semanticCount,
    theoreticalSemantics: THEORETICAL_TOTAL,
    workingGenericBudget: WORKING_BUDGET,
    protectedReserveSlots: RESERVE_SLOTS,
    experimentalSlackSlots: RESERVE_SLOTS - WORKING_BUDGET,
    junctionAllocations: 0,
    boundarySafeIngress: true,
    balancedQuotas,
    proportionalQuotas,
    hybridSeedBudget,
    hybridSeedQuotas,
    modelNames: MODEL_ORDER,
    strategyNames: STRATEGY_ORDER,
    modelSummary: modelSweep,
    strategySummary,
  };

  const modelDocument = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-geometry-model-sweep",
    schemaVersion: 2,
    status: "5A.2-research-only-unallocated",
    boundarySafeIngress: "declared boundary pixel -> immediate interior ingress -> hub",
    demandedSemanticCount: demandMap.semanticCount,
    totalWeightedDemand: demandMap.totalDemandMultiplicity,
    models: modelSweep,
  };

  const latticeDocument = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-generic-junction-lattice",
    schemaVersion: 2,
    status: "5A.2-research-only-unallocated",
    theory: {
      workingBudget: WORKING_BUDGET,
      reserveSlots: RESERVE_SLOTS,
      slackSlots: RESERVE_SLOTS - WORKING_BUDGET,
      portPriority: PORT_PRIORITY,
      priorityMeaning: "extremes, center pair, quarter-region points, then remaining midpoints",
      boundaryIngress: "immediate inward pixel; hub kernels clamped to the interior",
      semanticDistance: "same-topology normalized boundary-port displacement; approximation metric only",
    },
    strategies,
  };

  const spec = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-geometry-research",
    schemaVersion: 2,
    status: "5A.2-geometry-and-generic-lattice",
    canonicalCell: { width: CELL_WIDTH, height: CELL_HEIGHT },
    frozenInput: {
      demandedSemantics: demandMap.semanticCount,
      weightedDemand: demandMap.totalDemandMultiplicity,
      theoreticalSemantics: THEORETICAL_TOTAL,
      blindSpots: blindSpots.missingSemanticCount,
      encodedGraphics: 5796,
      protectedReserveSlots: RESERVE_SLOTS,
      junctionAllocations: 0,
    },
    boundarySafeIngress: true,
    geometryModels: MODEL_ORDER,
    genericTheory: {
      workingBudget: WORKING_BUDGET,
      leaveSlackSlots: RESERVE_SLOTS - WORKING_BUDGET,
      dyadicPortPriority: PORT_PRIORITY,
      balancedTopologyQuotas: balancedQuotas,
      proportionalTopologyQuotas: proportionalQuotas,
      hybrid: "300 proportional lattice semantics + highest remaining demand semantics to 600",
    },
    next: "5A.3 exhaustive candidate generation and global exact bitmap dedup using demand and generic-lattice baselines",
  };

  return {
    stats,
    texts: {
      "geometry-stats.json": jsonText(stats),
      "geometry-model-sweep.json": jsonText(modelDocument),
      "generic-lattice-600.json": jsonText(latticeDocument),
      "geometry-report.md": reportMarkdown(modelSweep, strategies),
      "spec/junction-geometry-research-v0.json": jsonText(spec),
    },
  };
}

export async function generateJunctionGeometryArtifacts(repoRoot) {
  const built = await buildJunctionGeometryDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "research", "junctions");
  await mkdir(outputRoot, { recursive: true });
  for (const [relativePath, content] of Object.entries(built.texts)) {
    const target = relativePath.startsWith("spec/") ? path.join(repoRoot, relativePath) : path.join(outputRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  return built.stats;
}

export async function verifyJunctionGeometryArtifacts(repoRoot) {
  const built = await buildJunctionGeometryDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "research", "junctions");
  for (const [relativePath, expected] of Object.entries(built.texts)) {
    const target = relativePath.startsWith("spec/") ? path.join(repoRoot, relativePath) : path.join(outputRoot, relativePath);
    const actual = await readFile(target, "utf8");
    if (actual !== expected) throw new Error(`${relativePath} is stale or non-deterministic for Milestone 5A.2.`);
  }
  if (built.stats.schemaVersion !== 2 || !built.stats.boundarySafeIngress) throw new Error("Boundary-safe Milestone 5A.2 schema fixture changed.");
  if (built.stats.workingGenericBudget !== 600 || built.stats.protectedReserveSlots !== 604 || built.stats.experimentalSlackSlots !== 4 || built.stats.junctionAllocations !== 0) throw new Error("Milestone 5A.2 budget/reserve invariant failed.");
  if (!TOPOLOGY_ORDER.every((topology) => built.stats.balancedQuotas[topology] === 120)) throw new Error("Balanced 600 lattice changed.");
  const expectedProportional = { LRT: 55, LRB: 55, LTB: 27, RTB: 27, LRTB: 436 };
  if (!TOPOLOGY_ORDER.every((topology) => built.stats.proportionalQuotas[topology] === expectedProportional[topology])) throw new Error("Proportional 600 lattice changed.");
  return built.stats;
}
