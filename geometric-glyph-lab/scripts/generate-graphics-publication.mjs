import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateGraphicsPublication } from "./vocabulary-publication.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateGraphicsPublication(repoRoot);

console.log("GraphSCII Milestone 4D.6 publication generated.");
console.log(JSON.stringify(stats, null, 2));
