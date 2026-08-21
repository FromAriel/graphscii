import { copyFile, mkdir, stat } from "node:fs/promises";
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
];

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

console.log("GraphSCII demo assets synchronized from the frozen repository artifacts.");
