import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PUBLICATION = "graphscii-graphics-v0";
const SOURCE_COMMIT = "415e8a0b31b987f72ffd3677a8537acff3c245b2";
const EXPECTED_ENCODED = 5796;
const EXPECTED_ASCII = 95;
const EXPECTED_RESERVE = 604;
const EXPECTED_SEMANTIC_ALIASES = 10816;
const EXPECTED_RENDERER_ONLY = 3392;
const EXPECTED_RENDERER_EXACT = 414;
const EXPECTED_RENDERER_DERIVED = 2978;
const EXPECTED_RENDERER_UNIQUE_DERIVED = 2555;
const EXPECTED_GLYPH_ARTIFACTS_PER_KIND = 5796;
const EXPECTED_ATLAS_FILES = 126;

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

async function sha256File(filename) {
  const bytes = await readFile(filename);
  return createHash("sha256").update(bytes).digest("hex");
}

async function countFiles(directory, pattern) {
  return (await readdir(directory)).filter((name) => pattern.test(name)).length;
}

function publicationMarkdown(publication) {
  const r = publication.rendererOnly;
  const a = publication.allocation;
  const c = publication.canonicalClasses;
  return `# GraphSCII Graphics Vocabulary v0\n\n` +
    `Status: **${publication.status}**\n\n` +
    `Publication ID: \`${publication.publication}\`\n\n` +
    `This snapshot freezes the first complete addressable GraphSCII graphics vocabulary. The canonical visual truth remains the 8×16 binary bitmap registry; this publication does not build a TTF/OTF.\n\n` +
    `## Encoded vocabulary\n\n` +
    `| Class | Encoded owners |\n| --- | ---: |\n` +
    `| Straight | ${c.straight.toLocaleString("en-US")} |\n` +
    `| Solid 100% | ${c.solid100.toLocaleString("en-US")} |\n` +
    `| Medium 75% | ${c.medium75.toLocaleString("en-US")} |\n` +
    `| Light 25% | ${c.light25.toLocaleString("en-US")} |\n` +
    `| Half 50% | ${c.half50.toLocaleString("en-US")} |\n` +
    `| **Total encoded PUA graphics** | **${publication.encodedGraphics.toLocaleString("en-US")}** |\n\n` +
    `Printable ASCII remains at \`U+0020..U+007E\` (${publication.printableAscii} characters), outside the PUA allocation. Minimum eventual font population with printable ASCII is **${publication.minimumPhysicalGlyphs.toLocaleString("en-US")} glyphs**.\n\n` +
    `## Address space\n\n` +
    `- Encoded: \`${a.unicodeStart}..${a.unicodeEnd}\`\n` +
    `- Protected reserve: \`${a.reserveStart}..${a.reserveEnd}\` — **${a.reserveSlots} slots**\n` +
    `- Published straight block: \`${a.straightStart}..${a.straightEnd}\` — unchanged\n\n` +
    `## Renderer-only semantics\n\n` +
    `GraphSCII retains **${r.semanticAliases.toLocaleString("en-US")} renderer-only semantic aliases** without spending more PUA codepoints: **${r.exactEncodedReuses.toLocaleString("en-US")} exact encoded reuses** and **${r.derivedAliases.toLocaleString("en-US")} derived aliases** across **${r.uniqueDerivedBitmaps.toLocaleString("en-US")} globally unique derived bitmaps**. Dense 87.5% and sparse 12.5% remain renderer-capable, and all 64 demoted-half semantics preserve their Hamming-distance-1 fallback relation.\n\n` +
    `## Canonical publication artifacts\n\n` +
    `- Registry: \`${publication.artifacts.registry}\`\n` +
    `- Registry stats: \`${publication.artifacts.registryStats}\`\n` +
    `- Master text atlas: \`${publication.artifacts.masterTextAtlas}\`\n` +
    `- Master page atlas: \`${publication.artifacts.masterPageAtlas}\`\n` +
    `- Master layout map: \`${publication.artifacts.masterLayoutMap}\`\n` +
    `- Renderer-only resolution index: \`${publication.artifacts.rendererOnlyIndex}\`\n` +
    `- Canonical ASCII glyphs: \`${publication.artifacts.asciiGlyphDirectory}\`\n` +
    `- Canonical PNG glyphs: \`${publication.artifacts.pngGlyphDirectory}\`\n\n` +
    `## Reproducibility\n\n` +
    `Source baseline: \`${publication.sourceCommit}\` (${publication.sourceCommitRole}).\n\n` +
    `Generation: \`${publication.generator}\`\n\n` +
    `Verification: \`${publication.verification}\`\n\n` +
    `The publication manifest records SHA-256 digests of its canonical registry, statistics, renderer-only index, and master atlas views. The Milestone 4D.6 completion gate additionally deletes the generated 4D vocabulary outputs, regenerates them from source, and requires the complete project verifier to pass.\n`;
}

async function loadState(repoRoot) {
  const manifestRoot = path.join(repoRoot, "artifacts", "manifest", "vocabulary");
  const vocabularyRoot = path.join(repoRoot, "artifacts", "vocabulary");
  const atlasRoot = path.join(vocabularyRoot, "atlases");
  const rendererRoot = path.join(vocabularyRoot, "renderer-only");

  const registryPath = path.join(manifestRoot, "registry.json");
  const statsPath = path.join(manifestRoot, "stats.json");
  const rendererIndexPath = path.join(rendererRoot, "index.json");
  const atlasStatsPath = path.join(atlasRoot, "stats.json");
  const masterTextPath = path.join(atlasRoot, "master-text-atlas.md");
  const masterPagePath = path.join(atlasRoot, "master-page-atlas.md");
  const masterLayoutPath = path.join(atlasRoot, "master-layout-map.md");

  const [registry, stats, rendererIndex, atlasStats] = await Promise.all([
    readJson(registryPath),
    readJson(statsPath),
    readJson(rendererIndexPath),
    readJson(atlasStatsPath),
  ]);

  const asciiCount = await countFiles(path.join(vocabularyRoot, "glyphs", "ascii"), /^U\+[0-9A-F]{6}\.txt$/u);
  const pngCount = await countFiles(path.join(vocabularyRoot, "glyphs", "png"), /^U\+[0-9A-F]{6}\.png$/u);

  if (registry.owners.length !== EXPECTED_ENCODED || stats.encodedOwners !== EXPECTED_ENCODED) {
    throw new Error("Milestone 4D.6 encoded vocabulary cardinality mismatch.");
  }
  if (stats.semanticAliases !== EXPECTED_SEMANTIC_ALIASES) {
    throw new Error("Milestone 4D.6 semantic alias fixture mismatch.");
  }
  if (
    stats.firstCodepoint !== "U+00E000" ||
    stats.lastAllocatedCodepoint !== "U+00F6A3" ||
    stats.reserveStart !== "U+00F6A4" ||
    stats.reserveEnd !== "U+00F8FF" ||
    stats.reserveSlots !== EXPECTED_RESERVE ||
    !stats.straightCodepointsUnchanged
  ) {
    throw new Error("Milestone 4D.6 allocation boundary fixture mismatch.");
  }
  if (asciiCount !== EXPECTED_GLYPH_ARTIFACTS_PER_KIND || pngCount !== EXPECTED_GLYPH_ARTIFACTS_PER_KIND) {
    throw new Error(`Milestone 4D.6 requires ${EXPECTED_GLYPH_ARTIFACTS_PER_KIND} ASCII and PNG glyph artifacts.`);
  }
  if (atlasStats.generatedFiles !== EXPECTED_ATLAS_FILES || atlasStats.encodedOwners !== EXPECTED_ENCODED) {
    throw new Error("Milestone 4D.6 categorized atlas fixture mismatch.");
  }
  if (
    rendererIndex.summary.semanticAliases !== EXPECTED_RENDERER_ONLY ||
    rendererIndex.summary.exactEncodedReuses !== EXPECTED_RENDERER_EXACT ||
    rendererIndex.summary.derivedAliases !== EXPECTED_RENDERER_DERIVED ||
    rendererIndex.summary.uniqueDerivedBitmaps !== EXPECTED_RENDERER_UNIQUE_DERIVED ||
    rendererIndex.summary.encodedCodepointsConsumed !== 0
  ) {
    throw new Error("Milestone 4D.6 renderer-only fixture mismatch.");
  }
  if (
    rendererIndex.groups["demoted-half"].semanticAliases !== 64 ||
    rendererIndex.groups["demoted-half"].uniqueDerivedBitmaps !== 62 ||
    rendererIndex.groups["demoted-half"].fallbackAliases !== 64
  ) {
    throw new Error("Milestone 4D.6 demoted-half fixture mismatch.");
  }

  const digests = {
    registrySha256: await sha256File(registryPath),
    registryStatsSha256: await sha256File(statsPath),
    rendererOnlyIndexSha256: await sha256File(rendererIndexPath),
    atlasStatsSha256: await sha256File(atlasStatsPath),
    masterTextAtlasSha256: await sha256File(masterTextPath),
    masterPageAtlasSha256: await sha256File(masterPagePath),
    masterLayoutMapSha256: await sha256File(masterLayoutPath),
  };

  return { registry, stats, rendererIndex, atlasStats, asciiCount, pngCount, digests };
}

export async function buildGraphicsPublication(repoRoot) {
  const state = await loadState(repoRoot);
  const publication = {
    schema: "graphscii-publication",
    schemaVersion: 2,
    publication: PUBLICATION,
    status: "provisional",
    sourceCommit: SOURCE_COMMIT,
    sourceCommitRole: "verified Milestone 4D.5 input baseline",
    generator: "cd geometric-glyph-lab && npm run generate",
    verification: "cd geometric-glyph-lab && npm run verify",
    canonicalCell: "8x16",
    bitmapSerialization: "v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex",
    encodedGraphics: EXPECTED_ENCODED,
    printableAscii: EXPECTED_ASCII,
    minimumPhysicalGlyphs: EXPECTED_ENCODED + EXPECTED_ASCII,
    semanticAliases: EXPECTED_SEMANTIC_ALIASES,
    canonicalClasses: {
      straight: state.stats.canonicalClassCounts.straight,
      solid100: state.stats.canonicalClassCounts["solid-100"],
      medium75: state.stats.canonicalClassCounts["medium-75"],
      light25: state.stats.canonicalClassCounts["light-25"],
      half50: state.stats.canonicalClassCounts["half-50"],
    },
    allocation: {
      unicodeStart: state.stats.firstCodepoint,
      unicodeEnd: state.stats.lastAllocatedCodepoint,
      straightStart: "U+00E000",
      straightEnd: "U+00E2E9",
      reserveStart: state.stats.reserveStart,
      reserveEnd: state.stats.reserveEnd,
      reserveSlots: state.stats.reserveSlots,
    },
    encodedTonalStyles: ["solid-100", "medium-75", "half-50", "light-25"],
    rendererOnlyTonalStyles: ["dense-87.5", "sparse-12.5", "demoted-half-50"],
    rendererOnly: {
      semanticAliases: state.rendererIndex.summary.semanticAliases,
      exactEncodedReuses: state.rendererIndex.summary.exactEncodedReuses,
      derivedAliases: state.rendererIndex.summary.derivedAliases,
      uniqueDerivedBitmaps: state.rendererIndex.summary.uniqueDerivedBitmaps,
      encodedCodepointsConsumed: state.rendererIndex.summary.encodedCodepointsConsumed,
      dense: state.rendererIndex.groups.dense,
      sparse: state.rendererIndex.groups.sparse,
      demotedHalf: state.rendererIndex.groups["demoted-half"],
    },
    artifactCounts: {
      asciiGlyphs: state.asciiCount,
      pngGlyphs: state.pngCount,
      categorizedAtlasFiles: state.atlasStats.generatedFiles,
      masterAtlasFiles: 10,
      rendererOnlyResolutionFiles: 5,
    },
    artifacts: {
      registry: "artifacts/manifest/vocabulary/registry.json",
      registryStats: "artifacts/manifest/vocabulary/stats.json",
      asciiGlyphDirectory: "artifacts/vocabulary/glyphs/ascii/",
      pngGlyphDirectory: "artifacts/vocabulary/glyphs/png/",
      categorizedAtlases: "artifacts/vocabulary/atlases/",
      masterTextAtlas: "artifacts/vocabulary/atlases/master-text-atlas.md",
      masterPageAtlas: "artifacts/vocabulary/atlases/master-page-atlas.md",
      masterLayoutMap: "artifacts/vocabulary/atlases/master-layout-map.md",
      rendererOnlyIndex: "artifacts/vocabulary/renderer-only/index.json",
      rendererOnlyAtlas: "artifacts/vocabulary/renderer-only/renderer-only-atlas.md",
    },
    digests: state.digests,
  };
  return {
    publication,
    json: jsonText(publication),
    markdown: publicationMarkdown(publication),
  };
}

export async function generateGraphicsPublication(repoRoot) {
  const outputRoot = path.join(repoRoot, "artifacts", "publications");
  await mkdir(outputRoot, { recursive: true });
  const built = await buildGraphicsPublication(repoRoot);
  await Promise.all([
    writeFile(path.join(outputRoot, `${PUBLICATION}.json`), built.json),
    writeFile(path.join(outputRoot, `${PUBLICATION}.md`), built.markdown),
  ]);
  return {
    publication: PUBLICATION,
    encodedGraphics: built.publication.encodedGraphics,
    rendererOnlySemanticAliases: built.publication.rendererOnly.semanticAliases,
    reserveSlots: built.publication.allocation.reserveSlots,
    outputFiles: 2,
  };
}

export async function verifyGraphicsPublication(repoRoot) {
  const outputRoot = path.join(repoRoot, "artifacts", "publications");
  const built = await buildGraphicsPublication(repoRoot);
  const [actualJson, actualMarkdown] = await Promise.all([
    readFile(path.join(outputRoot, `${PUBLICATION}.json`), "utf8"),
    readFile(path.join(outputRoot, `${PUBLICATION}.md`), "utf8"),
  ]);
  if (actualJson !== built.json) {
    throw new Error(`${PUBLICATION}.json does not match deterministic Milestone 4D.6 generation.`);
  }
  if (actualMarkdown !== built.markdown) {
    throw new Error(`${PUBLICATION}.md does not match deterministic Milestone 4D.6 generation.`);
  }
  const p = built.publication;
  if (
    p.encodedGraphics !== EXPECTED_ENCODED ||
    p.minimumPhysicalGlyphs !== 5891 ||
    p.allocation.reserveSlots !== EXPECTED_RESERVE ||
    p.rendererOnly.semanticAliases !== EXPECTED_RENDERER_ONLY ||
    p.rendererOnly.exactEncodedReuses !== EXPECTED_RENDERER_EXACT ||
    p.rendererOnly.derivedAliases !== EXPECTED_RENDERER_DERIVED ||
    p.rendererOnly.uniqueDerivedBitmaps !== EXPECTED_RENDERER_UNIQUE_DERIVED
  ) {
    throw new Error("Milestone 4D.6 publication fixture mismatch.");
  }
  return {
    publication: p.publication,
    sourceCommit: p.sourceCommit,
    encodedGraphics: p.encodedGraphics,
    minimumPhysicalGlyphs: p.minimumPhysicalGlyphs,
    rendererOnlySemanticAliases: p.rendererOnly.semanticAliases,
    reserveSlots: p.allocation.reserveSlots,
    digests: p.digests,
  };
}
