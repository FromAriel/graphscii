import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyVocabularyRegistry } from "./vocabulary-registry.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const result = await verifyVocabularyRegistry(repoRoot);

console.log("Verified GraphSCII Milestone 4D.1 canonical vocabulary registry.");
console.log(JSON.stringify(result, null, 2));
