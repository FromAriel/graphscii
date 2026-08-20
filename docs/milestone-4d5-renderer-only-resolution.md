# Milestone 4D.5 — Renderer-Only Resolution Registry

Status: **COMPLETE — GENERATED, FULL-CHAIN VERIFIED, AND BYTE-STABLE**

Milestone 4D.5 promotes the renderer-only semantic population from an internal vocabulary index into explicit publication-facing resolution artifacts.

No new Unicode codepoints are allocated by this slice.

## Persistent outputs

```text
artifacts/vocabulary/renderer-only/
├── dense.json
├── sparse.json
├── demoted-half.json
├── index.json
└── renderer-only-atlas.md
```

Exactly **5 deterministic files** are generated.

## Resolution contract

Renderer-only semantics have exactly two publication-facing outcomes.

### Encoded exact reuse

When the requested renderer-only bitmap already has a canonical encoded owner:

```json
{
  "resolution": "encoded-exact-reuse",
  "glyphId": 123,
  "codepoint": "U+00E07B",
  "bitmapKey": "..."
}
```

The verifier resolves the codepoint back through the 5,796-owner vocabulary and requires exact bitmap identity.

### Renderer-only derived

When no encoded owner has the requested raster:

```json
{
  "resolution": "renderer-only-derived",
  "glyphId": null,
  "codepoint": null,
  "bitmapKey": "..."
}
```

The semantic request remains valid GraphSCII data but must be rendered algorithmically rather than represented by another BMP PUA character.

## Frozen population

```text
renderer-only semantic aliases             3,392
exact encoded reuse aliases                   414
derived aliases                              2,978
unique derived bitmaps                       2,555
new encoded codepoints consumed                  0
```

Per group:

```text
dense 87.5%
  semantic aliases                           1,664
  exact encoded reuses                         207
  derived aliases                            1,457
  unique derived bitmaps                     1,204

sparse 12.5%
  semantic aliases                           1,664
  exact encoded reuses                         207
  derived aliases                            1,457
  unique derived bitmaps                     1,289

demoted half 50%
  semantic aliases                              64
  exact encoded reuses                           0
  derived aliases                               64
  unique desired bitmaps                        62
  fallback aliases                              64
  unique desired fallback bitmaps               62
```

The global unique-derived count is **2,555**, not the simple sum of every group count, because exact bitmap identity remains global across renderer-only styles as well.

## Demoted-half fallback invariant

The 64 demoted half semantics represent 62 distinct desired bitmaps. Every one preserves the fallback relationship selected by Milestone 4C.

For each demoted-half semantic the registry stores:

```text
desired bitmap key
fallback glyph ID
fallback codepoint
fallback bitmap key
Hamming distance
```

The verifier independently recomputes Hamming distance from the two canonical bitmap keys and requires:

```text
desired bitmap != fallback bitmap
Hamming distance = 1
fallback codepoint resolves to the recorded encoded owner
```

A fallback is therefore never mislabeled as exact equality.

## Human atlas

`renderer-only-atlas.md` is the resolution-oriented human reference. It is grouped as:

```text
Dense 87.5%
Sparse 12.5%
Demoted half 50%
```

Every semantic alias is listed with its final resolution. Exact reuse entries show the encoded codepoint and glyph ID. Derived entries show the exact desired bitmap key. Demoted-half entries additionally show the one-pixel fallback relationship.

The existing 4D.3/4D.4 renderer-only visual atlases remain the bitmap-oriented view; this 4D.5 atlas is specifically the semantic-resolution view.

## Permanent commands

From `geometric-glyph-lab/`:

```powershell
npm run generate:renderer-only-resolution
npm run verify:renderer-only-resolution
```

Both are included in the aggregate pipeline:

```powershell
npm run generate
npm run verify
```

Generation runs after the canonical vocabulary and atlas layers, so the renderer-only publication always resolves against the latest verified encoded registry.

## Verification gates

The dedicated verifier rebuilds all five files and requires exact byte identity with committed artifacts. It also freezes:

```text
total semantic aliases                     3,392
total exact reuses                            414
total derived aliases                       2,978
total unique derived bitmaps                2,555
dense semantic aliases                      1,664
dense exact / derived                     207 / 1,457
sparse semantic aliases                     1,664
sparse exact / derived                    207 / 1,457
demoted-half semantic aliases                  64
demoted-half unique desired bitmaps            62
demoted-half Hamming distance                   1
encoded codepoints consumed                       0
```

The complete TypeScript check, deterministic generation, and full project verification chain passed before the generated artifacts were committed.

## Result

Milestone 4D.5 is complete.

GraphSCII now has an explicit answer for every renderer-only semantic request: either reuse an existing encoded glyph exactly, or render the requested canonical bitmap algorithmically. The 604-slot PUA reserve remains untouched.

The next slice is **Milestone 4D.6 — `graphscii-graphics-v0` publication snapshot**.
