import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFillRegistry, verifyFillRegistry } from "./fill-registry.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const outputRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, "artifacts");

await buildFillRegistry(outputRoot);
const verified = await verifyFillRegistry(outputRoot);

console.log("GraphSCII fill registry generated and verified.");
console.log(JSON.stringify(verified, null, 2));
