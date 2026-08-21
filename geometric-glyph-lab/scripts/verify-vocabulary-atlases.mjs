import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyVocabularyAtlases } from "./vocabulary-atlases.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await verifyVocabularyAtlases(repoRoot);

console.log("GraphSCII Milestone 4D.3 categorized atlases verified.");
console.log(JSON.stringify(stats, null, 2));
