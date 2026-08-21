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
const THEORETICAL_TOTAL = 22528;
const DEMANDED_TOTAL = 22428;
const TOTAL_WEIGHTED_DEMAND = 928242;
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
  if (result.length !== THEORETICAL_TOTAL) throw new Error(`Theoretical junction universe changed: ${result.length}.`);
  return result;
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
  throw new Error(`Unknown junction model ${model}.`);
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
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) if (hasPixel(bitmap, x, y)) foreground.push({ x, y });
  }
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
  return {
    bitmapKey: bitmapKey(rasterized.bitmap),
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
    exactGraphicsV0GlyphId: bitmapIndex[bitmapKey(rasterized.bitmap)] ?? null,
  };
}

function incrementObjectCounter(object, key, amount = 1) {
  object[key] = (object[key] ?? 0) + amount;
}

function demandBand(value) {
  if (value === 0) return "zero";
  if (value < 10) return "1-9";
  if (value < 100) return "10-99";
  if (value < 1000) return "100-999";
  return "1000+";
}

function ownerId(index) {
  return `J${String(index).padStart(5, "0")}`;
}

function reportMarkdown(stats) {
  const modelRows = MODEL_ORDER.map((model) => {
    const value = stats.byModel[model];
    return `| ${model} | ${value.candidates.toLocaleString("en-US")} | ${value.uniqueRasters.toLocaleString("en-US")} | ${value.graphicsV0ReuseOwners.toLocaleString("en-US")} |`;
  }).join("\n");
  const strategyRows = STRATEGY_ORDER.map((strategy) => {
    const value = stats.strategyOwnerCoverage[strategy];
    return `| ${strategy} | ${value.selectedSemantics} | ${value.visualOwners} | ${value.novelVisualOwners} |`;
  }).join("\n");
  return `# Milestone 5A.3 Exhaustive Junction Candidate Dedup\n\n` +
    `Status: **GENERATED RESEARCH — ALLOCATION-FREE**\n\n` +
    `All 22,528 one-port-per-edge junction semantics are rasterized under all four boundary-safe Milestone 5A.2 geometry models, producing 90,112 semantic-model candidates before exact bitmap dedup. The 100 5A.1 blind spots are deliberately included as breadth-protection candidates.\n\n` +
    `## Headline measurements\n\n` +
    `- Semantic universe: **${stats.semanticUniverse.toLocaleString("en-US")}**\n` +
    `- Geometry models: **${stats.modelCount}**\n` +
    `- Semantic-model candidates: **${stats.candidateCount.toLocaleString("en-US")}**\n` +
    `- Valid candidates: **${stats.validCandidateCount.toLocaleString("en-US")}**\n` +
    `- Unique global junction rasters: **${stats.uniqueRasterOwners.toLocaleString("en-US")}**\n` +
    `- Existing graphics-v0 exact-reuse owners: **${stats.graphicsV0ReuseOwners.toLocaleString("en-US")}**\n` +
    `- Novel junction visual owners: **${stats.novelJunctionOwners.toLocaleString("en-US")}**\n` +
    `- Owners representing multiple semantic tuples: **${stats.multiSemanticOwnerCount.toLocaleString("en-US")}**\n` +
    `- Owners reached by multiple geometry models: **${stats.multiModelOwnerCount.toLocaleString("en-US")}**\n` +
    `- PUA junction allocations: **0 of ${RESERVE_SLOTS}**\n\n` +
    `## Per-model raw populations\n\n| Model | Candidates | Unique rasters | graphics-v0 reuse owners |\n| --- | ---: | ---: | ---: |\n${modelRows}\n\n` +
    `## Generic/demand 600-set owner footprints\n\n| Strategy | Selected semantics | Visual owners touched | Novel visual owners |\n| --- | ---: | ---: | ---: |\n${strategyRows}\n\n` +
    `Every visual owner carries its exact semantic aliases, unique demand weight, blind-spot status, topology set, contributing geometry models, and membership in all four 5A.2 600-connector baselines. Nearby-port approximation remains metadata only; exact bitmap identity is never inferred from distance.\n\n` +
    `Next: **Milestone 5A.4 — optimize the deduplicated owner population across budgets K=0..604 using empirical demand and generic-lattice breadth simultaneously.**\n`;
}

export async function buildJunctionCandidateDocuments(repoRoot) {
  const root = path.join(repoRoot, "artifacts", "research", "junctions");
  const demandMap = await readJson(path.join(root, "demand-map.json"));
  const blindSpots = await readJson(path.join(root, "blind-spots.json"));
  const geometryStats = await readJson(path.join(root, "geometry-stats.json"));
  const lattice = await readJson(path.join(root, "generic-lattice-600.json"));
  const bitmapIndexDocument = await readJson(path.join(repoRoot, "artifacts", "manifest", "vocabulary", "indexes", "by-bitmap.json"));

  if (demandMap.semanticCount !== DEMANDED_TOTAL || demandMap.totalDemandMultiplicity !== TOTAL_WEIGHTED_DEMAND) throw new Error("5A.1 demand fixture changed.");
  if (blindSpots.missingSemanticCount !== 100 || blindSpots.theoreticalSemanticCount !== THEORETICAL_TOTAL) throw new Error("5A.1 blind-spot fixture changed.");
  if (geometryStats.schemaVersion !== 2 || !geometryStats.boundarySafeIngress || geometryStats.junctionAllocations !== 0) throw new Error("5A.2 geometry fixture changed.");
  if (geometryStats.protectedReserveSlots !== RESERVE_SLOTS) throw new Error("Milestone 5 reserve boundary changed.");

  const bitmapIndex = bitmapIndexDocument.entries;
  const demandByKey = new Map(demandMap.semantics.map((semantic) => [semantic.key, semantic]));
  const blindSpotKeys = new Set(blindSpots.missingSemantics.map((semantic) => semantic.key));
  const strategySets = Object.fromEntries(STRATEGY_ORDER.map((strategy) => {
    const selections = lattice.strategies[strategy]?.selections;
    if (!Array.isArray(selections) || selections.length !== 600) throw new Error(`5A.2 strategy ${strategy} is missing its 600 semantic selections.`);
    return [strategy, new Set(selections.map((entry) => entry.key))];
  }));

  const semanticUniverse = buildTheoreticalUniverse().map((base) => {
    const demand = demandByKey.get(base.key);
    return {
      ...base,
      demandMultiplicity: demand?.demandMultiplicity ?? 0,
      pairDemand: demand?.pairDemand ?? 0,
      tripleDemand: demand?.tripleDemand ?? 0,
      topHubs: demand?.topHubs ?? [],
      isBlindSpot: blindSpotKeys.has(base.key),
      strategyMembership: STRATEGY_ORDER.filter((strategy) => strategySets[strategy].has(base.key)),
    };
  });

  if (semanticUniverse.filter((semantic) => semantic.demandMultiplicity > 0).length !== DEMANDED_TOTAL) throw new Error("Demanded semantic count changed during 5A.3 merge.");
  if (semanticUniverse.filter((semantic) => semantic.isBlindSpot).length !== 100) throw new Error("Blind-spot semantic count changed during 5A.3 merge.");

  const ownersByBitmap = new Map();
  const candidates = [];
  const perModelOwnerSets = Object.fromEntries(MODEL_ORDER.map((model) => [model, new Set()]));
  const perModelReuseSets = Object.fromEntries(MODEL_ORDER.map((model) => [model, new Set()]));
  let invalidCandidateCount = 0;

  for (const model of MODEL_ORDER) {
    for (const semantic of semanticUniverse) {
      const raster = rasterRecord(model, semantic, bitmapIndex);
      const candidateId = candidates.length;
      if (!raster.valid) invalidCandidateCount += 1;

      let owner = ownersByBitmap.get(raster.bitmapKey);
      if (!owner) {
        owner = {
          ownerIndex: ownersByBitmap.size,
          ownerId: ownerId(ownersByBitmap.size),
          bitmapKey: raster.bitmapKey,
          pixelCount: raster.pixelCount,
          exactGraphicsV0GlyphId: raster.exactGraphicsV0GlyphId,
          candidateAliases: [],
          semanticCoverage: new Map(),
          models: new Set(),
          topologies: new Set(),
        };
        ownersByBitmap.set(raster.bitmapKey, owner);
      }

      owner.candidateAliases.push({ candidateId, model, semanticKey: semantic.key });
      owner.models.add(model);
      owner.topologies.add(semantic.topology);
      if (!owner.semanticCoverage.has(semantic.key)) {
        owner.semanticCoverage.set(semantic.key, {
          key: semantic.key,
          topology: semantic.topology,
          ports: semantic.ports.map((port) => port.label),
          demandMultiplicity: semantic.demandMultiplicity,
          isBlindSpot: semantic.isBlindSpot,
          strategyMembership: semantic.strategyMembership,
        });
      }

      perModelOwnerSets[model].add(raster.bitmapKey);
      if (raster.exactGraphicsV0GlyphId !== null) perModelReuseSets[model].add(raster.bitmapKey);

      candidates.push({
        candidateId,
        ownerId: owner.ownerId,
        model,
        semanticKey: semantic.key,
        topology: semantic.topology,
        ports: semantic.ports.map((port) => port.label),
        demandMultiplicity: semantic.demandMultiplicity,
        isBlindSpot: semantic.isBlindSpot,
        strategyMembership: semantic.strategyMembership,
        bitmapKey: raster.bitmapKey,
        pixelCount: raster.pixelCount,
        hub: raster.hub,
        valid: raster.valid,
        invalidReasons: raster.reasons,
        exactGraphicsV0GlyphId: raster.exactGraphicsV0GlyphId,
      });
    }
  }

  const owners = [...ownersByBitmap.values()].map((owner) => {
    const semanticCoverage = [...owner.semanticCoverage.values()].sort((a, b) => a.key.localeCompare(b.key));
    const strategyCoverage = Object.fromEntries(STRATEGY_ORDER.map((strategy) => {
      const keys = semanticCoverage.filter((semantic) => semantic.strategyMembership.includes(strategy)).map((semantic) => semantic.key);
      return [strategy, keys];
    }));
    const exactWeightedDemand = semanticCoverage.reduce((sum, semantic) => sum + semantic.demandMultiplicity, 0);
    return {
      ownerIndex: owner.ownerIndex,
      ownerId: owner.ownerId,
      bitmapKey: owner.bitmapKey,
      pixelCount: owner.pixelCount,
      reuseStatus: owner.exactGraphicsV0GlyphId === null ? "novel-junction-owner" : "graphics-v0-exact-reuse",
      exactGraphicsV0GlyphId: owner.exactGraphicsV0GlyphId,
      candidateAliasCount: owner.candidateAliases.length,
      semanticAliasCount: semanticCoverage.length,
      demandedSemanticCount: semanticCoverage.filter((semantic) => semantic.demandMultiplicity > 0).length,
      blindSpotSemanticCount: semanticCoverage.filter((semantic) => semantic.isBlindSpot).length,
      exactWeightedDemand,
      models: [...owner.models].sort((a, b) => MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b)),
      topologies: [...owner.topologies].sort((a, b) => TOPOLOGY_ORDER.indexOf(a) - TOPOLOGY_ORDER.indexOf(b)),
      strategyCoverage,
      strategySupportCount: STRATEGY_ORDER.filter((strategy) => strategyCoverage[strategy].length > 0).length,
      representative: owner.candidateAliases[0],
      candidateAliases: owner.candidateAliases,
      semanticCoverage,
    };
  });

  const exactReuseOwners = owners.filter((owner) => owner.exactGraphicsV0GlyphId !== null);
  const novelOwners = owners.filter((owner) => owner.exactGraphicsV0GlyphId === null);
  const totalOwnerDemand = owners.reduce((sum, owner) => sum + owner.exactWeightedDemand, 0);

  const classificationSummary = {
    bySemanticAliasCount: {},
    byCandidateAliasCount: {},
    byModelCount: {},
    byTopologySignature: {},
    byDemandBand: {},
    byStrategySupportCount: {},
    multiSemanticOwners: [],
    multiModelOwners: [],
  };

  for (const owner of owners) {
    incrementObjectCounter(classificationSummary.bySemanticAliasCount, String(owner.semanticAliasCount));
    incrementObjectCounter(classificationSummary.byCandidateAliasCount, String(owner.candidateAliasCount));
    incrementObjectCounter(classificationSummary.byModelCount, String(owner.models.length));
    incrementObjectCounter(classificationSummary.byTopologySignature, owner.topologies.join("+"));
    incrementObjectCounter(classificationSummary.byDemandBand, demandBand(owner.exactWeightedDemand));
    incrementObjectCounter(classificationSummary.byStrategySupportCount, String(owner.strategySupportCount));
    if (owner.semanticAliasCount > 1) classificationSummary.multiSemanticOwners.push(owner.ownerId);
    if (owner.models.length > 1) classificationSummary.multiModelOwners.push(owner.ownerId);
  }

  const strategyOwnerCoverage = Object.fromEntries(STRATEGY_ORDER.map((strategy) => {
    const touched = owners.filter((owner) => owner.strategyCoverage[strategy].length > 0);
    const selectedKeys = new Set(touched.flatMap((owner) => owner.strategyCoverage[strategy]));
    return [strategy, {
      selectedSemantics: selectedKeys.size,
      visualOwners: touched.length,
      novelVisualOwners: touched.filter((owner) => owner.reuseStatus === "novel-junction-owner").length,
      graphicsV0ReuseOwners: touched.filter((owner) => owner.reuseStatus === "graphics-v0-exact-reuse").length,
    }];
  }));

  const byModel = Object.fromEntries(MODEL_ORDER.map((model) => [model, {
    candidates: THEORETICAL_TOTAL,
    uniqueRasters: perModelOwnerSets[model].size,
    graphicsV0ReuseOwners: perModelReuseSets[model].size,
  }]));

  const stats = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-candidate-stats",
    schemaVersion: 1,
    status: "5A.3-allocation-free",
    semanticUniverse: semanticUniverse.length,
    demandedSemantics: DEMANDED_TOTAL,
    blindSpotSemantics: blindSpotKeys.size,
    totalWeightedDemand: TOTAL_WEIGHTED_DEMAND,
    modelCount: MODEL_ORDER.length,
    models: MODEL_ORDER,
    candidateCount: candidates.length,
    validCandidateCount: candidates.length - invalidCandidateCount,
    invalidCandidateCount,
    uniqueRasterOwners: owners.length,
    graphicsV0ReuseOwners: exactReuseOwners.length,
    novelJunctionOwners: novelOwners.length,
    candidateToRasterCompression: rounded(candidates.length / Math.max(1, owners.length)),
    multiSemanticOwnerCount: classificationSummary.multiSemanticOwners.length,
    multiModelOwnerCount: classificationSummary.multiModelOwners.length,
    maximumSemanticAliasesPerOwner: Math.max(...owners.map((owner) => owner.semanticAliasCount)),
    maximumCandidateAliasesPerOwner: Math.max(...owners.map((owner) => owner.candidateAliasCount)),
    summedOwnerDemandMultiplicity: totalOwnerDemand,
    byModel,
    strategyOwnerCoverage,
    junctionAllocations: 0,
    protectedReserveSlots: RESERVE_SLOTS,
  };

  const candidateDocument = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-candidates",
    schemaVersion: 1,
    status: "5A.3-research-only-unallocated",
    candidateCount: candidates.length,
    candidates,
  };

  const ownerDocument = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-visual-owners",
    schemaVersion: 1,
    status: "5A.3-research-only-unallocated",
    ownerCount: owners.length,
    ownerIdentity: "exact 8x16 bitmap key across all four junction geometry models",
    owners,
  };

  const reuseDocument = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-exact-reuse",
    schemaVersion: 1,
    graphicsV0ReuseOwnerCount: exactReuseOwners.length,
    novelOwnerCount: novelOwners.length,
    owners: exactReuseOwners.map((owner) => ({
      ownerId: owner.ownerId,
      bitmapKey: owner.bitmapKey,
      exactGraphicsV0GlyphId: owner.exactGraphicsV0GlyphId,
      semanticAliasCount: owner.semanticAliasCount,
      candidateAliasCount: owner.candidateAliasCount,
    })),
  };

  const classifications = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-owner-classifications",
    schemaVersion: 1,
    ownerCount: owners.length,
    ...classificationSummary,
    strategyOwnerCoverage,
  };

  const spec = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-candidate-research",
    schemaVersion: 1,
    status: "5A.3-exhaustive-candidates-global-exact-dedup",
    frozenInput: {
      semanticUniverse: THEORETICAL_TOTAL,
      demandedSemantics: DEMANDED_TOTAL,
      blindSpotSemantics: 100,
      weightedDemand: TOTAL_WEIGHTED_DEMAND,
      geometryModels: MODEL_ORDER,
      graphicsPublication: "graphscii-graphics-v0",
      protectedReserveSlots: RESERVE_SLOTS,
      junctionAllocations: 0,
    },
    candidateIdentity: "geometry model + exact boundary-port semantic tuple",
    visualOwnerIdentity: "exact canonical 8x16 bitmap key",
    demandAccounting: "sum each unique semantic tuple once per visual owner, never once per geometry-model alias",
    coverageSignals: STRATEGY_ORDER,
    next: "5A.4 demand/breadth/Pareto owner optimization across budgets K=0..604",
  };

  return {
    stats,
    texts: {
      "candidate-stats.json": jsonText(stats),
      "candidates.json": jsonText(candidateDocument),
      "unique-rasters.json": jsonText(ownerDocument),
      "exact-reuse.json": jsonText(reuseDocument),
      "classifications.json": jsonText(classifications),
      "candidate-report.md": reportMarkdown(stats),
      "spec/junction-candidate-research-v0.json": jsonText(spec),
    },
  };
}

export async function generateJunctionCandidateArtifacts(repoRoot) {
  const built = await buildJunctionCandidateDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "research", "junctions");
  await mkdir(outputRoot, { recursive: true });
  for (const [relativePath, content] of Object.entries(built.texts)) {
    const target = relativePath.startsWith("spec/") ? path.join(repoRoot, relativePath) : path.join(outputRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  return built.stats;
}

export async function verifyJunctionCandidateArtifacts(repoRoot) {
  const built = await buildJunctionCandidateDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "research", "junctions");
  for (const [relativePath, expected] of Object.entries(built.texts)) {
    const target = relativePath.startsWith("spec/") ? path.join(repoRoot, relativePath) : path.join(outputRoot, relativePath);
    const actual = await readFile(target, "utf8");
    if (actual !== expected) throw new Error(`${relativePath} is stale or non-deterministic for Milestone 5A.3.`);
  }
  if (built.stats.semanticUniverse !== THEORETICAL_TOTAL) throw new Error("5A.3 semantic universe changed.");
  if (built.stats.candidateCount !== THEORETICAL_TOTAL * MODEL_ORDER.length) throw new Error("5A.3 exhaustive candidate count changed.");
  if (built.stats.validCandidateCount !== built.stats.candidateCount || built.stats.invalidCandidateCount !== 0) throw new Error("5A.3 boundary-safe candidate validity failed.");
  if (built.stats.junctionAllocations !== 0 || built.stats.protectedReserveSlots !== RESERVE_SLOTS) throw new Error("5A.3 reserve invariant failed.");
  if (!STRATEGY_ORDER.every((strategy) => built.stats.strategyOwnerCoverage[strategy].selectedSemantics === 600)) throw new Error("5A.3 lost a 600-semantic coverage baseline.");
  return built.stats;
}
