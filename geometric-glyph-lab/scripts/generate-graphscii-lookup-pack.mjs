import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateGraphsciilLookupPackArtifacts } from "./graphscii-lookup-pack.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

const destIndex = process.argv.indexOf("--dest");
const destDir = destIndex >= 0 ? path.resolve(process.argv[destIndex + 1]) : null;

const stats = await generateGraphsciilLookupPackArtifacts(repoRoot, destDir);

console.log("GraphSCII lookup pack generated.");
console.log(`canonical: ${path.join(repoRoot, "artifacts", "graphscii-lookup-pack", "v1")}`);
if (destDir) console.log(`mirrored:  ${destDir}`);
console.log(JSON.stringify(stats, null, 2));
