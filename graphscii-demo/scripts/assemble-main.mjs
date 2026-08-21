import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(scriptDir, "..");
const partsDir = path.join(demoRoot, "src", "main.parts");
const output = path.join(demoRoot, "src", "main.generated.ts");

const parts = (await readdir(partsDir))
  .filter((name) => name.endsWith(".ts.part"))
  .sort((a, b) => a.localeCompare(b));

if (parts.length === 0) throw new Error("No GraphSCII Draw main-controller source parts were found.");

const source = (await Promise.all(parts.map((name) => readFile(path.join(partsDir, name), "utf8"))))
  .map((part) => part.trimEnd())
  .join("\n\n");

await writeFile(output, `${source}\n`, "utf8");
console.log(`Assembled GraphSCII Draw controller from ${parts.length} source parts.`);
