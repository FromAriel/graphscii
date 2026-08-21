# Milestone 4D.2 — Canonical Per-Glyph ASCII and PNG Artifacts

Status: **COMPLETE**

Milestone 4D.2 materializes every encoded owner from the Milestone 4D.1 canonical vocabulary registry into deterministic per-glyph source artifacts.

The artifact generator does not independently regenerate geometry or choose glyph ownership. Its sole visual input is:

```text
artifacts/manifest/vocabulary/registry.json
```

Each owner's canonical 32-hex-digit `bitmapKey` is decoded into the frozen 8×16 bitmap, and that bitmap is then emitted in two forms.

## Frozen output population

```text
encoded owners       5,796
ASCII artifacts      5,796
PNG artifacts        5,796
combined files      11,592

first codepoint     U+E000
last codepoint      U+F6A3
reserve begins      U+F6A4
```

The 604-slot reserve remains untouched.

## Output tree

```text
artifacts/vocabulary/glyphs/
├── ascii/
│   ├── U+00E000.txt
│   ├── ...
│   └── U+00F6A3.txt
└── png/
    ├── U+00E000.png
    ├── ...
    └── U+00F6A3.png
```

Filenames are derived directly from the owner's canonical Unicode codepoint and therefore sort into the encoded vocabulary range.

## ASCII contract

Every ASCII file contains exactly 16 rows of exactly 8 characters plus a final newline.

```text
# = ON pixel
- = OFF pixel
```

Bit order remains the frozen GraphSCII rule:

```text
x=0 is bit 0 / least-significant bit
rows are y=0..15 top to bottom
```

## PNG contract

Every PNG is exactly:

```text
8 × 16 pixels
RGBA
black opaque pixels for ON cells
transparent pixels for OFF cells
no scaling
no anti-aliasing
```

PNG bytes are produced by the same deterministic PNG encoder already used by the straight artifact pipeline. They are generated directly from the canonical bitmap rather than by browser rendering, screenshots, or font rasterization.

## Deterministic generator

Implementation:

```text
geometric-glyph-lab/scripts/vocabulary-artifacts.mjs
```

Commands:

```powershell
npm run generate:vocabulary-artifacts
npm run verify:vocabulary-artifacts
```

Both are now included in the normal:

```powershell
npm run generate
npm run verify
```

The generator clears only:

```text
artifacts/vocabulary/glyphs/
```

before regeneration, preventing stale glyph files from surviving changes while leaving registries and unrelated research artifacts untouched.

I/O is bounded rather than launching all 11,592 writes simultaneously, so the generator remains stable on ordinary filesystems and CI runners.

## Verification gates

The verifier independently reads the canonical vocabulary registry and requires:

```text
registry owners                    5,796
ASCII filenames                    exactly 5,796 expected names
PNG filenames                      exactly 5,796 expected names
ASCII content                      byte-for-byte deterministic
PNG content                        byte-for-byte deterministic
first artifact                     U+00E000
last artifact                      U+00F6A3
files inside reserve               0
```

For every owner, verification reconstructs the expected ASCII and PNG from that owner's registry bitmap key and compares the committed file against it.

This means a file with the correct name but incorrect pixels fails the gate, as does a correct artifact under the wrong codepoint filename.

## CI result

The Milestone 4D.2 feature-branch verification ran:

```text
npm install
npm run check
npm run generate
npm run verify
```

Only after the complete verification chain passed did CI commit the generated `artifacts/vocabulary/glyphs/` tree.

Generated artifact commit:

```text
a9cf1182b9daf8813327f48dc75b4206247426bc
```

Spot checks confirm both ends of the vocabulary are physically present:

```text
artifacts/vocabulary/glyphs/ascii/U+00E000.txt
artifacts/vocabulary/glyphs/png/U+00E000.png
artifacts/vocabulary/glyphs/ascii/U+00F6A3.txt
artifacts/vocabulary/glyphs/png/U+00F6A3.png
```

## What 4D.2 deliberately does not do

4D.2 does not yet create categorized or combined atlases. It creates the canonical per-owner material from which those atlases must be assembled.

It also does not build a TTF/OTF. The font compiler remains downstream of the canonical bitmap vocabulary.

## Next

**Milestone 4D.3 — categorized visual/text atlases.**

4D.3 should use the 5,796 canonical per-glyph artifacts and registry metadata to generate category-separated pages for straight, solid, medium 75%, half 50%, and light 25%, plus renderer-only reference and reserve-layout views. The later 4D.4 master text atlas will combine those categories into the complete human-readable publication reference.
