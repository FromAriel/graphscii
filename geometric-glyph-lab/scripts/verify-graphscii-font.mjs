import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyGraphSCIIFont } from "./font-compiler.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await verifyGraphSCIIFont(repoRoot);

console.log("GraphSCII TrueType font verification passed.");
console.log(JSON.stringify(stats, null, 2));
