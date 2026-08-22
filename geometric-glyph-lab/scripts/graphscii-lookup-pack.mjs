import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PACK_SCHEMA_VERSION = 1;
const EXPECTED_STRAIGHT_PAIRS = 1664;
const EXPECTED_BOUNDARY_SIDE_STYLES = 6592;

// Frozen graphics-v1 allocation classes (glyph ID ranges).
const CLASS_RANGES = {
  solid: [746, 2004],
  medium: [2005, 3273],
  light: [3274, 4588],
  half: [4589, 5795],
};

const ENCODED_TONES = ["solid", "medium", "light", "half"];

// Full-cell dither masks per §5.4 of GRAPHSCII_PLAN.md. Bit x of row byte y
// is pixel (x, y); "#" is set, "-" unset. Masks are 8 rows doubled to 16.
const INTERIOR_MASK_KEYS = {
  solid: "ff".repeat(16),
  medium: "55ff".repeat(8),
  light: "5500".repeat(8),
  half: "55aa".repeat(8),
};

function jsonText(value) {
  // Deterministic serialization: keys are inserted in sorted order by the
  // builders, so no replacer is needed — but sort defensively anyway.
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sortedKeysFirst(value) {
  if (Array.isArray(value)) return value.map(sortedKeysFirst);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortedKeysFirst(value[key]);
    }
    return out;
  }
  return value;
}

function stableJson(value) {
  return `${JSON.stringify(sortedKeysFirst(value), null, 2)}\n`;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readJsonBytes(filename) {
  const buffer = await readFile(filename);
  return { buffer, json: JSON.parse(buffer.toString("utf8")) };
}

function parseFillAlias(alias) {
  const match =
    /^straight-fill:(LR|TB|LT|LB|RT|RB):([LRTB]\d{1,2})>([LRTB]\d{1,2}):side([AB]):([a-z]+)$/.exec(
      alias,
    );
  if (!match) return null;
  return {
    family: match[1],
    startPort: match[2],
    endPort: match[3],
    side: match[4],
    tone: match[5],
  };
}

function parseStraightAlias(alias) {
  const match = /^straight:([LRTB]\d{1,2})>([LRTB]\d{1,2})$/.exec(alias);
  if (!match) return null;
  return { startPort: match[1], endPort: match[2] };
}

function buildStraightPairs(owners) {
  const pairs = {};
  for (const owner of owners) {
    for (const alias of owner.semanticAliases) {
      const parsed = parseStraightAlias(alias);
      if (!parsed) continue;
      const forward = `${parsed.startPort}>${parsed.endPort}`;
      const reverse = `${parsed.endPort}>${parsed.startPort}`;
      pairs[forward] = owner.codepointValue;
      pairs[reverse] = owner.codepointValue;
    }
  }
  const count = Object.keys(pairs).length;
  if (count !== EXPECTED_STRAIGHT_PAIRS) {
    throw new Error(`Expected ${EXPECTED_STRAIGHT_PAIRS} directed straight pairs; got ${count}.`);
  }
  return pairs;
}

function buildBoundarySideStyle(owners) {
  const styles = {};
  for (const owner of owners) {
    for (const alias of owner.semanticAliases) {
      const parsed = parseFillAlias(alias);
      if (!parsed) continue;
      if (!ENCODED_TONES.includes(parsed.tone)) continue;
      const key = `${parsed.family}:${parsed.startPort}>${parsed.endPort}:side${parsed.side}:${parsed.tone}`;
      if (styles[key] != null && styles[key] !== owner.codepointValue) {
        throw new Error(`Conflicting boundary-side-style mapping for ${key}.`);
      }
      styles[key] = owner.codepointValue;
    }
  }
  const count = Object.keys(styles).length;
  if (count !== EXPECTED_BOUNDARY_SIDE_STYLES) {
    throw new Error(`Expected ${EXPECTED_BOUNDARY_SIDE_STYLES} boundary-side-style entries; got ${count}.`);
  }
  return styles;
}

function buildToneInteriors(owners, byBitmapEntries) {
  const classOwnersByRange = new Map();
  for (const tone of ENCODED_TONES) classOwnersByRange.set(tone, []);
  for (const owner of owners) {
    for (const tone of ENCODED_TONES) {
      const [low, high] = CLASS_RANGES[tone];
      if (owner.glyphId >= low && owner.glyphId <= high) {
        classOwnersByRange.get(tone).push(owner.bitmapKey);
      }
    }
  }

  const interiors = {};
  const fallbacks = [];
  for (const tone of ENCODED_TONES) {
    const maskKey = INTERIOR_MASK_KEYS[tone];
    let glyphId = byBitmapEntries[maskKey];
    let bitmapKey = maskKey;
    let fallback = false;
    if (glyphId == null) {
      // Plan §5.4 fallback: lexicographically smallest bitmapKey owner of the
      // tone's frozen allocation class. Recorded explicitly in the manifest.
      const candidates = [...classOwnersByRange.get(tone)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      bitmapKey = candidates[0];
      if (!bitmapKey) throw new Error(`No owners found for tone class ${tone}.`);
      glyphId = byBitmapEntries[bitmapKey];
      if (glyphId == null) throw new Error(`Fallback bitmap for ${tone} is not a published owner.`);
      fallback = true;
      fallbacks.push(tone);
    }
    interiors[tone] = {
      codepoint: 0xe000 + glyphId,
      glyphId,
      bitmapKey,
      fallback,
    };
  }
  return { interiors, fallbacks };
}

export async function buildGraphsciilLookupPackDocuments(repoRoot) {
  const manifestDir = path.join(repoRoot, "artifacts", "manifest", "vocabulary-v1");
  const registryPath = path.join(manifestDir, "registry.json");
  const byBitmapPath = path.join(manifestDir, "indexes", "by-bitmap.json");
  const fontPath = path.join(repoRoot, "artifacts", "fonts", "GraphSCII-Regular.ttf");

  const [registry, byBitmap, fontBytes] = await Promise.all([
    readJsonBytes(registryPath),
    readJsonBytes(byBitmapPath),
    readFile(fontPath),
  ]);

  const owners = registry.json.registry?.owners ?? registry.json.owners;
  if (owners?.length !== 6397) {
    throw new Error(`Lookup pack requires the frozen 6397-owner registry; got ${owners?.length}.`);
  }
  if (byBitmap.json.index !== "by-bitmap" || byBitmap.json.entryCount !== 6397) {
    throw new Error("Unexpected by-bitmap index document.");
  }

  const straightPairs = buildStraightPairs(owners);
  const boundarySideStyle = buildBoundarySideStyle(owners);
  const { interiors, fallbacks } = buildToneInteriors(owners, byBitmap.json.entries);

  const documents = {
    "straight_pairs.json": stableJson(straightPairs),
    "boundary_side_style.json": stableJson(boundarySideStyle),
    "tone_interiors.json": stableJson(interiors),
    "GraphSCII-Regular.ttf": fontBytes,
  };

  const files = {};
  for (const name of Object.keys(documents).sort()) {
    files[name] = sha256(documents[name]);
  }

  const manifest = sortedKeysFirst({
    format: "graphscii",
    schema: "graphscii-lookup-pack",
    schemaVersion: PACK_SCHEMA_VERSION,
    sourcePins: {
      "registry.json": sha256(registry.buffer),
      "indexes/by-bitmap.json": sha256(byBitmap.buffer),
    },
    files,
    counts: {
      straightPairs: Object.keys(straightPairs).length,
      boundarySideStyles: Object.keys(boundarySideStyle).length,
      toneInteriors: Object.keys(interiors).length,
    },
    interiorFallbacks: fallbacks.sort(),
  });

  return {
    manifest,
    documents: {
      ...documents,
      "MANIFEST.json": stableJson(manifest),
    },
    stats: {
      schemaVersion: PACK_SCHEMA_VERSION,
      straightPairs: manifest.counts.straightPairs,
      boundarySideStyles: manifest.counts.boundarySideStyles,
      toneInteriors: manifest.counts.toneInteriors,
      interiorFallbacks: fallbacks.sort(),
      toneInteriorsDetail: interiors,
    },
  };
}

export async function generateGraphsciilLookupPackArtifacts(repoRoot, destDir = null) {
  const built = await buildGraphsciilLookupPackDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "graphscii-lookup-pack", "v1");
  await mkdir(outputRoot, { recursive: true });
  const targets = [outputRoot];
  if (destDir) {
    await mkdir(destDir, { recursive: true });
    targets.push(destDir);
  }
  for (const target of targets) {
    for (const [name, content] of Object.entries(built.documents)) {
      await writeFile(path.join(target, name), content);
    }
  }
  return built.stats;
}

export async function verifyGraphsciilLookupPackArtifacts(repoRoot, destDir = null) {
  const built = await buildGraphsciilLookupPackDocuments(repoRoot);
  const outputRoot = path.join(repoRoot, "artifacts", "graphscii-lookup-pack", "v1");

  for (const [name, content] of Object.entries(built.documents)) {
    const actual = await readFile(path.join(outputRoot, name));
    const expected = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    if (!actual.equals(expected)) {
      throw new Error(`Lookup pack artifact does not match deterministic generation: ${name}`);
    }
    // MANIFEST.json cannot pin its own hash; its integrity is guaranteed by
    // the byte-comparison above against deterministic regeneration.
    if (name === "MANIFEST.json") continue;
    const pinnedHash = built.manifest.files[name];
    if (!pinnedHash || sha256(actual) !== pinnedHash) {
      throw new Error(`Manifest hash pin mismatch for ${name}`);
    }
  }

  if (destDir) {
    for (const [name, content] of Object.entries(built.documents)) {
      const mirrored = await readFile(path.join(destDir, name));
      const expected = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
      if (!mirrored.equals(expected)) {
        throw new Error(`Mirrored lookup pack drift detected for ${name} in ${destDir}`);
      }
    }
  }

  return built.stats;
}
