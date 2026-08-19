import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const STRAIGHT_CATALOG_SCHEMA_VERSION = 1;

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function relativeArtifactLink(artifactPath) {
  return `../${artifactPath.replaceAll("\\\\", "/")}`;
}

function aliasLine(alias) {
  return `- \`${alias.aliasKey}\` — \`${alias.start} → ${alias.end}\` · family \`${alias.family}\` · candidate \`${alias.candidateId}\``;
}

function glyphHeading(glyph) {
  return `## ${glyph.codepointHex} — Glyph ${glyph.glyphIdHex}`;
}

async function renderGlyph(root, glyph) {
  const asciiPath = path.join(root, glyph.artifacts.ascii);
  const ascii = (await readFile(asciiPath, "utf8")).replace(/\r\n/g, "\n").replace(/\n$/, "");
  const families = glyph.families.map((family) => `\`${family}\``).join(", ");
  const aliases = glyph.aliases.map(aliasLine).join("\n");
  const asciiLink = relativeArtifactLink(glyph.artifacts.ascii);
  const pngLink = relativeArtifactLink(glyph.artifacts.png);

  return [
    glyphHeading(glyph),
    "",
    `- **Codepoint:** \`${glyph.codepointHex}\``,
    `- **Glyph ID:** \`${glyph.glyphId}\` (\`0x${glyph.glyphIdHex}\`)`,
    `- **Allocation:** \`${glyph.allocation?.status ?? "provisional"}\` straight-line vocabulary`,
    `- **Families:** ${families}`,
    `- **Bitmap key:** \`${glyph.bitmap.key}\``,
    `- **Alias interpretations:** ${glyph.aliases.length}`,
    `- **Connectivity semantics:** \`${glyph.connectivity.semantics}\``,
    `- **Canonical files:** [ASCII](${asciiLink}) · [PNG](${pngLink})`,
    "",
    "### Geometry aliases",
    "",
    aliases,
    "",
    "### Exact 8×16 ASCII",
    "",
    "```text",
    ascii,
    "```",
    "",
  ].join("\n");
}

export async function renderStraightLinesCatalog(root) {
  const manifest = await readJson(path.join(root, "manifest", "glyphs.json"));

  if (manifest.format !== "graphscii" || manifest.formatVersion !== 1) {
    throw new Error("GraphSCII manifest format mismatch while rendering straight catalog.");
  }
  if (manifest.manifestSchemaVersion !== 2) {
    throw new Error("Straight catalog requires semantic manifest schema version 2.");
  }
  if (manifest.glyphCount !== 746 || manifest.aliasCount !== 832) {
    throw new Error("Straight catalog regression count mismatch.");
  }
  if (manifest.allocation?.class !== "straight-lines") {
    throw new Error("Straight catalog requires the straight-lines allocation.");
  }

  const header = [
    "# GraphSCII Straight-Line Glyph Catalog",
    "",
    "> Generated artifact. Do not edit by hand. Regenerate from `geometric-glyph-lab/` with `npm run generate`.",
    "",
    "This catalog publishes the complete current straight-line vocabulary as human-readable Markdown while preserving the machine semantics from `artifacts/manifest/glyphs.json`.",
    "",
    "## Catalog summary",
    "",
    `- **Catalog schema:** ${STRAIGHT_CATALOG_SCHEMA_VERSION}`,
    `- **GraphSCII format:** ${manifest.formatVersion}`,
    `- **Manifest schema:** ${manifest.manifestSchemaVersion}`,
    `- **Canonical cell:** ${manifest.cell.width}×${manifest.cell.height}`,
    `- **Visual glyphs:** ${manifest.glyphCount}`,
    `- **Mathematical aliases:** ${manifest.aliasCount}`,
    `- **Candidate definitions:** ${manifest.candidateCount}`,
    `- **Duplicate candidates:** ${manifest.duplicateCandidateCount}`,
    `- **Allocation:** \`${manifest.allocation.unicodeStart}\` … \`${manifest.allocation.unicodeEnd}\` (\`${manifest.allocation.status}\`)`,
    "- **Connectivity:** aliases are alternative two-port interpretations, never simultaneous branches",
    "",
    "Each entry below contains the exact canonical 8×16 ASCII bitmap. The linked PNG is the same bitmap rendered as native 8×16 RGBA pixels.",
    "",
    "---",
    "",
  ].join("\n");

  const entries = [];
  for (const glyph of manifest.glyphs) {
    entries.push(await renderGlyph(root, glyph));
  }

  return `${header}${entries.join("\n---\n\n")}`;
}

export async function buildStraightLinesCatalog(root) {
  const classRoot = path.join(root, "classes");
  const catalogPath = path.join(classRoot, "straight-lines.md");
  await mkdir(classRoot, { recursive: true });
  const content = await renderStraightLinesCatalog(root);
  await writeFile(catalogPath, content, "utf8");
  const bytes = Buffer.byteLength(content, "utf8");
  const statsPath = path.join(root, "manifest", "stats.json");
  const stats = await readJson(statsPath);
  stats.catalogs = {
    ...(stats.catalogs ?? {}),
    straightLines: {
      catalogSchemaVersion: STRAIGHT_CATALOG_SCHEMA_VERSION,
      glyphCount: 746,
      aliasCount: 832,
      bytes,
      path: "classes/straight-lines.md",
    },
  };
  await writeFile(statsPath, `${JSON.stringify(stats, null, 2)}\n`, "utf8");
  return {
    catalogPath,
    bytes,
  };
}

export async function verifyStraightLinesCatalog(root) {
  const catalogPath = path.join(root, "classes", "straight-lines.md");
  const actual = (await readFile(catalogPath, "utf8")).replace(/\r\n/g, "\n");
  const expected = await renderStraightLinesCatalog(root);
  if (actual !== expected) {
    throw new Error("straight-lines.md is stale or does not match the generated semantic registry.");
  }

  const manifest = await readJson(path.join(root, "manifest", "glyphs.json"));
  const headings = actual.match(/^## U\+[0-9A-F]{6} — Glyph [0-9A-F]{3}$/gm) ?? [];
  if (headings.length !== manifest.glyphCount) {
    throw new Error(`Expected ${manifest.glyphCount} glyph headings, found ${headings.length}.`);
  }

  let aliasLines = 0;
  for (const glyph of manifest.glyphs) {
    const heading = glyphHeading(glyph);
    if (!actual.includes(heading)) {
      throw new Error(`Catalog missing ${heading}.`);
    }
    for (const alias of glyph.aliases) {
      if (!actual.includes(`\`${alias.aliasKey}\``)) {
        throw new Error(`Catalog missing alias ${alias.aliasKey}.`);
      }
      aliasLines += 1;
    }
  }
  if (aliasLines !== 832) {
    throw new Error(`Expected 832 catalog alias records, got ${aliasLines}.`);
  }

  const stats = await readJson(path.join(root, "manifest", "stats.json"));
  const catalogStats = stats.catalogs?.straightLines;
  if (
    catalogStats?.catalogSchemaVersion !== STRAIGHT_CATALOG_SCHEMA_VERSION ||
    catalogStats?.glyphCount !== 746 ||
    catalogStats?.aliasCount !== 832 ||
    catalogStats?.bytes !== Buffer.byteLength(actual, "utf8") ||
    catalogStats?.path !== "classes/straight-lines.md"
  ) {
    throw new Error("Straight catalog statistics mismatch.");
  }

  return {
    glyphs: headings.length,
    aliases: aliasLines,
    bytes: Buffer.byteLength(actual, "utf8"),
    path: catalogPath,
  };
}
