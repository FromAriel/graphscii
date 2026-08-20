import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyVocabularyMasterAtlas } from "./vocabulary-master-atlas.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await verifyVocabularyMasterAtlas(repoRoot);

console.log("GraphSCII Milestone 4D.4 master atlases verified.");
console.log(JSON.stringify(stats, null, 2));
