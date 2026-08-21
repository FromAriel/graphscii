import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PUBLICATION = "graphscii-graphics-v1";
const BASE_PUBLICATION = "graphscii-graphics-v0";
const SOURCE_COMMIT = "f252a57efb94526e42d7bfd72d65854f2ae756d8";

const EXPECTED_BASE_OWNERS = 5796;
const EXPECTED_CONNECTOR_OWNERS = 601;
const EXPECTED_ORTHOGONAL_OWNERS = 544;
const EXPECTED_DIAGONAL_OWNERS = 57;
const EXPECTED_TOTAL_OWNERS = 6397;
const EXPECTED_CONNECTOR_SEMANTICS = 700;
const EXPECTED_BASE_SEMANTICS = 10816;
const EXPECTED_TOTAL_SEMANTICS = EXPECTED_BASE_SEMANTICS + EXPECTED_CONNECTOR_SEMANTICS;
const EXPECTED_PRINTABLE_ASCII = 95;
const EXPECTED_RESERVE = 3;
const EXPECTED_CONNECTOR_ATLAS_PAGES = 3;
const EXPECTED_RENDERER_ONLY = 3392;
const EXPECTED_RENDERER_EXACT = 414;
const EXPECTED_RENDERER_DERIVED = 2978;
const EXPECTED_RENDERER_UNIQUE_DERIVED = 2555;

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

function publicationMarkdown(p) {
  const a = p.allocation;
  const c = p.canonicalClasses;
  return `# GraphSCII Graphics Vocabulary v1\n\n` +
    `Status: **${p.status}**\n\n` +
    `Publication ID: \`${p.publication}\`\n\n` +
    `Base publication: \`${p.basePublication}\`\n\n` +
    `This snapshot extends the frozen graphics-v0 bitmap vocabulary with the final deterministic generic connector basis. It still defines an addressable 8×16 graphics vocabulary rather than a TTF/OTF font.\n\n` +
    `## Encoded vocabulary\n\n` +
    `| Class | Encoded owners |\n| --- | ---: |\n` +
    `| Straight | ${c.straight.toLocaleString("en-US")} |\n` +
    `| Solid 100% | ${c.solid100.toLocaleString("en-US")} |\n` +
    `| Medium 75% | ${c.medium75.toLocaleString("en-US")} |\n` +
    `| Light 25% | ${c.light25.toLocaleString("en-US")} |\n` +
    `| Half 50% | ${c.half50.toLocaleString("en-US")} |\n` +
    `| Orthogonal connectors | ${c.connectorOrthogonal.toLocaleString("en-US")} |\n` +
    `| Diagonal connectors | ${c.connectorDiagonal.toLocaleString("en-US")} |\n` +
    `| **Total encoded PUA graphics** | **${p.encodedGraphics.toLocaleString("en-US")}** |\n\n` +
    `Printable ASCII remains at \`U+0020..U+007E\` (${p.printableAscii} characters), outside the PUA allocation. Minimum eventual font population with printable ASCII is **${p.minimumPhysicalGlyphs.toLocaleString("en-US")} glyphs**.\n\n` +
    `## Generic connector language\n\n` +
    `The encoded connector extension contains **${p.connectorOwners.toLocaleString("en-US")} novel visual owners** resolving **${p.connectorSemanticAliases.toLocaleString("en-US")} deterministic connector semantics**. Exact bitmap reuse is global, so semantic aliases may resolve to pre-existing graphics without consuming another codepoint.\n\n` +
    `## Address space\n\n` +
    `- Encoded: \`${a.unicodeStart}..${a.unicodeEnd}\`\n` +
    `- Connector block: \`${a.connectorStart}..${a.connectorEnd}\` — **${p.connectorOwners} owners**\n` +
    `- Final protected reserve: \`${a.reserveStart}..${a.reserveEnd}\` — **${a.reserveSlots} slots**\n` +
    `- Published straight block: \`${a.straightStart}..${a.straightEnd}\` — unchanged\n\n` +
    `## Semantic population\n\n` +
    `- graphics-v0 semantic aliases: **${p.baseSemanticAliases.toLocaleString("en-US")}**\n` +
    `- connector semantic aliases: **${p.connectorSemanticAliases.toLocaleString("en-US")}**\n` +
    `- combined addressable semantic aliases: **${p.semanticAliases.toLocaleString("en-US")}**\n` +
    `- inherited renderer-only semantic aliases: **${p.rendererOnly.semanticAliases.toLocaleString("en-US")}**\n\n` +
    `## Canonical publication artifacts\n\n` +
    `- v1 registry: \`${p.artifacts.registry}\`\n` +
    `- v1 registry stats: \`${p.artifacts.registryStats}\`\n` +
    `- v1 connector semantics: \`${p.artifacts.connectorSemantics}\`\n` +
    `- connector alias index: \`${p.artifacts.connectorAliasIndex}\`\n` +
    `- connector glyph artifacts: \`${p.artifacts.connectorGlyphDirectory}\`\n` +
    `- connector atlas index: \`${p.artifacts.connectorAtlasIndex}\`\n` +
    `- v1 layout map: \`${p.artifacts.masterLayoutMap}\`\n` +
    `- allocation spec: \`${p.artifacts.allocationSpec}\`\n\n` +
    `## Reproducibility\n\n` +
    `Verified Milestone 5C source baseline: \`${p.sourceCommit}\`.\n\n` +
    `Generation: \`${p.generator}\`\n\n` +
    `Verification: \`${p.verification}\`\n\n` +
    `The manifest freezes SHA-256 digests for the v1 registry, stats, semantics, connector alias index, connector atlas index, v1 layout map, allocation spec, inherited renderer-only index, and base graphics-v0 publication.\n`;
}

async function loadState(repoRoot) {
  const v1Root = path.join(repoRoot, "artifacts", "manifest", "vocabulary-v1");
  const vocabularyRoot = path.join(repoRoot, "artifacts", "vocabulary");
  const connectorGlyphRoot = path.join(vocabularyRoot, "connectors", "glyphs");
  const connectorAtlasRoot = path.join(vocabularyRoot, "atlases", "connectors");

  const paths = {
    registry: path.join(v1Root, "registry.json"),
    stats: path.join(v1Root, "stats.json"),
    semantics: path.join(v1Root, "semantics.json"),
    connectorAlias: path.join(v1Root, "indexes", "by-connector-alias.json"),
    connectorAtlas: path.join(connectorAtlasRoot, "index.json"),
    masterLayout: path.join(vocabularyRoot, "atlases", "master-layout-map-v1.md"),
    allocationSpec: path.join(repoRoot, "spec", "generic-connector-allocation-v1.json"),
    rendererOnly: path.join(vocabularyRoot, "renderer-only", "index.json"),
    basePublication: path.join(repoRoot, "artifacts", "publications", `${BASE_PUBLICATION}.json`),
  };

  const [registry, stats, semantics, connectorAlias, connectorAtlas, rendererOnly, basePublication] = await Promise.all([
    readJson(paths.registry),
    readJson(paths.stats),
    readJson(paths.semantics),
    readJson(paths.connectorAlias),
    readJson(paths.connectorAtlas),
    readJson(paths.rendererOnly),
    readJson(paths.basePublication),
  ]);

  if (registry?.schema !== "graphscii-graphics-vocabulary-v1" || registry?.status !== "provisional-graphics-v1") {
    throw new Error("Milestone 5E requires the provisional GraphSCII graphics-v1 registry.");
  }
  if (!Array.isArray(registry.owners) || registry.owners.length !== EXPECTED_TOTAL_OWNERS) {
    throw new Error(`Milestone 5E requires ${EXPECTED_TOTAL_OWNERS} encoded v1 owners.`);
  }
  if (
    stats.baseOwners !== EXPECTED_BASE_OWNERS ||
    stats.orthogonalNovelOwners !== EXPECTED_ORTHOGONAL_OWNERS ||
    stats.diagonalNovelOwners !== EXPECTED_DIAGONAL_OWNERS ||
    stats.connectorOwners !== EXPECTED_CONNECTOR_OWNERS ||
    stats.totalOwners !== EXPECTED_TOTAL_OWNERS ||
    stats.connectorSemanticAliases !== EXPECTED_CONNECTOR_SEMANTICS ||
    stats.connectorStart !== "U+00F6A4" ||
    stats.connectorEnd !== "U+00F8FC" ||
    stats.reserveStart !== "U+00F8FD" ||
    stats.reserveEnd !== "U+00F8FF" ||
    stats.reserveSlots !== EXPECTED_RESERVE ||
    !stats.straightCodepointsUnchanged
  ) {
    throw new Error("Milestone 5E v1 allocation fixture mismatch.");
  }
  if (
  semantics?.schema !== "graphscii-generic-connector-semantics-v1" ||
  semantics?.semanticCount !== EXPECTED_CONNECTOR_SEMANTICS ||
  !Array.isArray(semantics.semantics) ||
  semantics.semantics.length !== EXPECTED_CONNECTOR_SEMANTICS
) {
  throw new Error(`Milestone 5E requires ${EXPECTED_CONNECTOR_SEMANTICS} connector semantics.`);
}
  if (connectorAlias.entryCount !== EXPECTED_CONNECTOR_SEMANTICS) {
    throw new Error("Milestone 5E connector alias index cardinality mismatch.");
  }
  if (connectorAtlas.ownerCount !== EXPECTED_CONNECTOR_OWNERS || connectorAtlas.pageCount !== EXPECTED_CONNECTOR_ATLAS_PAGES) {
    throw new Error("Milestone 5E connector atlas fixture mismatch.");
  }
  if (basePublication.publication !== BASE_PUBLICATION || basePublication.encodedGraphics !== EXPECTED_BASE_OWNERS) {
    throw new Error("Milestone 5E base graphics-v0 publication mismatch.");
  }
  if (
    rendererOnly.summary.semanticAliases !== EXPECTED_RENDERER_ONLY ||
    rendererOnly.summary.exactEncodedReuses !== EXPECTED_RENDERER_EXACT ||
    rendererOnly.summary.derivedAliases !== EXPECTED_RENDERER_DERIVED ||
    rendererOnly.summary.uniqueDerivedBitmaps !== EXPECTED_RENDERER_UNIQUE_DERIVED
  ) {
    throw new Error("Milestone 5E inherited renderer-only fixture mismatch.");
  }

  const baseOwners = registry.owners.slice(0, EXPECTED_BASE_OWNERS);
  const connectorOwners = registry.owners.slice(EXPECTED_BASE_OWNERS);
  for (let index = 0; index < EXPECTED_BASE_OWNERS; index += 1) {
    const owner = baseOwners[index];
    if (!owner || owner.glyphId !== index || owner.codepointValue !== 0xe000 + index) {
      throw new Error(`Milestone 5E base owner stability failure at glyph ${index}.`);
    }
  }
  for (let index = 0; index < connectorOwners.length; index += 1) {
    const owner = connectorOwners[index];
    if (!owner || owner.glyphId !== EXPECTED_BASE_OWNERS + index || owner.codepointValue !== 0xf6a4 + index) {
      throw new Error(`Milestone 5E connector allocation order failure at offset ${index}.`);
    }
  }

  const canonicalCounts = {
    straight: baseOwners.filter((owner) => owner.canonicalClass === "straight").length,
    solid100: baseOwners.filter((owner) => owner.canonicalClass === "solid-100").length,
    medium75: baseOwners.filter((owner) => owner.canonicalClass === "medium-75").length,
    light25: baseOwners.filter((owner) => owner.canonicalClass === "light-25").length,
    half50: baseOwners.filter((owner) => owner.canonicalClass === "half-50").length,
    connectorOrthogonal: connectorOwners.filter((owner) => owner.canonicalClass === "connector-orthogonal").length,
    connectorDiagonal: connectorOwners.filter((owner) => owner.canonicalClass === "connector-diagonal").length,
  };
  if (
    canonicalCounts.straight !== 746 ||
    canonicalCounts.solid100 !== 1259 ||
    canonicalCounts.medium75 !== 1269 ||
    canonicalCounts.light25 !== 1315 ||
    canonicalCounts.half50 !== 1207 ||
    canonicalCounts.connectorOrthogonal !== EXPECTED_ORTHOGONAL_OWNERS ||
    canonicalCounts.connectorDiagonal !== EXPECTED_DIAGONAL_OWNERS
  ) {
    throw new Error("Milestone 5E canonical class count mismatch.");
  }

  const [baseAscii, basePng, connectorAscii, connectorPng] = await Promise.all([
    countFiles(path.join(vocabularyRoot, "glyphs", "ascii"), /^U\+[0-9A-F]{6}\.txt$/u),
    countFiles(path.join(vocabularyRoot, "glyphs", "png"), /^U\+[0-9A-F]{6}\.png$/u),
    countFiles(path.join(connectorGlyphRoot, "ascii"), /^U\+[0-9A-F]{6}\.txt$/u),
    countFiles(path.join(connectorGlyphRoot, "png"), /^U\+[0-9A-F]{6}\.png$/u),
  ]);
  if (baseAscii !== EXPECTED_BASE_OWNERS || basePng !== EXPECTED_BASE_OWNERS || connectorAscii !== EXPECTED_CONNECTOR_OWNERS || connectorPng !== EXPECTED_CONNECTOR_OWNERS) {
    throw new Error("Milestone 5E canonical glyph artifact count mismatch.");
  }

  const digests = {
    registrySha256: await sha256File(paths.registry),
    registryStatsSha256: await sha256File(paths.stats),
    connectorSemanticsSha256: await sha256File(paths.semantics),
    connectorAliasIndexSha256: await sha256File(paths.connectorAlias),
    connectorAtlasIndexSha256: await sha256File(paths.connectorAtlas),
    masterLayoutMapV1Sha256: await sha256File(paths.masterLayout),
    allocationSpecSha256: await sha256File(paths.allocationSpec),
    rendererOnlyIndexSha256: await sha256File(paths.rendererOnly),
    basePublicationSha256: await sha256File(paths.basePublication),
  };

  return {
    stats,
    canonicalCounts,
    rendererOnly,
    artifactCounts: { baseAscii, basePng, connectorAscii, connectorPng },
    digests,
  };
}

export async function buildGraphicsPublicationV1(repoRoot) {
  const state = await loadState(repoRoot);
  const publication = {
    schema: "graphscii-publication",
    schemaVersion: 3,
    publication: PUBLICATION,
    status: "provisional",
    basePublication: BASE_PUBLICATION,
    sourceCommit: SOURCE_COMMIT,
    sourceCommitRole: "verified Milestone 5C generated allocation baseline",
    generator: "cd geometric-glyph-lab && npm run generate",
    verification: "cd geometric-glyph-lab && npm run verify",
    canonicalCell: "8x16",
    bitmapSerialization: "v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex",
    encodedGraphics: EXPECTED_TOTAL_OWNERS,
    printableAscii: EXPECTED_PRINTABLE_ASCII,
    minimumPhysicalGlyphs: EXPECTED_TOTAL_OWNERS + EXPECTED_PRINTABLE_ASCII,
    baseSemanticAliases: EXPECTED_BASE_SEMANTICS,
    connectorSemanticAliases: EXPECTED_CONNECTOR_SEMANTICS,
    semanticAliases: EXPECTED_TOTAL_SEMANTICS,
    connectorOwners: EXPECTED_CONNECTOR_OWNERS,
    canonicalClasses: state.canonicalCounts,
    allocation: {
      unicodeStart: "U+00E000",
      unicodeEnd: "U+00F8FC",
      straightStart: "U+00E000",
      straightEnd: "U+00E2E9",
      connectorStart: "U+00F6A4",
      connectorEnd: "U+00F8FC",
      reserveStart: "U+00F8FD",
      reserveEnd: "U+00F8FF",
      reserveSlots: EXPECTED_RESERVE,
    },
    rendererOnly: {
      semanticAliases: state.rendererOnly.summary.semanticAliases,
      exactEncodedReuses: state.rendererOnly.summary.exactEncodedReuses,
      derivedAliases: state.rendererOnly.summary.derivedAliases,
      uniqueDerivedBitmaps: state.rendererOnly.summary.uniqueDerivedBitmaps,
      encodedCodepointsConsumed: state.rendererOnly.summary.encodedCodepointsConsumed,
    },
    artifactCounts: {
      baseAsciiGlyphs: state.artifactCounts.baseAscii,
      basePngGlyphs: state.artifactCounts.basePng,
      connectorAsciiGlyphs: state.artifactCounts.connectorAscii,
      connectorPngGlyphs: state.artifactCounts.connectorPng,
      totalAsciiGlyphs: state.artifactCounts.baseAscii + state.artifactCounts.connectorAscii,
      totalPngGlyphs: state.artifactCounts.basePng + state.artifactCounts.connectorPng,
      connectorAtlasPages: EXPECTED_CONNECTOR_ATLAS_PAGES,
    },
    artifacts: {
      registry: "artifacts/manifest/vocabulary-v1/registry.json",
      registryStats: "artifacts/manifest/vocabulary-v1/stats.json",
      connectorSemantics: "artifacts/manifest/vocabulary-v1/semantics.json",
      connectorAliasIndex: "artifacts/manifest/vocabulary-v1/indexes/by-connector-alias.json",
      connectorGlyphDirectory: "artifacts/vocabulary/connectors/glyphs/",
      connectorAtlasIndex: "artifacts/vocabulary/atlases/connectors/index.json",
      masterLayoutMap: "artifacts/vocabulary/atlases/master-layout-map-v1.md",
      allocationSpec: "spec/generic-connector-allocation-v1.json",
      inheritedRendererOnlyIndex: "artifacts/vocabulary/renderer-only/index.json",
      basePublication: `artifacts/publications/${BASE_PUBLICATION}.json`,
    },
    digests: state.digests,
  };
  return {
    publication,
    json: jsonText(publication),
    markdown: publicationMarkdown(publication),
  };
}

export async function generateGraphicsPublicationV1(repoRoot) {
  const outputRoot = path.join(repoRoot, "artifacts", "publications");
  await mkdir(outputRoot, { recursive: true });
  const built = await buildGraphicsPublicationV1(repoRoot);
  await Promise.all([
    writeFile(path.join(outputRoot, `${PUBLICATION}.json`), built.json),
    writeFile(path.join(outputRoot, `${PUBLICATION}.md`), built.markdown),
  ]);
  return {
    publication: PUBLICATION,
    encodedGraphics: built.publication.encodedGraphics,
    connectorOwners: built.publication.connectorOwners,
    connectorSemanticAliases: built.publication.connectorSemanticAliases,
    reserveSlots: built.publication.allocation.reserveSlots,
    outputFiles: 2,
  };
}

export async function verifyGraphicsPublicationV1(repoRoot) {
  const outputRoot = path.join(repoRoot, "artifacts", "publications");
  const built = await buildGraphicsPublicationV1(repoRoot);
  const [actualJson, actualMarkdown] = await Promise.all([
    readFile(path.join(outputRoot, `${PUBLICATION}.json`), "utf8"),
    readFile(path.join(outputRoot, `${PUBLICATION}.md`), "utf8"),
  ]);
  if (actualJson !== built.json) throw new Error(`${PUBLICATION}.json is not deterministic.`);
  if (actualMarkdown !== built.markdown) throw new Error(`${PUBLICATION}.md is not deterministic.`);
  const p = built.publication;
  if (
    p.encodedGraphics !== EXPECTED_TOTAL_OWNERS ||
    p.minimumPhysicalGlyphs !== 6492 ||
    p.connectorOwners !== EXPECTED_CONNECTOR_OWNERS ||
    p.connectorSemanticAliases !== EXPECTED_CONNECTOR_SEMANTICS ||
    p.semanticAliases !== EXPECTED_TOTAL_SEMANTICS ||
    p.allocation.unicodeEnd !== "U+00F8FC" ||
    p.allocation.reserveSlots !== EXPECTED_RESERVE ||
    p.artifactCounts.totalAsciiGlyphs !== EXPECTED_TOTAL_OWNERS ||
    p.artifactCounts.totalPngGlyphs !== EXPECTED_TOTAL_OWNERS ||
    p.rendererOnly.semanticAliases !== EXPECTED_RENDERER_ONLY
  ) {
    throw new Error("GraphSCII graphics-v1 publication fixture mismatch.");
  }
  return {
    publication: PUBLICATION,
    encodedGraphics: p.encodedGraphics,
    semanticAliases: p.semanticAliases,
    connectorOwners: p.connectorOwners,
    reserveSlots: p.allocation.reserveSlots,
    digests: p.digests,
    outputFiles: 2,
  };
}
