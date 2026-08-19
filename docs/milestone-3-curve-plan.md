# Milestone 3 — Curve Generation and Global Raster Dedup Plan

Status: **PLANNED — NEXT IMPLEMENTATION MILESTONE**

This milestone adds curved boundary primitives to GraphSCII without wasting codepoints on curves that rasterize identically to existing straight glyphs or to other curves.

The central invariant is:

> **One canonical 8×16 bitmap gets at most one visual glyph/codepoint, regardless of how many mathematical shape definitions produce it.**

A curve definition may therefore be semantically new while visually reusing an existing straight glyph. The mathematical definition must still be preserved because later operations — especially filling one side or the other — may produce different rasters even when the thin stroke does not.

---

## 1. Goals

Milestone 3 must answer empirically:

1. How many mathematically useful curve definitions can be generated inside one 8×16 cell?
2. How many are invalid because they escape the cell, touch unintended boundaries, self-intersect, or otherwise violate the simple-boundary model?
3. How many curve strokes rasterize exactly like one of the existing 746 straight glyphs?
4. How many different curve definitions collapse to the same curve raster?
5. How many genuinely new 8×16 curve rasters remain?
6. How visually distinct are those new rasters from the existing straight vocabulary?
7. How many new Unicode slots would be required if we retained all useful novel curve rasters?

No new curve codepoints should be frozen until those measurements exist.

---

## 2. Global visual-dedup rule

GraphSCII must maintain a single global bitmap registry across shape classes.

For every generated curve candidate:

```text
mathematical curve definition
          ↓
deterministic 8×16 raster
          ↓
32-hex-character bitmap key
          ↓
GLOBAL BITMAP LOOKUP
```

Resolution order:

```text
1. bitmap already owned by a straight glyph
      → reuse existing straight glyph/codepoint

2. bitmap already seen from an earlier curve definition
      → reuse that curve visual raster

3. bitmap never seen before
      → create a novel curve visual record
         (unallocated during research)
```

A bitmap match is exact. Similarity is not deduplication.

The existing straight allocation `U+00E000..U+00E2E9` must not move merely because curves are added.

---

## 3. Semantic curve definitions must survive visual dedup

Visual dedup must **not** delete mathematical curve geometry.

Suppose:

```text
curve A raster == straight glyph U+00E042
```

The curve candidate should remain in semantic data and resolve like:

```json
{
  "aliasKey": "curve:...",
  "visualDisposition": "reuse-existing-straight",
  "canonicalGlyphId": 66,
  "canonicalCodepoint": "U+00E042",
  "canonicalClass": "straight-lines",
  "bitmapMatch": "exact"
}
```

A program asking for that mathematical curve can therefore be told:

```text
requested geometry: curve alias X
render using:        U+00E042
reason:              exact bitmap reuse
```

This is the background-data redirect requested for shapes that do not need a new codepoint.

The curve record still retains its endpoints, tangents, curvature parameters, control points, and orientation.

This is essential for the later generic fill operation. Two mathematical boundaries can share the same thin raster yet produce different side-filled rasters.

---

## 4. Curve representation

The initial curve primitive should be a **cubic Bézier boundary**:

```text
P0 = start boundary port
P1 = start control point
P2 = end control point
P3 = end boundary port
```

The authored grammar should be semantic rather than raw-control-point-first:

```text
start port
end port
start tangent class
end tangent class
curvature / handle-strength class
```

Control points are derived deterministically from those parameters.

The complete derived control points must also be stored in the generated semantic record so the exact mathematical curve can be reproduced later.

---

## 5. Endpoint coverage

Curves should cover more topology than straight lines.

The initial sweep should consider every pair of distinct GraphSCII boundary ports, including:

```text
opposite edge
    LR
    TB

adjacent edge
    LT
    LB
    RT
    RB

same edge
    LL
    RR
    TT
    BB
```

There are 48 semantic boundary ports. All unordered distinct pairs give:

```text
C(48,2) = 1128 endpoint pairs
```

Some semantic ports share the same geometric corner pixel, for example `L0` and `T0`. Coordinate-identical endpoint pairs are degenerate and should be rejected explicitly rather than silently producing zero-length curves.

Same-edge curves are important because they create arches, bumps, cups, rounded returns, and other geometry impossible in the current straight vocabulary.

---

## 6. Tangent grammar

Tangents should be stored in **travel direction**:

- the start tangent points from the start boundary into the cell,
- the end tangent points from inside the cell out through the end boundary.

This makes neighbor continuity natural: an outgoing tangent from one cell can directly match the incoming tangent of its neighbor.

The first research sweep should use a small rational tangent vocabulary relative to the boundary normal:

```text
hard-left     approximately -45°
soft-left     approximately -26.565°
normal          0°
soft-right    approximately +26.565°
hard-right    approximately +45°
```

These can be represented with integer direction ratios rather than arbitrary floating angles:

```text
1:1
1:2
0:1
1:2 mirrored
1:1 mirrored
```

The exact edge-relative vector table becomes part of the curve grammar specification once verified.

A future milestone can add more tangent classes if real drawings reveal a coverage hole. The first sweep should prefer a systematic compact tangent basis over arbitrary angle proliferation.

---

## 7. Curvature / handle strengths

Initial research strengths:

```text
tight
normal
gentle
```

The strength controls Bézier handle length while the tangent class controls direction.

Exact handle-length constants should be deterministic and stored in the curve grammar specification. They should be quantized to GraphSCII fixed-point geometry rather than left as UI-only floating values.

The first implementation should make these constants easy to change while preserving a versioned grammar ID so experiments remain reproducible.

With roughly 1124 nondegenerate endpoint pairs, five tangent choices at each endpoint, and three strengths, the broad initial sweep is on the order of:

```text
~1124 × 5 × 5 × 3
≈ 84,300 mathematical candidates
```

This is an upper-bound research pool before geometric validity filtering and deduplication, not a proposed Unicode allocation.

---

## 8. Deterministic curve geometry and rasterization

Curves must rasterize identically in the browser, Node verification, and artifact generation.

Recommended implementation:

```text
fixed-point geometry
256 subunits per source pixel
```

Control points are quantized to fixed-point coordinates before rasterization.

For cubic flattening, use deterministic repeated subdivision at `t = 1/2` rather than browser-dependent canvas stroking or anti-aliasing.

A simple first contract:

```text
8 binary subdivision levels
→ 256 small polyline segments
→ quantize segment points to canonical pixel coordinates
→ connect consecutive pixels with existing Bresenham rasterizer
```

No anti-aliasing. The output remains a binary 8×16 bitmap and therefore uses the same bitmap-key/dedup machinery as straight lines.

The exact subdivision/rounding contract must be documented before curve codepoints are allocated.

---

## 9. Validity filters

Not every mathematical cubic should become a GraphSCII boundary candidate.

Initial candidates should be rejected with an explicit machine-readable reason when they violate the simple-boundary model.

Reject at least:

```text
coordinate-identical endpoints
curve leaves the canonical cell interior
curve exits and re-enters the cell
self-intersecting / looping curves
raster is disconnected
raster touches unintended boundary pixels
raster does not contain both declared endpoint pixels
```

For the first curve vocabulary, the only lit boundary pixels should normally be the declared connection ports. This keeps seam semantics simple and mechanically queryable.

If useful future geometry requires multi-pixel boundary spans, that should be introduced deliberately as a later semantic extension rather than appearing accidentally from shallow tangents.

Every rejected candidate should remain countable by rejection reason in research statistics.

---

## 10. Direction and reversal

Stroke geometry is visually direction-independent, but orientation must still be preserved semantically because fill-side meaning later depends on travel direction.

Each curve definition stores a canonical orientation:

```text
start port → end port
```

The reverse query should resolve to the same canonical visual glyph with:

```text
reversed: true
```

When generic boundary fill is added later, reversing a boundary also swaps its left/right (A/B) fill interpretation.

Do not erase direction merely because the stroke bitmap is symmetric under reversal.

---

## 11. Curve alias identity

Curve definitions need stable semantic identities independent of Unicode allocation.

A key should encode the complete authored grammar, conceptually:

```text
curve:<start>><end>:ts=<startTangent>:te=<endTangent>:k=<strength>
```

Example shape only:

```text
curve:L8>B4:ts=normal:te=soft-left:k=normal
```

The exact punctuation can be chosen once and then versioned.

Stable curve alias IDs let programs refer to mathematical geometry even when:

- its stroke reuses a straight glyph,
- several curves share one curve glyph,
- provisional codepoints later move,
- its filled variants become distinct glyphs.

---

## 12. Canonical-render resolution fields

Every accepted mathematical curve should expose a render-resolution object.

During research:

```text
reuse-existing-straight
reuse-existing-curve
new-raster-unallocated
```

After provisional curve allocation:

```text
reuse-existing-straight
reuse-existing-curve
authorized-curve-glyph
```

Recommended generated fields:

```json
{
  "visualDisposition": "reuse-existing-straight",
  "canonicalBitmapKey": "...",
  "canonicalGlyphId": 66,
  "canonicalCodepoint": "U+00E042",
  "canonicalClass": "straight-lines",
  "exactBitmapMatch": true
}
```

For a novel unallocated raster, `canonicalGlyphId` and `canonicalCodepoint` remain null until the allocation decision.

The default renderer always uses the canonical glyph/codepoint. GraphSCII should not allocate duplicate codepoints merely to distinguish semantic classes that have identical pixels.

---

## 13. Dedup and analysis pipeline

The research pipeline should be:

```text
curve grammar candidate
        ↓
geometry validity checks
        ↓
deterministic curve raster
        ↓
bitmap key
        ↓
compare against straight-v0 bitmap index
        ↓
compare against previously seen curve rasters
        ↓
classify disposition
        ↓
novelty / coverage statistics
```

Statistics must include at least:

```text
raw mathematical candidates
accepted mathematical candidates
rejected candidates by reason
exact straight collisions
curve-to-curve duplicate aliases
novel curve rasters
novel rasters by endpoint family
novel rasters by tangent pair
novel rasters by curvature strength
maximum aliases per curve raster
projected total glyph count if all novel rasters were allocated
```

---

## 14. Near-duplicate analysis

Exact raster equality is the only automatic dedup rule, but the research report should also measure visual novelty.

For every novel curve raster, record the Hamming distance to its nearest existing straight raster and, later, to other selected curve rasters.

Suggested report buckets:

```text
0 pixels different   exact dedup — reuse existing glyph
1 pixel different    extremely near
2–3 pixels           near
4+ pixels            clearly distinct at 8×16 scale
```

Do **not** automatically discard 1-pixel-different curves during the first research pass. Preserve them and let atlas inspection plus coverage analysis determine whether they deserve scarce codepoint space.

This separates objective exact deduplication from later vocabulary-selection judgment.

---

## 15. No curve codepoints in the first research slice

The first curve implementation should not immediately assign tens of thousands of candidates to Unicode.

Straight glyphs remain:

```text
U+00E000..U+00E2E9
```

Only after we know the novel curve-raster count and inspect the atlas do we decide which curve visuals deserve allocation.

If selected novel curve glyphs are allocated contiguously, the first available provisional codepoint is currently:

```text
U+00E2EA
```

Curves whose pixels already exist never consume a new slot.

---

## 16. Global codepoint ownership policy

GraphSCII should treat codepoints as identities of **canonical visual bitmaps**, not semantic shape classes.

Policy:

1. one bitmap key → at most one canonical glyph/codepoint,
2. the earliest allocated visual owner keeps the codepoint,
3. later shape classes attach semantic aliases to that visual owner,
4. semantic aliases retain all geometry needed for future derived operations,
5. exact visual reuse never consumes another Unicode slot.

This policy should eventually apply to curves, fills, junctions, arcs, textures, and every later class.

---

## 17. Browser research UI

Before allocating curve codepoints, the lab should make the empirical results easy to inspect.

Add filters for:

```text
all curve candidates
novel curve rasters
matches existing straight
curve-to-curve duplicates
rejected geometry
same-edge curves
adjacent-edge curves
opposite-edge curves
```

A selected curve should show:

```text
mathematical alias key
start / end ports
start / end tangent classes
curvature strength
derived control points
8×16 raster
bitmap key
validity status
visual disposition
canonical glyph/codepoint when reused
nearest straight raster + Hamming distance
all curve aliases sharing this raster
```

A useful visual mode should overlay the straight chord and the mathematical curve so we can see when a mathematically curved path is visually indistinguishable at 8×16.

---

## 18. Research artifacts

Milestone 3 research should generate reproducible artifacts before publication:

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

These are research outputs, not automatically part of the final Unicode vocabulary.

Once a curve set is selected, the normal artifact pipeline can generate canonical per-glyph PNG/ASCII, manifest records, indexes, a `curves.md` class catalog, atlases, and publication provenance.

---

## 19. Verification requirements

The curve verification suite must prove:

- the published straight-v0 snapshot remains unchanged,
- the curve grammar version is explicit,
- candidate generation order is deterministic,
- every accepted curve raster is a valid 8×16 binary bitmap,
- every rejected candidate has a deterministic rejection reason,
- every exact straight collision resolves to the existing straight glyph/codepoint,
- no exact bitmap is allocated twice,
- every curve-to-curve duplicate resolves to one canonical curve visual,
- every curve alias retains complete mathematical geometry,
- reverse queries resolve to the same stroke visual with `reversed: true`,
- endpoint and tangent metadata are internally consistent,
- research artifacts reproduce byte-for-byte where practical.

After codepoint allocation begins, additionally verify that no curve allocation overwrites or moves the existing straight range.

---

## 20. Milestone 3 implementation slices

### 3A — curve grammar + deterministic rasterizer

Deliver:

```text
versioned curve grammar
all endpoint topology classes
five initial tangent deviations
three initial strengths
fixed-point cubic representation
deterministic cubic subdivision/rasterizer
validity filters
unit/regression tests
interactive single-curve explorer
```

No new Unicode codepoints.

### 3B — broad generation + global dedup research

Deliver:

```text
tens-of-thousands candidate sweep
straight-v0 exact collision detection
curve-to-curve deduplication
canonical render-resolution metadata
rejection statistics
near-duplicate/Hamming analysis
research JSON reports
novel and collision atlases
```

Still no new Unicode codepoints.

### 3C — coverage selection + provisional curve allocation

After inspecting 3B results:

```text
choose the useful novel curve raster set
assign provisional new glyph IDs/codepoints only to selected novel rasters
keep exact-straight matches as semantic redirects
keep curve duplicate aliases on their canonical visual
add curve query indexes
integrate curve filter into main atlas
```

The first possible new codepoint is currently `U+00E2EA`, but the number allocated is determined empirically.

### 3D — curve artifacts + publication

Deliver:

```text
canonical PNG/ASCII for allocated curve glyphs
curves.md generated class catalog
combined manifest/indexes
combined atlas
curve-v0 publication provenance
full generation + verification snapshot
```

---

## 21. What happens after curves

Once straight and curved boundary definitions exist, GraphSCII should implement a **generic boundary-fill operation**, not a separate hand-authored solids vocabulary.

Input:

```text
any straight boundary alias
any curve boundary alias
```

Output:

```text
stroke
fill side A
fill side B
```

Crucially, the fill generator operates on the preserved **mathematical boundary definitions**, not only on canonical stroke glyphs.

Therefore a curve whose stroke reuses an existing straight codepoint can still create a distinct filled raster later.

Filled results then go through the same global bitmap deduplication and canonical-codepoint reuse policy.

This is expected to generate progressive fills, slopes, wedges, rounded solid boundaries, silhouette fragments, and many other “solid pieces” as consequences of one boundary system rather than independent shape grammars.

---

## 22. Decision gate before allocation

Milestone 3B ends with a deliberate decision rather than automatic codepoint assignment.

We inspect:

```text
how many novel curve rasters exist
how many collide exactly with straights
how many are visually near-duplicates
which tangent/strength classes materially improve coverage
how many slots remain for filled boundaries, junctions, textures, and special geometry
```

Only then do we allocate the curve subset.

The rule remains:

> Generate broadly. Preserve mathematical meaning. Deduplicate globally. Allocate codepoints only for new visual information that earns the space.
