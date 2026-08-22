import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCrossoverCoverageArtifacts } from "./crossover-coverage.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateCrossoverCoverageArtifacts(repoRoot);

console.log("GraphSCII Milestone 10A.0 crossover coverage artifacts generated.");
console.log(JSON.stringify(stats, null, 2));
