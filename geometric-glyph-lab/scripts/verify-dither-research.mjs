import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyDitherResearch } from "./dither-research.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(scriptDir, "..", "..");

const verified = await verifyDitherResearch(repoRoot);
console.log("GraphSCII Milestone 4B dither research artifacts verified.");
console.log(JSON.stringify(verified, null, 2));
