import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDitherResearch, verifyDitherResearch } from "./dither-research.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(scriptDir, "..", "..");

await buildDitherResearch(repoRoot);
const verified = await verifyDitherResearch(repoRoot);

console.log("GraphSCII Milestone 4B dither research generated and verified.");
console.log(JSON.stringify(verified, null, 2));
