import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifySemanticRegistry } from "./semantic-registry.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const outputRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, "artifacts");

const result = await verifySemanticRegistry(outputRoot);
console.log("GraphSCII semantic registry verification passed.");
console.log(JSON.stringify(result, null, 2));
