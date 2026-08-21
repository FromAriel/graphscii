import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateGraphicsPublicationV1 } from "./vocabulary-publication-v1.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateGraphicsPublicationV1(repoRoot);

console.log("GraphSCII Milestone 5E graphics-v1 publication generated.");
console.log(JSON.stringify(stats, null, 2));
