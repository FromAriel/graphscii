import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDiagonalSelectionArtifacts } from "./diagonal-selection.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const selection = await generateDiagonalSelectionArtifacts(repoRoot);
console.log("GraphSCII final deterministic diagonal connector selection generated.");
console.log(JSON.stringify(selection, null, 2));
