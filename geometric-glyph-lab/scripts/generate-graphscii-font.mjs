import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateGraphSCIIFont } from "./font-compiler.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const manifest = await generateGraphSCIIFont(repoRoot);

console.log("GraphSCII TrueType font generated.");
console.log(JSON.stringify(manifest, null, 2));
