import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStraightLinesCatalog, verifyStraightLinesCatalog } from "./straight-catalog.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const outputRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, "artifacts");

const built = await buildStraightLinesCatalog(outputRoot);
const verified = await verifyStraightLinesCatalog(outputRoot);

console.log("GraphSCII straight-line catalog generated.");
console.log(JSON.stringify({
  path: built.catalogPath,
  glyphs: verified.glyphs,
  aliases: verified.aliases,
  bytes: verified.bytes,
}, null, 2));
