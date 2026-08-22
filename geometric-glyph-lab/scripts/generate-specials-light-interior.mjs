import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateSpecialsLightInteriorArtifacts } from "./specials-light-interior.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const stats = await generateSpecialsLightInteriorArtifacts(repoRoot);

console.log("GraphSCII specials-light-interior (v1.1) artifacts generated.");
console.log(JSON.stringify(stats, null, 2));
