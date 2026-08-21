import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateJunctionCandidateArtifacts } from "./junction-candidates.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateJunctionCandidateArtifacts(repoRoot);
console.log("Generated GraphSCII Milestone 5A.3 exhaustive junction candidates.");
console.log(JSON.stringify(stats, null, 2));
