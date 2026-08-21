import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// The cell is 16 high x 8 wide, so the three-leg angle sample keeps a 2:1
// vertical:horizontal rule count. Within each axis the selected levels are
// evenly spread across the non-bar squash range. Every selected rule keeps
// all four missing-leg orientations, preserving orientation symmetry.
const THREE_LEG_RULE_IDS = [
  "DV00", "DV03", "DV06", "DV08", "DV11", "DV14",
  "DH02", "DH04", "DH06",
];
const EXPECTED_FULL_X_SEMANTICS = 24;
const EXPECTED_THREE_LEG_SEMANTICS = 36;
const EXPECTED_SELECTED_SEMANTICS = 60;

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function markdownReport(selection) {
  return `# Final Deterministic Diagonal Connector Selection\n\n` +
    `Status: **SELECTED — UNALLOCATED**\n\n` +
    `The final diagonal semantic basis is a rule system, not a random sample. It keeps every one of the 24 axis-squashed full-X rules, then adds all four one-leg-removed orientations for nine evenly spaced angle rules.\n\n` +
    `The 8×16 cell has a 2:1 vertical:horizontal axis ratio, so the three-leg sample uses six vertical-squash rules and three horizontal-squash rules.\n\n` +
    `Selected three-leg rule IDs:\n\n\`\`\`text\n${THREE_LEG_RULE_IDS.join("\n")}\n\`\`\`\n\n` +
    `Counts:\n\n\`\`\`text\n` +
    `full-X semantic rules             ${selection.fullXSemanticCount}\n` +
    `three-leg semantic rules          ${selection.threeLegSemanticCount}\n` +
    `selected diagonal semantics       ${selection.selectedSemanticCount}\n` +
    `selected exact raster owners      ${selection.selectedRasterOwnerCount}\n` +
    `new diagonal glyphs required      ${selection.selectedIncrementalNovelOwners}\n` +
    `orthogonal new glyphs required    ${selection.orthogonalNovelOwners}\n` +
    `final new connector glyphs        ${selection.finalNovelConnectorOwners}\n` +
    `BMP PUA reserve                   ${selection.protectedReserveSlots}\n` +
    `reserve remaining                 ${selection.finalReserveRemaining}\n` +
    `\`\`\`\n\n` +
    `All four missing-leg orientations are retained for every selected angle rule, so the selection never favors one quadrant. Exact bitmap identity still controls storage: existing graphics-v0 or orthogonal owners are reused for free, and duplicate diagonal semantics share one owner.\n`;
}

export async function buildDiagonalSelectionDocuments(repoRoot) {
  const [diagonalSemantics, diagonalOwners, diagonalStats, orthogonalStats] = await Promise.all([
    readJson(path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-connectors.json")),
    readJson(path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-owners.json")),
    readJson(path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-stats.json")),
    readJson(path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-stats.json")),
  ]);
  if (diagonalStats.reasonedXRules !== 24 || diagonalStats.semanticCount !== 120) throw new Error("Frozen diagonal candidate fixture changed.");
  if (orthogonalStats.novelOwnersRequired !== 544 || orthogonalStats.protectedReserveSlots !== 604) throw new Error("Frozen orthogonal budget fixture changed.");

  const threeLegRuleSet = new Set(THREE_LEG_RULE_IDS);
  const selectedSemantics = diagonalSemantics.semantics.filter((semantic) =>
    semantic.mask === "FULL" || (threeLegRuleSet.has(semantic.ruleId) && semantic.mask !== "FULL")
  );
  const fullXSemantics = selectedSemantics.filter((semantic) => semantic.mask === "FULL");
  const threeLegSemantics = selectedSemantics.filter((semantic) => semantic.mask !== "FULL");
  if (fullXSemantics.length !== EXPECTED_FULL_X_SEMANTICS) throw new Error(`Expected ${EXPECTED_FULL_X_SEMANTICS} selected full-X semantics, found ${fullXSemantics.length}.`);
  if (threeLegSemantics.length !== EXPECTED_THREE_LEG_SEMANTICS) throw new Error(`Expected ${EXPECTED_THREE_LEG_SEMANTICS} selected three-leg semantics, found ${threeLegSemantics.length}.`);
  if (selectedSemantics.length !== EXPECTED_SELECTED_SEMANTICS) throw new Error(`Expected ${EXPECTED_SELECTED_SEMANTICS} selected diagonal semantics, found ${selectedSemantics.length}.`);

  const selectedKeys = new Set(selectedSemantics.map((semantic) => semantic.bitmapKey));
  const selectedOwners = diagonalOwners.owners.filter((owner) => selectedKeys.has(owner.bitmapKey));
  const incrementalOwners = selectedOwners.filter((owner) => owner.incrementalNovel);
  const graphicsReuseOwners = selectedOwners.filter((owner) => owner.exactGraphicsV0GlyphId !== null);
  const orthogonalReuseOwners = selectedOwners.filter((owner) => owner.exactOrthogonalOwner);

  const selection = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-final-diagonal-connector-selection",
    schemaVersion: 1,
    status: "5B.2-selected-unallocated",
    rule: {
      fullX: "keep all 24 vertical/horizontal squash X rules",
      threeLeg: "use a 2:1 vertical:horizontal angle sample matching the 16:8 cell dimensions; choose six evenly spread non-bar vertical levels and three evenly spread nonzero horizontal levels; keep all four missing-leg orientations",
      selectedThreeLegRuleIds: THREE_LEG_RULE_IDS,
      orientationPolicy: "all four missing legs NW/NE/SE/SW for every selected rule",
    },
    fullXSemanticCount: fullXSemantics.length,
    threeLegSemanticCount: threeLegSemantics.length,
    selectedSemanticCount: selectedSemantics.length,
    selectedRasterOwnerCount: selectedOwners.length,
    selectedGraphicsV0ReuseOwners: graphicsReuseOwners.length,
    selectedOrthogonalReuseOwners: orthogonalReuseOwners.length,
    selectedIncrementalNovelOwners: incrementalOwners.length,
    orthogonalNovelOwners: orthogonalStats.novelOwnersRequired,
    finalNovelConnectorOwners: orthogonalStats.novelOwnersRequired + incrementalOwners.length,
    protectedReserveSlots: orthogonalStats.protectedReserveSlots,
    finalReserveRemaining: orthogonalStats.protectedReserveSlots - orthogonalStats.novelOwnersRequired - incrementalOwners.length,
    selectedSemanticIds: selectedSemantics.map((semantic) => semantic.id),
    selectedOwnerIds: selectedOwners.map((owner) => owner.ownerId),
    selectedIncrementalOwnerIds: incrementalOwners.map((owner) => owner.ownerId),
  };

  const spec = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-generic-connector-basis-v0-selection",
    schemaVersion: 1,
    status: "measured-final-selection-unallocated",
    orthogonal: {
      semanticCount: orthogonalStats.semanticCount,
      exactOwners: orthogonalStats.uniqueRasterOwners,
      novelOwners: orthogonalStats.novelOwnersRequired,
    },
    diagonal: {
      candidateSemanticCount: diagonalStats.semanticCount,
      selectedSemanticCount: selection.selectedSemanticCount,
      selectedNovelOwners: selection.selectedIncrementalNovelOwners,
      threeLegRuleIds: THREE_LEG_RULE_IDS,
    },
    finalNovelConnectorOwners: selection.finalNovelConnectorOwners,
    protectedReserveSlots: selection.protectedReserveSlots,
    finalReserveRemaining: selection.finalReserveRemaining,
    allocationState: "unallocated",
  };

  return { selection, spec, report: markdownReport(selection) };
}

export async function generateDiagonalSelectionArtifacts(repoRoot) {
  const docs = await buildDiagonalSelectionDocuments(repoRoot);
  const researchDir = path.join(repoRoot, "artifacts", "research", "junctions");
  const specDir = path.join(repoRoot, "spec");
  await mkdir(researchDir, { recursive: true });
  await mkdir(specDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(researchDir, "diagonal-selection.json"), jsonText(docs.selection)),
    writeFile(path.join(researchDir, "diagonal-selection-report.md"), docs.report),
    writeFile(path.join(specDir, "generic-connector-basis-v0-selection.json"), jsonText(docs.spec)),
  ]);
  return docs.selection;
}

export async function verifyDiagonalSelectionArtifacts(repoRoot) {
  const docs = await buildDiagonalSelectionDocuments(repoRoot);
  const expected = new Map([
    [path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-selection.json"), jsonText(docs.selection)],
    [path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-selection-report.md"), docs.report],
    [path.join(repoRoot, "spec", "generic-connector-basis-v0-selection.json"), jsonText(docs.spec)],
  ]);
  for (const [filename, expectedText] of expected) {
    const actual = await readFile(filename, "utf8");
    if (actual !== expectedText) throw new Error(`Diagonal selection artifact mismatch: ${path.relative(repoRoot, filename)}`);
  }
  if (docs.selection.selectedSemanticCount !== 60) throw new Error("Final diagonal semantic selection must contain exactly 60 reasoned semantics.");
  if (docs.selection.selectedIncrementalNovelOwners > 60) throw new Error("Final diagonal selection exceeds the 60-slot post-orthogonal budget.");
  if (docs.selection.finalReserveRemaining < 0) throw new Error("Final connector selection exceeds BMP PUA capacity.");
  return docs.selection;
}
