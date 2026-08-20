import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TOPOLOGIES = ["LRT", "LRB", "LTB", "RTB", "LRTB"];
const EXPECTED_THEORETICAL = 22528;
const EXPECTED_DEMANDED = 22428;
const EXPECTED_MISSING = 100;

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function portRange(edge) {
  return edge === "L" || edge === "R" ? 16 : 8;
}

function enumerateTopology(topology) {
  const edges = [...topology];
  const result = [];
  function visit(index, labels) {
    if (index === edges.length) {
      result.push({ topology, key: labels.join(","), ports: [...labels] });
      return;
    }
    const edge = edges[index];
    for (let port = 0; port < portRange(edge); port += 1) {
      labels.push(`${edge}${port}`);
      visit(index + 1, labels);
      labels.pop();
    }
  }
  visit(0, []);
  return result;
}

export async function buildJunctionBlindSpots(repoRoot) {
  const demand = await readJson(path.join(repoRoot, "artifacts", "research", "junctions", "demand-map.json"));
  const demanded = new Set(demand.semantics.map((entry) => entry.key));
  const theoretical = TOPOLOGIES.flatMap(enumerateTopology);
  const missing = theoretical.filter((entry) => !demanded.has(entry.key));
  const missingByTopology = Object.fromEntries(TOPOLOGIES.map((topology) => [topology, 0]));
  for (const entry of missing) missingByTopology[entry.topology] += 1;

  if (theoretical.length !== EXPECTED_THEORETICAL) {
    throw new Error(`Expected ${EXPECTED_THEORETICAL} theoretical junction semantics, got ${theoretical.length}.`);
  }
  if (demanded.size !== EXPECTED_DEMANDED || missing.length !== EXPECTED_MISSING) {
    throw new Error("Milestone 5A.1 measured theoretical-coverage fixture changed.");
  }

  return {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-junction-demand-blind-spots",
    schemaVersion: 1,
    status: "5A.1-allocation-free",
    theoreticalSemanticCount: theoretical.length,
    demandedSemanticCount: demanded.size,
    missingSemanticCount: missing.length,
    coveragePercent: Number((demanded.size * 100 / theoretical.length).toFixed(6)),
    missingByTopology,
    interpretation: "These semantics received zero demand from the measured two-/three-straight selectable-ray composition model. They remain breadth-protection candidates, not rejected junctions.",
    missingSemantics: missing,
  };
}

export async function generateJunctionBlindSpots(repoRoot) {
  const document = await buildJunctionBlindSpots(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "research", "junctions");
  await mkdir(outputRoot, { recursive: true });
  await writeFile(path.join(outputRoot, "blind-spots.json"), jsonText(document));
  return document;
}

export async function verifyJunctionBlindSpots(repoRoot) {
  const expected = await buildJunctionBlindSpots(repoRoot);
  const filename = path.join(repoRoot, "artifacts", "research", "junctions", "blind-spots.json");
  const actual = await readFile(filename, "utf8");
  if (actual !== jsonText(expected)) {
    throw new Error("artifacts/research/junctions/blind-spots.json does not match deterministic Milestone 5A.1 generation.");
  }
  if (
    expected.missingSemanticCount !== 100 ||
    expected.missingByTopology.LRT !== 0 ||
    expected.missingByTopology.LRB !== 0 ||
    expected.missingByTopology.LTB !== 0 ||
    expected.missingByTopology.RTB !== 0 ||
    expected.missingByTopology.LRTB !== 100
  ) {
    throw new Error("Milestone 5A.1 blind-spot topology fixture mismatch.");
  }
  return {
    theoreticalSemanticCount: expected.theoreticalSemanticCount,
    demandedSemanticCount: expected.demandedSemanticCount,
    missingSemanticCount: expected.missingSemanticCount,
    missingByTopology: expected.missingByTopology,
  };
}
