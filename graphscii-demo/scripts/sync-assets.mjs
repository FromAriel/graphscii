import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(demoRoot, "..");
const outputDir = path.join(demoRoot, "public", "assets");

const assets = [
  ["artifacts/fonts/GraphSCII-Regular.ttf", "GraphSCII-Regular.ttf"],
  ["artifacts/manifest/vocabulary-v1/registry.json", "registry.json"],
  ["artifacts/manifest/indexes/by-connection-pair.json", "by-connection-pair.json"],
  ["artifacts/manifest/vocabulary/indexes/by-boundary-side-style.json", "by-boundary-side-style.json"],
  ["artifacts/manifest/vocabulary/indexes/by-alias.json", "by-alias.json"],
  ["artifacts/research/junctions/orthogonal-connectors.json", "orthogonal-connectors.json"],
  ["artifacts/research/junctions/diagonal-connectors.json", "diagonal-connectors.json"],
  ["artifacts/research/junctions/diagonal-selection.json", "diagonal-selection.json"],
].map(([source, target]) => ({
  source: path.join(repoRoot, ...source.split("/")),
  target: path.join(outputDir, target),
}));

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

console.log(
  "GraphSCII demo assets synchronized directly from the frozen v1 registry and canonical semantic rule indexes.",
);
