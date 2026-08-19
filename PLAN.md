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

Each assigned visual glyph is one deterministic 8×16 binary bitmap. Multiple mathematical definitions may share that bitmap and therefore share one canonical glyph/codepoint.

The goal is a compact **2D graphics instruction set** whose cells compose predictably and can be selected mechanically by software.

A program should eventually be able to ask:

```text
Which glyph connects L13 to R4?
Which curve connects these ports with these tangents?
Does this curve visually reuse an existing straight glyph?
Which glyph fills side A of this boundary?
Which neighboring glyphs are geometrically compatible?
```

The same vocabulary should support font rendering, direct bitmap rendering, ASCII inspection, generated class catalogs, JSON lookup, atlases, an editor, and eventually an automatic geometry-to-glyph solver.

---

## 2. Source-of-truth hierarchy

Authority order:

1. **Generator/specification source** — mathematical geometry and family rules.
2. **Canonical bitmap** — visual identity.
3. **Global visual registry** — one canonical visual glyph per bitmap key.
4. **Semantic aliases** — straight/curve/fill/etc. definitions that resolve to canonical visuals.
5. **Generated artifacts** — PNG, ASCII, JSON, Markdown, atlases, fonts.

Pipeline:

```text
mathematical shape definition
        ↓
deterministic rasterizer
        ↓
canonical 8×16 bitmap
        ↓
GLOBAL exact bitmap deduplication
        ↓
canonical visual glyph + semantic aliases
        ↓
PNG / ASCII / JSON / catalogs / atlases
        ↓
font + drawing APIs
```

The font is always a compiled artifact, never the authoritative visual definition.

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

Bitmap serialization:

```text
16 bytes
rows top → bottom
x=0 is bit 0
32 lowercase hexadecimal characters
```

Serialization ID:

```text
v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex
```

ASCII:

```text
# = filled pixel
- = empty pixel
```

Artifact stems use six uppercase hexadecimal digits, e.g. `U+00E000`.

---

## 4. Global visual-dedup and codepoint rule

GraphSCII codepoints identify **canonical visual bitmaps**, not semantic shape classes.

Global invariant:

> **One bitmap key gets at most one canonical glyph/codepoint.**

For any new mathematical definition:

```text
new definition
    ↓
rasterize
    ↓
bitmap already exists?
    ├── yes → attach semantic alias and reuse existing glyph/codepoint
    └── no  → create new visual candidate
```

This rule applies across straight lines, curves, filled boundaries, junctions, arcs, textures, and future classes.

A semantic record that reuses an existing visual must expose background resolution data such as:

```json
{
  "visualDisposition": "reuse-existing-straight",
  "canonicalGlyphId": 66,
  "canonicalCodepoint": "U+00E042",
  "canonicalClass": "straight-lines",
  "exactBitmapMatch": true
}
```

The semantic geometry is still preserved in full even when its visual rendering is reused.

That is critical because later derived operations can distinguish mathematically different boundaries that happened to share the same thin raster.

---

## 5. Vocabulary/codepoint budget

Working target:

```text
4096 glyph IDs = 12 bits
```

Preferred PUA mapping:

```text
glyph 0x000 → U+E000
...
glyph 0xFFF → U+EFFF
```

`4096` is a budget, not a target to fill blindly.

Provisional reserve goal:

```text
0x000–0xEFF   vocabulary             3840
0xF00–0xFFF   reserved/experimental  256
```

Generate candidate supersets first. Measure exact deduplication and visual coverage before assigning slots.

---

## 6. Straight-line vocabulary — COMPLETE AND PUBLISHED

Candidate families:

```text
LR  16 × 16 = 256
TB   8 ×  8 =  64
LT  16 ×  8 = 128
LB  16 ×  8 = 128
RT  16 ×  8 = 128
RB  16 ×  8 = 128
                 ───
                 832
```

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
assignment   codepoint = U+E000 + glyphId
```

Source: `spec/straight-allocation.json`.

Semantic registry preserves all 832 straight definitions and generates codepoint, bitmap, port, and connection-pair indexes.

Published snapshot:

```text
publication    straight-v0
source commit   791a0a2175b888ee24061ed92a0d31eaf3342fdc
snapshot commit 5806d99d73ab635bdbd0b1ff661ed810aeaa995d
```

The repository contains all 746 ASCII files, all 746 PNG files, the semantic manifest/indexes, `straight-lines.md`, four atlases, statistics, and publication provenance.

See:

- [`docs/connectivity.md`](docs/connectivity.md)
- [`docs/milestone-2a-semantic-registry.md`](docs/milestone-2a-semantic-registry.md)
- [`docs/milestone-2b-straight-catalog.md`](docs/milestone-2b-straight-catalog.md)
- [`docs/milestone-2c-straight-publication.md`](docs/milestone-2c-straight-publication.md)

---

## 7. Curve strategy — NEXT

Detailed design: [`docs/milestone-3-curve-plan.md`](docs/milestone-3-curve-plan.md).

Curves are generated before a separate solids vocabulary because filled geometry will later be derived generically from boundary primitives.

Initial curve primitive:

```text
cubic Bézier
P0 = start port
P1 = derived from start tangent + strength
P2 = derived from end tangent + strength
P3 = end port
```

Authored grammar:

```text
start port
end port
start tangent class
end tangent class
curvature/handle strength
```

Endpoint topology includes:

```text
opposite edges  LR TB
adjacent edges  LT LB RT RB
same edge       LL RR TT BB
```

There are 48 semantic ports, giving `C(48,2)=1128` unordered distinct semantic endpoint pairs before rejection of coordinate-degenerate corner pairs.

Initial tangent research basis:

```text
hard-left
soft-left
normal
soft-right
hard-right
```

Initial strengths:

```text
tight
normal
gentle
```

A broad first sweep is therefore on the order of ~84,000 mathematical candidates before validity filtering and exact raster deduplication.

This is a research pool, not a Unicode allocation.

---

## 8. Curve dedup behavior

Every accepted curve definition is preserved semantically, then classified visually:

```text
reuse-existing-straight
reuse-existing-curve
new-raster-unallocated
```

Example:

```text
requested curve alias
        ↓
raster exactly matches U+00E042
        ↓
semantic curve remains in data
render using U+00E042
no new Unicode slot consumed
```

This handles short/subtle curves that collapse to existing straight pixels under 8×16 confinement.

Curve-to-curve collisions work the same way: many mathematical curves may share one canonical curve visual.

Exact equality is the only automatic dedup criterion.

Near-duplicate analysis is reported separately using Hamming distance so we can decide later whether a 1-pixel-different curve is worth a scarce codepoint.

---

## 9. Curve raster contract

Curve rasterization must be deterministic and binary.

Planned approach:

```text
fixed-point geometry
256 subunits / pixel
        ↓
cubic control points quantized to fixed-point
        ↓
8 deterministic t=1/2 subdivision levels
        ↓
256 polyline segments
        ↓
existing Bresenham segment rasterizer
        ↓
canonical 8×16 bitmap
```

No browser Canvas stroking and no anti-aliasing.

Initial candidate rejection reasons include:

```text
coordinate-identical endpoints
curve leaves cell
extra boundary crossings
self-intersection / loop
unintended boundary pixels
disconnected raster
missing declared endpoint pixel
```

For the initial curve model, a boundary stroke should normally touch the cell boundary only at its declared ports.

---

## 10. Curve research outputs

Before any curve codepoint allocation, generate:

```text
artifacts/research/curves/
├── stats.json
├── accepted-curves.json
├── rejected-curves.json
├── straight-collisions.json
├── novel-rasters.json
├── nearest-straight.json
├── atlas-novel.png
├── atlas-straight-collisions.png
└── report.md
```

Measure:

```text
raw mathematical candidates
accepted candidates
rejections by reason
exact straight collisions
curve-to-curve duplicate aliases
novel curve rasters
novel rasters by endpoint topology
novel rasters by tangent pair
novel rasters by strength
maximum aliases per raster
nearest-straight Hamming distance
projected glyph total if all novel curves were allocated
```

No new curve codepoints during the research sweep.

The first currently available provisional codepoint is `U+00E2EA`, but it is not assigned until the coverage decision gate.

---

## 11. Curve semantic/query requirements

Each accepted curve alias retains:

```text
stable alias key
start/end ports
orientation
start/end tangent classes
curvature strength
derived P0/P1/P2/P3 control points
bitmap key
visual disposition
canonical visual resolution
reverse-query relationship
```

Stroke reversal resolves to the same visual with `reversed: true`.

Orientation must still be preserved because generic fill later depends on direction; reversing a boundary swaps its A/B fill interpretation.

The browser research UI should expose filters for:

```text
novel curves
matches straight
curve duplicates
rejected curves
same-edge
adjacent-edge
opposite-edge
```

and show the curve, straight chord, raster, canonical codepoint reuse, nearest-straight distance, aliases, tangents, strength, and control points.

---

## 12. Generic boundary fill — AFTER CURVES

There is no longer a separate basic-solids milestone.

After straight and curve boundaries exist, implement one generic operation:

```text
BOUNDARY
├── stroke
├── fill side A
└── fill side B
```

Input is the preserved **mathematical boundary alias**, not merely the canonical stroke glyph.

Therefore:

```text
curve stroke visually matches straight stroke
             ↓
curve reuses straight codepoint for stroke
             ↓
curve geometry is still preserved
             ↓
curve fill A/B may rasterize differently
```

This generic fill system should naturally generate much of the solid vocabulary:

```text
progressive horizontal/vertical fills
halves
slopes
wedges
triangles
terrain edges
silhouette boundaries
rounded filled contours
concave/convex solid pieces
```

Filled results then go through the same global bitmap deduplication and canonical-codepoint reuse policy.

A standalone full block will still be needed. Empty can probably remain a structural blank rather than consuming a PUA glyph, subject to verification when fill work begins.

---

## 13. Current generation pipeline

From `geometric-glyph-lab/`:

```powershell
npm run generate
npm run verify
```

Current published pipeline:

```text
straight base artifacts
        ↓
straight semantic registry
        ↓
straight-lines.md catalog
```

Curve research joins this pipeline without changing the published straight-v0 output.

---

## 14. Repository structure

```text
graphscii/
├── PLAN.md
├── README.md
├── .github/workflows/
│   └── publish-straight-snapshot.yml
├── geometric-glyph-lab/
├── spec/
│   ├── straight-allocation.json
│   └── curve-grammar.json          # Milestone 3
├── artifacts/
│   ├── manifest/
│   ├── glyphs/
│   ├── classes/
│   ├── atlases/
│   ├── publications/
│   └── research/
│       └── curves/                 # Milestone 3
└── docs/
    ├── format.md
    ├── connectivity.md
    ├── PLAN-v0.md
    ├── milestone-1-artifacts.md
    ├── milestone-2a-semantic-registry.md
    ├── milestone-2b-straight-catalog.md
    ├── milestone-2c-straight-publication.md
    └── milestone-3-curve-plan.md
```

---

## 15. Codepoint stability policy

Before v1 freeze, provisional IDs/codepoints may move, but existing published visual owners should not move casually.

After freeze:

1. never silently change an assigned codepoint's visual meaning,
2. never allocate two codepoints to the same canonical bitmap merely for semantic distinction,
3. never recycle a retired codepoint for unrelated geometry within the same major version,
4. preserve semantic aliases and redirects in metadata,
5. increment the format major version for unavoidable breaking remaps.

---

## 16. Milestone sequence

### Milestone 0 — fundamentals — **COMPLETE**

- [x] freeze 8×16 cell/orientation.
- [x] freeze bitmap serialization.
- [x] freeze ASCII/artifact naming.
- [x] preserve `832 → 746 → 86` regression.

### Milestone 1 — artifact pipeline — **COMPLETE**

- [x] deterministic generator CLI.
- [x] JSON manifest/stats.
- [x] per-glyph ASCII/PNG.
- [x] atlases.
- [x] reproducibility verification.

### Milestone 2A — straight semantic registry — **COMPLETE**

- [x] provisional straight allocation.
- [x] preserve all 832 semantic aliases.
- [x] codepoint/bitmap/port/pair indexes.

### Milestone 2B — straight class catalog — **COMPLETE**

- [x] generated `straight-lines.md`.
- [x] all 746 inline ASCII forms.
- [x] semantic metadata and aliases.

### Milestone 2C — straight publication — **COMPLETE**

- [x] complete `straight-v0` artifact snapshot.
- [x] all 746 ASCII + 746 PNG files committed.
- [x] provenance and publication verification.

### Milestone 3A — curve grammar + deterministic rasterizer — **NEXT**

- [ ] version `spec/curve-grammar.json`.
- [ ] implement cubic Bézier semantic grammar.
- [ ] support opposite/adjacent/same-edge endpoint topology.
- [ ] implement five initial tangent deviations.
- [ ] implement three initial strengths.
- [ ] implement fixed-point deterministic cubic flattening/rasterization.
- [ ] implement validity/rejection rules.
- [ ] build single-curve browser explorer.
- [ ] add curve raster regression tests.
- [ ] allocate **no new Unicode codepoints**.

### Milestone 3B — broad curve generation + global dedup research

- [ ] run broad candidate sweep (~84k upper-bound before rejection).
- [ ] exact-dedup every accepted curve against straight-v0.
- [ ] exact-dedup curves against earlier curve rasters.
- [ ] preserve all mathematical curve aliases.
- [ ] generate canonical visual-resolution redirects.
- [ ] compute nearest-straight Hamming distances.
- [ ] generate research JSON, atlases, and report.
- [ ] report projected codepoint pressure.
- [ ] allocate **no new Unicode codepoints**.

### Milestone 3C — curve coverage selection + provisional allocation

- [ ] inspect novel/near-duplicate atlases.
- [ ] decide which tangent/strength classes earn space.
- [ ] select useful novel curve rasters.
- [ ] assign codepoints only to selected novel rasters.
- [ ] keep exact-straight matches as redirects to existing codepoints.
- [ ] add curve lookup indexes and main atlas filters.

### Milestone 3D — curve publication

- [ ] generate canonical PNG/ASCII for allocated curve visuals.
- [ ] generate `curves.md`.
- [ ] generate combined manifest/indexes/atlases.
- [ ] publish `curve-v0` snapshot with provenance.

### Milestone 4 — generic boundary fill

- [ ] define orientation-relative A/B side semantics.
- [ ] apply to every retained straight boundary alias.
- [ ] apply to every retained curve boundary alias.
- [ ] preserve mathematical provenance even for stroke redirects.
- [ ] globally dedup filled rasters against all existing visuals.
- [ ] add full-block primitive and settle structural empty policy.
- [ ] generate filled-boundary catalogs/artifacts.

### Milestone 5 — junctions

- [ ] direction-mask model.
- [ ] sharp/rounded junction generation.
- [ ] compatibility metadata.
- [ ] global dedup + artifacts.

### Milestone 6 — circles/ellipses

- [ ] radius/ellipse grammar.
- [ ] arc generation.
- [ ] reuse generic fill operation.
- [ ] global dedup/coverage analysis.

### Milestone 7 — textures/terminals/specials

- [ ] dithers/hatches/stipple.
- [ ] seamless texture phases.
- [ ] caps/nodes/arrows.
- [ ] special primitives justified by drawing failures.

### Milestone 8 — vocabulary optimization

- [ ] analyze full candidate superset.
- [ ] identify coverage holes and codepoint pressure.
- [ ] score/select competing visuals.
- [ ] preserve reserve space.
- [ ] produce provisional 4K allocation map.

### Milestone 9 — font compiler

- [ ] bitmap-to-outline compiler.
- [ ] fixed metrics + PUA cmap.
- [ ] TTF/WOFF2.
- [ ] specimen tests.

### Milestone 10 — drawing API

- [ ] stable manifest/query API.
- [ ] canonical glyph resolver.
- [ ] neighbor compatibility.
- [ ] geometry-to-glyph solver.
- [ ] multi-cell renderer.

### Milestone 11 — interactive editor

- [ ] multi-cell canvas.
- [ ] line/curve/shape tools.
- [ ] automatic glyph solving.
- [ ] manual replacement.
- [ ] Unicode copy/paste.
- [ ] PNG/text/JSON export.

### Milestone 12 — GraphSCII v1

- [ ] final coverage review.
- [ ] freeze codepoint meanings.
- [ ] freeze manifest schema v1.
- [ ] release artifact snapshot.
- [ ] complete programmer/user docs.
- [ ] tag/release v1.

---

## 17. Definition of done for v1

GraphSCII v1 is ready when every assigned visual glyph reproduces from source; one bitmap maps to at most one canonical codepoint; semantic aliases and redirects preserve mathematical meaning; PNG/ASCII artifacts exist; major classes have generated catalogs; JSON fully describes identity/connectivity/fill semantics; atlases cover the vocabulary; a fixed-cell font exists; programs can render through font or canonical bitmap data; neighbor compatibility is mechanically queryable; generation is deterministic; and the codepoint map is ready to be treated as API.

---

## 18. Guiding rule

Prefer designs that make GraphSCII more **systematic, reproducible, queryable, composable, inspectable, programmable, and geometrically expressive per codepoint**.

Generate broadly. Preserve mathematical meaning. Deduplicate globally. Allocate a new codepoint only when new pixels earn the space.
