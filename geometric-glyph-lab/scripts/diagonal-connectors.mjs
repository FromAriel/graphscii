import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const WIDTH = 8;
const HEIGHT = 16;
const LEG_ORDER = ["NW", "NE", "SE", "SW"];
const MASKS = ["FULL", ...LEG_ORDER.map((leg) => `MISSING_${leg}`)];
const VERTICAL_LEVELS = 16;
const HORIZONTAL_LEVELS = 8;

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}

function reducedSlope(dx, dy) {
  if (dx === 0) return "0:1";
  if (dy === 0) return "1:0";
  const d = gcd(dx, dy);
  return `${dx / d}:${dy / d}`;
}

function bitmapKey(rows) {
  return [...rows].map((row) => row.toString(16).padStart(2, "0")).join("");
}

function setPixel(rows, x, y) {
  if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) rows[y] |= 1 << x;
}

function rasterizeLinePoints(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
}

// Split a Bresenham diagonal into two connected legs. Odd-length paths share
// one midpoint pixel; even-length paths share the central two-pixel bridge.
// The union of both halves is always exactly the original line.
function splitLineIntoLegs(points) {
  const n = points.length;
  const middle = Math.floor(n / 2);
  if (n % 2 === 1) return [points.slice(0, middle + 1), points.slice(middle)];
  return [points.slice(0, middle + 1), points.slice(middle - 1)];
}

function connected8(rows) {
  const foreground = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (rows[y] & (1 << x)) foreground.push({ x, y });
    }
  }
  if (foreground.length === 0) return false;
  const key = (x, y) => `${x},${y}`;
  const queue = [foreground[0]];
  const seen = new Set([key(foreground[0].x, foreground[0].y)]);
  while (queue.length) {
    const current = queue.shift();
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const x = current.x + dx;
        const y = current.y + dy;
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || !(rows[y] & (1 << x))) continue;
        const k = key(x, y);
        if (!seen.has(k)) {
          seen.add(k);
          queue.push({ x, y });
        }
      }
    }
  }
  return seen.size === foreground.length;
}

function squashBounds(axis, level) {
  if (axis === "vertical") {
    const top = Math.floor(level / 2);
    const bottom = HEIGHT - 1 - Math.ceil(level / 2);
    return { left: 0, right: WIDTH - 1, top, bottom };
  }
  const left = Math.floor(level / 2);
  const right = WIDTH - 1 - Math.ceil(level / 2);
  return { left, right, top: 0, bottom: HEIGHT - 1 };
}

function ruleId(axis, level) {
  return `${axis === "vertical" ? "DV" : "DH"}${String(level).padStart(2, "0")}`;
}

function buildRules() {
  const rules = [];
  for (let level = 0; level < VERTICAL_LEVELS; level += 1) {
    const bounds = squashBounds("vertical", level);
    const dx = bounds.right - bounds.left;
    const dy = bounds.bottom - bounds.top;
    rules.push({
      id: ruleId("vertical", level),
      axis: "vertical",
      level,
      bounds,
      deltaX: dx,
      deltaY: dy,
      reducedSlope: reducedSlope(dx, dy),
      barLike: dx === 0 || dy === 0,
      description: `full-width X with ${level} total row${level === 1 ? "" : "s"} removed, split as evenly as possible between top and bottom`,
    });
  }
  for (let level = 0; level < HORIZONTAL_LEVELS; level += 1) {
    const bounds = squashBounds("horizontal", level);
    const dx = bounds.right - bounds.left;
    const dy = bounds.bottom - bounds.top;
    rules.push({
      id: ruleId("horizontal", level),
      axis: "horizontal",
      level,
      bounds,
      deltaX: dx,
      deltaY: dy,
      reducedSlope: reducedSlope(dx, dy),
      barLike: dx === 0 || dy === 0,
      description: `full-height X with ${level} total column${level === 1 ? "" : "s"} removed, split as evenly as possible between left and right`,
    });
  }
  return rules;
}

function rasterizeRuleLegs(rule) {
  const { left, right, top, bottom } = rule.bounds;
  const nwToSe = rasterizeLinePoints(left, top, right, bottom);
  const neToSw = rasterizeLinePoints(right, top, left, bottom);
  const [nw, se] = splitLineIntoLegs(nwToSe);
  const [ne, sw] = splitLineIntoLegs(neToSw);
  return { NW: nw, NE: ne, SE: se, SW: sw };
}

function rasterizeSemantic(rule, mask) {
  const rows = new Uint8Array(HEIGHT);
  const legs = rasterizeRuleLegs(rule);
  const missing = mask === "FULL" ? null : mask.slice("MISSING_".length);
  for (const leg of LEG_ORDER) {
    if (leg === missing) continue;
    for (const point of legs[leg]) setPixel(rows, point.x, point.y);
  }
  return { rows, connected: connected8(rows), missingLeg: missing };
}

function semanticId(rule, mask) {
  return `D:${rule.id}:${mask}`;
}

function ownerId(index) {
  return `DJ${String(index).padStart(3, "0")}`;
}

function reportMarkdown(stats) {
  return `# Deterministic Diagonal Connector Swatch\n\n` +
    `Status: **GENERATED — RESEARCH-ONLY, UNALLOCATED**\n\n` +
    `The diagonal basis is not sampled. It is generated by two simple axis-squash rules over the canonical 8×16 cell: 16 vertical squash levels and 8 horizontal squash levels. Each rule produces one full X plus four one-leg-removed three-leg candidates.\n\n` +
    `## Counts\n\n\`\`\`text\n` +
    `reasoned X rules                    ${String(stats.reasonedXRules).padStart(4)}\n` +
    `full-X semantics                    ${String(stats.fullXSemantics).padStart(4)}\n` +
    `one-leg-removed semantics           ${String(stats.threeLegSemantics).padStart(4)}\n` +
    `raw diagonal semantics              ${String(stats.semanticCount).padStart(4)}\n` +
    `valid connected semantics           ${String(stats.validSemanticCount).padStart(4)}\n` +
    `unique diagonal raster owners       ${String(stats.uniqueRasterOwners).padStart(4)}\n` +
    `graphics-v0 exact reuse owners      ${String(stats.graphicsV0ReuseOwners).padStart(4)}\n` +
    `orthogonal exact reuse owners       ${String(stats.orthogonalReuseOwners).padStart(4)}\n` +
    `incremental novel owners            ${String(stats.incrementalNovelOwners).padStart(4)}\n` +
    `remaining budget after orthogonal   ${String(stats.remainingBudgetAfterOrthogonal).padStart(4)}\n` +
    `\`\`\`\n\n` +
    `The 24 X rules are deterministic common-angle constructions. Vertical level k removes k total rows, alternating the removal between top and bottom; horizontal level k does the same with columns left and right. The degenerate terminal bar-like rules are intentionally generated so exact reuse/dedup can remove their cost rather than introducing a special-case random omission.\n\n` +
    `Each X is split into four named raster legs (NW, NE, SE, SW) at its Bresenham midpoint. The four three-leg variants are generated by removing exactly one named leg.\n\n` +
    `This complete full-X + three-leg family ${stats.fitsRemainingBudget ? "fits" : "does not fit"} the ${stats.remainingBudgetAfterOrthogonal}-slot remainder after the orthogonal basis. No codepoints are allocated in this slice.\n`;
}

export async function buildDiagonalConnectorDocuments(repoRoot) {
  const [bitmapIndexDocument, orthogonalOwnersDocument, orthogonalStats] = await Promise.all([
    readJson(path.join(repoRoot, "artifacts", "manifest", "vocabulary", "indexes", "by-bitmap.json")),
    readJson(path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-owners.json")),
    readJson(path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-stats.json")),
  ]);
  if (bitmapIndexDocument.index !== "by-bitmap" || bitmapIndexDocument.entryCount !== 5796) throw new Error("Frozen graphics-v0 bitmap index changed.");
  if (orthogonalStats.novelOwnersRequired !== 544 || orthogonalStats.reserveRemainingAfterNovelOwners !== 60) throw new Error("Frozen orthogonal connector budget changed.");

  const existing = bitmapIndexDocument.entries;
  const orthogonalKeys = new Set(orthogonalOwnersDocument.owners.map((owner) => owner.bitmapKey));
  const rules = buildRules();
  if (rules.length !== 24) throw new Error(`Expected 24 reasoned X rules, found ${rules.length}.`);

  const semantics = [];
  const ownerMap = new Map();
  for (const rule of rules) {
    for (const mask of MASKS) {
      const raster = rasterizeSemantic(rule, mask);
      const key = bitmapKey(raster.rows);
      const semantic = {
        id: semanticId(rule, mask),
        ruleId: rule.id,
        axis: rule.axis,
        level: rule.level,
        mask,
        missingLeg: raster.missingLeg,
        bounds: rule.bounds,
        deltaX: rule.deltaX,
        deltaY: rule.deltaY,
        reducedSlope: rule.reducedSlope,
        barLikeRule: rule.barLike,
        connected: raster.connected,
        bitmapKey: key,
        exactGraphicsV0GlyphId: existing[key] ?? null,
        exactOrthogonalOwner: orthogonalKeys.has(key),
      };
      semantics.push(semantic);
      if (!ownerMap.has(key)) ownerMap.set(key, []);
      ownerMap.get(key).push(semantic);
    }
  }

  const ownerEntries = [...ownerMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, aliases], index) => ({
      ownerId: ownerId(index),
      bitmapKey: key,
      exactGraphicsV0GlyphId: existing[key] ?? null,
      exactOrthogonalOwner: orthogonalKeys.has(key),
      incrementalNovel: existing[key] === undefined && !orthogonalKeys.has(key),
      semanticAliasCount: aliases.length,
      semanticAliases: aliases.map((entry) => entry.id).sort(),
      fullXAliasCount: aliases.filter((entry) => entry.mask === "FULL").length,
      threeLegAliasCount: aliases.filter((entry) => entry.mask !== "FULL").length,
      rules: [...new Set(aliases.map((entry) => entry.ruleId))].sort(),
      slopes: [...new Set(aliases.map((entry) => entry.reducedSlope))].sort(),
      includesBarLikeRule: aliases.some((entry) => entry.barLikeRule),
      connected: aliases.every((entry) => entry.connected),
    }));

  const validSemantics = semantics.filter((entry) => entry.connected);
  const fullKeys = new Set(semantics.filter((entry) => entry.mask === "FULL").map((entry) => entry.bitmapKey));
  const threeLegKeys = new Set(semantics.filter((entry) => entry.mask !== "FULL").map((entry) => entry.bitmapKey));
  const graphicsReuse = ownerEntries.filter((owner) => owner.exactGraphicsV0GlyphId !== null);
  const orthogonalReuse = ownerEntries.filter((owner) => owner.exactOrthogonalOwner);
  const incremental = ownerEntries.filter((owner) => owner.incrementalNovel);
  const fullIncremental = incremental.filter((owner) => owner.fullXAliasCount > 0);
  const additionalThreeLegIncremental = incremental.filter((owner) => owner.fullXAliasCount === 0 && owner.threeLegAliasCount > 0);

  const stats = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-diagonal-connector-stats",
    schemaVersion: 1,
    status: "5B.2-research-only-unallocated",
    width: WIDTH,
    height: HEIGHT,
    verticalSquashRules: VERTICAL_LEVELS,
    horizontalSquashRules: HORIZONTAL_LEVELS,
    reasonedXRules: rules.length,
    masksPerRule: MASKS.length,
    fullXSemantics: rules.length,
    threeLegSemantics: rules.length * 4,
    semanticCount: semantics.length,
    validSemanticCount: validSemantics.length,
    invalidSemanticCount: semantics.length - validSemantics.length,
    uniqueFullXRasters: fullKeys.size,
    uniqueThreeLegRasters: threeLegKeys.size,
    uniqueRasterOwners: ownerEntries.length,
    semanticDuplicatesRemoved: semantics.length - ownerEntries.length,
    graphicsV0ReuseOwners: graphicsReuse.length,
    orthogonalReuseOwners: orthogonalReuse.length,
    incrementalNovelOwners: incremental.length,
    fullXIncrementalNovelOwners: fullIncremental.length,
    additionalThreeLegIncrementalNovelOwners: additionalThreeLegIncremental.length,
    remainingBudgetAfterOrthogonal: orthogonalStats.reserveRemainingAfterNovelOwners,
    fitsRemainingBudget: incremental.length <= orthogonalStats.reserveRemainingAfterNovelOwners,
    overflowOwners: Math.max(0, incremental.length - orthogonalStats.reserveRemainingAfterNovelOwners),
    junctionAllocations: 0,
  };

  const semanticDocument = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-diagonal-connectors",
    schemaVersion: 1,
    status: "5B.2-research-only-unallocated",
    ruleSystem: {
      vertical: "k=0..15; full width; remove k total rows alternating top then bottom as evenly as possible",
      horizontal: "k=0..7; full height; remove k total columns alternating left then right as evenly as possible",
      legSplit: "split each opposite-corner Bresenham diagonal at its raster midpoint; odd paths share one midpoint pixel, even paths share the central two-pixel bridge",
      masks: MASKS,
    },
    rules,
    semantics,
  };

  const ownerDocument = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-diagonal-connector-owners",
    schemaVersion: 1,
    status: "5B.2-research-only-unallocated",
    ownerCount: ownerEntries.length,
    ownerIdentity: "exact canonical 8x16 bitmap key",
    owners: ownerEntries,
  };

  const spec = {
    format: "graphscii",
    formatVersion: 1,
    schema: "graphscii-diagonal-connector-basis",
    schemaVersion: 1,
    status: "5B.2-measured-reasoned-basis-unallocated",
    reasonedXRules: rules.length,
    ruleIds: rules.map((rule) => rule.id),
    masks: MASKS,
    rawSemanticCount: semantics.length,
    uniqueRasterOwners: ownerEntries.length,
    graphicsV0ReuseOwners: graphicsReuse.length,
    orthogonalReuseOwners: orthogonalReuse.length,
    incrementalNovelOwners: incremental.length,
    remainingBudgetAfterOrthogonal: orthogonalStats.reserveRemainingAfterNovelOwners,
    fitsRemainingBudget: stats.fitsRemainingBudget,
    allocationPolicy: "measure all 24 reasoned full-X rules and all four one-leg-removed variants; exact-dedup before any allocation decision",
  };

  return { stats, semanticDocument, ownerDocument, spec, report: reportMarkdown(stats) };
}

export async function generateDiagonalConnectorArtifacts(repoRoot) {
  const docs = await buildDiagonalConnectorDocuments(repoRoot);
  const researchDir = path.join(repoRoot, "artifacts", "research", "junctions");
  const specDir = path.join(repoRoot, "spec");
  await mkdir(researchDir, { recursive: true });
  await mkdir(specDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(researchDir, "diagonal-connectors.json"), jsonText(docs.semanticDocument)),
    writeFile(path.join(researchDir, "diagonal-owners.json"), jsonText(docs.ownerDocument)),
    writeFile(path.join(researchDir, "diagonal-stats.json"), jsonText(docs.stats)),
    writeFile(path.join(researchDir, "diagonal-report.md"), docs.report),
    writeFile(path.join(specDir, "diagonal-junction-basis-v0.json"), jsonText(docs.spec)),
  ]);
  return docs.stats;
}

export async function verifyDiagonalConnectorArtifacts(repoRoot) {
  const docs = await buildDiagonalConnectorDocuments(repoRoot);
  const expected = new Map([
    [path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-connectors.json"), jsonText(docs.semanticDocument)],
    [path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-owners.json"), jsonText(docs.ownerDocument)],
    [path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-stats.json"), jsonText(docs.stats)],
    [path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-report.md"), docs.report],
    [path.join(repoRoot, "spec", "diagonal-junction-basis-v0.json"), jsonText(docs.spec)],
  ]);
  for (const [filename, expectedText] of expected) {
    const actual = await readFile(filename, "utf8");
    if (actual !== expectedText) throw new Error(`Diagonal connector artifact mismatch: ${path.relative(repoRoot, filename)}`);
  }
  if (docs.stats.reasonedXRules !== 24) throw new Error(`Expected 24 reasoned X rules, found ${docs.stats.reasonedXRules}.`);
  if (docs.stats.semanticCount !== 120) throw new Error(`Expected 120 full/three-leg diagonal semantics, found ${docs.stats.semanticCount}.`);
  if (docs.stats.invalidSemanticCount !== 0) throw new Error(`Expected all diagonal semantics connected, found ${docs.stats.invalidSemanticCount} invalid.`);
  if (docs.stats.junctionAllocations !== 0) throw new Error("5B.2 must remain allocation-free.");
  return docs.stats;
}
