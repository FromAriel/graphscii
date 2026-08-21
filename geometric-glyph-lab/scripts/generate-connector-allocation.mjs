import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateConnectorAllocationArtifacts } from "./connector-allocation.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateConnectorAllocationArtifacts(repoRoot);
console.log("GraphSCII connector allocation artifacts generated.");
console.log(JSON.stringify(stats, null, 2));
