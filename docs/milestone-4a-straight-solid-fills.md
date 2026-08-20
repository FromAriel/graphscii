# Milestone 4A — Straight Solid Half-Fills

Status: **IMPLEMENTED ON RESEARCH BRANCH; NO NEW CODEPOINTS ALLOCATED**

Milestone 4A derives solid filled geometry directly from the published straight mathematical definitions.

## Construction

The authoritative input remains all 832 straight mathematical definitions, not only the 746 deduplicated stroke owners.

Each oriented line produces two semantic fills:

```text
straight boundary
├── side A solid
└── side B solid
```

For every canonical pixel center `(x,y)`, the implementation evaluates the oriented integer cross product against the mathematical line connecting the two port pixel centers:

```text
cross = (x2-x1)(y-y1) - (y2-y1)(x-x1)

cross > 0 → side A
cross < 0 → side B
```

The existing Bresenham stroke is cloned first and is therefore forced ON in both output fills.

This keeps the boundary crisp while allowing the selected side to become a solid region.

## Measured result

```text
straight mathematical definitions       832
semantic side-fill candidates          1664
unique fill rasters                    1347

fill candidates reusing a straight      100
straight visuals reused                  88
fill candidates reusing earlier fill    305
new fill visual owners                 1259

published straight visuals              746
combined straight + solid visuals      2005
```

The full block emerges automatically from `LR L0→R0 side A`, while the complementary side B reuses the published top horizontal straight glyph `U+00E000`.

No codepoints are allocated to the 1,259 new fill visuals in this milestone.

## Global visual ownership

The same global GraphSCII rule applies:

```text
one bitmap key → at most one canonical visual owner
```

Every side-fill semantic record is classified as one of:

```text
reuse-existing-straight
reuse-existing-fill
new-fill-unallocated
```

The semantic fill definition is preserved even when its pixels reuse an existing visual owner.

## Browser research UI

The lab gains a Straight Fill Explorer that lets the user choose any of the 832 mathematical straight definitions and inspect:

```text
stroke
fill side A
fill side B
```

The panel also reports the measured global counts and whether each selected fill reuses a published straight, reuses an earlier fill visual, or is a new unallocated fill visual.

## Regression fixture

`npm run verify:fills` freezes the exact counts above and additionally verifies:

- the 832 → 746 straight baseline remains unchanged;
- every fill preserves every boundary stroke pixel;
- every stored bitmap key matches the generated bitmap;
- the full block emerges deterministically;
- `L0→R0 side B` resolves to `U+00E000`;
- the bottom complementary full-block definition reuses the first fill visual;
- fill alias accounting is complete.

The machine-readable fixture is `spec/straight-fill-solid-research.json`.

## Next

Milestone 4B applies the phase-locked dither palette to the same 1,664 semantic side regions:

```text
final = boundary-stroke OR (selected-side-region AND dither-mask)
```

The next measurement decides the actual cost of brightness/texturing after global exact deduplication.
