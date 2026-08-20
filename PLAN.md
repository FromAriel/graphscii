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

Each canonical visual is a deterministic 8×16 binary bitmap. Multiple mathematical or appearance definitions may share one visual glyph when they rasterize identically.

The project goal is a compact **2D graphics instruction set** whose cells compose predictably and can be selected mechanically by software.

The same vocabulary should support font rendering, direct bitmap rendering, ASCII inspection, generated catalogs, JSON lookup, atlases, an editor, and eventually automatic geometry-to-glyph solving.

---

## 2. Global visual identity rule

> **One bitmap key gets at most one canonical glyph/codepoint.**

For any new semantic definition:

```text
mathematical definition
        ↓
deterministic 8×16 raster
        ↓
bitmap already exists?
    ├── yes → preserve semantic alias and reuse visual owner
    └── no  → create a novel visual candidate
```

This applies across straight strokes, filled regions, dithered fills, curves, junctions, arcs, textures, and future classes.

Semantic geometry is never discarded merely because its current raster duplicates another definition. Derived operations can distinguish definitions that share one visual form.

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

Bitmap serialization remains 16 row bytes, top-to-bottom, `x=0` as bit 0, with 32 lowercase hex characters as the canonical bitmap key.

ASCII:

```text
# = filled pixel
- = empty pixel
```

---

## 4. Vocabulary/codepoint budget

Current preferred PUA window:

```text
U+E000..U+EFFF = 4,096 codepoints
```

Current provisional reserve idea:

```text
0x000–0xEFF   vocabulary             3840
0xF00–0xFFF   reserved/experimental  256
```

The new fill/dither research may intentionally explore a visual vocabulary below roughly **6,000 glyphs**, but 6,000 does **not** fit in the current single 4K PUA window.

Therefore allocation is deferred until measured counts exist. If the selected vocabulary exceeds 4,096, choose deliberately between pruning to one 4K window or expanding into an additional Private Use range.

Do not pre-allocate by guesswork.

---

## 5. Straight vocabulary — COMPLETE AND PUBLISHED

Frozen regression fixture:

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

The **832 mathematical definitions**, not only the 746 visual owners, remain authoritative input for derived fill generation.

---

## 6. Curve research — PRESERVED, EXPANSION PAUSED

Milestone 3A implemented a deterministic cubic Bézier research engine and single-curve explorer with:

```text
start/end ports
5 tangent classes
3 strengths
256-unit fixed-point geometry
256 deterministic samples
exact straight-raster reuse detection
```

This work remains useful and should not be deleted.

The broad curve-vocabulary expansion is paused as the primary direction. The full research space proved large enough that allocating curves first would put heavy pressure on the compact glyph budget.

Detailed historical design remains in [`docs/milestone-3-curve-plan.md`](docs/milestone-3-curve-plan.md) and [`docs/milestone-3a-curve-engine.md`](docs/milestone-3a-curve-engine.md).

Curves may return later as a curated extension after the straight filled+dither vocabulary is measured.

---

## 7. New direction — straight filled geometry + brightness dithers — NEXT

Detailed design: [`docs/milestone-4-straight-fill-dither-plan.md`](docs/milestone-4-straight-fill-dither-plan.md).

Core pipeline:

```text
832 published straight mathematical boundaries
        ↓
fill side A / fill side B
        ↓
1,664 semantic fill definitions
        ↓
solid or phase-locked dither mask
        ↓
canonical 8×16 raster
        ↓
GLOBAL exact bitmap deduplication
```

The boundary stroke remains fully ON for every fill style:

```text
final = stroke OR (selected-side-region AND fill-mask)
```

This allows shape and approximate brightness to coexist in one glyph.

### Side-fill rule

For each oriented line, classify pixel centers by the sign of the mathematical line cross product.

```text
cross > 0 → side A
cross < 0 → side B
cross = 0 → boundary
```

The implementation must be deterministic/fixed-point and preserve the original straight stroke.

### Dither phase rule

Dither patterns use an 8×8 phase-locked tile.

For the 8×16 GraphSCII cell, the mask repeats vertically twice:

```text
mask(x,y) = pattern[x, y mod 8]
```

No random or per-glyph phase shifts are allowed. Neighboring cells must tile coherently.

### Initial five-style research palette

```text
solid       100%
dense       87.5%
medium      75%
light       25%
sparse      12.5%
```

These are the user-supplied seed patterns. A 50% mask may be tested later if the measured vocabulary budget supports it.

Important: dithered forms are generated from the **underlying mathematical side region**, not from a deduplicated solid bitmap, because semantic boundaries that collapse under solid fill may separate again under a sparse mask.

---

## 8. Immediate milestone sequence

### Milestone 4A — solid straight half-fill generator — **NEXT**

```text
832 straight definitions × 2 sides = 1,664 semantic candidates
```

- [ ] deterministic side-A / side-B classification;
- [ ] boundary stroke always ON;
- [ ] exact global dedup against 746 straight visuals and other fills;
- [ ] preserve all semantic fill aliases;
- [ ] exact candidate/unique/reuse statistics;
- [ ] browser preview for stroke / fill A / fill B;
- [ ] no dithers yet;
- [ ] no new codepoints yet.

Primary question: **How many genuinely new solid filled rasters do the 832 straight boundaries produce?**

### Milestone 4B — phase-locked dither sweep

- [ ] freeze the initial 8×8 mask palette;
- [ ] apply masks to all 1,664 semantic fill definitions;
- [ ] preserve stroke pixels fully ON;
- [ ] exact global dedup across straights, solids, and dither variants;
- [ ] report unique/reuse counts per fill style;
- [ ] atlas filters by style and side;
- [ ] no codepoint allocation yet.

With five total styles the raw semantic upper bound is:

```text
1,664 × 5 = 8,320 styled candidates
```

This is not the expected final visual count; exact dedup determines the real cost.

### Milestone 4C — palette/budget decision

- [ ] inspect visual separation among brightness levels;
- [ ] analyze exact and near duplicates;
- [ ] measure total codepoint pressure;
- [ ] choose retained style set;
- [ ] decide one-PUA-window vs expanded address space only if required;
- [ ] allocate provisional codepoints only after this gate.

### Milestone 4D — filled/dither publication

- [ ] generate ASCII and PNG artifacts;
- [ ] publish semantic manifest and indexes;
- [ ] publish fill masks/spec;
- [ ] generate catalogs and atlases by style;
- [ ] record reproducible statistics/provenance.

---

## 9. Later work

After the filled+dither vocabulary is measured and useful:

### Milestone 5 — junctions
### Milestone 6 — curated curve/arc extension if justified
### Milestone 7 — terminals/specials
### Milestone 8 — vocabulary optimization
### Milestone 9 — font compiler
### Milestone 10 — drawing API / solver
### Milestone 11 — interactive editor
### Milestone 12 — GraphSCII v1 freeze/release

---

## 10. Current generation/verification commands

From `geometric-glyph-lab/`:

```powershell
npm run generate
npm run verify
npm run verify:curves
npm run check
```

The published straight pipeline remains authoritative while Milestone 4 is research-only. New fill/dither codepoints must not be assigned before the 4C decision gate.

---

## 11. Guiding rule

Prefer **geometry reuse + derived appearance** over independent hand-authored glyph families.

For this phase:

```text
mathematical straight boundary
        ↓
side region
        ↓
solid / dither brightness mask
        ↓
canonical 8×16 bitmap
        ↓
global exact dedup
        ↓
canonical visual owner + preserved semantic aliases
```

Do not spend a new codepoint when an existing bitmap renders the requested definition exactly. Do not discard source geometry merely because an intermediate visual representation deduplicates.
