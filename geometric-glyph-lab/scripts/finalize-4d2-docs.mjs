import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

function replaceExactly(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) {
    throw new Error(`Unable to finalize 4D.2: missing ${label}.`);
  }
  if (text.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Unable to finalize 4D.2: ${label} is not unique.`);
  }
  return text.slice(0, first) + after + text.slice(first + before.length);
}

const planPath = path.join(repoRoot, "PLAN.md");
let plan = await readFile(planPath, "utf8");
plan = replaceExactly(
  plan,
  `4D.1  canonical allocation registry                 COMPLETE\n4D.2  5,796 canonical ASCII/PNG artifacts             NEXT\n4D.3  categorized visual/text atlases`,
  `4D.1  canonical allocation registry                 COMPLETE\n4D.2  5,796 canonical ASCII/PNG artifacts             COMPLETE\n4D.3  categorized visual/text atlases                  NEXT`,
  "4D execution-order block",
);
plan = replaceExactly(
  plan,
  `### 4D.2 — canonical per-glyph artifacts\n\nGenerate deterministic source artifacts for all 5,796 encoded owners:\n\n\`\`\`text\nartifacts/vocabulary/glyphs/\n├── ascii/    5,796 files\n└── png/      5,796 files\n\`\`\`\n\nThe canonical bitmap registry remains the source of truth for both.`,
  `### 4D.2 — canonical per-glyph artifacts — COMPLETE\n\nCompletion note: [\`docs/milestone-4d2-canonical-glyph-artifacts.md\`](docs/milestone-4d2-canonical-glyph-artifacts.md)\n\nThe complete encoded vocabulary is now materialized directly from the canonical registry:\n\n\`\`\`text\nartifacts/vocabulary/glyphs/\n├── ascii/    5,796 files\n└── png/      5,796 files\n\`\`\`\n\nExactly **11,592** per-glyph files are present. Every ASCII artifact is an exact 8×16 \`#\`/\`-\` raster and every PNG is an exact 8×16 deterministic RGBA rendering of the same registry bitmap. The generator clears only this glyph-artifact tree before rebuilding, and the verifier checks every filename and every file byte against the corresponding owner bitmap key.\n\nThe canonical bitmap registry remains the source of truth for both forms.`,
  "4D.2 plan block",
);
plan = replaceExactly(
  plan,
  `### 4D.3 — categorized atlases`,
  `### 4D.3 — categorized atlases — NEXT`,
  "4D.3 heading",
);
plan = replaceExactly(
  plan,
  `npm run generate:vocabulary\nnpm run verify:vocabulary\nnpm run check`,
  `npm run generate:vocabulary\nnpm run verify:vocabulary\nnpm run generate:vocabulary-artifacts\nnpm run verify:vocabulary-artifacts\nnpm run check`,
  "current commands block",
);
plan = replaceExactly(
  plan,
  `The published straight allocation remains authoritative. The 4C fill/dither ranges are planned but unallocated until Milestone 4D publication.`,
  `The published straight allocation remains authoritative. Milestone 4D.1 has provisionally allocated the selected 5,796-owner graphics vocabulary through U+F6A3; Milestone 4D.2 has materialized all 5,796 ASCII and PNG owners. The 604-slot U+F6A4..U+F8FF reserve remains untouched.`,
  "current allocation summary",
);
await writeFile(planPath, plan);

const milestonePath = path.join(repoRoot, "docs", "milestone-4d-publication-plan.md");
let milestone = await readFile(milestonePath, "utf8");
milestone = replaceExactly(
  milestone,
  `Status: **IN PROGRESS — 4D.1 COMPLETE; 4D.2 NEXT**`,
  `Status: **IN PROGRESS — 4D.1 AND 4D.2 COMPLETE; 4D.3 NEXT**`,
  "4D milestone status",
);
milestone = replaceExactly(
  milestone,
  `## 3. Milestone 4D.2 — canonical per-glyph artifacts — NEXT`,
  `## 3. Milestone 4D.2 — canonical per-glyph artifacts — COMPLETE\n\nCompletion note: [\`milestone-4d2-canonical-glyph-artifacts.md\`](milestone-4d2-canonical-glyph-artifacts.md)`,
  "4D.2 milestone heading",
);
milestone = replaceExactly(
  milestone,
  `The bitmap key in the registry is the source of truth for both forms.`,
  `The bitmap key in the registry is the source of truth for both forms.\n\nImplemented and verified result:\n\n\`\`\`text\nASCII glyph artifacts     5,796\nPNG glyph artifacts       5,796\ncombined files           11,592\nfirst codepoint          U+E000\nlast codepoint           U+F6A3\nreserve artifacts             0\n\`\`\`\n\nGeneration and verification are permanent parts of \`npm run generate\` and \`npm run verify\`. Every committed artifact is reproduced from the canonical registry and compared byte-for-byte by the verifier.`,
  "4D.2 source-of-truth paragraph",
);
milestone = replaceExactly(
  milestone,
  `## 4. Milestone 4D.3 — category atlases`,
  `## 4. Milestone 4D.3 — category atlases — NEXT`,
  "4D.3 milestone heading",
);
await writeFile(milestonePath, milestone);

console.log("Milestone 4D.2 documentation finalized; 4D.3 is next.");
