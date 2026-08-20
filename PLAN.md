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

## 5. Current direction — straight filled geometry + brightness dithers

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

Measured research palette:

```text
solid       100.0%
dense        87.5%
medium       75.0%
light        25.0%
sparse       12.5%
```

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

Important consequences:

- The full solid block emerges automatically from the geometry.
- Progressive horizontal and vertical fills emerge automatically.
- Slopes, wedges, and silhouette-like filled edges emerge from the diagonal/corner-crossing boundaries.
- 88 already-published straight visuals can also serve as fill outputs without consuming another visual slot.
- **No fill codepoints have been allocated yet.**

Machine fixture:

`spec/straight-fill-solid-research.json`

Regression command:

```powershell
npm run verify:fills
```

---

## 7. Milestone 4A.1 — persistent fill registry — COMPLETE

Completion note:

[`docs/milestone-4a1-fill-registry.md`](docs/milestone-4a1-fill-registry.md)

The 1,664 solid fill semantics and their 1,347 unique fill rasters are persistent generated artifacts.

`npm run generate` writes:

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

Frozen lookup counts:

```text
by-alias                 1,664
by-bitmap                1,347
by-boundary-side         1,664
by-straight-candidate      832
by-owner                 1,347
```

All 1,259 novel fill visuals remain research-only and unallocated.

The first unused provisional PUA codepoint remains `U+00E2EA`.

---

## 8. Milestone 4B — phase-locked dither sweep — COMPLETE

Completion note:

[`docs/milestone-4b-dither-sweep.md`](docs/milestone-4b-dither-sweep.md)

Every one of the 1,664 mathematical side semantics was rendered under all five styles from the original mathematical boundary + selected side:

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

Per-style new visual owners:

```text
solid       1,259
dense       1,227
medium      1,246
light       1,315
sparse      1,289
```

Dither-only reuse accounting:

```text
semantic candidates                     6,656
reuse published straights                 539
reuse solid visual owners                 139
same-style duplicate candidates           840
cross-style dither reuses                   61
```

Research artifacts are deterministic and persisted at:

```text
artifacts/research/dithers/
spec/straight-fill-dither-research.json
```

Ten static style/side atlases are generated, and the browser Straight Fill Explorer now supports all five fill styles plus a live 832-definition style/side atlas.

Verification commands:

```powershell
npm run verify:dithers
npm run verify:dither-research
```

Both are included in `npm run verify`.

**No fill or dither codepoints were allocated.**

---

## 9. Milestone 4C — palette and address-space decision — NEXT

The 4B result creates a hard address-space constraint.

Current preferred PUA window:

```text
U+E000..U+EFFF = 4,096 slots
```

Measured all-five-style vocabulary:

```text
straight + solid + dither visuals     7,082
single-window capacity                4,096
                                      -----
over budget                           2,986
```

Therefore keeping every visual from all five styles **cannot fit in one 4K PUA window**.

4C must use the 4B statistics, Hamming distributions, and atlases to evaluate useful retained subsets and deliberately choose among:

```text
prune one or more brightness levels
reserve some styles as renderer-only transformations
expand into another Private Use range
combine pruning with an expanded address-space policy
```

4C should calculate the exact globally deduplicated visual cost of candidate retained palettes rather than estimating from per-style totals.

The primary decision question is now:

> Which appearance levels deserve addressable glyph identity, and which should remain derived rendering operations?

Do not allocate new codepoints before this gate is resolved.

---

## 10. Milestone 4D — publication

After the 4C decision:

- allocate provisional visual owners for the retained addressable vocabulary;
- extend the global semantic registry across straight, solid, and retained dither semantics;
- generate ASCII and PNG artifacts for newly allocated owners;
- publish semantic manifests and lookup indexes;
- publish the exact retained dither-mask specification;
- generate catalogs and atlases by style;
- record reproducible statistics and provenance.

---

## 11. Later milestones

```text
5   junctions
6   curated curve/arc extension if justified
7   terminals / specials
8   vocabulary optimization
9   font compiler
10  drawing API / solver
11  interactive editor
12  GraphSCII v1 freeze / release
```

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
npm run check
```

The published straight allocation remains authoritative. Solid and dither visuals remain research-only until the 4C allocation gate.

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
