import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateJunctionGeometryArtifacts } from "./junction-geometry-sweep.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateJunctionGeometryArtifacts(repoRoot);

console.log("GraphSCII Milestone 5A.2 geometry and generic lattice artifacts generated.");
console.log(JSON.stringify(stats, null, 2));
