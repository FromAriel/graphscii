import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildArtifacts, verifyArtifacts } from "./artifact-pipeline.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const outputRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, "artifacts");

const built = await buildArtifacts(outputRoot);
const verified = await verifyArtifacts(outputRoot);

console.log(`GraphSCII artifacts generated at ${outputRoot}`);
console.log(JSON.stringify({
  candidates: built.result.candidates.length,
  glyphs: built.result.glyphs.length,
  duplicates: built.result.duplicateCandidates,
  asciiFiles: verified.asciiFiles,
  pngFiles: verified.pngFiles,
  atlas: verified.atlas,
  pages: built.pageCount,
}, null, 2));
