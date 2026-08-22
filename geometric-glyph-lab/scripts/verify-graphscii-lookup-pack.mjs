import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyGraphsciilLookupPackArtifacts } from "./graphscii-lookup-pack.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

const destIndex = process.argv.indexOf("--dest");
const destDir = destIndex >= 0 ? path.resolve(process.argv[destIndex + 1]) : null;

const stats = await verifyGraphsciilLookupPackArtifacts(repoRoot, destDir);

console.log("GraphSCII lookup pack verified (byte-determinism, manifest pins, mirror).");
console.log(JSON.stringify(stats, null, 2));
