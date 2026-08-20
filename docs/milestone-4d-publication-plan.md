# Milestone 4D — Published GraphSCII Graphics Vocabulary v0

Status: **IN PROGRESS — 4D.1 THROUGH 4D.4 COMPLETE; 4D.5 NEXT**

Milestone 4D turns the completed 4C palette decision into the first complete addressable GraphSCII graphics vocabulary.

This milestone does **not** build the TTF/OTF yet. Its purpose is to freeze the canonical Unicode allocation, canonical 8×16 bitmap vocabulary, semantic resolution system, generated artifacts, atlases, and publication provenance that a later font compiler must consume.

The canonical visual truth remains the 8×16 binary bitmap registry.

---

## 1. Frozen 4C input

Milestone 4D consumes the completed 4C decision without re-optimizing it.

Encoded tonal families:

```text
straight             existing published stroke vocabulary
solid                100%
medium                75%
half                  50%
light                 25%
```

Renderer-only tonal families:

```text
dense                 87.5%
sparse                12.5%
62 demoted half-tone visual owners
```

Planned encoded population:

```text
straight                              746
solid                               1,259
75% medium                          1,269
25% light                           1,315
50% half retained                  1,207
                                    -----
encoded PUA graphics               5,796
BMP PUA reserve                      604
```

Printable ASCII remains at normal Unicode positions and consumes no PUA slots:

```text
U+0020..U+007E = 95 printable ASCII characters
```

Planned PUA layout:

```text
U+E000..U+E2E9      746   published straight visuals
U+E2EA..U+E7D4    1,259   solid fill visuals
U+E7D5..U+ECC9    1,269   75% medium visuals
U+ECCA..U+F1EC    1,315   25% light visuals
U+F1ED..U+F6A3    1,207   retained 50% half visuals
U+F6A4..U+F8FF      604   reserved
```

Hard invariant:

> The existing 746 straight glyphs and their codepoints must never be renumbered by Milestone 4D.

---

## 2. Milestone 4D.1 — canonical allocation registry — COMPLETE

Completion note: [`milestone-4d1-canonical-allocation-registry.md`](milestone-4d1-canonical-allocation-registry.md)

Create one global canonical encoded vocabulary covering all 5,796 addressable GraphSCII graphics.

Allocation order is deterministic:

```text
existing straight owners
        ↓
novel solid owners
        ↓
novel 75% medium owners
        ↓
novel 25% light owners
        ↓
retained novel 50% half owners
```

Exact raster identity remains global. A later family never receives a new codepoint if its exact bitmap already has an earlier canonical owner.

Every encoded owner must record at least:

```text
glyphId
codepoint
bitmapKey
canonicalClass
firstSemanticAlias
allSemanticAliases / alias references
allocationStatus
```

Every semantic definition must resolve to one of:

```text
encoded-owner
renderer-only-exact-reuse
renderer-only-derived
```

Expected registry outputs:

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

4D.1 definition of done:

```text
encoded owners                    = 5,796
unique encoded bitmap keys        = 5,796
unique allocated codepoints       = 5,796
first codepoint                   = U+E000
last allocated codepoint          = U+F6A3
reserve start                     = U+F6A4
reserve slots                     = 604
straight codepoints unchanged     = YES
new allocations in reserve        = 0
```

---

## 3. Milestone 4D.2 — canonical per-glyph artifacts — COMPLETE

Completion note: [`milestone-4d2-canonical-glyph-artifacts.md`](milestone-4d2-canonical-glyph-artifacts.md)

Generate deterministic font-facing source artifacts for every encoded owner.

Expected tree:

```text
artifacts/vocabulary/
└── glyphs/
    ├── ascii/
    │   ├── U+00E000.txt
    │   ├── ...
    │   └── U+00F6A3.txt
    └── png/
        ├── U+00E000.png
        ├── ...
        └── U+00F6A3.png
```

ASCII format remains exactly 8 columns × 16 rows using only:

```text
# = ON
- = OFF
```

PNG output must be generated deterministically from the canonical bitmap, not by browser screenshots or anti-aliased font rendering.

Required counts:

```text
ASCII glyph artifacts     5,796
PNG glyph artifacts       5,796
```

The bitmap key in the registry is the source of truth for both forms.

Implemented and verified result:

```text
ASCII glyph artifacts     5,796
PNG glyph artifacts       5,796
combined files           11,592
first codepoint          U+E000
last codepoint           U+F6A3
reserve artifacts             0
```

Generation and verification are permanent parts of `npm run generate` and `npm run verify`. Every committed artifact is reproduced from the canonical registry and compared byte-for-byte by the verifier.

---

## 4. Milestone 4D.3 — category atlases — COMPLETE

Completion note: [`milestone-4d3-categorized-atlases.md`](milestone-4d3-categorized-atlases.md)

Generate clean, navigable category atlases before generating the final combined master atlas.

Categories:

```text
straight
solid
medium-75
half-50
light-25
renderer-only-reference
reserve-layout
```

Expected structure:

```text
artifacts/vocabulary/atlases/
├── straight/
├── solid/
├── medium/
├── half/
├── light/
├── renderer-only/
└── combined/
```

Encoded categories should have paged PNG atlases and text/index companions.

Use a stable page size, provisionally 256 encoded glyphs per page, so the full vocabulary is inspectable without one enormous image.

Each category should expose:

```text
page-00.png
page-01.png
...
page-00.txt
page-01.txt
...
index.md
```

Page ordering must follow canonical codepoint order, never filesystem enumeration order.

---

## 5. Milestone 4D.4 — master text atlas and master layout map — COMPLETE

Completion note: [`milestone-4d4-master-atlases.md`](milestone-4d4-master-atlases.md)

Milestone 4D must include a **master text atlas** combining the entire encoded vocabulary into one human-readable, categorized reference.

This is a first-class publication artifact, not an optional convenience file.

Required outputs:

```text
artifacts/vocabulary/atlases/
├── master-text-atlas.md
├── master-text-atlas.txt
├── master-page-atlas.md
├── master-page-atlas.txt
├── master-layout-map.md
├── straight-text-atlas.md
├── solid-text-atlas.md
├── medium-text-atlas.md
├── half-text-atlas.md
└── light-text-atlas.md
```

### Master atlas organization

The master text atlas must be neatly separated and categorized in this order:

```text
1. STRAIGHT
2. SOLID 100%
3. MEDIUM 75%
4. HALF 50%
5. LIGHT 25%
6. RENDERER-ONLY REFERENCE
7. RESERVED PUA MAP
```

Each encoded category begins with a summary header containing:

```text
category name
visual count
codepoint start
codepoint end
semantic count / alias count where applicable
```

Each glyph entry should expose enough information to audit or grep the vocabulary:

```text
codepoint
glyphId
canonical class/style
bitmapKey
semantic owner / representative alias
alias count
8×16 ASCII bitmap
```

A representative entry should read conceptually like:

```text
## U+E2EA · glyph 0746
Class: solid
Bitmap: <32 lowercase hex characters>
Aliases: <count>
Representative: straight-fill:...:sideA:solid

--------
---###--
---####-
--#####-
--######
-#######
########
########
########
########
########
########
########
########
########
########
```

### Master page atlas

The page atlas mirrors codepoint layout rather than semantic hierarchy.

For example:

```text
PAGE E0
U+E000..U+E0FF

PAGE E1
U+E100..U+E1FF
...
```

This gives a second human view that answers "what occupies this Unicode neighborhood?"

### Master layout map

`master-layout-map.md` is the compact architectural overview:

| Section | Count | Start | End |
|---|---:|---|---|
| straight | 746 | U+E000 | U+E2E9 |
| solid | 1,259 | U+E2EA | U+E7D4 |
| medium 75% | 1,269 | U+E7D5 | U+ECC9 |
| light 25% | 1,315 | U+ECCA | U+F1EC |
| half 50% | 1,207 | U+F1ED | U+F6A3 |
| reserve | 604 | U+F6A4 | U+F8FF |

The master atlas must make category boundaries visually obvious with headings, separator rules, counts, and range summaries.

---

## 6. Milestone 4D.5 — renderer-only resolution registry — NEXT

Renderer-only semantics remain part of GraphSCII even though they do not all own codepoints.

Populations:

```text
dense 87.5%
sparse 12.5%
62 demoted 50% visual owners representing 64 semantic definitions
```

Renderer-only resolution has two distinct cases.

### Exact encoded reuse

If the derived renderer-only bitmap already equals an encoded canonical owner:

```json
{
  "resolution": "encoded-exact-reuse",
  "codepoint": "U+00....",
  "bitmapKey": "..."
}
```

### Derived renderer-only bitmap

If no encoded owner has that exact bitmap:

```json
{
  "resolution": "renderer-only-derived",
  "codepoint": null,
  "bitmapKey": "...",
  "style": "sparse"
}
```

The 62 demoted 50% owners must additionally preserve their one-pixel fallback relation:

```text
desired bitmap key
nearest encoded bitmap key
Hamming distance = 1
```

The one-pixel neighbor is a fallback relationship only. It must never be represented as exact raster equality.

Expected outputs:

```text
artifacts/vocabulary/renderer-only/
├── dense.json
├── sparse.json
├── demoted-half.json
├── index.json
└── renderer-only-atlas.md
```

---

## 7. Milestone 4D.6 — publication snapshot

After allocation, artifacts, atlases, and renderer-only resolution all reproduce deterministically, publish the vocabulary snapshot.

Publication name:

```text
graphscii-graphics-v0
```

Expected outputs:

```text
artifacts/publications/
├── graphscii-graphics-v0.json
└── graphscii-graphics-v0.md
```

Publication metadata must include at least:

```text
publication name
status
source commit
generation command
verification command
canonical cell
encoded graphics count
printable ASCII count
reserved PUA count
allocated Unicode start/end
reserve Unicode start/end
encoded tonal styles
renderer-only tonal styles
registry schema/version
master atlas paths
```

No TTF/OTF is required for 4D completion.

---

## 8. Full verification gates

Milestone 4D publication must fail closed unless all of the following hold:

```text
encoded owners                         5,796
unique encoded bitmap keys             5,796
unique allocated codepoints            5,796

straight owners                          746
solid additions                        1,259
75% medium additions                   1,269
25% light additions                    1,315
retained 50% half additions            1,207

first codepoint                       U+E000
straight allocation end               U+E2E9
last allocated codepoint              U+F6A3
reserve start                         U+F6A4
reserve end                           U+F8FF
reserve slots                            604

straight legacy codepoints unchanged      YES
duplicate encoded bitmap owners             0
duplicate encoded codepoint owners           0
new allocations in reserve                   0

demoted 50% owners preserved                62
demoted 50% semantics preserved             64
renderer-only dense preserved               YES
renderer-only sparse preserved              YES

ASCII glyph artifacts                  5,796
PNG glyph artifacts                    5,796
master text atlas exists                 YES
master page atlas exists                 YES
master layout map exists                 YES
category atlases exist                    YES
renderer-only atlas exists                YES
```

Fresh-build reproducibility gate:

```text
delete generated 4D vocabulary outputs
        ↓
npm run generate
        ↓
npm run verify
        ↓
regenerate every registry/artifact/atlas
        ↓
byte-stable comparison
        ↓
PASS
```

---

## 9. Implementation order

Execute 4D in slices:

```text
4D.1  canonical allocation registry                 NEXT
4D.2  5,796 canonical ASCII/PNG artifacts
4D.3  category atlases
4D.4  master text atlas + page atlas + layout map
4D.5  renderer-only resolution registry
4D.6  graphscii-graphics-v0 publication snapshot
```

Do not jump directly to the font compiler. Each later slice must consume the same canonical registry generated in 4D.1.

---

## 10. Architectural boundary

Milestone 4D defines **what the font must contain**, not **how the font file is encoded**.

```text
semantic definitions
        ↓
global exact raster resolution
        ↓
canonical 8×16 bitmap owners
        ↓
provisional Unicode allocation
        ↓
registry + ASCII + PNG + atlases + publication
        ↓
LATER: font compiler
```

If a future font compiler renders `U+E93A` incorrectly, the 4D bitmap registry remains authoritative and allows the compiler bug to be detected.

That separation is intentional.