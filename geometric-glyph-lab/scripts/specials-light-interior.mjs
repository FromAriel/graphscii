import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Frozen inputs and outputs for the specials-light-interior publication.
const V1_MANIFEST_DIR = path.join("artifacts", "manifest", "vocabulary-v1");
const V11_MANIFEST_DIR = path.join("artifacts", "manifest", "vocabulary-v1.1");
const V1_REGISTRY_REL = path.join(V1_MANIFEST_DIR, "registry.json");
const EXPECTED_V1_OWNERS = 6397;
const SPECIAL_GLYPH_ID = 6397;
const SPECIAL_BITMAP_KEY = "55005500550055005500550055005500";
const SPECIAL_CODEPOINT_VALUE = 0xf8fd;
const SPECIAL_ALIAS = "tone-interior:light";

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function buildSpecialsLightInteriorDocuments(repoRoot) {
  const registryBytes = await readFile(path.join(repoRoot, V1_REGISTRY_REL));
  const baseSha = sha256(registryBytes);
  const registry = JSON.parse(registryBytes.toString("utf8"));

  const doc = registry.registry ?? registry;
  const owners = doc.owners;
  if (!Array.isArray(owners) || owners.length !== EXPECTED_V1_OWNERS) {
    throw new Error(`Expected ${EXPECTED_V1_OWNERS} frozen v1 owners.`);
  }
  const lastOwner = owners[owners.length - 1];
  if (lastOwner.glyphId !== EXPECTED_V1_OWNERS - 1 || lastOwner.codepointValue !== 0xf8fc) {
    throw new Error("Frozen v1 registry does not end at glyphId 6396 / U+F8FC.");
  }
  const byBitmapV1 = JSON.parse(
    (await readFile(path.join(repoRoot, V1_MANIFEST_DIR, "indexes", "by-bitmap.json"))).toString("utf8"),
  );
  if (byBitmapV1.entries[SPECIAL_BITMAP_KEY] != null) {
    throw new Error("Light interior bitmap already published; diversion unnecessary.");
  }

  const specialOwner = {
    glyphId: SPECIAL_GLYPH_ID,
    codepoint: "U+00F8FD",
    codepointValue: SPECIAL_CODEPOINT_VALUE,
    bitmapKey: SPECIAL_BITMAP_KEY,
    canonicalClass: "light-25",
    allocationStatus: "published-special-interior",
    firstSemanticAlias: SPECIAL_ALIAS,
    semanticAliases: [SPECIAL_ALIAS],
  };

  const registryV11 = cloneJson(doc);
  registryV11.owners = [...owners, specialOwner];
  registryV11.status = "provisional-graphics-v1.1";
  registryV11.allocation = {
    ...registryV11.allocation,
    unicodeEnd: "U+00F8FD",
    specialStart: "U+00F8FD",
    specialEnd: "U+00F8FD",
    reserveStart: "U+00F8FE",
    reserveSlots: 2,
    rule:
      registryV11.allocation.rule +
      "; plus one reserved-slot special: tone-interior light full-cell dither owner (docs/specials-light-interior-plan.md)",
  };

  const rebuildIndex = (v1IndexDoc, entries) => ({
    ...cloneJson(v1IndexDoc),
    entryCount: Object.keys(entries).length,
    entries,
  });

  const byBitmapEntries = {};
  const byCodepointEntries = {};
  for (const owner of registryV11.owners) {
    byBitmapEntries[owner.bitmapKey] = owner.glyphId;
    byCodepointEntries[owner.codepoint] = owner.glyphId;
  }
  if (
    Object.keys(byBitmapEntries).length !== EXPECTED_V1_OWNERS + 1 ||
    Object.keys(byCodepointEntries).length !== EXPECTED_V1_OWNERS + 1
  ) {
    throw new Error("v1.1 index cardinality regression.");
  }

  const connectorAliasRaw = await readFile(
    path.join(repoRoot, V1_MANIFEST_DIR, "indexes", "by-connector-alias.json"),
  );

  const documents = {
    [path.join(V11_MANIFEST_DIR, "registry.json")]: jsonText(registryV11),
    [path.join(V11_MANIFEST_DIR, "indexes", "by-bitmap.json")]: jsonText(
      rebuildIndex(byBitmapV1, byBitmapEntries),
    ),
    [path.join(V11_MANIFEST_DIR, "indexes", "by-codepoint.json")]: jsonText(
      rebuildIndex(
        JSON.parse(
          (await readFile(path.join(repoRoot, V1_MANIFEST_DIR, "indexes", "by-codepoint.json"))).toString(
            "utf8",
          ),
        ),
        byCodepointEntries,
      ),
    ),
    [path.join(V11_MANIFEST_DIR, "indexes", "by-connector-alias.json")]: connectorAliasRaw,
    [path.join("artifacts", "publications", "graphscii-graphics-v1.1.json")]: jsonText({
      format: "graphscii",
      schema: "graphscii-graphics-publication",
      version: "v1.1",
      basePublication: {
        name: "graphscii-graphics-v1",
        registrySha256: baseSha,
      },
      specials: [
        {
          glyphId: SPECIAL_GLYPH_ID,
          codepoint: "U+F8FD",
          bitmapKey: SPECIAL_BITMAP_KEY,
          semanticAlias: SPECIAL_ALIAS,
          justificationDoc: "docs/specials-light-interior-plan.md",
        },
      ],
      encodedOwners: EXPECTED_V1_OWNERS + 1,
      reserveSlots: 2,
    }),
  };

  // Publication file pins are computed over everything except itself.
  const publicationName = path.join("artifacts", "publications", "graphscii-graphics-v1.1.json");
  const pins = {};
  for (const [name, content] of Object.entries(documents)) {
    if (name === publicationName) continue;
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    pins[name.split("\\").join("/")] = sha256(buffer);
  }
  const publication = JSON.parse(documents[publicationName].toString("utf8"));
  publication.files = pins;
  documents[publicationName] = jsonText(publication);

  return { documents, stats: buildStats(registryV11, publication) };
}

function buildStats(registryV11, publication) {
  const owners = registryV11.owners;
  const classCounts = {};
  for (const owner of owners) {
    classCounts[owner.canonicalClass] = (classCounts[owner.canonicalClass] ?? 0) + 1;
  }
  return {
    encodedOwners: owners.length,
    lastAllocatedCodepoint: registryV11.allocation.unicodeEnd,
    reserveSlots: registryV11.allocation.reserveSlots,
    reserveStart: registryV11.allocation.reserveStart,
    classCounts,
    special: publication.specials[0],
  };
}

export async function generateSpecialsLightInteriorArtifacts(repoRoot) {
  const built = await buildSpecialsLightInteriorDocuments(repoRoot);
  for (const [relativeName, content] of Object.entries(built.documents)) {
    const absolute = path.join(repoRoot, relativeName);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  }
  return built.stats;
}

export async function verifySpecialsLightInteriorArtifacts(repoRoot) {
  const built = await buildSpecialsLightInteriorDocuments(repoRoot);
  for (const [relativeName, content] of Object.entries(built.documents)) {
    const actual = await readFile(path.join(repoRoot, relativeName));
    const expected = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    if (!actual.equals(expected)) {
      throw new Error(`Specials-light-interior artifact mismatch: ${relativeName}`);
    }
  }

  // Prove the frozen base was not disturbed since generation.
  const publicationPath = path.join(repoRoot, "artifacts", "publications", "graphscii-graphics-v1.1.json");
  const publication = JSON.parse((await readFile(publicationPath)).toString("utf8"));
  const currentBaseHash = sha256(await readFile(path.join(repoRoot, V1_REGISTRY_REL)));
  if (publication.basePublication.registrySha256 !== currentBaseHash) {
    throw new Error("Frozen graphics-v1 registry changed after v1.1 generation.");
  }

  return built.stats;
}
