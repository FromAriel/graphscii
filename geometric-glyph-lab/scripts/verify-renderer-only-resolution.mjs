import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyRendererOnlyResolution } from "./renderer-only-resolution.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await verifyRendererOnlyResolution(repoRoot);

console.log("GraphSCII Milestone 4D.5 renderer-only resolution artifacts verified.");
console.log(JSON.stringify(stats, null, 2));
