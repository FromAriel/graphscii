import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCrossoverResolutionArtifacts } from "./crossover-resolution.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateCrossoverResolutionArtifacts(repoRoot);

console.log("GraphSCII Milestone 10A.1/10A.2 crossover resolution artifacts generated.");
console.log(JSON.stringify(stats, null, 2));
