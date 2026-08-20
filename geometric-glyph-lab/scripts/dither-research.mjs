import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ALL_FAMILIES,
  CELL_HEIGHT,
  CELL_WIDTH,
  STRAIGHT_FILL_STYLE_DEFINITIONS,
  STRAIGHT_FILL_STYLE_ORDER,
  generate,
  generateStraightDitherSweep,
  generateStraightSolidFills,
  hasPixel,
} from "../dist/core/index.js";
import { encodeRgbaPng } from "./artifact-pipeline.mjs";

export const DITHER_RESEARCH_SCHEMA_VERSION = 1;

function renderAtlas(candidates, columns = 32) {
  const rows = Math.max(1, Math.ceil(candidates.length / columns));
  const width = columns * CELL_WIDTH;
  const height = rows * CELL_HEIGHT;
  const rgba = Buffer.alloc(width * height * 4);

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const cellX = index % columns;
    const cellY = Math.floor(index / columns);
    for (let y = 0; y < CELL_HEIGHT; y += 1) {
      for (let x = 0; x < CELL_WIDTH; x += 1) {
        if (!hasPixel(candidate.bitmap, x, y)) {
          continue;
        }
        const px = cellX * CELL_WIDTH + x;
        const py = cellY * CELL_HEIGHT + y;
        const offset = (py * width + px) * 4;
        rgba[offset] = 0;
        rgba[offset + 1] = 0;
        rgba[offset + 2] = 0;
        rgba[offset + 3] = 255;
      }
    }
  }

  return {
    width,
    height,
    columns,
    rows,
    png: encodeRgbaPng(width, height, rgba),
  };
}

function buildReport(stats, comparisons) {
  const lines = [
    "# GraphSCII Milestone 4B — Phase-Locked Dither Sweep",
    "",
    "Status: **RESEARCH COMPLETE — NO DITHER CODEPOINTS ALLOCATED**",
    "",
    "## Global result",
    "",
    "```text",
    `styled semantic candidates        ${stats.styledSemanticCandidates.toLocaleString("en-US")}`,
    `unique styled rasters             ${stats.uniqueStyledRasters.toLocaleString("en-US")}`,
    `published straight visuals        ${stats.publishedStraightVisuals.toLocaleString("en-US")}`,
    `novel solid visuals               ${stats.novelSolidVisuals.toLocaleString("en-US")}`,
    `novel dither visuals              ${stats.novelDitherVisuals.toLocaleString("en-US")}`,
    `combined visual vocabulary        ${stats.combinedStraightSolidAndDitherVisuals.toLocaleString("en-US")}`,
    "```",
    "",
    "## Per-style exact dedup",
    "",
    "| Style | Mask | Semantic | Unique | Straight reuse | Solid reuse | Same-style dup | Prior-dither reuse | New visuals |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];

  for (const style of stats.styles) {
    lines.push(
      `| ${style.style} | ${style.maskOnCells}/64 | ${style.semanticCandidates} | ${style.uniqueRasters} | ${style.straightReuseCandidates} | ${style.solidReuseCandidates} | ${style.sameStyleDuplicateCandidates} | ${style.priorDitherStyleReuseCandidates} | ${style.newVisuals} |`,
    );
  }

  lines.push(
    "",
    "## Hamming comparisons for identical geometry/side semantics",
    "",
    "| Style A | Style B | Exact | ≤1 px | ≤2 px | Min | Max | Mean |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
  );
  for (const comparison of comparisons) {
    lines.push(
      `| ${comparison.styleA} | ${comparison.styleB} | ${comparison.exactMatches} | ${comparison.withinOnePixel} | ${comparison.withinTwoPixels} | ${comparison.minDistance} | ${comparison.maxDistance} | ${comparison.meanDistance.toFixed(6)} |`,
    );
  }

  lines.push(
    "",
    "## Address-space consequence",
    "",
    `Keeping all five styles would require **${stats.combinedStraightSolidAndDitherVisuals.toLocaleString("en-US")}** distinct visual owners including the published straight vocabulary. This exceeds the preferred 4,096-slot U+E000..U+EFFF window, so Milestone 4C must prune the palette, move some styles to renderer-only transformations, or deliberately expand the address space before any fill/dither codepoint allocation.`,
    "",
  );

  return `${lines.join("\n")}\n`;
}

function buildResearchData() {
  const straight = generate(ALL_FAMILIES);
  const solid = generateStraightSolidFills(straight);
  const sweep = generateStraightDitherSweep(straight, solid);

  const masks = {
    format: "graphscii",
    formatVersion: 1,
    schema: "straight-fill-dither-masks",
    schemaVersion: DITHER_RESEARCH_SCHEMA_VERSION,
    phase: "cell-locked-8x8-repeat-y-mod-8",
    masks: STRAIGHT_FILL_STYLE_DEFINITIONS.map((definition) => ({
      id: definition.id,
      label: definition.label,
      onCells: definition.onCells,
      totalCells: definition.totalCells,
      density: definition.density,
      rows: [...definition.rows],
    })),
  };

  const stats = {
    format: "graphscii",
    formatVersion: 1,
    schema: "straight-fill-dither-research-stats",
    schemaVersion: DITHER_RESEARCH_SCHEMA_VERSION,
    status: "research-unallocated",
    ...sweep.stats,
    hammingComparisons: sweep.hammingComparisons,
  };

  const spec = {
    format: "graphscii",
    formatVersion: 1,
    schema: "straight-fill-dither-research",
    schemaVersion: DITHER_RESEARCH_SCHEMA_VERSION,
    status: "research-unallocated",
    source: {
      straightMathematicalDefinitions: straight.candidates.length,
      publishedStraightVisuals: straight.glyphs.length,
      solidSideSemantics: solid.candidates.length,
      novelSolidVisuals: solid.visuals.length,
    },
    styleOrder: [...STRAIGHT_FILL_STYLE_ORDER],
    maskPhase: "mask(x,y)=pattern[x,y mod 8]; phase locked to cell coordinates",
    boundaryRule: "existing Bresenham boundary stroke forced ON after side-region masking",
    sideRule: "oriented mathematical boundary; side A cross>0; side B cross<0",
    allocation: {
      status: "unallocated-research",
      codepointsAssigned: 0,
      firstAvailableProvisionalCodepoint: "U+00E2EA",
      decisionGate: "Milestone 4C",
    },
    counts: sweep.stats,
    masks: masks.masks,
    hammingComparisons: sweep.hammingComparisons,
  };

  const atlasFiles = {};
  const atlasManifest = {
    format: "graphscii",
    formatVersion: 1,
    schema: "straight-fill-dither-atlases",
    schemaVersion: DITHER_RESEARCH_SCHEMA_VERSION,
    cell: { width: CELL_WIDTH, height: CELL_HEIGHT },
    candidateOrder: "straight candidate ID ascending; one selected side per atlas",
    atlases: [],
  };

  for (const style of STRAIGHT_FILL_STYLE_ORDER) {
    for (const side of ["A", "B"]) {
      const candidates = sweep.candidates.filter((candidate) => candidate.style === style && candidate.side === side);
      const rendered = renderAtlas(candidates);
      const filename = `${style}-side-${side.toLowerCase()}.png`;
      atlasFiles[filename] = rendered.png;
      atlasManifest.atlases.push({
        style,
        side,
        filename: `atlases/${filename}`,
        candidateCount: candidates.length,
        columns: rendered.columns,
        rows: rendered.rows,
        width: rendered.width,
        height: rendered.height,
      });
    }
  }

  return {
    masks,
    stats,
    spec,
    atlasManifest,
    atlasFiles,
    report: buildReport(sweep.stats, sweep.hammingComparisons),
  };
}

async function writeJson(filename, value) {
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`);
}

export async function buildDitherResearch(repoRoot) {
  const data = buildResearchData();
  const artifactRoot = path.join(repoRoot, "artifacts", "research", "dithers");
  const atlasRoot = path.join(artifactRoot, "atlases");
  const specPath = path.join(repoRoot, "spec", "straight-fill-dither-research.json");

  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(atlasRoot, { recursive: true });
  await mkdir(path.dirname(specPath), { recursive: true });

  await Promise.all([
    writeJson(path.join(artifactRoot, "masks.json"), data.masks),
    writeJson(path.join(artifactRoot, "stats.json"), data.stats),
    writeJson(path.join(artifactRoot, "atlases.json"), data.atlasManifest),
    writeJson(specPath, data.spec),
    writeFile(path.join(artifactRoot, "report.md"), data.report),
    ...Object.entries(data.atlasFiles).map(([filename, png]) =>
      writeFile(path.join(atlasRoot, filename), png),
    ),
  ]);

  return data;
}

function assertJsonEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} does not match deterministic regeneration.`);
  }
}

export async function verifyDitherResearch(repoRoot) {
  const expected = buildResearchData();
  const artifactRoot = path.join(repoRoot, "artifacts", "research", "dithers");
  const atlasRoot = path.join(artifactRoot, "atlases");
  const specPath = path.join(repoRoot, "spec", "straight-fill-dither-research.json");

  const [masks, stats, atlasManifest, spec, report] = await Promise.all([
    readFile(path.join(artifactRoot, "masks.json"), "utf8").then(JSON.parse),
    readFile(path.join(artifactRoot, "stats.json"), "utf8").then(JSON.parse),
    readFile(path.join(artifactRoot, "atlases.json"), "utf8").then(JSON.parse),
    readFile(specPath, "utf8").then(JSON.parse),
    readFile(path.join(artifactRoot, "report.md"), "utf8"),
  ]);

  assertJsonEqual(masks, expected.masks, "Dither mask fixture");
  assertJsonEqual(stats, expected.stats, "Dither research stats");
  assertJsonEqual(atlasManifest, expected.atlasManifest, "Dither atlas manifest");
  assertJsonEqual(spec, expected.spec, "Dither research spec");
  if (report !== expected.report) {
    throw new Error("Dither research report does not match deterministic regeneration.");
  }

  for (const [filename, expectedPng] of Object.entries(expected.atlasFiles)) {
    const actualPng = await readFile(path.join(atlasRoot, filename));
    if (!actualPng.equals(expectedPng)) {
      throw new Error(`Dither atlas ${filename} does not match deterministic regeneration.`);
    }
  }

  return {
    styledSemanticCandidates: stats.styledSemanticCandidates,
    uniqueStyledRasters: stats.uniqueStyledRasters,
    novelDitherVisuals: stats.novelDitherVisuals,
    combinedVisuals: stats.combinedStraightSolidAndDitherVisuals,
    atlasCount: atlasManifest.atlases.length,
    allocation: stats.status,
  };
}
