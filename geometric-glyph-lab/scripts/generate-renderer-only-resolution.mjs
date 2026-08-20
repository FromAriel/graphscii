import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateRendererOnlyResolution } from "./renderer-only-resolution.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateRendererOnlyResolution(repoRoot);

console.log("GraphSCII Milestone 4D.5 renderer-only resolution artifacts generated.");
console.log(JSON.stringify(stats, null, 2));
