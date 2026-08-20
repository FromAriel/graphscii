import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyGraphicsPublication } from "./vocabulary-publication.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await verifyGraphicsPublication(repoRoot);

console.log("GraphSCII Milestone 4D.6 publication verified.");
console.log(JSON.stringify(stats, null, 2));
