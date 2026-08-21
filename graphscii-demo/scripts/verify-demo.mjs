import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(demoRoot, "..");

const paths = {
  registry: path.join(repoRoot, "artifacts", "manifest", "vocabulary-v1", "registry.json"),
  pairs: path.join(repoRoot, "artifacts", "manifest", "indexes", "by-connection-pair.json"),
  boundary: path.join(repoRoot, "artifacts", "manifest", "vocabulary", "indexes", "by-boundary-side-style.json"),
  aliases: path.join(repoRoot, "artifacts", "manifest", "vocabulary", "indexes", "by-alias.json"),
  orthogonal: path.join(repoRoot, "artifacts", "research", "junctions", "orthogonal-connectors.json"),
  diagonal: path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-connectors.json"),
  diagonalSelection: path.join(repoRoot, "artifacts", "research", "junctions", "diagonal-selection.json"),
  font: path.join(repoRoot, "artifacts", "fonts", "GraphSCII-Regular.ttf"),
  fontManifest: path.join(repoRoot, "artifacts", "fonts", "manifest.json"),
};

const [registry, pairs, boundary, aliases, orthogonal, diagonal, diagonalSelection, fontManifest] = await Promise.all([
  readFile(paths.registry, "utf8").then(JSON.parse),
  readFile(paths.pairs, "utf8").then(JSON.parse),
  readFile(paths.boundary, "utf8").then(JSON.parse),
  readFile(paths.aliases, "utf8").then(JSON.parse),
  readFile(paths.orthogonal, "utf8").then(JSON.parse),
  readFile(paths.diagonal, "utf8").then(JSON.parse),
  readFile(paths.diagonalSelection, "utf8").then(JSON.parse),
  readFile(paths.fontManifest, "utf8").then(JSON.parse),
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
  throw new Error("GraphSCII v1 registry must have globally unique codepoints and bitmap owners.");
}
if (registry.owners[0]?.codepointValue !== 0xe000 || registry.owners.at(-1)?.codepointValue !== 0xf8fc) {
  throw new Error("GraphSCII v1 registry has unexpected PUA boundaries.");
}

const straightOwners = registry.owners.filter((owner) => owner.canonicalClass === "straight");
const fillClasses = new Set(["solid-100", "medium-75", "half-50", "light-25"]);
const fillOwners = registry.owners.filter((owner) => fillClasses.has(owner.canonicalClass));
const connectorClasses = new Set(["connector-orthogonal", "connector-diagonal"]);
const connectorOwners = registry.owners.filter((owner) => connectorClasses.has(owner.canonicalClass));
if (straightOwners.length !== 746) throw new Error(`Expected 746 straight owners, found ${straightOwners.length}.`);
if (fillOwners.length !== 5050) throw new Error(`Expected 5,050 fill owners, found ${fillOwners.length}.`);
if (connectorOwners.length !== 601) throw new Error(`Expected 601 connector owners, found ${connectorOwners.length}.`);

if (pairs?.index !== "by-connection-pair" || pairs?.entryCount !== 1664 || Object.keys(pairs.entries ?? {}).length !== 1664) {
  throw new Error("Straight lookup must be the published 1,664-entry by-connection-pair table.");
}
const straightGlyphIds = new Set(straightOwners.map((owner) => owner.glyphId));
for (const [pair, entry] of Object.entries(pairs.entries)) {
  if (!straightGlyphIds.has(entry.glyphId)) throw new Error(`Straight connection rule ${pair} does not resolve to a straight owner.`);
}

if (boundary?.index !== "by-boundary-side-style" || boundary?.entryCount !== 9984 || Object.keys(boundary.entries ?? {}).length !== 9984) {
  throw new Error("Fill lookup must be the published 9,984-entry by-boundary-side-style table.");
}
if (aliases?.index !== "by-alias" || aliases?.entryCount !== 10816 || Object.keys(aliases.entries ?? {}).length !== 10816) {
  throw new Error("Semantic resolution source must be the published 10,816-entry by-alias table.");
}

const selectedStyles = new Set(["solid", "medium", "half", "light"]);
const semanticCounts = { solid: 0, medium: 0, half: 0, light: 0 };
let exactEncodable = 0;
let rendererOnlyDerived = 0;
for (const [ruleKey, aliasKey] of Object.entries(boundary.entries)) {
  const style = ruleKey.slice(ruleKey.lastIndexOf(":") + 1);
  if (!selectedStyles.has(style)) continue;
  semanticCounts[style] += 1;
  const semantic = aliases.entries[aliasKey];
  if (!semantic) throw new Error(`Fill rule ${ruleKey} has no semantic resolution.`);
  if (Number.isInteger(semantic.glyphId) && semantic.codepoint !== null) {
    const owner = registry.owners[semantic.glyphId];
    if (!owner || owner.glyphId !== semantic.glyphId || owner.bitmapKey !== semantic.bitmapKey) {
      throw new Error(`Exact fill semantic ${ruleKey} does not resolve to the exact canonical bitmap owner.`);
    }
    exactEncodable += 1;
  } else if (semantic.resolution === "renderer-only-derived") {
    rendererOnlyDerived += 1;
    if (semantic.glyphId !== null || semantic.codepoint !== null) {
      throw new Error(`Renderer-only fill semantic ${ruleKey} unexpectedly owns an encoded codepoint.`);
    }
  } else {
    throw new Error(`Selected fill semantic ${ruleKey} has an unsupported resolution state: ${semantic.resolution}.`);
  }
}
for (const [style, count] of Object.entries(semanticCounts)) {
  if (count !== 1664) throw new Error(`Expected 1,664 ${style} semantic rules; found ${count}.`);
}
if (exactEncodable !== 6592 || rendererOnlyDerived !== 64) {
  throw new Error(`Expected 6,592 exact encodable selected fill semantics plus 64 renderer-only half semantics; found ${exactEncodable} + ${rendererOnlyDerived}.`);
}

if (orthogonal?.schema !== "graphscii-orthogonal-connectors" || !Array.isArray(orthogonal.semantics) || orthogonal.semantics.length !== 640) {
  throw new Error("Orthogonal connector grammar must contain exactly 640 published semantics.");
}
for (const semantic of orthogonal.semantics) {
  if (!bitmaps.has(semantic.bitmapKey)) throw new Error(`Orthogonal semantic ${semantic.id} has no canonical v1 bitmap owner.`);
}
if (diagonal?.schema !== "graphscii-diagonal-connectors" || !Array.isArray(diagonal.semantics)) {
  throw new Error("Diagonal connector source table is missing or malformed.");
}
if (diagonalSelection?.schema !== "graphscii-final-diagonal-connector-selection"
  || diagonalSelection?.selectedSemanticCount !== 60
  || !Array.isArray(diagonalSelection.selectedSemanticIds)
  || diagonalSelection.selectedSemanticIds.length !== 60) {
  throw new Error("Diagonal connector selection must contain exactly the published 60 semantics.");
}
const diagonalById = new Map(diagonal.semantics.map((semantic) => [semantic.id, semantic]));
for (const id of diagonalSelection.selectedSemanticIds) {
  const semantic = diagonalById.get(id);
  if (!semantic || !bitmaps.has(semantic.bitmapKey)) throw new Error(`Selected diagonal semantic ${id} has no canonical v1 owner.`);
}

const fontBytes = await readFile(paths.font);
const fontInfo = await stat(paths.font);
const fontSha256 = createHash("sha256").update(fontBytes).digest("hex");
if (fontInfo.size < 1_000_000) throw new Error("GraphSCII reference font is unexpectedly small.");
if (fontSha256 !== fontManifest.fontSha256) throw new Error("GraphSCII reference font SHA-256 does not match its manifest.");
if (fontManifest.encodedCharacters !== 6492 || fontManifest.puaCharacters !== 6397 || fontManifest.verification?.allGlyphRasterRoundTrip !== true) {
  throw new Error("GraphSCII font manifest does not describe the verified v1 reference font.");
}

console.log(
  `GraphSCII assets verified: 6397 owners; 1664 straight rules; 6592 exactly encodable selected fill semantics; `
  + `64 renderer-only half semantics (never substituted); 640 orthogonal and 60 selected diagonal semantics; font ${fontSha256}.`,
);
