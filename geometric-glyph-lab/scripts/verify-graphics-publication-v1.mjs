import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyGraphicsPublicationV1 } from "./vocabulary-publication-v1.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await verifyGraphicsPublicationV1(repoRoot);

console.log("GraphSCII Milestone 5E graphics-v1 publication verified.");
console.log(JSON.stringify(stats, null, 2));
