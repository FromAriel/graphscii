import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ALL_FAMILIES,
  CELL_HEIGHT,
  CELL_WIDTH,
  formatPort,
  generate,
  portToPixel,
} from "../dist/core/index.js";

const TOPOLOGY_ORDER = ["LRT", "LRB", "LTB", "RTB", "LRTB"];
const TOPOLOGY_SET = new Set(TOPOLOGY_ORDER);
const EDGE_ORDER = new Map([["L", 0], ["R", 1], ["T", 2], ["B", 3]]);
const ZONE_COLUMNS = 4;
const ZONE_ROWS = 4;
const PORT_BANDS = 4;
const ANGLE_SECTORS = 16;
const MAX_SOURCE_EXAMPLES = 8;
const MAX_SEMANTIC_HUB_EXAMPLES = 8;
const THEORETICAL_REFERENCE_SEMANTICS = 22528;

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const r = x % y;
    x = y;
    y = r;
  }
  return x || 1;
}

function fraction(num, den) {
  if (den === 0) throw new Error("Cannot normalize zero-denominator fraction.");
  let n = num;
  let d = den;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { num: n / g, den: d / g };
}

function fractionKey(value) {
  return `${value.num}/${value.den}`;
}

function fractionDecimal(value) {
  return value.num / value.den;
}

function rounded(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function segmentIntersection(a0, a1, b0, b1) {
  const r = subtract(a1, a0);
  const s = subtract(b1, b0);
  let den = cross(r, s);
  if (den === 0) return null;

  const qMinusP = subtract(b0, a0);
  let tNum = cross(qMinusP, s);
  let uNum = cross(qMinusP, r);
  if (den < 0) {
    den = -den;
    tNum = -tNum;
    uNum = -uNum;
  }
  if (tNum <= 0 || tNum >= den || uNum <= 0 || uNum >= den) return null;

  const x = fraction(a0.x * den + r.x * tNum, den);
  const y = fraction(a0.y * den + r.y * tNum, den);
  return { x, y, key: `${fractionKey(x)},${fractionKey(y)}` };
}

function comparePorts(a, b) {
  return (EDGE_ORDER.get(a.edge) - EDGE_ORDER.get(b.edge)) || (a.index - b.index);
}

function uniquePorts(lines) {
  const byLabel = new Map();
  for (const line of lines) {
    byLabel.set(formatPort(line.start), line.start);
    byLabel.set(formatPort(line.end), line.end);
  }
  return [...byLabel.values()].sort(comparePorts);
}

function topologyForPorts(ports) {
  if (ports.length !== 3 && ports.length !== 4) return null;
  const edges = new Set(ports.map((port) => port.edge));
  if (edges.size !== ports.length) return null;
  const topology = ["L", "R", "T", "B"].filter((edge) => edges.has(edge)).join("");
  return TOPOLOGY_SET.has(topology) ? topology : null;
}

function combinations(items, size) {
  const result = [];
  const chosen = [];
  function visit(start) {
    if (chosen.length === size) {
      result.push([...chosen]);
      return;
    }
    const needed = size - chosen.length;
    for (let index = start; index <= items.length - needed; index += 1) {
      chosen.push(items[index]);
      visit(index + 1);
      chosen.pop();
    }
  }
  visit(0);
  return result;
}

function validRaySubsets(lines) {
  const ports = uniquePorts(lines);
  const result = [];
  for (const size of [3, 4]) {
    if (ports.length < size) continue;
    for (const subset of combinations(ports, size)) {
      const topology = topologyForPorts(subset);
      if (topology) result.push({ ports: subset, topology });
    }
  }
  return result;
}

function portCount(edge) {
  return edge === "L" || edge === "R" ? CELL_HEIGHT : CELL_WIDTH;
}

function portBand(port) {
  return Math.min(PORT_BANDS - 1, Math.floor((port.index * PORT_BANDS) / portCount(port.edge)));
}

function hubZone(hub) {
  const x = fractionDecimal(hub.x);
  const y = fractionDecimal(hub.y);
  const column = Math.min(ZONE_COLUMNS - 1, Math.floor((x * ZONE_COLUMNS) / CELL_WIDTH));
  const row = Math.min(ZONE_ROWS - 1, Math.floor((y * ZONE_ROWS) / CELL_HEIGHT));
  return { column, row, key: `z${row}${column}` };
}

function nearestIntegers(value, maxValue) {
  const floorValue = Math.floor(value.num / value.den);
  const ceilValue = Math.ceil(value.num / value.den);
  if (floorValue === ceilValue) return [Math.max(0, Math.min(maxValue, floorValue))];
  const floorDistance = value.num - floorValue * value.den;
  const ceilDistance = ceilValue * value.den - value.num;
  const values = floorDistance < ceilDistance
    ? [floorValue]
    : ceilDistance < floorDistance
      ? [ceilValue]
      : [floorValue, ceilValue];
  return values.filter((entry) => entry >= 0 && entry <= maxValue);
}

function nearestHubPixels(hub) {
  const xs = nearestIntegers(hub.x, CELL_WIDTH - 1);
  const ys = nearestIntegers(hub.y, CELL_HEIGHT - 1);
  const pixels = [];
  for (const y of ys) {
    for (const x of xs) pixels.push({ x, y, key: `${x},${y}` });
  }
  return pixels;
}

function normalizedAngleDegrees(hub, port) {
  const point = portToPixel(port);
  const dx = point.x - fractionDecimal(hub.x);
  const dy = point.y - fractionDecimal(hub.y);
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  return angle;
}

function angleSector(angle) {
  return Math.floor((angle + 360 / ANGLE_SECTORS / 2) / (360 / ANGLE_SECTORS)) % ANGLE_SECTORS;
}

function circularSeparation(a, b) {
  const delta = Math.abs(a - b) % 360;
  return Math.min(delta, 360 - delta);
}

function separationBucket(value) {
  if (value < 15) return "00-15";
  if (value < 30) return "15-30";
  if (value < 60) return "30-60";
  if (value < 90) return "60-90";
  if (value < 120) return "90-120";
  if (value < 150) return "120-150";
  return "150-180";
}

function nearestAxisDistance(angle, offset) {
  let best = Infinity;
  for (let candidate = offset; candidate < 360; candidate += 90) {
    best = Math.min(best, circularSeparation(angle, candidate));
  }
  return best;
}

function classifyShape(angles) {
  const pairwise = [];
  for (let i = 0; i < angles.length; i += 1) {
    for (let j = i + 1; j < angles.length; j += 1) {
      pairwise.push(circularSeparation(angles[i], angles[j]));
    }
  }
  const minPairwise = Math.min(...pairwise);
  const maxPairwise = Math.max(...pairwise);
  if (minPairwise < 15) return "near-degenerate";
  if (angles.length === 3) {
    if (maxPairwise >= 150) return "T-like";
    if (minPairwise >= 60 && maxPairwise <= 150) return "Y-like";
    return "strongly-asymmetric";
  }
  const cardinalScore = Math.max(...angles.map((angle) => nearestAxisDistance(angle, 0)));
  const diagonalScore = Math.max(...angles.map((angle) => nearestAxisDistance(angle, 45)));
  if (cardinalScore <= 15) return "cross-like";
  if (diagonalScore <= 15) return "X-like";
  const sorted = [...angles].sort((a, b) => a - b);
  const gaps = sorted.map((angle, index) => {
    const next = index + 1 < sorted.length ? sorted[index + 1] : sorted[0] + 360;
    return next - angle;
  });
  if (Math.max(...gaps) - Math.min(...gaps) > 90) return "strongly-asymmetric";
  return "mixed-angle";
}

function geometryForDemand(hub, ports) {
  const zone = hubZone(hub);
  const branchAngles = ports.map((port) => {
    const angle = normalizedAngleDegrees(hub, port);
    return {
      port: formatPort(port),
      angleDegrees: rounded(angle),
      sector: angleSector(angle),
      portBand: portBand(port),
    };
  });
  const separations = [];
  for (let i = 0; i < branchAngles.length; i += 1) {
    for (let j = i + 1; j < branchAngles.length; j += 1) {
      const separation = circularSeparation(branchAngles[i].angleDegrees, branchAngles[j].angleDegrees);
      separations.push({
        ports: [branchAngles[i].port, branchAngles[j].port],
        degrees: rounded(separation),
        bucket: separationBucket(separation),
      });
    }
  }
  const shapeCharacter = classifyShape(branchAngles.map((entry) => entry.angleDegrees));
  return { zone, branchAngles, separations, shapeCharacter };
}

function semanticKey(ports) {
  return ports.map(formatPort).join(",");
}

function makeSemanticState(ports, topology) {
  return {
    key: semanticKey(ports),
    topology,
    ports: ports.map((port) => ({
      edge: port.edge,
      index: port.index,
      label: formatPort(port),
      band: portBand(port),
    })),
    demandMultiplicity: 0,
    pairDemand: 0,
    tripleDemand: 0,
    hubDemand: new Map(),
    zoneDemand: new Map(),
    shapeDemand: new Map(),
    sourceExamples: [],
  };
}

function incrementMap(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function makeCoverageAccumulator() {
  return new Map();
}

function addCoverage(accumulator, key, semanticKeyValue, weight = 1) {
  let current = accumulator.get(key);
  if (!current) {
    current = { key, semantics: new Set(), weightedDemand: 0 };
    accumulator.set(key, current);
  }
  current.semantics.add(semanticKeyValue);
  current.weightedDemand += weight;
}

function serializeCoverage(accumulator) {
  return [...accumulator.values()]
    .map((entry) => ({ key: entry.key, semanticCount: entry.semantics.size, weightedDemand: entry.weightedDemand }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function makeCoverageSet() {
  return {
    topology: makeCoverageAccumulator(),
    hubZone: makeCoverageAccumulator(),
    exactPort: makeCoverageAccumulator(),
    normalizedPortBand: makeCoverageAccumulator(),
    branchAngleSector: makeCoverageAccumulator(),
    pairwiseAngularSeparation: makeCoverageAccumulator(),
    shapeCharacter: makeCoverageAccumulator(),
    symmetryOrientationClass: makeCoverageAccumulator(),
  };
}

function addDemandEvent(semanticMap, coverage, hubDemandMap, hub, ports, topology, lines, compositionKind) {
  const key = semanticKey(ports);
  let semantic = semanticMap.get(key);
  if (!semantic) {
    semantic = makeSemanticState(ports, topology);
    semanticMap.set(key, semantic);
  }
  const geometry = geometryForDemand(hub, ports);
  semantic.demandMultiplicity += 1;
  if (compositionKind === "pair") semantic.pairDemand += 1;
  else semantic.tripleDemand += 1;
  incrementMap(semantic.hubDemand, hub.key);
  incrementMap(semantic.zoneDemand, geometry.zone.key);
  incrementMap(semantic.shapeDemand, geometry.shapeCharacter);
  incrementMap(hubDemandMap, hub.key);

  if (semantic.sourceExamples.length < MAX_SOURCE_EXAMPLES) {
    semantic.sourceExamples.push({
      kind: compositionKind,
      hub: hub.key,
      candidateIds: lines.map((line) => line.candidateId).sort((a, b) => a - b),
      selectedPorts: ports.map(formatPort),
    });
  }

  addCoverage(coverage.topology, topology, key);
  addCoverage(coverage.hubZone, geometry.zone.key, key);
  addCoverage(coverage.shapeCharacter, geometry.shapeCharacter, key);
  addCoverage(coverage.symmetryOrientationClass, `${topology}:${geometry.shapeCharacter}:${geometry.zone.key}`, key);
  for (const port of ports) {
    addCoverage(coverage.exactPort, formatPort(port), key);
    addCoverage(coverage.normalizedPortBand, `${port.edge}:band-${portBand(port)}`, key);
  }
  for (const branch of geometry.branchAngles) {
    addCoverage(coverage.branchAngleSector, `sector-${String(branch.sector).padStart(2, "0")}`, key);
  }
  for (const separation of geometry.separations) {
    addCoverage(coverage.pairwiseAngularSeparation, separation.bucket, key);
  }
}

function sortedDemandMap(map) {
  return [...map.entries()]
    .map(([key, weightedDemand]) => ({ key, weightedDemand }))
    .sort((a, b) => b.weightedDemand - a.weightedDemand || a.key.localeCompare(b.key));
}

function serializeSemantic(state, semanticId) {
  const hubs = sortedDemandMap(state.hubDemand);
  return {
    semanticId,
    key: state.key,
    topology: state.topology,
    ports: state.ports,
    demandMultiplicity: state.demandMultiplicity,
    pairDemand: state.pairDemand,
    tripleDemand: state.tripleDemand,
    hubSupportCount: hubs.length,
    topHubs: hubs.slice(0, MAX_SEMANTIC_HUB_EXAMPLES),
    hubZoneDemand: sortedDemandMap(state.zoneDemand),
    shapeDemand: sortedDemandMap(state.shapeDemand),
    sourceExamples: state.sourceExamples,
  };
}

function summarizeTopology(semantics) {
  const result = Object.fromEntries(TOPOLOGY_ORDER.map((key) => [key, { semanticCount: 0, weightedDemand: 0 }]));
  for (const semantic of semantics) {
    result[semantic.topology].semanticCount += 1;
    result[semantic.topology].weightedDemand += semantic.demandMultiplicity;
  }
  return result;
}

function exactCenterKey() {
  return `${fractionKey(fraction(7, 2))},${fractionKey(fraction(15, 2))}`;
}

function reportMarkdown(stats, hubDensity, coverageBuckets) {
  const topologyLines = TOPOLOGY_ORDER.map((key) => {
    const value = stats.topologies[key];
    return `| ${key} | ${value.semanticCount.toLocaleString("en-US")} | ${value.weightedDemand.toLocaleString("en-US")} |`;
  }).join("\n");
  const hubLines = hubDensity.exactHubs.slice(0, 12).map((hub, index) =>
    `| ${index + 1} | ${hub.key} | ${hub.xDecimal}, ${hub.yDecimal} | ${hub.intersectionPairCount.toLocaleString("en-US")} | ${hub.junctionDemand.toLocaleString("en-US")} | ${hub.zone} |`
  ).join("\n");
  const zoneLines = [...coverageBuckets.hubZone]
    .sort((a, b) => b.weightedDemand - a.weightedDemand || a.key.localeCompare(b.key))
    .map((entry) => `| ${entry.key} | ${entry.semanticCount.toLocaleString("en-US")} | ${entry.weightedDemand.toLocaleString("en-US")} |`)
    .join("\n");

  return `# Milestone 5A.1 Junction Demand Map\n\n` +
    `Status: **GENERATED RESEARCH — ALLOCATION-FREE**\n\n` +
    `This artifact measures where the existing 832-definition straight GraphSCII language naturally creates junction demand. At every exact interior straight-line intersection, each contributing straight supplies two selectable rays from the hub to its boundary ports. Valid 3-ray and 4-ray subsets become junction demand events. No junction codepoints are allocated.\n\n` +
    `## Headline measurements\n\n` +
    `- Straight mathematical definitions: **${stats.straightSemanticDefinitions.toLocaleString("en-US")}**\n` +
    `- Unordered straight pairs examined: **${stats.totalPossiblePairs.toLocaleString("en-US")}**\n` +
    `- Strict interior intersecting pairs: **${stats.interiorIntersectingPairs.toLocaleString("en-US")}**\n` +
    `- Exact mathematical hub positions: **${stats.exactHubCount.toLocaleString("en-US")}**\n` +
    `- Pair source compositions producing demand: **${stats.pairSourcesWithDemand.toLocaleString("en-US")}**\n` +
    `- Pair-derived junction demand events: **${stats.pairDemandEvents.toLocaleString("en-US")}**\n` +
    `- Concurrent straight triples examined: **${stats.tripleCombinationsConsidered.toLocaleString("en-US")}**\n` +
    `- Triple source compositions producing demand: **${stats.tripleSourcesWithDemand.toLocaleString("en-US")}**\n` +
    `- Triple-derived junction demand events: **${stats.tripleDemandEvents.toLocaleString("en-US")}**\n` +
    `- Unique demanded port semantics: **${stats.uniqueDemandSemantics.toLocaleString("en-US")} of ${THEORETICAL_REFERENCE_SEMANTICS.toLocaleString("en-US")}** (${stats.theoreticalSemanticCoveragePercent.toFixed(3)}%)\n` +
    `- Total weighted demand multiplicity: **${stats.totalDemandMultiplicity.toLocaleString("en-US")}**\n` +
    `- Exact center-hub demand share: **${stats.centerHubDemandSharePercent.toFixed(3)}%**\n` +
    `- PUA reserve consumed: **0 of 604**\n\n` +
    `## Topology demand\n\n| Topology | Unique semantics | Weighted demand |\n| --- | ---: | ---: |\n${topologyLines}\n\n` +
    `## Highest-demand exact hubs\n\n| Rank | Exact hub | Decimal hub | Intersecting pairs | Junction demand | Zone |\n| ---: | --- | --- | ---: | ---: | --- |\n${hubLines}\n\n` +
    `## Coarse 4×4 hub-zone demand\n\n| Zone | Unique semantics | Weighted demand |\n| --- | ---: | ---: |\n${zoneLines}\n\n` +
    `The demand semantics are keyed by boundary-port tuple, matching the 22,528 one-port-per-edge reference universe. Exact hub positions remain a measured distribution attached to those semantics rather than multiplying the semantic address space.\n\n` +
    `Milestone 5A.2 will use this demand field to compare mathematical-intersection, symmetric half-pixel-center, and central-2×2 raster models.\n`;
}

function buildResearchSpec(stats) {
  return {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-coverage-research",
    schemaVersion: 1,
    status: "5A.1-demand-map-complete-allocation-free",
    canonicalCell: { width: CELL_WIDTH, height: CELL_HEIGHT },
    frozenInput: {
      publication: "graphscii-graphics-v0",
      straightSemanticDefinitions: 832,
      straightVisualOwners: 746,
      encodedGraphics: 5796,
      allocatedEnd: "U+00F6A3",
      reserveStart: "U+00F6A4",
      reserveEnd: "U+00F8FF",
      reserveSlots: 604,
      junctionAllocations: 0,
    },
    demandMethod: {
      pairIntersections: "strict-interior exact rational segment intersections",
      selectableRays: "each concurrent straight contributes hub-to-endpoint rays",
      pairAndTripleRaySubsets: [3, 4],
      topologyGate: [...TOPOLOGY_ORDER],
      onePortPerParticipatingEdge: true,
      semanticIdentity: "sorted boundary-port tuple; exact hub is demand metadata",
      theoreticalReferenceSemanticCount: THEORETICAL_REFERENCE_SEMANTICS,
    },
    coverageTaxonomy: {
      hubGrid: { columns: ZONE_COLUMNS, rows: ZONE_ROWS },
      normalizedPortBandsPerEdge: PORT_BANDS,
      branchAngleSectors: ANGLE_SECTORS,
      pairwiseSeparationBucketsDegrees: ["00-15", "15-30", "30-60", "60-90", "90-120", "120-150", "150-180"],
      shapeClasses: ["T-like", "Y-like", "cross-like", "X-like", "mixed-angle", "strongly-asymmetric", "near-degenerate"],
    },
    measured: {
      totalPossiblePairs: stats.totalPossiblePairs,
      interiorIntersectingPairs: stats.interiorIntersectingPairs,
      exactHubCount: stats.exactHubCount,
      pairSourcesWithDemand: stats.pairSourcesWithDemand,
      pairDemandEvents: stats.pairDemandEvents,
      tripleCombinationsConsidered: stats.tripleCombinationsConsidered,
      tripleSourcesWithDemand: stats.tripleSourcesWithDemand,
      tripleDemandEvents: stats.tripleDemandEvents,
      uniqueDemandSemantics: stats.uniqueDemandSemantics,
      theoreticalSemanticCoveragePercent: stats.theoreticalSemanticCoveragePercent,
      totalDemandMultiplicity: stats.totalDemandMultiplicity,
      centerHubDemand: stats.centerHubDemand,
      centerHubDemandSharePercent: stats.centerHubDemandSharePercent,
      topologies: stats.topologies,
    },
    next: "5A.2 deterministic junction raster and hub-model sweep",
  };
}

export async function buildJunctionDemandDocuments(repoRoot) {
  const planningSpec = await readJson(path.join(repoRoot, "spec", "junction-coverage-plan-v0.json"));
  const publication = await readJson(path.join(repoRoot, "artifacts", "publications", "graphscii-graphics-v0.json"));
  if (planningSpec.frozenInput.junctionAllocationsDuring5A !== 0) {
    throw new Error("Milestone 5A planning contract must remain allocation-free.");
  }
  if (
    publication.encodedGraphics !== 5796 ||
    publication.allocation.unicodeEnd !== "U+00F6A3" ||
    publication.allocation.reserveStart !== "U+00F6A4" ||
    publication.allocation.reserveSlots !== 604
  ) {
    throw new Error("Milestone 5A.1 frozen graphics-v0 publication boundary mismatch.");
  }
  if (planningSpec.demandModel.theoreticalReferenceSemanticCount !== THEORETICAL_REFERENCE_SEMANTICS) {
    throw new Error("Milestone 5A.1 theoretical reference universe changed.");
  }

  const generated = generate(ALL_FAMILIES);
  if (generated.candidates.length !== 832 || generated.glyphs.length !== 746) {
    throw new Error("Milestone 5A.1 requires the frozen 832-definition / 746-owner straight vocabulary.");
  }

  const lines = generated.candidates.map((candidate) => ({
    ...candidate,
    p0: portToPixel(candidate.start),
    p1: portToPixel(candidate.end),
  }));
  const totalPossiblePairs = lines.length * (lines.length - 1) / 2;
  const hubs = new Map();
  const semanticMap = new Map();
  const coverage = makeCoverageSet();
  const hubDemandMap = new Map();
  let interiorIntersectingPairs = 0;
  let pairSourcesWithDemand = 0;
  let pairDemandEvents = 0;

  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const hub = segmentIntersection(lines[i].p0, lines[i].p1, lines[j].p0, lines[j].p1);
      if (!hub) continue;
      interiorIntersectingPairs += 1;
      let hubRecord = hubs.get(hub.key);
      if (!hubRecord) {
        hubRecord = { hub, lineIds: new Set(), intersectionPairCount: 0 };
        hubs.set(hub.key, hubRecord);
      }
      hubRecord.lineIds.add(i);
      hubRecord.lineIds.add(j);
      hubRecord.intersectionPairCount += 1;

      const sourceLines = [lines[i], lines[j]];
      const subsets = validRaySubsets(sourceLines);
      if (subsets.length > 0) pairSourcesWithDemand += 1;
      for (const subset of subsets) {
        addDemandEvent(semanticMap, coverage, hubDemandMap, hub, subset.ports, subset.topology, sourceLines, "pair");
        pairDemandEvents += 1;
      }
    }
  }

  let tripleCombinationsConsidered = 0;
  let tripleSourcesWithDemand = 0;
  let tripleDemandEvents = 0;
  for (const hubRecord of hubs.values()) {
    const ids = [...hubRecord.lineIds].sort((a, b) => a - b);
    if (ids.length < 3) continue;
    for (let a = 0; a < ids.length - 2; a += 1) {
      for (let b = a + 1; b < ids.length - 1; b += 1) {
        for (let c = b + 1; c < ids.length; c += 1) {
          tripleCombinationsConsidered += 1;
          const sourceLines = [lines[ids[a]], lines[ids[b]], lines[ids[c]]];
          const subsets = validRaySubsets(sourceLines);
          if (subsets.length > 0) tripleSourcesWithDemand += 1;
          for (const subset of subsets) {
            addDemandEvent(semanticMap, coverage, hubDemandMap, hubRecord.hub, subset.ports, subset.topology, sourceLines, "triple");
            tripleDemandEvents += 1;
          }
        }
      }
    }
  }

  const semanticEntries = [...semanticMap.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((state, index) => serializeSemantic(state, index));
  const totalDemandMultiplicity = semanticEntries.reduce((sum, entry) => sum + entry.demandMultiplicity, 0);
  const topologySummary = summarizeTopology(semanticEntries);
  const coverageBuckets = Object.fromEntries(Object.entries(coverage).map(([key, value]) => [key, serializeCoverage(value)]));

  const exactHubs = [...hubs.values()].map((record) => {
    const zone = hubZone(record.hub);
    return {
      key: record.hub.key,
      x: record.hub.x,
      y: record.hub.y,
      xDecimal: rounded(fractionDecimal(record.hub.x)),
      yDecimal: rounded(fractionDecimal(record.hub.y)),
      zone: zone.key,
      nearestPixels: nearestHubPixels(record.hub),
      intersectingLineCount: record.lineIds.size,
      intersectionPairCount: record.intersectionPairCount,
      junctionDemand: hubDemandMap.get(record.hub.key) ?? 0,
    };
  }).sort((a, b) => b.junctionDemand - a.junctionDemand || b.intersectionPairCount - a.intersectionPairCount || a.key.localeCompare(b.key));

  const pixelDensityMap = new Map();
  const zoneDensityMap = new Map();
  for (const hub of exactHubs) {
    for (const pixel of hub.nearestPixels) {
      const weight = 1 / hub.nearestPixels.length;
      const current = pixelDensityMap.get(pixel.key) ?? { key: pixel.key, x: pixel.x, y: pixel.y, intersectionPairWeight: 0, junctionDemandWeight: 0 };
      current.intersectionPairWeight += hub.intersectionPairCount * weight;
      current.junctionDemandWeight += hub.junctionDemand * weight;
      pixelDensityMap.set(pixel.key, current);
    }
    const zoneCurrent = zoneDensityMap.get(hub.zone) ?? { key: hub.zone, exactHubCount: 0, intersectionPairs: 0, junctionDemand: 0 };
    zoneCurrent.exactHubCount += 1;
    zoneCurrent.intersectionPairs += hub.intersectionPairCount;
    zoneCurrent.junctionDemand += hub.junctionDemand;
    zoneDensityMap.set(hub.zone, zoneCurrent);
  }

  const centerKey = exactCenterKey();
  const centerHub = exactHubs.find((hub) => hub.key === centerKey) ?? null;
  const centerHubDemand = centerHub?.junctionDemand ?? 0;
  const centerHubDemandSharePercent = totalDemandMultiplicity === 0 ? 0 : centerHubDemand * 100 / totalDemandMultiplicity;
  const theoreticalSemanticCoveragePercent = semanticEntries.length * 100 / THEORETICAL_REFERENCE_SEMANTICS;

  const stats = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-demand-stats",
    schemaVersion: 2,
    status: "5A.1-allocation-free",
    straightSemanticDefinitions: generated.candidates.length,
    straightVisualOwners: generated.glyphs.length,
    totalPossiblePairs,
    interiorIntersectingPairs,
    exactHubCount: hubs.size,
    pairSourcesWithDemand,
    pairDemandEvents,
    tripleCombinationsConsidered,
    tripleSourcesWithDemand,
    tripleDemandEvents,
    uniqueDemandSemantics: semanticEntries.length,
    totalDemandMultiplicity,
    theoreticalReferenceSemantics: THEORETICAL_REFERENCE_SEMANTICS,
    theoreticalSemanticCoveragePercent: rounded(theoreticalSemanticCoveragePercent, 6),
    centerHubKey: centerKey,
    centerHubDemand,
    centerHubDemandSharePercent: rounded(centerHubDemandSharePercent, 6),
    junctionAllocations: 0,
    reserveSlots: 604,
    topologies: topologySummary,
  };

  const demandMap = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-demand-map",
    schemaVersion: 2,
    status: "research-allocation-free",
    semanticIdentity: "sorted boundary-port tuple",
    semanticCount: semanticEntries.length,
    totalDemandMultiplicity,
    semantics: semanticEntries,
  };

  const hubDensity = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-hub-density",
    schemaVersion: 2,
    exactHubCount: exactHubs.length,
    exactCenter: centerHub,
    exactHubs,
    nearestRasterPixels: [...pixelDensityMap.values()]
      .map((entry) => ({ ...entry, intersectionPairWeight: rounded(entry.intersectionPairWeight), junctionDemandWeight: rounded(entry.junctionDemandWeight) }))
      .sort((a, b) => b.junctionDemandWeight - a.junctionDemandWeight || a.y - b.y || a.x - b.x),
    coarseZones: [...zoneDensityMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };

  const coverageDocument = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-coverage-buckets",
    schemaVersion: 2,
    taxonomy: {
      topology: [...TOPOLOGY_ORDER],
      hubGrid: { columns: ZONE_COLUMNS, rows: ZONE_ROWS },
      normalizedPortBandsPerEdge: PORT_BANDS,
      branchAngleSectors: ANGLE_SECTORS,
      angleSectorDegrees: 360 / ANGLE_SECTORS,
    },
    buckets: coverageBuckets,
  };

  const spec = buildResearchSpec(stats);
  const report = reportMarkdown(stats, hubDensity, coverageBuckets);
  return {
    stats,
    texts: {
      "stats.json": jsonText(stats),
      "demand-map.json": jsonText(demandMap),
      "hub-density.json": jsonText(hubDensity),
      "coverage-buckets.json": jsonText(coverageDocument),
      "report.md": report,
      "spec/junction-coverage-research-v0.json": jsonText(spec),
    },
  };
}

export async function generateJunctionDemandArtifacts(repoRoot) {
  const built = await buildJunctionDemandDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "research", "junctions");
  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputRoot, "stats.json"), built.texts["stats.json"]),
    writeFile(path.join(outputRoot, "demand-map.json"), built.texts["demand-map.json"]),
    writeFile(path.join(outputRoot, "hub-density.json"), built.texts["hub-density.json"]),
    writeFile(path.join(outputRoot, "coverage-buckets.json"), built.texts["coverage-buckets.json"]),
    writeFile(path.join(outputRoot, "report.md"), built.texts["report.md"]),
    writeFile(path.join(repoRoot, "spec", "junction-coverage-research-v0.json"), built.texts["spec/junction-coverage-research-v0.json"]),
  ]);
  return built.stats;
}

export async function verifyJunctionDemandArtifacts(repoRoot) {
  const built = await buildJunctionDemandDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "research", "junctions");
  const checks = [
    [path.join(outputRoot, "stats.json"), built.texts["stats.json"]],
    [path.join(outputRoot, "demand-map.json"), built.texts["demand-map.json"]],
    [path.join(outputRoot, "hub-density.json"), built.texts["hub-density.json"]],
    [path.join(outputRoot, "coverage-buckets.json"), built.texts["coverage-buckets.json"]],
    [path.join(outputRoot, "report.md"), built.texts["report.md"]],
    [path.join(repoRoot, "spec", "junction-coverage-research-v0.json"), built.texts["spec/junction-coverage-research-v0.json"]],
  ];
  for (const [filename, expected] of checks) {
    const actual = await readFile(filename, "utf8");
    if (actual !== expected) throw new Error(`${path.relative(repoRoot, filename)} does not match deterministic Milestone 5A.1 generation.`);
  }
  if (
    built.stats.straightSemanticDefinitions !== 832 ||
    built.stats.straightVisualOwners !== 746 ||
    built.stats.totalPossiblePairs !== 345696 ||
    built.stats.theoreticalReferenceSemantics !== THEORETICAL_REFERENCE_SEMANTICS ||
    built.stats.junctionAllocations !== 0 ||
    built.stats.reserveSlots !== 604
  ) {
    throw new Error("Milestone 5A.1 frozen input or allocation-free fixture mismatch.");
  }
  for (const topology of TOPOLOGY_ORDER) {
    if (built.stats.topologies[topology].semanticCount <= 0 || built.stats.topologies[topology].weightedDemand <= 0) {
      throw new Error(`Milestone 5A.1 demand model lost topology ${topology}.`);
    }
  }
  return built.stats;
}
