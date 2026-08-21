import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateVocabularyGlyphArtifacts } from "./vocabulary-artifacts.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const generated = await generateVocabularyGlyphArtifacts(repoRoot);

console.log("GraphSCII Milestone 4D.2 canonical per-glyph artifacts generated.");
console.log(JSON.stringify(generated, null, 2));
