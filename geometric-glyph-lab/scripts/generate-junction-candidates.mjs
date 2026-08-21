import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateShardedJunctionCandidateArtifacts } from "./junction-candidate-storage.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateShardedJunctionCandidateArtifacts(repoRoot);
console.log("Generated sharded GraphSCII Milestone 5A.3 exhaustive junction candidates.");
console.log(JSON.stringify(stats, null, 2));
