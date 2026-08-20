import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPaletteDecisionArtifacts } from "./palette-decision.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const verified = await verifyPaletteDecisionArtifacts(repoRoot);

console.log("GraphSCII Milestone 4C palette decision verified.");
console.log(JSON.stringify(verified, null, 2));
