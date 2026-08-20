import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateJunctionDemandArtifacts } from "./junction-demand.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateJunctionDemandArtifacts(repoRoot);

console.log("GraphSCII Milestone 5A.1 junction demand artifacts generated.");
console.log(JSON.stringify(stats, null, 2));
