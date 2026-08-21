import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const WIDTH = 8;
const HEIGHT = 16;
const RESERVE_SLOTS = 604;
const MASKS = [
  { id: "NESW", label: "full-cross", missing: null },
  { id: "ESW", label: "missing-north", missing: "N" },
  { id: "NSW", label: "missing-east", missing: "E" },
  { id: "NEW", label: "missing-south", missing: "S" },
  { id: "NSE", label: "missing-west", missing: "W" },
];

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function setPixel(rows, x, y) {
  rows[y] |= 1 << x;
}

function rasterizeOrthogonalConnector(x, y, mask) {
  const rows = new Uint8Array(HEIGHT);
  if (mask.includes("N")) for (let yy = 0; yy <= y; yy += 1) setPixel(rows, x, yy);
  if (mask.includes("E")) for (let xx = x; xx < WIDTH; xx += 1) setPixel(rows, xx, y);
  if (mask.includes("S")) for (let yy = y; yy < HEIGHT; yy += 1) setPixel(rows, x, yy);
  if (mask.includes("W")) for (let xx = 0; xx <= x; xx += 1) setPixel(rows, xx, y);
  return rows;
}

function bitmapKey(rows) {
  return [...rows].map((row) => row.toString(16).padStart(2, "0")).join("");
}

function armLengths(x, y) {
  return { N: y, E: WIDTH - 1 - x, S: HEIGHT - 1 - y, W: x };
}

function semanticId(x, y, mask) {
  return `O:x${x}:y${y}:${mask}`;
}

function representativeScore(alias) {
  return [alias.zeroLengthPresentArms, alias.onePixelPresentArms, alias.mask === "NESW" ? 0 : 1, alias.y, alias.x, alias.mask];
}

function compareScore(a, b) {
  const aa = representativeScore(a);
  const bb = representativeScore(b);
  for (let index = 0; index < aa.length; index += 1) {
    if (typeof aa[index] === "number") {
      if (aa[index] !== bb[index]) return aa[index] - bb[index];
    } else {
      const cmp = String(aa[index]).localeCompare(String(bb[index]));
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

function ownerId(index) {
  return `OJ${String(index).padStart(3, "0")}`;
}

function markdownReport(stats) {
  return `# Orthogonal Generic Connector Basis\n\n` +
    `Status: **GENERATED — RESEARCH-ONLY, UNALLOCATED**\n\n` +
    `The basis is exactly five semantic masks at every one of the 128 canonical 8×16 intersection positions: one full cross plus four one-arm-removed three-leg connectors.\n\n` +
    `## Counts\n\n` +
    `\`\`\`text\n` +
    `intersection positions          ${String(stats.intersectionPositions).padStart(4)}\n` +
    `masks per position              ${String(stats.masksPerPosition).padStart(4)}\n` +
    `raw semantic connectors         ${String(stats.semanticCount).padStart(4)}\n` +
    `unique exact raster owners      ${String(stats.uniqueRasterOwners).padStart(4)}\n` +
    `semantic duplicates removed     ${String(stats.semanticDuplicatesRemoved).padStart(4)}\n` +
    `graphics-v0 exact reuse owners  ${String(stats.graphicsV0ReuseOwners).padStart(4)}\n` +
    `novel PUA owners required       ${String(stats.novelOwnersRequired).padStart(4)}\n` +
    `available reserve               ${String(stats.protectedReserveSlots).padStart(4)}\n` +
    `reserve remaining if allocated  ${String(stats.reserveRemainingAfterNovelOwners).padStart(4)}\n` +
    `\`\`\`\n\n` +
    `## Generic families\n\n` +
    `- \`NESW\`: 128 full four-leg crossings.\n` +
    `- \`ESW\`: 128 three-leg connectors missing north.\n` +
    `- \`NSW\`: 128 three-leg connectors missing east.\n` +
    `- \`NEW\`: 128 three-leg connectors missing south.\n` +
    `- \`NSE\`: 128 three-leg connectors missing west.\n\n` +
    `Edge and corner positions intentionally degenerate. Exact bitmap dedup preserves every semantic alias while paying for a visual only once. Existing graphics-v0 reuse is also free.\n\n` +
    `The family ${stats.fitsReserve ? "fits" : "does not fit"} the 604-slot reserve after exact dedup. No codepoints are allocated by this slice.\n`;
}

export async function buildOrthogonalConnectorDocuments(repoRoot) {
  const bitmapIndexDocument = await readJson(path.join(repoRoot, "artifacts", "manifest", "vocabulary", "indexes", "by-bitmap.json"));
  if (bitmapIndexDocument.index !== "by-bitmap" || bitmapIndexDocument.entryCount !== 5796) {
    throw new Error("Frozen graphics-v0 bitmap index changed.");
  }
  const existing = bitmapIndexDocument.entries;
  const semantics = [];
  const ownerMap = new Map();
  const byMask = Object.fromEntries(MASKS.map((entry) => [entry.id, { label: entry.label, semanticCount: 0, uniqueBitmapKeys: new Set() }]));

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const lengths = armLengths(x, y);
      for (const maskDef of MASKS) {
        const rows = rasterizeOrthogonalConnector(x, y, maskDef.id);
        const key = bitmapKey(rows);
        const presentArms = [...maskDef.id];
        const zeroLengthPresentArms = presentArms.filter((arm) => lengths[arm] === 0).length;
        const onePixelPresentArms = presentArms.filter((arm) => lengths[arm] === 1).length;
        const semantic = {
          id: semanticId(x, y, maskDef.id),
          x,
          y,
          mask: maskDef.id,
          family: maskDef.label,
          missingArm: maskDef.missing,
          armLengths: lengths,
          zeroLengthPresentArms,
          onePixelPresentArms,
          bitmapKey: key,
          exactGraphicsV0GlyphId: existing[key] ?? null,
        };
        semantics.push(semantic);
        byMask[maskDef.id].semanticCount += 1;
        byMask[maskDef.id].uniqueBitmapKeys.add(key);
        if (!ownerMap.has(key)) ownerMap.set(key, []);
        ownerMap.get(key).push(semantic);
      }
    }
  }

  const ownerEntries = [...ownerMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, aliases], index) => {
      const sortedAliases = [...aliases].sort(compareScore);
      const representative = sortedAliases[0];
      return {
        ownerId: ownerId(index),
        bitmapKey: key,
        exactGraphicsV0GlyphId: existing[key] ?? null,
        novel: existing[key] === undefined,
        representativeSemantic: representative.id,
        minimumZeroLengthPresentArms: Math.min(...aliases.map((alias) => alias.zeroLengthPresentArms)),
        minimumOnePixelPresentArms: Math.min(...aliases.map((alias) => alias.onePixelPresentArms)),
        semanticAliasCount: aliases.length,
        semanticAliases: aliases.map((alias) => alias.id).sort(),
        families: [...new Set(aliases.map((alias) => alias.family))].sort(),
      };
    });

  const reuseOwners = ownerEntries.filter((owner) => !owner.novel);
  const novelOwners = ownerEntries.filter((owner) => owner.novel);
  const duplicateAliases = semantics.length - ownerEntries.length;
  const aliasOwners = ownerEntries.filter((owner) => owner.semanticAliasCount > 1);

  const stats = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-orthogonal-connector-stats",
    schemaVersion: 1,
    status: "5B.1-research-only-unallocated",
    width: WIDTH,
    height: HEIGHT,
    intersectionPositions: WIDTH * HEIGHT,
    masksPerPosition: MASKS.length,
    semanticCount: semantics.length,
    uniqueRasterOwners: ownerEntries.length,
    semanticDuplicatesRemoved: duplicateAliases,
    ownersWithSemanticAliases: aliasOwners.length,
    maximumSemanticAliasesPerOwner: Math.max(...ownerEntries.map((owner) => owner.semanticAliasCount)),
    graphicsV0ReuseOwners: reuseOwners.length,
    novelOwnersRequired: novelOwners.length,
    protectedReserveSlots: RESERVE_SLOTS,
    reserveRemainingAfterNovelOwners: RESERVE_SLOTS - novelOwners.length,
    fitsReserve: novelOwners.length <= RESERVE_SLOTS,
    junctionAllocations: 0,
    byMask: Object.fromEntries(MASKS.map((entry) => [entry.id, {
      label: entry.label,
      semanticCount: byMask[entry.id].semanticCount,
      uniqueRasterCountWithinMask: byMask[entry.id].uniqueBitmapKeys.size,
    }])),
  };

  const semanticDocument = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-orthogonal-connectors",
    schemaVersion: 1,
    status: "5B.1-research-only-unallocated",
    coordinateConvention: "x=0..7 left-to-right; y=0..15 top-to-bottom",
    masks: MASKS,
    semantics,
  };

  const ownerDocument = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-orthogonal-connector-owners",
    schemaVersion: 1,
    status: "5B.1-research-only-unallocated",
    ownerCount: ownerEntries.length,
    ownerIdentity: "exact canonical 8x16 bitmap key",
    owners: ownerEntries,
  };

  const spec = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-orthogonal-connector-basis",
    schemaVersion: 1,
    status: "5B.1-measured-generic-basis-unallocated",
    coordinateConvention: semanticDocument.coordinateConvention,
    masks: MASKS.map(({ id, label, missing }) => ({ id, label, missing })),
    rawSemanticCount: semantics.length,
    exactRasterOwnerCount: ownerEntries.length,
    graphicsV0ReuseOwners: reuseOwners.length,
    novelOwnersRequired: novelOwners.length,
    protectedReserveSlots: RESERVE_SLOTS,
    reserveRemainingIfAllocated: RESERVE_SLOTS - novelOwners.length,
    allocationPolicy: "preserve all 640 semantic connectors through exact owner aliases; allocate only novel visual owners",
  };

  return {
    stats,
    semanticDocument,
    ownerDocument,
    spec,
    report: markdownReport(stats),
  };
}

export async function generateOrthogonalConnectorArtifacts(repoRoot) {
  const docs = await buildOrthogonalConnectorDocuments(repoRoot);
  const researchDir = path.join(repoRoot, "artifacts", "research", "junctions");
  const specDir = path.join(repoRoot, "spec");
  await mkdir(researchDir, { recursive: true });
  await mkdir(specDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(researchDir, "orthogonal-connectors.json"), jsonText(docs.semanticDocument)),
    writeFile(path.join(researchDir, "orthogonal-owners.json"), jsonText(docs.ownerDocument)),
    writeFile(path.join(researchDir, "orthogonal-stats.json"), jsonText(docs.stats)),
    writeFile(path.join(researchDir, "orthogonal-report.md"), docs.report),
    writeFile(path.join(specDir, "orthogonal-junction-basis-v0.json"), jsonText(docs.spec)),
  ]);
  return docs.stats;
}

export async function verifyOrthogonalConnectorArtifacts(repoRoot) {
  const docs = await buildOrthogonalConnectorDocuments(repoRoot);
  const expected = new Map([
    [path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-connectors.json"), jsonText(docs.semanticDocument)],
    [path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-owners.json"), jsonText(docs.ownerDocument)],
    [path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-stats.json"), jsonText(docs.stats)],
    [path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-report.md"), docs.report],
    [path.join(repoRoot, "spec", "orthogonal-junction-basis-v0.json"), jsonText(docs.spec)],
  ]);
  for (const [filename, expectedText] of expected) {
    const actual = await readFile(filename, "utf8");
    if (actual !== expectedText) throw new Error(`Orthogonal connector artifact mismatch: ${path.relative(repoRoot, filename)}`);
  }
  if (docs.stats.semanticCount !== 640) throw new Error(`Expected 640 orthogonal semantics, found ${docs.stats.semanticCount}.`);
  if (docs.stats.uniqueRasterOwners !== 548) throw new Error(`Expected 548 exact orthogonal raster owners, found ${docs.stats.uniqueRasterOwners}.`);
  if (!docs.stats.fitsReserve) throw new Error("Orthogonal generic connector basis no longer fits the 604-slot reserve.");
  if (docs.stats.junctionAllocations !== 0) throw new Error("5B.1 must remain allocation-free.");
  return docs.stats;
}
