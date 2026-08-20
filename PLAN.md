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

The broad curve vocabulary is no longer the immediate direction because the research sweep demonstrated severe codepoint pressure. Curves may return later after the straight fill+dither vocabulary is measured.

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

Initial research palette:

```text
solid       100%
dense       87.5%
medium      75%
light       25%
sparse      12.5%
```

---

## 6. Milestone 4A — solid straight half-fills — COMPLETE

Implementation/completion note:

[`docs/milestone-4a-straight-solid-fills.md`](docs/milestone-4a-straight-solid-fills.md)

Each of the 832 oriented straight definitions produces two semantic solid fills:

```text
832 × 2 = 1,664 semantic fill candidates
```

The selected side is determined by the exact integer oriented cross product of each pixel center against the mathematical line. The existing Bresenham stroke is cloned first, so all boundary pixels remain ON.

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

The browser lab now includes a Straight Fill Explorer showing the original stroke, solid side A, and solid side B for any of the 832 mathematical straight definitions.

---

## 7. Milestone 4B — phase-locked dither sweep — NEXT

Apply the dither palette to the same underlying 1,664 semantic side definitions.

Do **not** derive dithered variants from the 1,347 deduplicated solid rasters. Dither generation starts from the original mathematical boundary + selected side so definitions that collapsed under solid fill are allowed to separate again under sparse masks.

For every style:

```text
boundary geometry
        ↓
side region
        ↓
8×8 phase-locked mask
        ↓
stroke forced ON
        ↓
8×16 raster
        ↓
global exact dedup against:
    published straights
    solid fills
    earlier dither variants
```

Raw styled semantic upper bound with five total fill styles:

```text
1,664 × 5 = 8,320 styled definitions
```

This is **not** the expected visual count. Exact dedup determines the real vocabulary cost.

4B must report, per style and globally:

- semantic candidate count;
- exact straight reuses;
- exact solid-fill reuses;
- dither-to-dither duplicates;
- genuinely new visual owners;
- combined visual vocabulary size;
- near-duplicate/Hamming distribution for later palette pruning;
- atlas views by brightness/style and side.

No dither codepoints are allocated during 4B.

---

## 8. Milestone 4C — palette and address-space decision

After 4B, decide which brightness levels earn permanent vocabulary space.

Current preferred PUA window:

```text
U+E000..U+EFFF = 4,096 slots
```

Research may intentionally explore below roughly 6,000 visuals, but that cannot fit inside one 4K window.

Therefore 4C must deliberately choose among:

```text
prune to one 4K window
expand into another Private Use range
reduce/merge dither levels
reserve some levels as renderer-only transformations
```

Do not allocate by guesswork before this gate.

---

## 9. Milestone 4D — publication

After the palette decision:

- allocate provisional visual owners;
- generate ASCII and PNG artifacts;
- publish semantic manifests and lookup indexes;
- publish the exact dither-mask specification;
- generate catalogs and atlases by style;
- record reproducible statistics and provenance.

---

## 10. Later milestones

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

## 11. Current commands

From `geometric-glyph-lab/`:

```powershell
npm run generate
npm run verify
npm run verify:curves
npm run verify:fills
npm run check
```

The published straight allocation remains authoritative. Solid and dither visuals stay research-only until the 4C allocation gate.

---

## 12. Guiding rule

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
