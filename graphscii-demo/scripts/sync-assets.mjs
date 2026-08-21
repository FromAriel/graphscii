import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(demoRoot, "..");
const outputDir = path.join(demoRoot, "public", "assets");

const assets = [
  {
    source: path.join(repoRoot, "artifacts", "fonts", "GraphSCII-Regular.ttf"),
    target: path.join(outputDir, "GraphSCII-Regular.ttf"),
  },
  {
    source: path.join(repoRoot, "artifacts", "manifest", "vocabulary-v1", "registry.json"),
    target: path.join(outputDir, "registry.json"),
  },
  {
    source: path.join(repoRoot, "artifacts", "manifest", "indexes", "by-connection-pair.json"),
    target: path.join(outputDir, "by-connection-pair.json"),
  },
  {
    source: path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-connectors.json"),
    target: path.join(outputDir, "orthogonal-connectors.json"),
  },
  {
    source: path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-connectors.json"),
    target: path.join(outputDir, "diagonal-connectors.json"),
  },
  {
    source: path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-selection.json"),
    target: path.join(outputDir, "diagonal-selection.json"),
  },
];

const boundaryStylePath = path.join(
  repoRoot,
  "artifacts",
  "manifest",
  "vocabulary",
  "indexes",
  "by-boundary-side-style.json",
);
const aliasPath = path.join(
  repoRoot,
  "artifacts",
  "manifest",
  "vocabulary",
  "indexes",
  "by-alias.json",
);
const fillRulesTarget = path.join(outputDir, "fill-rules.json");
const encodedStyles = new Set(["solid", "medium", "half", "light"]);

await mkdir(outputDir, { recursive: true });

for (const asset of assets) {
  try {
    const info = await stat(asset.source);
    if (!info.isFile()) throw new Error("not a file");
  } catch {
    throw new Error(`Required GraphSCII asset is missing: ${asset.source}`);
  }
  await copyFile(asset.source, asset.target);
}

const [boundaryStyle, byAlias] = await Promise.all([
  readFile(boundaryStylePath, "utf8").then(JSON.parse),
  readFile(aliasPath, "utf8").then(JSON.parse),
]);

if (boundaryStyle?.index !== "by-boundary-side-style" || boundaryStyle?.entryCount !== 9984) {
  throw new Error("GraphSCII boundary/side/style source is not the canonical 9,984-entry table.");
}
if (byAlias?.index !== "by-alias" || byAlias?.entryCount !== 10816) {
  throw new Error("GraphSCII semantic alias source is not the canonical 10,816-entry table.");
}

const entries = {};
const styleCounts = { solid: 0, medium: 0, half: 0, light: 0 };
let fallbackCount = 0;

for (const [ruleKey, aliasKey] of Object.entries(boundaryStyle.entries ?? {})) {
  const style = ruleKey.slice(ruleKey.lastIndexOf(":") + 1);
  if (!encodedStyles.has(style)) continue;

  const semantic = byAlias.entries?.[aliasKey];
  if (!semantic) throw new Error(`GraphSCII fill rule ${ruleKey} has no semantic resolution.`);

  let glyphId = null;
  if (semantic.resolution === "encoded-owner" && Number.isInteger(semantic.glyphId)) {
    glyphId = semantic.glyphId;
  } else if (
    style === "half"
    && semantic.resolution === "renderer-only-derived"
    && Number.isInteger(semantic.fallbackGlyphId)
  ) {
    glyphId = semantic.fallbackGlyphId;
    fallbackCount += 1;
  }

  if (!Number.isInteger(glyphId)) {
    throw new Error(`GraphSCII encoded fill rule ${ruleKey} did not resolve to an addressable glyph.`);
  }

  entries[ruleKey] = glyphId;
  styleCounts[style] += 1;
}

if (Object.keys(entries).length !== 6656) {
  throw new Error(`Expected 6,656 encoded GraphSCII fill rules; found ${Object.keys(entries).length}.`);
}
for (const [style, count] of Object.entries(styleCounts)) {
  if (count !== 1664) throw new Error(`Expected 1,664 ${style} fill rules; found ${count}.`);
}
if (fallbackCount !== 64) {
  throw new Error(`Expected 64 published half-tone fallback rules; found ${fallbackCount}.`);
}

await writeFile(fillRulesTarget, `${JSON.stringify({
  format: "graphscii",
  formatVersion: 1,
  schema: "graphscii-demo-fill-rules-v1",
  schemaVersion: 1,
  sourceIndex: "by-boundary-side-style",
  entryCount: Object.keys(entries).length,
  fallbackCount,
  styleCounts,
  entries,
}, null, 2)}\n`);

console.log(
  "GraphSCII demo assets synchronized from the frozen registry and published drawing-rule artifacts "
  + `(including ${Object.keys(entries).length.toLocaleString()} canonical fill rules).`,
);
