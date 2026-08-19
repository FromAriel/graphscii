import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSemanticRegistry, verifySemanticRegistry } from "./semantic-registry.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const outputRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, "artifacts");

await buildSemanticRegistry(outputRoot);
const verified = await verifySemanticRegistry(outputRoot);

console.log("GraphSCII semantic registry generated and verified.");
console.log(JSON.stringify(verified, null, 2));
