import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyVocabularyGlyphArtifacts } from "./vocabulary-artifacts.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const verified = await verifyVocabularyGlyphArtifacts(repoRoot);

console.log("GraphSCII Milestone 4D.2 canonical per-glyph artifacts verified.");
console.log(JSON.stringify(verified, null, 2));
