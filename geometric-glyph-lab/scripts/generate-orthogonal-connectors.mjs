import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateOrthogonalConnectorArtifacts } from "./orthogonal-connectors.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateOrthogonalConnectorArtifacts(repoRoot);
console.log("Generated GraphSCII Milestone 5B.1 orthogonal generic connectors.");
console.log(JSON.stringify(stats, null, 2));
