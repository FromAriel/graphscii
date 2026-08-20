# Milestone 4D.1 — Canonical Allocation Registry

Status: **COMPLETE — GENERATED AND VERIFIED ON THE 4D FEATURE BRANCH**

Milestone 4D.1 materializes the frozen 4C palette decision into one global canonical addressable GraphSCII graphics registry.

The registry is now the machine-readable bridge from semantic geometry/appearance to canonical 8×16 visual ownership and provisional BMP Private Use Area codepoints.

## Encoded population

```text
straight                              746
solid 100%                          1,259
medium 75%                         1,269
light 25%                          1,315
retained half 50%                  1,207
                                    -----
encoded visual owners               5,796
```

Every encoded owner has one unique bitmap key and one unique provisional codepoint.

```text
unique encoded bitmap keys          5,796
unique allocated codepoints         5,796
```

The published straight block is preserved exactly:

```text
glyph IDs                            0..745
codepoints                    U+E000..U+E2E9
straight codepoints changed             NO
```

The full encoded allocation ends at:

```text
U+F6A3
```

The protected reserve remains:

```text
U+F6A4..U+F8FF = 604 slots
```

No 4D.1 allocation enters that reserve.

## Canonical allocation order

Allocation is deterministic and globally bitmap-deduplicated:

```text
published straight owners
        ↓
novel solid owners
        ↓
novel 75% medium owners
        ↓
novel 25% light owners
        ↓
retained novel 50% half owners
```

A later family never receives a new codepoint when its exact bitmap already belongs to an earlier owner.

## Semantic population

The registry resolves all currently defined straight and tonal semantics:

```text
straight semantic aliases              832
solid semantic aliases               1,664
medium semantic aliases              1,664
light semantic aliases               1,664
half semantic aliases                1,664
dense semantic aliases               1,664
sparse semantic aliases              1,664
                                      -----
all semantic aliases                10,816
```

Fill-style boundary/side/style keys total:

```text
9,984
```

Every semantic request is classified as one of:

```text
encoded-owner
renderer-only-exact-reuse
renderer-only-derived
```

Measured resolution counts:

```text
encoded semantic aliases             7,424
renderer-only semantic aliases       3,392

renderer-only exact reuse              414
renderer-only derived                2,978
```

Renderer-only breakdown:

```text
half 50% demotions
  exact reuse                            0
  derived                               64

dense 87.5%
  exact reuse                          207
  derived                            1,457

sparse 12.5%
  exact reuse                          207
  derived                            1,457
```

The 2,978 derived requests collapse to 2,555 unique derived bitmap keys.

For the 64 half-tone semantic definitions represented by the 62 one-pixel-demoted visual owners, the registry records the exact desired bitmap and its deterministic one-pixel encoded fallback. The fallback is never misrepresented as an exact match.

## Persistent artifacts

`npm run generate:vocabulary` writes:

```text
artifacts/manifest/vocabulary/
├── registry.json
├── stats.json
└── indexes/
    ├── by-codepoint.json
    ├── by-bitmap.json
    ├── by-alias.json
    ├── by-owner.json
    ├── by-boundary-side-style.json
    └── renderer-only.json
```

Index cardinalities are frozen at:

```text
by-codepoint                  5,796
by-bitmap                     5,796
by-owner                      5,796
by-alias                     10,816
by-boundary-side-style        9,984
renderer-only                 3,392
```

Each encoded owner records:

```text
glyphId
codepoint
codepointValue
bitmapKey
canonicalClass
allocationStatus
firstSemanticAlias
semanticAliases[]
```

Each semantic resolution records the originating straight definition, side/style when applicable, bitmap identity, resolution class, encoded owner when exact, and renderer fallback metadata when required.

## Commands

```powershell
npm run generate:vocabulary
npm run verify:vocabulary
```

Both commands are included in the normal:

```powershell
npm run generate
npm run verify
```

## Verification gate

The implementation passed TypeScript checking, deterministic generation, the dedicated vocabulary verifier, and the complete existing GraphSCII verification chain before the generated registry was committed.

Hard verified invariants:

```text
encoded owners                    5,796
unique bitmap owners              5,796
unique codepoints                 5,796
first codepoint                  U+E000
last allocated codepoint         U+F6A3
reserve start                    U+F6A4
reserve end                      U+F8FF
reserve slots                       604
straight codepoints unchanged        YES
allocations inside reserve             0
```

## Next slice

**Milestone 4D.2 — canonical per-glyph artifacts**

Generate deterministic 8×16 ASCII and PNG source artifacts for every one of the 5,796 encoded owners. The allocation registry created here is the source of truth for those exports.
