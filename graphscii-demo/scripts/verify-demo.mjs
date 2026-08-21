import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(demoRoot, "..");

const registryPath = path.join(repoRoot, "artifacts", "manifest", "vocabulary-v1", "registry.json");
const pairIndexPath = path.join(repoRoot, "artifacts", "manifest", "indexes", "by-connection-pair.json");
const boundaryStylePath = path.join(repoRoot, "artifacts", "manifest", "vocabulary", "indexes", "by-boundary-side-style.json");
const aliasPath = path.join(repoRoot, "artifacts", "manifest", "vocabulary", "indexes", "by-alias.json");
const orthogonalPath = path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-connectors.json");
const diagonalPath = path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-connectors.json");
const diagonalSelectionPath = path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-selection.json");
const fontPath = path.join(repoRoot, "artifacts", "fonts", "GraphSCII-Regular.ttf");
const fontManifestPath = path.join(repoRoot, "artifacts", "fonts", "manifest.json");

const [registry, pairIndex, boundaryStyle, byAlias, orthogonal, diagonal, diagonalSelection] = await Promise.all([
  readFile(registryPath, "utf8").then(JSON.parse),
  readFile(pairIndexPath, "utf8").then(JSON.parse),
  readFile(boundaryStylePath, "utf8").then(JSON.parse),
  readFile(aliasPath, "utf8").then(JSON.parse),
  readFile(orthogonalPath, "utf8").then(JSON.parse),
  readFile(diagonalPath, "utf8").then(JSON.parse),
  readFile(diagonalSelectionPath, "utf8").then(JSON.parse),
]);

if (registry?.format !== "graphscii" || registry?.schema !== "graphscii-graphics-vocabulary-v1") {
  throw new Error("Demo source registry is not the frozen GraphSCII graphics-v1 registry.");
}
if (!Array.isArray(registry.owners) || registry.owners.length !== 6397) {
  throw new Error(`Expected 6,397 GraphSCII owners, found ${registry?.owners?.length ?? "none"}.`);
}
const codepoints = new Set(registry.owners.map((owner) => owner.codepointValue));
const bitmaps = new Set(registry.owners.map((owner) => owner.bitmapKey));
if (codepoints.size !== 6397 || bitmaps.size !== 6397) {
  throw new Error("GraphSCII demo registry must have globally unique codepoints and bitmap owners.");
}
if (registry.owners[0]?.codepointValue !== 0xe000 || registry.owners.at(-1)?.codepointValue !== 0xf8fc) {
  throw new Error("GraphSCII demo registry has unexpected v1 PUA boundaries.");
}

const straightOwners = registry.owners.filter((owner) => owner.canonicalClass === "straight");
const fillClasses = new Set(["solid-100", "medium-75", "half-50", "light-25"]);
const fillOwners = registry.owners.filter((owner) => fillClasses.has(owner.canonicalClass));
const connectorClasses = new Set(["connector-orthogonal", "connector-diagonal"]);
const connectorOwners = registry.owners.filter((owner) => connectorClasses.has(owner.canonicalClass));
if (straightOwners.length !== 746) throw new Error(`Expected 746 straight owners, found ${straightOwners.length}.`);
if (fillOwners.length !== 5050) throw new Error(`Expected 5,050 fill owners, found ${fillOwners.length}.`);
if (connectorOwners.length !== 601) throw new Error(`Expected 601 connector owners, found ${connectorOwners.length}.`);
if (straightOwners.some((owner) => owner.codepointValue < 0xe000 || owner.codepointValue > 0xe2e9)) {
  throw new Error("A straight owner escaped the published U+E000..U+E2E9 allocation.");
}
if (connectorOwners.some((owner) => owner.codepointValue < 0xf6a4 || owner.codepointValue > 0xf8fc)) {
  throw new Error("A connector owner escaped the published U+F6A4..U+F8FC allocation.");
}

if (pairIndex?.index !== "by-connection-pair" || pairIndex?.entryCount !== 1664 || Object.keys(pairIndex.entries ?? {}).length !== 1664) {
  throw new Error("GraphSCII straight lookup must be the published 1,664-entry by-connection-pair table.");
}
const straightGlyphIds = new Set(straightOwners.map((owner) => owner.glyphId));
for (const [pair, entry] of Object.entries(pairIndex.entries)) {
  if (!straightGlyphIds.has(entry.glyphId)) throw new Error(`Straight connection rule ${pair} does not resolve to a straight owner.`);
}

if (boundaryStyle?.index !== "by-boundary-side-style"
  || boundaryStyle?.entryCount !== 9984
  || Object.keys(boundaryStyle.entries ?? {}).length !== 9984) {
  throw new Error("GraphSCII fill lookup must be the published 9,984-entry by-boundary-side-style table.");
}
if (byAlias?.index !== "by-alias" || byAlias?.entryCount !== 10816 || Object.keys(byAlias.entries ?? {}).length !== 10816) {
  throw new Error("GraphSCII semantic resolution source must be the published 10,816-entry by-alias table.");
}

const encodedStyles = new Set(["solid", "medium", "half", "light"]);
const styleCounts = { solid: 0, medium: 0, half: 0, light: 0 };
let encodedFillRuleCount = 0;
let halfFallbackCount = 0;
for (const [ruleKey, aliasKey] of Object.entries(boundaryStyle.entries)) {
  const style = ruleKey.slice(ruleKey.lastIndexOf(":") + 1);
  if (!encodedStyles.has(style)) continue;
  const semantic = byAlias.entries[aliasKey];
  if (!semantic) throw new Error(`Fill rule ${ruleKey} has no semantic resolution.`);

  let glyphId = null;
  if (semantic.resolution === "encoded-owner" && Number.isInteger(semantic.glyphId)) {
    glyphId = semantic.glyphId;
  } else if (
    style === "half"
    && semantic.resolution === "renderer-only-derived"
    && Number.isInteger(semantic.fallbackGlyphId)
  ) {
    glyphId = semantic.fallbackGlyphId;
    halfFallbackCount += 1;
  }

  if (!Number.isInteger(glyphId)) {
    throw new Error(`Encoded fill rule ${ruleKey} did not resolve to an addressable GraphSCII glyph.`);
  }
  const owner = registry.owners[glyphId];
  if (!owner || owner.glyphId !== glyphId || owner.codepointValue >= 0xf6a4) {
    throw new Error(`Encoded fill rule ${ruleKey} escaped the frozen pre-connector vocabulary.`);
  }

  styleCounts[style] += 1;
  encodedFillRuleCount += 1;
}
if (encodedFillRuleCount !== 6656) {
  throw new Error(`Expected 6,656 encoded boundary/side/style fill rules; found ${encodedFillRuleCount}.`);
}
for (const [style, count] of Object.entries(styleCounts)) {
  if (count !== 1664) throw new Error(`Expected 1,664 ${style} fill rules; found ${count}.`);
}
if (halfFallbackCount !== 64) {
  throw new Error(`Expected the published 64 half-tone one-pixel fallbacks; found ${halfFallbackCount}.`);
}

if (orthogonal?.schema !== "graphscii-orthogonal-connectors" || !Array.isArray(orthogonal.semantics) || orthogonal.semantics.length !== 640) {
  throw new Error("GraphSCII orthogonal connector grammar must contain exactly 640 published semantics.");
}
for (const semantic of orthogonal.semantics) {
  if (!bitmaps.has(semantic.bitmapKey)) throw new Error(`Orthogonal semantic ${semantic.id} has no canonical v1 bitmap owner.`);
}

if (diagonal?.schema !== "graphscii-diagonal-connectors" || !Array.isArray(diagonal.semantics)) {
  throw new Error("GraphSCII diagonal connector source table is missing or malformed.");
}
if (diagonalSelection?.schema !== "graphscii-final-diagonal-connector-selection"
  || diagonalSelection?.selectedSemanticCount !== 60
  || !Array.isArray(diagonalSelection.selectedSemanticIds)
  || diagonalSelection.selectedSemanticIds.length !== 60) {
  throw new Error("GraphSCII diagonal connector selection must contain exactly the published 60 semantics.");
}
const diagonalById = new Map(diagonal.semantics.map((semantic) => [semantic.id, semantic]));
for (const semanticId of diagonalSelection.selectedSemanticIds) {
  const semantic = diagonalById.get(semanticId);
  if (!semantic) throw new Error(`Selected diagonal semantic ${semanticId} is absent from the source rule table.`);
  if (!bitmaps.has(semantic.bitmapKey)) throw new Error(`Selected diagonal semantic ${semanticId} has no canonical v1 bitmap owner.`);
}

const fontManifest = JSON.parse(await readFile(fontManifestPath, "utf8"));
const fontBytes = await readFile(fontPath);
const fontInfo = await stat(fontPath);
const fontSha256 = createHash("sha256").update(fontBytes).digest("hex");
if (fontInfo.size < 1_000_000) throw new Error("GraphSCII reference font is unexpectedly small.");
if (fontSha256 !== fontManifest.fontSha256) throw new Error("GraphSCII reference font SHA-256 does not match its manifest.");
if (fontManifest.encodedCharacters !== 6492 || fontManifest.puaCharacters !== 6397 || fontManifest.verification?.allGlyphRasterRoundTrip !== true) {
  throw new Error("GraphSCII font manifest does not describe the verified v1 reference font.");
}

console.log(
  `GraphSCII demo assets verified: ${registry.owners.length} graphics; `
  + `${pairIndex.entryCount} straight pair rules; ${encodedFillRuleCount} encoded fill rules; `
  + `${orthogonal.semantics.length} orthogonal semantics; ${diagonalSelection.selectedSemanticCount} selected diagonal semantics; `
  + `font ${fontSha256}.`,
);
