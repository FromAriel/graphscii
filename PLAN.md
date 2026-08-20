# GraphSCII — Living Project Plan

> **Status:** Active project memory and roadmap.
>
> **Repository:** `FromAriel/graphscii`
>
> **Implementation:** `geometric-glyph-lab/`
>
> **Canonical cell:** **8 columns × 16 rows**
>
> The original long-form plan is preserved at [`docs/PLAN-v0.md`](docs/PLAN-v0.md). Detailed milestone plans and completion notes live under `docs/`.

---

## 1. What GraphSCII is

GraphSCII is a fixed-cell graphics language encoded as Unicode glyphs and machine-readable tile data.

Each canonical visual is one deterministic **8×16 binary bitmap**. Multiple mathematical or appearance definitions may share the same visual owner when they rasterize identically.

Global rule:

> **One bitmap key gets at most one canonical glyph/codepoint.**

Semantic geometry is preserved even when its current visual form deduplicates, because later derived operations can distinguish definitions that temporarily share pixels.

---

## 2. Frozen cell contract

```text
width  = 8 pixels
height = 16 pixels
x = 0..7   left → right
y = 0..15  top → bottom
```

Ports:

```text
T0..T7
B0..B7
L0..L15
R0..R15
```

Bitmap identity remains 16 row bytes, top-to-bottom, `x=0` as bit 0, serialized as 32 lowercase hexadecimal characters.

ASCII:

```text
# = filled
- = empty
```

Normative details: [`docs/format.md`](docs/format.md).

---

## 3. Straight vocabulary — COMPLETE AND PUBLISHED

Frozen fixture:

```text
mathematical straight definitions    832
unique straight visuals              746
duplicate definitions                 86
maximum aliases                        4
```

Current provisional allocation:

```text
glyph IDs    0..745
Unicode      U+00E000..U+00E2E9
```

Published snapshot:

```text
straight-v0
snapshot commit 5806d99d73ab635bdbd0b1ff661ed810aeaa995d
```

The **832 mathematical definitions**, not only the 746 deduplicated stroke owners, remain authoritative input for derived geometry.

---

## 4. Curve research — PRESERVED, EXPANSION PAUSED

Milestone 3A produced a deterministic cubic Bézier curve engine and single-curve explorer with five tangent classes, three strengths, fixed-point rasterization, validity checks, and exact reuse detection against the straight vocabulary.

That work remains in the repository and is useful for future curated extensions.

The broad curve vocabulary is no longer the immediate direction because the research sweep demonstrated severe codepoint pressure. Curves may return later after the straight fill+dither vocabulary is resolved.

See:

- [`docs/milestone-3-curve-plan.md`](docs/milestone-3-curve-plan.md)
- [`docs/milestone-3a-curve-engine.md`](docs/milestone-3a-curve-engine.md)

---

## 5. Current direction — straight filled geometry + tonal dithers

Detailed design:

[`docs/milestone-4-straight-fill-dither-plan.md`](docs/milestone-4-straight-fill-dither-plan.md)

Architecture:

```text
832 mathematical straight boundaries
        ↓
select side A / side B
        ↓
solid or phase-locked dither mask
        ↓
boundary stroke forced ON
        ↓
canonical 8×16 bitmap
        ↓
GLOBAL exact raster dedup
```

Generic appearance rule:

```text
final = boundary-stroke OR (selected-side-region AND fill-mask)
```

Dither masks are **phase locked** to the cell coordinate system. No random or per-glyph phase shifts are allowed.

Research styles now measured:

```text
solid       100.0%
dense        87.5%
medium       75.0%
half         50.0%
light        25.0%
sparse       12.5%
```

The full BMP Private Use Area is now the intended graphics address space:

```text
U+E000..U+F8FF = 6,400 slots
```

Printable ASCII remains at `U+0020..U+007E` and consumes no PUA slots.

---

## 6. Milestone 4A — solid straight half-fills — COMPLETE

Implementation/completion note:

[`docs/milestone-4a-straight-solid-fills.md`](docs/milestone-4a-straight-solid-fills.md)

Each of the 832 oriented straight definitions produces two semantic solid fills:

```text
832 × 2 = 1,664 semantic fill candidates
```

The selected side is determined by the exact integer oriented cross product against the mathematical line. The existing Bresenham stroke is cloned first, so all boundary pixels remain ON.

Measured result:

```text
semantic solid fills                 1,664
unique fill rasters                  1,347
fill candidates reusing straight       100
straight visuals reused                  88
fill candidates reusing earlier fill    305
new fill visual owners               1,259
published straight visuals             746
combined straight + solid visuals     2,005
```

No fill codepoints have been allocated yet.

Machine fixture:

`spec/straight-fill-solid-research.json`

---

## 7. Milestone 4A.1 — persistent fill registry — COMPLETE

Completion note:

[`docs/milestone-4a1-fill-registry.md`](docs/milestone-4a1-fill-registry.md)

The 1,664 solid fill semantics and their 1,347 unique fill rasters are persistent generated artifacts.

```text
artifacts/manifest/fills/
├── registry.json
├── stats.json
└── indexes/
    ├── by-alias.json
    ├── by-bitmap.json
    ├── by-boundary-side.json
    ├── by-owner.json
    └── by-straight-candidate.json
```

All 1,259 novel fill visuals remain research-only and unallocated.

---

## 8. Milestone 4B — phase-locked dither sweep — COMPLETE

Completion note:

[`docs/milestone-4b-dither-sweep.md`](docs/milestone-4b-dither-sweep.md)

Five styles were swept across all 1,664 side semantics:

```text
1,664 × 5 = 8,320 styled semantic candidates
```

Measured exact-dedup result:

```text
styled semantic candidates               8,320
unique styled rasters                    6,500
published straight visuals                 746
novel solid visual owners                1,259
novel dither visual owners               5,077
combined straight + solid + dither       7,082
```

Research artifacts:

```text
artifacts/research/dithers/
spec/straight-fill-dither-research.json
```

No fill or dither codepoints were allocated in 4B.

---

## 9. Milestone 4C — palette and address-space decision — COMPLETE

Completion note:

[`docs/milestone-4c-palette-decision.md`](docs/milestone-4c-palette-decision.md)

Milestone 4C added a true 50% phase-locked checkerboard and exhaustively evaluated every 3-style and 4-style palette containing solid from:

```text
100% / 87.5% / 75% / 50% / 25% / 12.5%
```

Exactly 20 candidate palettes were measured with global raster dedup.

### Selected encoded tonal palette

```text
solid      100%
medium      75%
half        50%
light       25%
```

This gives exact quarter-step tonal spacing.

Dense 87.5% and sparse 12.5% remain supported semantic **renderer-only** styles.

### Exact cost and compression

The selected four-level palette costs:

```text
exact globally deduplicated visuals    5,858
```

That is 58 above the 5,800 graphics target. The optimizer found exactly 62 globally novel 50% owners that are only one pixel away from an already encoded straight/solid/75%/25% visual.

Those 62 owners, representing 64 semantic definitions, remain renderer-only.

Final planned encoded population:

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

Printable ASCII remains outside the PUA:

```text
95 printable ASCII + 5,796 PUA graphics = 5,891 physical glyphs minimum
```

### Planned PUA layout

These are planned ranges; 4C does not yet assign new fill/dither codepoints:

```text
U+E000..U+E2E9      746   published straight visuals
U+E2EA..U+E7D4    1,259   solid fill visuals
U+E7D5..U+ECC9    1,269   75% medium visuals
U+ECCA..U+F1EC    1,315   25% light visuals
U+F1ED..U+F6A3    1,207   retained 50% half visuals
U+F6A4..U+F8FF      604   reserve
```

Persistent decision artifacts:

```text
artifacts/research/palette/
├── decision.json
├── candidate-palettes.json
├── half-demotions.json
└── report.md

spec/straight-fill-palette-v0.json
```

The semantic vocabulary remains richer than the encoded font. Dense, sparse, and the 62 demoted half-tone owners can still resolve to existing codepoints on exact bitmap matches or be generated by the renderer.

---

## 10. Milestone 4D — published graphics vocabulary v0 — IN PROGRESS

Detailed implementation plan:

[`docs/milestone-4d-publication-plan.md`](docs/milestone-4d-publication-plan.md)

Milestone 4D materializes the 4C decision into the first complete addressable GraphSCII graphics vocabulary. It defines what the eventual font must contain, but does not yet build the TTF/OTF.

Execution order:

```text
4D.1  canonical allocation registry                 COMPLETE
4D.2  5,796 canonical ASCII/PNG artifacts             COMPLETE
4D.3  categorized visual/text atlases                  COMPLETE
4D.4  master text atlas + page atlas + layout map          COMPLETE
4D.5  renderer-only resolution registry                     COMPLETE
4D.6  graphscii-graphics-v0 publication snapshot              NEXT
```

### 4D.1 — canonical allocation registry — COMPLETE

Completion note: [`docs/milestone-4d1-canonical-allocation-registry.md`](docs/milestone-4d1-canonical-allocation-registry.md)

One global encoded registry now spans the 5,796 addressable graphics.

Hard gates:

```text
encoded owners                    5,796
unique bitmap owners              5,796
unique codepoints                 5,796
first codepoint                  U+E000
last allocated codepoint         U+F6A3
reserve                          U+F6A4..U+F8FF
reserve slots                       604
straight codepoints unchanged        YES
```

Expected registry tree:

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

### 4D.2 — canonical per-glyph artifacts — COMPLETE

Completion note: [`docs/milestone-4d2-canonical-glyph-artifacts.md`](docs/milestone-4d2-canonical-glyph-artifacts.md)

The complete encoded vocabulary is now materialized directly from the canonical registry:

```text
artifacts/vocabulary/glyphs/
├── ascii/    5,796 files
└── png/      5,796 files
```

Exactly **11,592** per-glyph files are present. Every ASCII artifact is an exact 8×16 `#`/`-` raster and every PNG is an exact 8×16 deterministic RGBA rendering of the same registry bitmap. The generator clears only this glyph-artifact tree before rebuilding, and the verifier checks every filename and every file byte against the corresponding owner bitmap key.

The canonical bitmap registry remains the source of truth for both forms.

### 4D.3 — categorized atlases — COMPLETE

Completion note: [`docs/milestone-4d3-categorized-atlases.md`](docs/milestone-4d3-categorized-atlases.md)

Generate category atlases for:

```text
straight
solid 100%
medium 75%
half 50%
light 25%
renderer-only reference
reserve layout
```

Encoded categories should have paged PNG and text views in canonical codepoint order.

### 4D.4 — master text atlas — COMPLETE

Completion note: [`docs/milestone-4d4-master-atlases.md`](docs/milestone-4d4-master-atlases.md)

The complete vocabulary must also exist as one combined, human-readable text atlas, neatly separated and categorized.

Required master outputs:

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

Master category order:

```text
1. STRAIGHT
2. SOLID 100%
3. MEDIUM 75%
4. HALF 50%
5. LIGHT 25%
6. RENDERER-ONLY REFERENCE
7. RESERVED PUA MAP
```

Each encoded glyph entry exposes its codepoint, glyph ID, class/style, bitmap key, representative semantic alias, alias count, and inline 8×16 ASCII bitmap.

The master page atlas separately mirrors Unicode/codepoint neighborhoods, while `master-layout-map.md` gives the compact category/range/count overview.

### 4D.5 — renderer-only resolution — COMPLETE

Completion note: [`docs/milestone-4d5-renderer-only-resolution.md`](docs/milestone-4d5-renderer-only-resolution.md)

Preserve dense 87.5%, sparse 12.5%, and the 62 demoted half-tone visual owners as explicit semantic outputs.

Renderer-only definitions must distinguish:

```text
encoded-exact-reuse
renderer-only-derived
```

The 62 demoted half-tone owners also retain their exact Hamming-distance-1 fallback relationship without pretending that fallback is raster-identical.

### 4D.6 — publication — NEXT

Publish:

```text
graphscii-graphics-v0
```

with deterministic registry, artifacts, atlases, master text atlas, renderer-only metadata, and provenance.

Fresh-build publication gate:

```text
delete generated 4D outputs
        ↓
npm run generate
        ↓
npm run verify
        ↓
byte-stable regenerated registry/artifacts/atlases
        ↓
PASS
```

The 604-slot reserve remains protected. No later family may consume it without a separately measured allocation decision.

---

## 11. Later milestones

```text
5   junctions / reserve-budget strategy
6   curated curve/arc extension if justified
7   terminals / specials
8   vocabulary optimization
9   font compiler
10  drawing API / solver
11  interactive editor
12  GraphSCII v1 freeze / release
```

The 604-slot reserve is intentionally protected until later families are measured.

---

## 12. Current commands

From `geometric-glyph-lab/`:

```powershell
npm run generate
npm run verify
npm run verify:curves
npm run verify:fills
npm run generate:fills
npm run verify:fill-registry
npm run generate:dithers
npm run verify:dithers
npm run verify:dither-research
npm run generate:palette
npm run verify:palette
npm run generate:vocabulary
npm run verify:vocabulary
npm run generate:vocabulary-artifacts
npm run verify:vocabulary-artifacts
npm run generate:vocabulary-atlases
npm run verify:vocabulary-atlases
npm run generate:vocabulary-master-atlas
npm run verify:vocabulary-master-atlas
npm run generate:renderer-only-resolution
npm run verify:renderer-only-resolution
npm run check
```

The published straight allocation remains authoritative. Milestone 4D.5 now persists all 3,392 renderer-only semantic resolutions as dense, sparse, and demoted-half publication artifacts: 414 exact encoded reuses and 2,978 derived aliases across 2,555 unique derived bitmaps, with every demoted-half fallback independently verified at Hamming distance 1. The 604-slot U+F6A4..U+F8FF reserve remains untouched. Milestone 4D.6 publication is next.

---

## 13. Guiding rule

Prefer **geometry reuse + derived appearance** over independent hand-authored glyph families.

```text
mathematical boundary
        ↓
semantic side / appearance
        ↓
deterministic raster
        ↓
global exact dedup
        ↓
canonical visual owner + preserved semantic aliases
```

Do not spend a new codepoint when an existing bitmap already renders the requested definition exactly.

When address-space pressure remains after exact dedup, prefer deterministic renderer fallback for low-distinctiveness derived appearances before discarding semantic capability.