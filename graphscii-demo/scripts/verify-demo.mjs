import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(demoRoot, "..");

const registryPath = path.join(repoRoot, "artifacts", "manifest", "vocabulary-v1", "registry.json");
const fontPath = path.join(repoRoot, "artifacts", "fonts", "GraphSCII-Regular.ttf");
const fontManifestPath = path.join(repoRoot, "artifacts", "fonts", "manifest.json");

const registry = JSON.parse(await readFile(registryPath, "utf8"));
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

const strokeClasses = new Set(["straight", "connector-orthogonal", "connector-diagonal"]);
const isStrokeRange = (codepoint) => (
  (codepoint >= 0xe000 && codepoint <= 0xe2e9)
  || (codepoint >= 0xf6a4 && codepoint <= 0xf8fc)
);
const strokeOwners = registry.owners.filter((owner) => strokeClasses.has(owner.canonicalClass));
if (strokeOwners.length !== 1347) {
  throw new Error(`Expected 1,347 straight/connector owners, found ${strokeOwners.length}.`);
}
for (const owner of strokeOwners) {
  if (!isStrokeRange(owner.codepointValue)) {
    throw new Error(`Stroke owner ${owner.codepoint} escaped the straight/connector allocation ranges.`);
  }
}
for (const owner of registry.owners) {
  if (owner.codepointValue >= 0xe2ea && owner.codepointValue <= 0xf6a3 && strokeClasses.has(owner.canonicalClass)) {
    throw new Error(`Fill-range owner ${owner.codepoint} is incorrectly classified as a stroke owner.`);
  }
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

console.log(`GraphSCII demo assets verified: ${registry.owners.length} graphics; ${strokeOwners.length} stroke owners; font ${fontSha256}.`);
