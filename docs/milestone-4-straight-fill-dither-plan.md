# Milestone 4 — Straight Filled Geometry + Dither Brightness Plan

Status: **PLANNED — NEXT IMPLEMENTATION DIRECTION**

This milestone pauses curve expansion and builds the next GraphSCII vocabulary directly from the already-published straight geometry.

The new direction is:

```text
published straight boundaries
        ↓
fill side A / fill side B
        ↓
phase-locked dither masks
        ↓
global exact raster deduplication
        ↓
compact shape + brightness vocabulary
```

The goal is to get useful solid regions, slopes, wedges, silhouette edges, terrain-like pieces, and brightness/texturing levels while keeping the vocabulary tractable.

---

## 1. Starting point

The published straight system contains:

```text
832 mathematical straight definitions
746 unique canonical straight rasters
86 duplicate mathematical definitions
```

The 832 mathematical definitions remain the correct source for fill generation.

Do **not** derive fills only from the 746 deduplicated stroke glyphs. Two mathematical lines can share the same thin raster but describe slightly different boundaries; a side-fill or dithered fill may reveal those differences.

Therefore:

```text
source of fill semantics = 832 straight definitions
source of visual identity = canonical 8×16 bitmap
```

---

## 2. Solid side-fill construction

Each oriented straight definition produces two semantic filled candidates:

```text
straight boundary
├── fill side A
└── fill side B
```

Raw solid-fill semantic count:

```text
832 × 2 = 1,664 candidates
```

Side A and side B are defined from the oriented mathematical line, not by flood-filling the Bresenham stroke.

For each pixel center `(x + 0.5, y + 0.5)`, classify the point by the sign of the oriented line cross product.

Conceptually:

```text
cross = (x2-x1)(py-y1) - (y2-y1)(px-x1)

cross > 0  → side A
cross < 0  → side B
cross = 0  → mathematical boundary
```

The exact implementation may use integer/fixed-point coordinates so no platform-dependent floating behavior enters the canonical result.

Boundary pixels are always forced ON in both filled forms.

Canonical solid form:

```text
solid-A = stroke OR side-A-region
solid-B = stroke OR side-B-region
```

The verifier must explicitly cover line-on-boundary cases, corner-touching lines, diagonal ties, and any pixel-center-on-boundary case.

---

## 3. Global deduplication remains mandatory

Every filled candidate is compared against the existing global bitmap registry.

Resolution order:

```text
1. exact bitmap already belongs to a published straight glyph
      → reuse that canonical owner/codepoint

2. exact bitmap already produced by an earlier fill definition
      → reuse that filled visual owner

3. bitmap is genuinely new
      → novel filled visual candidate
```

A semantic fill definition is never discarded because its raster is duplicated.

Example metadata:

```json
{
  "aliasKey": "straight-fill:L13>R4:sideA:solid",
  "boundaryAlias": "straight:L13>R4",
  "side": "A",
  "fillStyle": "solid",
  "visualDisposition": "reuse-existing-filled",
  "canonicalGlyphId": null,
  "canonicalCodepoint": null,
  "exactBitmapMatch": true
}
```

No new codepoint is spent when an existing bitmap already renders the requested result exactly.

---

## 4. Dither is a fill operation, not a new geometry family

After side-region generation works, apply fixed binary dither masks to the selected filled region.

The geometry remains identical. Only the density/brightness of the interior changes.

Canonical textured form:

```text
textured = stroke OR (side-region AND dither-mask)
```

The boundary stroke remains fully ON at every brightness level.

This keeps geometric edges crisp while allowing the interior to represent tone.

---

## 5. Dither phase contract

Dither patterns are **phase-locked** to GraphSCII cell coordinates.

The initial mask tile is 8×8.

For an 8×16 glyph:

```text
mask(x, y) = pattern[x, y mod 8]
```

Because the cell width is exactly 8 and the cell height is exactly 16, an 8×8 pattern repeats twice vertically and remains aligned across neighboring GraphSCII cells.

This must be deterministic. A glyph must never choose a random/local phase.

The same style ID always means the same bit at the same local `(x,y)` coordinate.

---

## 6. Initial dither palette

Use the supplied patterns as the first research palette rather than inventing unrelated textures.

Initial five-style palette, including solid:

```text
solid       100%
dense       87.5%
medium      75%
light       25%
sparse      12.5%
```

Seed masks:

### solid — 100%

```text
########
########
########
########
########
########
########
########
```

### dense — 87.5%

```text
###-###-
########
#-###-##
########
###-###-
########
#-###-##
########
```

### medium — 75%

```text
#-#-#-#-
########
#-#-#-#-
########
#-#-#-#-
########
#-#-#-#-
########
```

### light — 25%

```text
#-#-#-#-
--------
#-#-#-#-
--------
#-#-#-#-
--------
#-#-#-#-
--------
```

### sparse — 12.5%

```text
#---#---
--------
--#---#-
--------
#---#---
--------
--#---#-
--------
```

These density labels are mathematical counts of ON cells in the 8×8 mask.

A 50% mask may be tested later, but it should not be added by default until the vocabulary budget is measured.

If the intended design becomes **solid plus five alternates** rather than five styles total, that is a separate six-style budget decision.

---

## 7. Critical semantic rule for dither generation

Generate every dithered form from the **underlying mathematical boundary + side region**, not from the deduplicated solid-fill bitmap.

Reason:

```text
boundary definition A
boundary definition B
        ↓
solid fills happen to raster identically
        ↓
subsequent dither masks may expose different region membership
```

So semantic geometry is authoritative for every derived fill style.

This is the same principle already used for straight aliases and curve research: visual dedup may collapse rendering, but it must never erase source geometry.

---

## 8. Candidate and budget math

Solid fill research starts with:

```text
1,664 semantic fill candidates
```

With five total fill styles:

```text
1,664 × 5 = 8,320 raw style candidates
```

plus the existing 746 straight glyphs.

That is only the raw semantic upper bound. Global exact dedup is expected to reduce it substantially.

The working research goal is:

```text
selected visual vocabulary < 6,000 glyphs if practical
```

However, the currently preferred single PUA window:

```text
U+E000..U+EFFF
```

contains only 4,096 codepoints.

Therefore **do not change the Unicode allocation yet**.

After the measured fill+dither sweep, choose one of two paths if the selected vocabulary exceeds 4,096:

1. prune/reduce the dither palette or other low-value visuals to stay inside one 4K window; or
2. deliberately expand the GraphSCII address space into an additional Private Use range.

The measurement must come before that decision.

---

## 9. Milestone slices

### 4A — solid straight half-fill generator — NEXT

Implement only solid side fills.

Definition of done:

```text
832 straight definitions
× 2 oriented sides
= 1,664 semantic candidates
```

- deterministic side-A / side-B region classification;
- boundary stroke forced ON;
- exact global dedup against the 746 published straights and other fills;
- preserve every semantic fill alias;
- report exact candidate/unique/reuse counts;
- browser preview for boundary, side A, and side B;
- no dither masks yet;
- no new Unicode allocation yet.

This slice answers the most important unknown first: **how many genuinely new solid filled visuals do the straight boundaries actually create?**

### 4B — phase-locked dither sweep

Apply the five seed fill styles to all 1,664 semantic fill definitions.

- generate from mathematical region semantics, not deduped solid visuals;
- preserve stroke pixels fully ON;
- globally deduplicate every textured raster;
- report per-style and total unique visual counts;
- report collisions with straights, solid fills, and other dither styles;
- show brightness/style filters in the atlas;
- no codepoint allocation yet.

### 4C — palette and budget decision

Use measured counts and visual inspection to choose the retained brightness palette.

Potential outcomes:

```text
solid + 4 alternates
solid + 3 alternates
solid + 2 alternates
```

or another measured subset.

Selection should consider:

- total glyph pressure;
- visible brightness separation;
- number of 1–2-pixel near-duplicates;
- usefulness on small filled regions;
- seamless tiling behavior;
- practical drawing tests.

Only after this gate should new visual owners receive provisional codepoints.

### 4D — filled/dither publication

Publish the selected vocabulary as a reproducible snapshot:

```text
ASCII glyphs
PNG glyphs
manifest + semantic aliases
fill-style masks/spec
lookup indexes
solid/dither catalogs
atlases by style
statistics
publication provenance
```

---

## 10. Browser research UI

The lab should eventually expose:

```text
Boundary source
  straight alias

View
  stroke
  fill A
  fill B

Fill style
  solid
  dense
  medium
  light
  sparse
```

Research atlas filters should include:

```text
all
solid only
dither style
side A / side B
novel visuals
reuses existing straight
multi-alias visuals
```

Each tile should expose its semantic derivations and canonical visual owner.

---

## 11. Verification requirements

Regression gates must include:

- straight baseline remains exactly `832 → 746 → 86`;
- exactly 1,664 raw solid fill semantics are generated before rejection/dedup;
- side classification is deterministic;
- reversing the oriented boundary swaps A/B semantics correctly;
- boundary pixels remain ON for every fill style;
- each 8×8 mask has a frozen bitmap and density;
- mask phase is identical across all glyphs;
- top and bottom 8-row halves of a fully filled 8×16 glyph use the same mask phase;
- global exact dedup never assigns two visual owners to one bitmap key;
- semantic aliases survive all visual deduplication;
- no new codepoints are allocated before the 4C decision gate.

---

## 12. Curve status

Milestone 3A curve research remains useful and is preserved.

The broad 3B curve expansion is **paused as a vocabulary direction** because the measured candidate space is much larger than the desired compact font budget.

Curve work may return later as a curated/specialized extension after the straight-filled+dither vocabulary is measured and proven useful.

Do not delete the curve engine or its research history.

---

## 13. Guiding rule

Prefer **geometry reuse + derived appearance** over adding unrelated hand-authored glyph families.

For this phase:

```text
mathematical straight boundary
        ↓
side region
        ↓
fill density mask
        ↓
canonical 8×16 bitmap
        ↓
global exact dedup
        ↓
canonical visual owner + preserved semantic aliases
```

The immediate next implementation slice is **4A — solid straight half-fill generation and exact measurement**.
