import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPaletteDecision } from "../dist/core/index.js";

export const PALETTE_DECISION_SCHEMA_VERSION = 1;

function buildSpec(decision) {
  return {
    format: "graphscii",
    formatVersion: 1,
    schema: "straight-fill-palette-v0",
    schemaVersion: PALETTE_DECISION_SCHEMA_VERSION,
    status: decision.status,
    bmpPrivateUseArea: decision.capacity,
    encodedToneStyles: decision.selected.encodedStyles,
    rendererOnlyToneStyles: decision.selected.rendererOnlyStyles,
    halfToneMask: {
      density: 0.5,
      phase: "cell-locked-8x8-repeat-y-mod-8",
      rows: [
        "#-#-#-#-",
        "-#-#-#-#",
        "#-#-#-#-",
        "-#-#-#-#",
        "#-#-#-#-",
        "-#-#-#-#",
        "#-#-#-#-",
        "-#-#-#-#",
      ],
    },
    selectedCounts: decision.selected,
    incrementalAllocatedVisuals: decision.incrementalAllocatedVisuals,
    plannedAllocation: decision.plannedAllocation,
    allocationGate: "Milestone 4D; these ranges are planned but fill/dither codepoints remain unassigned until publication",
  };
}

function buildReport(decision) {
  const fourStyle = decision.candidatePalettes.filter((entry) => entry.styleCount === 4);
  const lines = [
    "# GraphSCII Milestone 4C — BMP PUA Palette Decision",
    "",
    "Status: **DECISION COMPLETE — CODEPOINT PUBLICATION DEFERRED TO 4D**",
    "",
    "## Decision",
    "",
    "Encode four tonal levels:",
    "",
    "```text",
    "solid      100%",
    "medium      75%",
    "half        50%",
    "light       25%",
    "```",
    "",
    "Keep `dense` (87.5%) and `sparse` (12.5%) as renderer-only semantic styles. They may still resolve to an encoded codepoint whenever their exact raster already has an encoded owner.",
    "",
    "The 50% level uses a phase-locked checkerboard. Exact materialization of the four selected levels would require 5,858 PUA graphics. To preserve the 5,800 target, a deterministic compression rule leaves the 62 globally novel 50% visual owners that are exactly one pixel from an already-encoded straight/solid/75%/25% visual as renderer-only. Those 62 owners cover 64 semantic definitions.",
    "",
    "```text",
    `exact selected four-level visuals       ${decision.selected.exactUncompressedVisuals.toLocaleString("en-US")}`,
    `one-pixel 50% owners renderer-only         ${decision.selected.halfOnePixelDemotedVisuals.toLocaleString("en-US")}`,
    `encoded GraphSCII PUA graphics          ${decision.selected.allocatedVisuals.toLocaleString("en-US")}`,
    `BMP PUA reserve                           ${decision.selected.puaReserve.toLocaleString("en-US")}`,
    `printable ASCII outside PUA                 ${decision.capacity.printableAsciiCount.toLocaleString("en-US")}`,
    `physical glyphs incl. printable ASCII    ${decision.selected.physicalGlyphsIncludingPrintableAscii.toLocaleString("en-US")}`,
    "```",
    "",
    "## Planned PUA layout",
    "",
    "| Family | Count | Start | End |",
    "|---|---:|---:|---:|",
    ...decision.plannedAllocation.map((range) => `| ${range.family} | ${range.count} | ${range.startCodepoint} | ${range.endCodepoint} |`),
    "",
    "These are planned ranges only. Milestone 4C does not assign new fill/dither codepoints; Milestone 4D performs publication/allocation.",
    "",
    "## Four-style exact candidates",
    "",
    "| Styles | Exact visuals | PUA reserve | Target ≤5800 | Max density gap | Gap spread |",
    "|---|---:|---:|---:|---:|---:|",
    ...fourStyle.map((entry) => `| ${entry.styles.join(" / ")} | ${entry.exactVisuals} | ${entry.puaReserve} | ${entry.meetsGraphicsTarget ? "yes" : "no"} | ${entry.maxDensityGap.toFixed(3)} | ${entry.densityGapSpread.toFixed(3)} |`),
    "",
    "## Why this palette",
    "",
    "`100% / 75% / 50% / 25%` is the only evaluated four-level palette with exact quarter-step spacing across the main tonal range. The exact union is only 58 visuals above the 5,800 target. The one-pixel-near compression rule removes 62 low-distinctiveness 50% owners, reaching 5,796 encoded graphics and leaving 604 BMP PUA slots reserved.",
    "",
    "Standard printable ASCII remains at U+0020..U+007E and consumes zero PUA slots.",
    "",
    "## Renderer contract",
    "",
    "The semantic vocabulary remains richer than the encoded font. Dense, sparse, and the 62 demoted 50% visual owners remain reproducible from mathematical boundary + side + phase-locked mask. If a renderer-only semantic raster exactly matches an encoded owner, use that existing codepoint; otherwise generate the bitmap through the renderer rather than allocating another PUA character.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildData() {
  const decision = buildPaletteDecision();
  const spec = buildSpec(decision);
  return {
    decision,
    spec,
    candidatePalettes: decision.candidatePalettes,
    halfDemotions: decision.halfDemotions,
    report: buildReport(decision),
  };
}

async function writeJson(filename, value) {
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`);
}

export async function buildPaletteDecisionArtifacts(repoRoot) {
  const data = buildData();
  const artifactRoot = path.join(repoRoot, "artifacts", "research", "palette");
  const specPath = path.join(repoRoot, "spec", "straight-fill-palette-v0.json");
  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(path.dirname(specPath), { recursive: true });
  await Promise.all([
    writeJson(path.join(artifactRoot, "decision.json"), data.decision),
    writeJson(path.join(artifactRoot, "candidate-palettes.json"), data.candidatePalettes),
    writeJson(path.join(artifactRoot, "half-demotions.json"), data.halfDemotions),
    writeJson(specPath, data.spec),
    writeFile(path.join(artifactRoot, "report.md"), data.report),
  ]);
  return data;
}

function assertJsonEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} does not match deterministic regeneration.`);
  }
}

export async function verifyPaletteDecisionArtifacts(repoRoot) {
  const expected = buildData();
  const artifactRoot = path.join(repoRoot, "artifacts", "research", "palette");
  const specPath = path.join(repoRoot, "spec", "straight-fill-palette-v0.json");
  const [decision, candidates, demotions, spec, report] = await Promise.all([
    readFile(path.join(artifactRoot, "decision.json"), "utf8").then(JSON.parse),
    readFile(path.join(artifactRoot, "candidate-palettes.json"), "utf8").then(JSON.parse),
    readFile(path.join(artifactRoot, "half-demotions.json"), "utf8").then(JSON.parse),
    readFile(specPath, "utf8").then(JSON.parse),
    readFile(path.join(artifactRoot, "report.md"), "utf8"),
  ]);
  assertJsonEqual(decision, expected.decision, "Palette decision");
  assertJsonEqual(candidates, expected.candidatePalettes, "Palette candidates");
  assertJsonEqual(demotions, expected.halfDemotions, "Half-tone demotions");
  assertJsonEqual(spec, expected.spec, "Palette specification");
  if (report !== expected.report) {
    throw new Error("Palette decision report does not match deterministic regeneration.");
  }
  return {
    encodedStyles: decision.selected.encodedStyles,
    rendererOnlyStyles: decision.selected.rendererOnlyStyles,
    exactUncompressedVisuals: decision.selected.exactUncompressedVisuals,
    demotedHalfVisuals: decision.selected.halfOnePixelDemotedVisuals,
    allocatedVisuals: decision.selected.allocatedVisuals,
    puaReserve: decision.selected.puaReserve,
    candidatePalettes: decision.candidatePalettes.length,
    allocationStatus: decision.status,
  };
}
