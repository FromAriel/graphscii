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
  const edges = TOPOLOGY_EDGES[topology];
  const ports = edges.map((edge, position) => ({ edge, index: indices[position], label: `${edge}${indices[position]}` }));
  return {
    key: canonicalKey(ports),
    topology,
    ports,
    indices: Object.fromEntries(ports.map((port) => [port.edge, port.index])),
  };
}

function buildTheoreticalUniverse() {
  const universe = [];
  for (const topology of TOPOLOGY_ORDER) {
    const edges = TOPOLOGY_EDGES[topology];
    const indices = new Array(edges.length).fill(0);
    const visit = (depth) => {
      if (depth === edges.length) {
        universe.push(makeSemantic(topology, indices));
        return;
      }
      const count = PORT_COUNTS[edges[depth]];
      for (let index = 0; index < count; index += 1) {
        indices[depth] = index;
        visit(depth + 1);
      }
    };
    visit(0);
  }
  if (universe.length !== THEORETICAL_TOTAL) {
    throw new Error(`Theoretical junction universe changed: ${universe.length}.`);
  }
  return universe;
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

function quotaLargestRemainder(budget, counts) {
  const exact = TOPOLOGY_ORDER.map((topology) => ({
    topology,
    exact: budget * counts[topology] / THEORETICAL_TOTAL,
  }));
  const quotas = Object.fromEntries(exact.map((entry) => [entry.topology, Math.floor(entry.exact)]));
  let used = Object.values(quotas).reduce((sum, value) => sum + value, 0);
  const remainderOrder = [...exact].sort((a, b) =>
    (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)) ||
    TOPOLOGY_ORDER.indexOf(a.topology) - TOPOLOGY_ORDER.indexOf(b.topology)
  );
  for (let index = 0; used < budget; index += 1) {
    quotas[remainderOrder[index % remainderOrder.length].topology] += 1;
    used += 1;
  }
  return quotas;
}

function prepareLatticeUniverse(universe) {
  return universe.map((semantic) => ({ ...semantic, latticeRank: latticeRank(semantic) }));
}

function selectByQuotas(latticeUniverse, quotas) {
  const selected = [];
  for (const topology of TOPOLOGY_ORDER) {
    const entries = latticeUniverse.filter((entry) => entry.topology === topology).sort(compareLattice);
    selected.push(...entries.slice(0, quotas[topology]));
  }
  return selected;
}

function mergeBitmap(target, source) {
  for (let y = 0; y < CELL_HEIGHT; y += 1) target[y] |= source[y];
}

function nearestIntegerValues(value, maxValue) {
  const low = Math.max(0, Math.min(maxValue, Math.floor(value)));
  const high = Math.max(0, Math.min(maxValue, Math.ceil(value)));
  if (low === high) return [low];
  const lowDistance = Math.abs(value - low);
  const highDistance = Math.abs(high - value);
  if (Math.abs(lowDistance - highDistance) < 1e-12) return [low, high];
  return lowDistance < highDistance ? [low] : [high];
}

function nearestKernel(x, y) {
  const xs = nearestIntegerValues(x, CELL_WIDTH - 1);
  const ys = nearestIntegerValues(y, CELL_HEIGHT - 1);
  const result = [];
  for (const yy of ys) for (const xx of xs) result.push({ x: xx, y: yy });
  return result.sort((a, b) => a.y - b.y || a.x - b.x);
}

function pixelDistanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function nearestAnchor(point, anchors) {
  return [...anchors].sort((a, b) => pixelDistanceSquared(point, a) - pixelDistanceSquared(point, b) || a.y - b.y || a.x - b.x)[0];
}

function pointKey(point) {
  return `${point.x},${point.y}`;
}

function uniquePoints(points) {
  return [...new Map(points.map((point) => [pointKey(point), point])).values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

function rasterizePortFan(ports, hubPoints, connectAllHubPoints = true) {
  const bitmap = emptyBitmap();
  const hubs = uniquePoints(hubPoints);
  for (const hub of hubs) setPixel(bitmap, hub.x, hub.y);
  for (const port of ports) {
    const point = portToPixel(port);
    const anchor = nearestAnchor(point, hubs);
    mergeBitmap(bitmap, rasterizeLineBetweenPixels(point, anchor));
  }
  if (connectAllHubPoints && hubs.length > 1) {
    const root = hubs[0];
    for (const hub of hubs.slice(1)) mergeBitmap(bitmap, rasterizeLineBetweenPixels(root, hub));
  }
  return { bitmap, hubPoints: hubs };
}

function parseFraction(text) {
  const [numeratorText, denominatorText] = text.split("/");
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    throw new Error(`Invalid rational coordinate ${text}.`);
  }
  return numerator / denominator;
}

function parseHubKey(key) {
  const [xText, yText] = key.split(",");
  return { x: parseFraction(xText), y: parseFraction(yText), key };
}

function centroidForPorts(ports) {
  const points = ports.map((port) => portToPixel(port));
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function fixedCenterKernel() {
  return [
    { x: 3, y: 7 }, { x: 4, y: 7 },
    { x: 3, y: 8 }, { x: 4, y: 8 },
  ];
}

function rasterizeModel(model, semantic) {
  const ports = semantic.ports.map((port) => parsePort(port.label ?? `${port.edge}${port.index}`));
  if (model === "mathematical-demand-hub") {
    const hubKey = semantic.topHubs?.[0]?.key;
    const point = hubKey ? parseHubKey(hubKey) : centroidForPorts(ports);
    return { ...rasterizePortFan(ports, nearestKernel(point.x, point.y), true), hub: { x: point.x, y: point.y, source: hubKey ? "top-demand-exact-hub" : "centroid-fallback" } };
  }
  if (model === "symmetric-half-pixel-center") {
    const kernel = fixedCenterKernel();
    const anchors = uniquePoints(ports.map((port) => nearestAnchor(portToPixel(port), kernel)));
    return { ...rasterizePortFan(ports, anchors, true), hub: { x: 3.5, y: 7.5, source: "directional-half-pixel-center" } };
  }
  if (model === "central-2x2-kernel") {
    return { ...rasterizePortFan(ports, fixedCenterKernel(), true), hub: { x: 3.5, y: 7.5, source: "full-central-2x2-kernel" } };
  }
  if (model === "port-centroid-midpoint") {
    const centroid = centroidForPorts(ports);
    return { ...rasterizePortFan(ports, nearestKernel(centroid.x, centroid.y), true), hub: { x: centroid.x, y: centroid.y, source: "boundary-port-centroid" } };
  }
  throw new Error(`Unknown junction raster model ${model}.`);
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
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) if (hasPixel(bitmap, x, y)) count += 1;
  }
  return count;
}

function connected8(bitmap) {
  const foreground = [];
  for (let y = 0; y < CELL_HEIGHT; y += 1) for (let x = 0; x < CELL_WIDTH; x += 1) if (hasPixel(bitmap, x, y)) foreground.push({ x, y });
  if (foreground.length === 0) return false;
  const seen = new Set([pointKey(foreground[0])]);
  const queue = [foreground[0]];
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
  const declaredCoordinates = new Set(ports.map((port) => pointKey(portToPixel(port))));
  const reasons = [];
  for (const coordinate of declaredCoordinates) {
    const [x, y] = coordinate.split(",").map(Number);
    if (!hasPixel(bitmap, x, y)) reasons.push(`declared-boundary-off:${coordinate}`);
  }
  for (const point of BOUNDARY_PIXELS) {
    if (hasPixel(bitmap, point.x, point.y) && !declaredCoordinates.has(pointKey(point))) reasons.push(`undeclared-boundary-on:${pointKey(point)}`);
  }
  if (!connected8(bitmap)) reasons.push("foreground-disconnected");
  for (const hub of hubPoints) if (!hasPixel(bitmap, hub.x, hub.y)) reasons.push(`hub-pixel-off:${pointKey(hub)}`);
  return {
    valid: reasons.length === 0,
    reasons,
    boundaryPortPixelCount: declaredCoordinates.size,
    boundaryPortCollisionCount: ports.length - declaredCoordinates.size,
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
    boundaryPortPixelCount: validation.boundaryPortPixelCount,
    boundaryPortCollisionCount: validation.boundaryPortCollisionCount,
    hub: {
      ...rasterized.hub,
      x: rounded(rasterized.hub.x),
      y: rounded(rasterized.hub.y),
      rasterPixels: rasterized.hubPoints,
    },
    exactGraphicsV0GlyphId: bitmapIndex[key] ?? null,
  };
}

function buildModelSweep(demandMap, bitmapIndex) {
  const models = {};
  for (const model of MODEL_ORDER) {
    const uniqueBitmaps = new Map();
    const exactReuseBitmaps = new Set();
    let validSemantics = 0;
    let invalidSemantics = 0;
    let exactReuseSemantics = 0;
    let weightedValidDemand = 0;
    let boundaryPortCollisions = 0;
    let centroidFallbacks = 0;
    const failures = [];
    for (const semantic of demandMap.semantics) {
      const record = rasterRecord(model, semantic, bitmapIndex);
      boundaryPortCollisions += record.boundaryPortCollisionCount;
      if (record.hub.source === "centroid-fallback") centroidFallbacks += 1;
      if (!record.valid) {
        invalidSemantics += 1;
        if (failures.length < 24) failures.push({ key: semantic.key, topology: semantic.topology, reasons: record.reasons });
        continue;
      }
      validSemantics += 1;
      weightedValidDemand += semantic.demandMultiplicity;
      const current = uniqueBitmaps.get(record.key) ?? { semanticCount: 0, weightedDemand: 0, exactGraphicsV0GlyphId: record.exactGraphicsV0GlyphId };
      current.semanticCount += 1;
      current.weightedDemand += semantic.demandMultiplicity;
      uniqueBitmaps.set(record.key, current);
      if (record.exactGraphicsV0GlyphId !== null) {
        exactReuseSemantics += 1;
        exactReuseBitmaps.add(record.key);
      }
    }
    models[model] = {
      semanticCount: demandMap.semanticCount,
      validSemantics,
      invalidSemantics,
      weightedValidDemand,
      weightedDemandCoveragePercent: rounded(weightedValidDemand * 100 / demandMap.totalDemandMultiplicity),
      uniqueRasterBitmaps: uniqueBitmaps.size,
      semanticToRasterCompression: rounded(validSemantics / Math.max(1, uniqueBitmaps.size)),
      exactGraphicsV0ReuseSemantics: exactReuseSemantics,
      exactGraphicsV0ReuseUniqueBitmaps: exactReuseBitmaps.size,
      novelUniqueBitmaps: uniqueBitmaps.size - exactReuseBitmaps.size,
      boundaryPortCollisions,
      centroidFallbacks,
      sampleFailures: failures,
    };
  }
  return models;
}

function topologyCounts(entries) {
  return Object.fromEntries(TOPOLOGY_ORDER.map((topology) => [topology, entries.filter((entry) => entry.topology === topology).length]));
}

function quantile(values, q) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q));
  return sorted[index];
}

function weightedQuantile(entries, q) {
  const usable = entries.filter((entry) => entry.weight > 0).sort((a, b) => a.value - b.value);
  const total = usable.reduce((sum, entry) => sum + entry.weight, 0);
  if (total === 0) return 0;
  const target = total * q;
  let cumulative = 0;
  for (const entry of usable) {
    cumulative += entry.weight;
    if (cumulative >= target) return entry.value;
  }
  return usable.at(-1).value;
}

function semanticDistance(a, b) {
  let max = 0;
  let sum = 0;
  let count = 0;
  for (const edge of TOPOLOGY_EDGES[a.topology]) {
    const normalized = Math.abs(a.indices[edge] - b.indices[edge]) / (PORT_COUNTS[edge] - 1);
    max = Math.max(max, normalized);
    sum += normalized;
    count += 1;
  }
  return { max, mean: sum / count };
}

function distanceCoverage(selection, universe, demandWeights) {
  const byTopology = Object.fromEntries(TOPOLOGY_ORDER.map((topology) => [topology, selection.filter((entry) => entry.topology === topology)]));
  const maxDistances = [];
  const meanDistances = [];
  const weightedMax = [];
  let weightedDistanceNumerator = 0;
  let totalDemand = 0;
  const worst = [];
  for (const semantic of universe) {
    const candidates = byTopology[semantic.topology];
    if (candidates.length === 0) throw new Error(`Strategy has no ${semantic.topology} connectors.`);
    let best = null;
    for (const candidate of candidates) {
      const distance = semanticDistance(semantic, candidate);
      if (!best || distance.max < best.max - 1e-12 || (Math.abs(distance.max - best.max) < 1e-12 && distance.mean < best.mean - 1e-12) || (Math.abs(distance.max - best.max) < 1e-12 && Math.abs(distance.mean - best.mean) < 1e-12 && candidate.key.localeCompare(best.key) < 0)) {
        best = { ...distance, key: candidate.key };
      }
    }
    maxDistances.push(best.max);
    meanDistances.push(best.mean);
    const weight = demandWeights.get(semantic.key) ?? 0;
    if (weight > 0) {
      weightedMax.push({ value: best.max, weight });
      weightedDistanceNumerator += best.max * weight;
      totalDemand += weight;
    }
    worst.push({ key: semantic.key, topology: semantic.topology, nearest: best.key, maxNormalizedPortDelta: best.max, meanNormalizedPortDelta: best.mean, demandMultiplicity: weight });
  }
  worst.sort((a, b) => b.maxNormalizedPortDelta - a.maxNormalizedPortDelta || b.demandMultiplicity - a.demandMultiplicity || a.key.localeCompare(b.key));
  return {
    theoretical: {
      averageMaxNormalizedPortDelta: rounded(maxDistances.reduce((sum, value) => sum + value, 0) / maxDistances.length),
      averageMeanNormalizedPortDelta: rounded(meanDistances.reduce((sum, value) => sum + value, 0) / meanDistances.length),
      p50MaxNormalizedPortDelta: rounded(quantile(maxDistances, 0.50)),
      p90MaxNormalizedPortDelta: rounded(quantile(maxDistances, 0.90)),
      p95MaxNormalizedPortDelta: rounded(quantile(maxDistances, 0.95)),
      p99MaxNormalizedPortDelta: rounded(quantile(maxDistances, 0.99)),
      worstMaxNormalizedPortDelta: rounded(Math.max(...maxDistances)),
    },
    demandWeighted: {
      averageMaxNormalizedPortDelta: rounded(weightedDistanceNumerator / Math.max(1, totalDemand)),
      p50MaxNormalizedPortDelta: rounded(weightedQuantile(weightedMax, 0.50)),
      p90MaxNormalizedPortDelta: rounded(weightedQuantile(weightedMax, 0.90)),
      p95MaxNormalizedPortDelta: rounded(weightedQuantile(weightedMax, 0.95)),
      p99MaxNormalizedPortDelta: rounded(weightedQuantile(weightedMax, 0.99)),
    },
    worstCases: worst.slice(0, 24).map((entry) => ({
      ...entry,
      maxNormalizedPortDelta: rounded(entry.maxNormalizedPortDelta),
      meanNormalizedPortDelta: rounded(entry.meanNormalizedPortDelta),
    })),
  };
}

function evaluateStrategy(name, selection, universe, demandWeights, bitmapIndex) {
  if (selection.length !== WORKING_BUDGET || new Set(selection.map((entry) => entry.key)).size !== WORKING_BUDGET) {
    throw new Error(`${name} did not produce exactly ${WORKING_BUDGET} unique connector semantics.`);
  }
  const selectedKeys = new Set(selection.map((entry) => entry.key));
  let exactDemand = 0;
  let demandedSelected = 0;
  let boundaryPortCollisions = 0;
  let invalidRasters = 0;
  let exactReuseSemantics = 0;
  const uniqueBitmaps = new Map();
  const exactReuseBitmaps = new Set();
  const selections = [];
  for (const semantic of selection) {
    const demand = demandWeights.get(semantic.key) ?? 0;
    if (demand > 0) demandedSelected += 1;
    exactDemand += demand;
    const record = rasterRecord("port-centroid-midpoint", semantic, bitmapIndex);
    boundaryPortCollisions += record.boundaryPortCollisionCount;
    if (!record.valid) invalidRasters += 1;
    if (record.exactGraphicsV0GlyphId !== null) {
      exactReuseSemantics += 1;
      exactReuseBitmaps.add(record.key);
    }
    const current = uniqueBitmaps.get(record.key) ?? { count: 0, exactGraphicsV0GlyphId: record.exactGraphicsV0GlyphId };
    current.count += 1;
    uniqueBitmaps.set(record.key, current);
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
  const distance = distanceCoverage(selection, universe, demandWeights);
  return {
    name,
    selectedSemantics: selection.length,
    topologyCounts: topologyCounts(selection),
    exactTheoreticalSemanticCoveragePercent: rounded(selection.length * 100 / THEORETICAL_TOTAL),
    demandedSelectedSemantics: demandedSelected,
    exactWeightedDemandCovered: exactDemand,
    exactWeightedDemandCoveragePercent: rounded(exactDemand * 100 / 928242),
    uniqueCentroidRasters: uniqueBitmaps.size,
    centroidSemanticToRasterCompression: rounded(selection.length / uniqueBitmaps.size),
    exactGraphicsV0ReuseSemantics: exactReuseSemantics,
    exactGraphicsV0ReuseUniqueBitmaps: exactReuseBitmaps.size,
    novelCentroidRasterOwners: uniqueBitmaps.size - exactReuseBitmaps.size,
    invalidCentroidRasters: invalidRasters,
    boundaryPortCollisions,
    nearestPortCoverage: distance,
    selections: selections.sort((a, b) => TOPOLOGY_ORDER.indexOf(a.topology) - TOPOLOGY_ORDER.indexOf(b.topology) || a.key.localeCompare(b.key)),
    selectedKeySet: selectedKeys,
  };
}

function reportMarkdown(stats, modelSweep, strategyResults) {
  const modelRows = MODEL_ORDER.map((model) => {
    const value = modelSweep[model];
    return `| ${model} | ${value.validSemantics.toLocaleString("en-US")} | ${value.uniqueRasterBitmaps.toLocaleString("en-US")} | ${value.exactGraphicsV0ReuseUniqueBitmaps.toLocaleString("en-US")} | ${value.novelUniqueBitmaps.toLocaleString("en-US")} | ${value.weightedDemandCoveragePercent.toFixed(3)}% |`;
  }).join("\n");
  const strategyRows = STRATEGY_ORDER.map((name) => {
    const value = strategyResults[name];
    return `| ${name} | ${Object.values(value.topologyCounts).join("/")} | ${value.exactWeightedDemandCoveragePercent.toFixed(3)}% | ${value.nearestPortCoverage.theoretical.averageMaxNormalizedPortDelta.toFixed(4)} | ${value.nearestPortCoverage.theoretical.p95MaxNormalizedPortDelta.toFixed(4)} | ${value.nearestPortCoverage.demandWeighted.averageMaxNormalizedPortDelta.toFixed(4)} | ${value.novelCentroidRasterOwners} |`;
  }).join("\n");
  return `# Milestone 5A.2 Junction Geometry and Generic 600-Lattice Sweep\n\n` +
    `Status: **GENERATED RESEARCH — ALLOCATION-FREE**\n\n` +
    `Milestone 5A.2 adds an explicit generic-coverage theory to the demand search. The generic theory walks each edge's ports in a dyadic order: endpoints, center pair, quarter-region points, then the remaining midpoints between already represented positions. It tests 600 semantic connectors while leaving four of the 604 reserve slots outside the working experiment. No PUA allocation occurs.\n\n` +
    `## Geometry-model sweep over the 22,428 demanded semantics\n\n` +
    `| Raster model | Valid semantics | Unique rasters | graphics-v0 exact-reuse rasters | Novel rasters | Weighted demand valid |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${modelRows}\n\n` +
    `The fourth model, **port-centroid-midpoint**, is the new generic theory: connect the requested boundary ports through their geometric midpoint/centroid and deterministically rasterize the nearest hub pixel/kernel.\n\n` +
    `## 600-connector strategy comparison\n\n` +
    `Topology counts are shown as LRT/LRB/LTB/RTB/LRTB. Nearest-port distance is normalized to each edge length, so 0 is exact and 1 spans an entire edge.\n\n` +
    `| Strategy | Topology counts | Exact weighted demand | Avg theoretical nearest Δ | P95 theoretical nearest Δ | Demand-weighted nearest Δ | Novel centroid rasters |\n| --- | --- | ---: | ---: | ---: | ---: | ---: |\n${strategyRows}\n\n` +
    `## Generic allocation hypotheses\n\n` +
    `- **even-topology-balanced-600:** 120 connectors in each of the five topology families.\n` +
    `- **even-space-proportional-600:** 55 / 55 / 27 / 27 / 436, proportional to the 22,528-semantic theoretical space.\n` +
    `- **hybrid-even-demand-600:** first 300 space-proportional lattice connectors, then the strongest remaining empirical-demand semantics until 600.\n` +
    `- **demand-top-600:** pure search baseline using the 600 highest weighted-demand semantics.\n\n` +
    `These are research selections, not codepoint assignments. Exact boundary-port semantics outside a selected set are not silently treated as identical; the nearest-port metrics only quantify how far a routing solver would need to move a connection to use the sampled basis.\n\n` +
    `Milestone 5A.3 can now exhaustively generate/deduplicate visual owners using both the empirical demand field and these generic lattice baselines.\n`;
}

function stripInternalStrategyFields(strategy) {
  const { selectedKeySet, ...rest } = strategy;
  return rest;
}

export async function buildJunctionGeometryDocuments(repoRoot) {
  const demandMap = await readJson(path.join(repoRoot, "artifacts", "research", "junctions", "demand-map.json"));
  const demandStats = await readJson(path.join(repoRoot, "artifacts", "research", "junctions", "stats.json"));
  const blindSpots = await readJson(path.join(repoRoot, "artifacts", "research", "junctions", "blind-spots.json"));
  const bitmapIndexDocument = await readJson(path.join(repoRoot, "artifacts", "manifest", "vocabulary", "indexes", "by-bitmap.json"));
  if (demandMap.schemaVersion !== 2 || demandMap.semanticCount !== 22428 || demandMap.totalDemandMultiplicity !== 928242) {
    throw new Error("Milestone 5A.2 requires the frozen 5A.1 demand-map fixture.");
  }
  if (demandStats.reserveSlots !== RESERVE_SLOTS || demandStats.junctionAllocations !== 0) {
    throw new Error("Milestone 5A.2 must remain allocation-free with all 604 reserve slots protected.");
  }
  if (blindSpots.missingSemanticCount !== 100 || blindSpots.theoreticalSemanticCount !== THEORETICAL_TOTAL) {
    throw new Error("Milestone 5A.2 blind-spot fixture mismatch.");
  }
  const bitmapIndex = bitmapIndexDocument.entries;
  const universe = buildTheoreticalUniverse();
  const latticeUniverse = prepareLatticeUniverse(universe);
  const universeByKey = new Map(latticeUniverse.map((entry) => [entry.key, entry]));
  const demandWeights = new Map(demandMap.semantics.map((semantic) => [semantic.key, semantic.demandMultiplicity]));

  const modelSweep = buildModelSweep(demandMap, bitmapIndex);

  const demandTop = [...demandMap.semantics]
    .sort((a, b) => b.demandMultiplicity - a.demandMultiplicity || a.key.localeCompare(b.key))
    .slice(0, WORKING_BUDGET)
    .map((semantic) => universeByKey.get(semantic.key));

  const balancedQuotas = Object.fromEntries(TOPOLOGY_ORDER.map((topology) => [topology, WORKING_BUDGET / TOPOLOGY_ORDER.length]));
  const proportionalQuotas = quotaLargestRemainder(WORKING_BUDGET, THEORETICAL_COUNTS);
  const balanced = selectByQuotas(latticeUniverse, balancedQuotas);
  const proportional = selectByQuotas(latticeUniverse, proportionalQuotas);

  const hybridSeedBudget = WORKING_BUDGET / 2;
  const hybridSeedQuotas = quotaLargestRemainder(hybridSeedBudget, THEORETICAL_COUNTS);
  const hybrid = selectByQuotas(latticeUniverse, hybridSeedQuotas);
  const hybridKeys = new Set(hybrid.map((entry) => entry.key));
  for (const semantic of [...demandMap.semantics].sort((a, b) => b.demandMultiplicity - a.demandMultiplicity || a.key.localeCompare(b.key))) {
    if (hybrid.length >= WORKING_BUDGET) break;
    if (hybridKeys.has(semantic.key)) continue;
    const entry = universeByKey.get(semantic.key);
    hybrid.push(entry);
    hybridKeys.add(entry.key);
  }

  const rawStrategies = {
    "demand-top-600": evaluateStrategy("demand-top-600", demandTop, latticeUniverse, demandWeights, bitmapIndex),
    "even-topology-balanced-600": evaluateStrategy("even-topology-balanced-600", balanced, latticeUniverse, demandWeights, bitmapIndex),
    "even-space-proportional-600": evaluateStrategy("even-space-proportional-600", proportional, latticeUniverse, demandWeights, bitmapIndex),
    "hybrid-even-demand-600": evaluateStrategy("hybrid-even-demand-600", hybrid, latticeUniverse, demandWeights, bitmapIndex),
  };
  const strategyResults = Object.fromEntries(Object.entries(rawStrategies).map(([name, value]) => [name, stripInternalStrategyFields(value)]));

  const stats = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-geometry-stats",
    schemaVersion: 1,
    status: "5A.2-allocation-free",
    demandedSemantics: demandMap.semanticCount,
    theoreticalSemantics: THEORETICAL_TOTAL,
    workingGenericBudget: WORKING_BUDGET,
    protectedReserveSlots: RESERVE_SLOTS,
    experimentalSlackSlots: RESERVE_SLOTS - WORKING_BUDGET,
    junctionAllocations: 0,
    balancedQuotas,
    proportionalQuotas,
    hybridSeedBudget,
    hybridSeedQuotas,
    modelNames: MODEL_ORDER,
    strategyNames: STRATEGY_ORDER,
    modelSummary: Object.fromEntries(MODEL_ORDER.map((model) => [model, modelSweep[model]])),
    strategySummary: Object.fromEntries(STRATEGY_ORDER.map((name) => {
      const value = strategyResults[name];
      return [name, {
        topologyCounts: value.topologyCounts,
        exactWeightedDemandCoveragePercent: value.exactWeightedDemandCoveragePercent,
        uniqueCentroidRasters: value.uniqueCentroidRasters,
        novelCentroidRasterOwners: value.novelCentroidRasterOwners,
        theoreticalAverageNearestPortDelta: value.nearestPortCoverage.theoretical.averageMaxNormalizedPortDelta,
        theoreticalP95NearestPortDelta: value.nearestPortCoverage.theoretical.p95MaxNormalizedPortDelta,
        demandWeightedAverageNearestPortDelta: value.nearestPortCoverage.demandWeighted.averageMaxNormalizedPortDelta,
      }];
    })),
  };

  const strategyDocument = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-generic-junction-lattice",
    schemaVersion: 1,
    status: "5A.2-research-only-unallocated",
    theory: {
      workingBudget: WORKING_BUDGET,
      reserveSlots: RESERVE_SLOTS,
      slackSlots: RESERVE_SLOTS - WORKING_BUDGET,
      portPriority: PORT_PRIORITY,
      priorityMeaning: "endpoints, center pair, quarter-region points, then remaining midpoints between represented positions",
      semanticDistance: "same-topology normalized boundary-port displacement; exact semantics are never silently equated",
    },
    strategies: strategyResults,
  };

  const modelDocument = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-geometry-model-sweep",
    schemaVersion: 1,
    status: "5A.2-research-only-unallocated",
    demandedSemanticCount: demandMap.semanticCount,
    totalWeightedDemand: demandMap.totalDemandMultiplicity,
    models: modelSweep,
  };

  const spec = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-geometry-research",
    schemaVersion: 1,
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
      "generic-lattice-600.json": jsonText(strategyDocument),
      "geometry-report.md": reportMarkdown(stats, modelSweep, strategyResults),
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
    if (actual !== expected) throw new Error(`${relativePath} is stale or not deterministic for Milestone 5A.2.`);
  }
  if (built.stats.workingGenericBudget !== 600 || built.stats.protectedReserveSlots !== 604 || built.stats.experimentalSlackSlots !== 4 || built.stats.junctionAllocations !== 0) {
    throw new Error("Milestone 5A.2 reserve/budget invariant failed.");
  }
  const balanced = built.stats.balancedQuotas;
  if (!TOPOLOGY_ORDER.every((topology) => balanced[topology] === 120)) throw new Error("Topology-balanced 600 lattice changed.");
  const proportional = built.stats.proportionalQuotas;
  const expectedProportional = { LRT: 55, LRB: 55, LTB: 27, RTB: 27, LRTB: 436 };
  if (!TOPOLOGY_ORDER.every((topology) => proportional[topology] === expectedProportional[topology])) throw new Error("Space-proportional 600 lattice changed.");
  if (built.stats.modelNames.length !== 4 || built.stats.strategyNames.length !== 4) throw new Error("Milestone 5A.2 model/strategy cardinality changed.");
  return built.stats;
}
