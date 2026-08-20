import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateJunctionBlindSpots } from "./junction-blind-spots.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const result = await generateJunctionBlindSpots(repoRoot);
console.log("GraphSCII Milestone 5A.1 junction blind spots generated.");
console.log(JSON.stringify({
  theoreticalSemanticCount: result.theoreticalSemanticCount,
  demandedSemanticCount: result.demandedSemanticCount,
  missingSemanticCount: result.missingSemanticCount,
  missingByTopology: result.missingByTopology,
}, null, 2));
