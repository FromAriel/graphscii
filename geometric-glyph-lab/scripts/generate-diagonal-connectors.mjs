import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDiagonalConnectorArtifacts } from "./diagonal-connectors.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateDiagonalConnectorArtifacts(repoRoot);
console.log("GraphSCII Milestone 5B.2 deterministic diagonal connector artifacts generated.");
console.log(JSON.stringify(stats, null, 2));
