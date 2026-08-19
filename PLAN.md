# GraphSCII — Living Project Plan

> **Status:** Active project memory and roadmap.
>
> **Repository:** `FromAriel/graphscii`
>
> **Implementation:** `geometric-glyph-lab/`
>
> **Canonical cell:** **8 columns × 16 rows**
>
> The original long-form planning document is preserved at [`docs/PLAN-v0.md`](docs/PLAN-v0.md). Completed milestone notes live in `docs/` and published generated snapshots live under `artifacts/`.

---

## 1. What GraphSCII is

GraphSCII is a fixed-cell graphics language encoded as Unicode glyphs and machine-readable tile data.

Each glyph is a deterministic 8×16 binary bitmap representing a useful local piece of geometry. Multiple mathematical definitions may share one visual glyph when they rasterize identically.

The project goal is a compact **2D graphics instruction set** whose cells compose predictably and can be selected mechanically by software.

The same vocabulary should support font rendering, direct bitmap rendering, ASCII inspection, generated class catalogs, JSON lookup, atlases, an editor, and eventually an automatic geometry-to-glyph solver.

---

## 2. Global visual identity rule

> **One bitmap key gets at most one canonical glyph/codepoint.**

For any new mathematical definition:

```text
new definition
    ↓
rasterize
    ↓
bitmap already exists?
    ├── yes → preserve semantic alias and reuse existing glyph/codepoint
    └── no  → create new visual candidate
```

This applies across straight lines, curves, filled boundaries, junctions, arcs, textures, and future classes.

Semantic geometry is never discarded merely because its thin raster duplicates another definition. Later derived operations such as side filling may distinguish definitions that share one stroke bitmap.

---

## 3. GraphSCII v1 cell contract — FROZEN

```text
width  = 8 pixels
height = 16 pixels
x = 0..7   left → right
y = 0..15  top → bottom
```

Ports:

```text
Top:     T0..T7
Bottom:  B0..B7
Left:    L0..L15
Right:   R0..R15
```

Normative contract: [`docs/format.md`](docs/format.md).

Bitmap serialization remains 16 row bytes, top-to-bottom, x=0 as bit 0, with 32 lowercase hex characters as the canonical bitmap key.

ASCII remains:

```text
# = filled pixel
- = empty pixel
```

---

## 4. Vocabulary/codepoint budget

Working budget:

```text
4096 glyph IDs = 12 bits
```

Preferred PUA mapping:

```text
glyph 0x000 → U+E000
...
glyph 0xFFF → U+EFFF
```

Provisional reserve goal:

```text
0x000–0xEFF   vocabulary             3840
0xF00–0xFFF   reserved/experimental  256
```

Generate candidate supersets first. Measure exact deduplication and coverage before assigning slots.

---

## 5. Straight vocabulary — COMPLETE AND PUBLISHED

Frozen fixture:

```text
mathematical candidates    832
unique canonical bitmaps   746
duplicate candidates        86
compression              10.3%
maximum aliases              4
```

Provisional allocation:

```text
glyph IDs    0..745
Unicode      U+00E000..U+00E2E9
```

Published snapshot:

```text
straight-v0
snapshot commit 5806d99d73ab635bdbd0b1ff661ed810aeaa995d
```

The repository contains all 746 ASCII files, all 746 PNG files, semantic manifest/indexes, `straight-lines.md`, atlases, statistics, and publication provenance.

---

## 6. Curve strategy — CURRENT

Detailed design: [`docs/milestone-3-curve-plan.md`](docs/milestone-3-curve-plan.md).

### Milestone 3A — curve grammar/rasterizer/explorer — **COMPLETE**

Implemented:

```text
cubic Bézier
start port
end port
start tangent
end tangent
strength
```

Tangent classes:

```text
hard-left
soft-left
normal
soft-right
hard-right
```

Strengths:

```text
tight
normal
gentle
```

Raster contract:

```text
256 fixed-point units / pixel
256 deterministic samples
sample segments → existing Bresenham rasterizer
```

Validity checks include zero-length endpoints, cell escape, missing endpoints, unintended boundary pixels, disconnected output, and sampled self-intersection. Same-edge curves are allowed when valid.

The browser lab includes a single-curve explorer that reports exact straight reuse versus novel/unallocated curve rasters.

Regression examples:

```text
L8→R8 normal/normal normal
→ exact reuse U+00E088

L8→R8 hard-left/hard-left normal
→ novel bitmap 0000000000000060fb06000000000000
→ no codepoint allocated
```

See [`docs/milestone-3a-curve-engine.md`](docs/milestone-3a-curve-engine.md).

### Milestone 3B — broad curve sweep — **NEXT**

Generate the broad endpoint/tangent/strength research space, including opposite-edge, adjacent-edge, and same-edge endpoint pairs.

For every mathematical curve:

```text
generate
↓
validate
↓
rasterize
↓
exact match existing straight? → reuse straight owner
↓ no
exact match earlier curve? → reuse curve visual
↓ no
novel curve visual candidate
```

Measure:

- mathematical candidate count,
- invalid/rejected count by reason,
- exact straight collisions,
- curve-to-curve duplicate count,
- genuinely novel curve rasters,
- near-duplicate Hamming-distance distribution,
- codepoint pressure if every novel raster were retained.

No new codepoints are allocated in 3B.

### Milestone 3C — curve selection/allocation

Inspect the 3B research atlas and statistics, decide which novel visual rasters earn slots, preserve all semantic curve definitions, and allocate only selected novel visual owners beginning after the published straight range.

### Milestone 3D — curve publication

Generate and publish curve ASCII/PNG artifacts, `curves.md`, semantic indexes, atlases, provenance, and a provisional `curve-v0` snapshot.

---

## 7. Generic boundary fill — AFTER CURVES

Filled geometry is not a separate hand-authored solids vocabulary.

Any retained mathematical boundary can later derive:

```text
boundary stroke
fill side A
fill side B
```

Initial boundary sources:

```text
straight definitions
curve definitions
```

Later sources may include arcs or other spline primitives.

Filled rasters go through the same global bitmap deduplication rule. A filled definition that matches an existing bitmap reuses that visual owner/codepoint while preserving its own semantic derivation.

This should produce progressive fills, slopes, wedges, silhouette fragments, rounded solids, and terrain-like pieces as emergent results of boundary geometry rather than unrelated glyph families.

---

## 8. Current generation/verification commands

From `geometric-glyph-lab/`:

```powershell
npm run generate
npm run verify
npm run verify:curves
npm run check
```

`npm run generate` still publishes the current straight artifact pipeline. Curve research is intentionally non-allocating until 3C.

---

## 9. Milestone sequence

### Milestone 0 — fundamentals — **COMPLETE**
### Milestone 1 — persistent straight artifact pipeline — **COMPLETE**
### Milestone 2A — straight semantic registry — **COMPLETE**
### Milestone 2B — straight class catalog — **COMPLETE**
### Milestone 2C — straight publication — **COMPLETE**

### Milestone 3A — curve grammar/rasterizer/explorer — **COMPLETE**
- [x] cubic Bézier semantic grammar.
- [x] 5 tangent classes.
- [x] 3 strength classes.
- [x] 256-unit fixed-point geometry.
- [x] 256-sample deterministic rasterization.
- [x] curve validity diagnostics.
- [x] same-edge curve support.
- [x] exact dedup lookup against all straight glyphs.
- [x] explicit existing-codepoint reuse result.
- [x] browser single-curve explorer.
- [x] curve regression verification.
- [x] no new Unicode allocation.

### Milestone 3B — broad curve sweep — **NEXT**
- [ ] enumerate endpoint pairs across all four edges.
- [ ] include same-edge pairs.
- [ ] apply all tangent/strength combinations.
- [ ] reject invalid curves with reason statistics.
- [ ] exact dedup against 746 straights.
- [ ] exact dedup curve-to-curve.
- [ ] preserve every semantic curve alias.
- [ ] calculate near-duplicate/Hamming statistics separately from exact dedup.
- [ ] generate research atlas and summary JSON.
- [ ] allocate no new codepoints.

### Milestone 3C — curve selection/allocation
- [ ] inspect research atlas.
- [ ] score/curate codepoint-worthy novel rasters.
- [ ] allocate selected curve visuals only.
- [ ] keep redirect metadata for reused visual owners.

### Milestone 3D — curve publication
- [ ] publish selected curve glyph artifacts/catalog/indexes.
- [ ] record provisional curve snapshot provenance.

### Milestone 4 — generic boundary fill
- [ ] deterministic side-A/side-B classification.
- [ ] derive fills from straight and curve mathematical boundaries.
- [ ] global dedup of filled forms.
- [ ] preserve boundary/fill semantic provenance.
- [ ] publish filled-boundary artifacts/catalog.

### Milestone 5 — junctions
### Milestone 6 — circles/ellipses and arc coverage
### Milestone 7 — textures/terminals/specials
### Milestone 8 — vocabulary optimization
### Milestone 9 — font compiler
### Milestone 10 — drawing API / solver
### Milestone 11 — interactive editor
### Milestone 12 — GraphSCII v1 freeze/release

---

## 10. Guiding rule

Prefer designs that make GraphSCII more **systematic, reproducible, queryable, composable, inspectable, programmable, and geometrically expressive per codepoint**.

Do not spend a new codepoint when an existing canonical bitmap renders the requested geometry exactly. Do not discard mathematical geometry merely because its current thin raster is visually duplicated.
