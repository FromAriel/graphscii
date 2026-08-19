# Milestone 3A — Curve Grammar, Rasterizer, and Explorer

Status: **implemented and locally verified**.

Milestone 3A introduces curved boundary research without allocating any new Unicode codepoints.

## Implemented curve grammar

A curve is defined semantically by:

```text
start port
end port
start tangent
end tangent
strength
```

Initial tangent vocabulary:

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

The primitive is a cubic Bézier. P0/P3 are boundary ports; P1/P2 are deterministically derived from the selected local tangents and strength.

## Deterministic rasterization

Curve geometry uses 256 fixed-point subunits per source pixel and 256 deterministic parameter samples. Consecutive samples are rounded to canonical pixel coordinates and connected through the existing Bresenham rasterizer.

The 8×16 bitmap remains visual ground truth.

## Validity checks

The research rasterizer reports invalid curves when it detects:

- coincident/zero-length endpoint geometry,
- sampled geometry escaping the canonical cell,
- missing endpoint pixels,
- unintended boundary pixels,
- disconnected raster output,
- sampled self-intersection.

Same-edge curves (LL/RR/TT/BB) are permitted when they satisfy the same rules.

## Exact straight reuse

Every valid curve raster is compared against all 746 published straight bitmap keys.

An exact match resolves to the existing straight visual owner and codepoint. The curve geometry remains semantically available for future derived operations such as side filling.

Representative regression fixture:

```text
curve L8 → R8
start tangent normal
end tangent normal
strength normal

bitmap 0000000000000000ff00000000000000
visual owner U+00E088
```

Representative novel fixture:

```text
curve L8 → R8
start tangent hard-left
end tangent hard-left
strength normal

bitmap 0000000000000060fb06000000000000
visual disposition novel-curve
codepoint none
```

No new curve codepoint is assigned in Milestone 3A.

## Browser explorer

The existing browser lab now mounts a separate **Single-curve explorer** above the straight atlas. It lets the user choose all five curve parameters and immediately see:

- canonical 8×16 raster,
- ASCII bitmap,
- stable curve alias key,
- bitmap key,
- P0/P1/P2/P3,
- validity status and reasons,
- exact straight-owner reuse when applicable,
- novel/unallocated status otherwise.

The explorer is included both in Vite source mode and in the prebuilt `dist/` used by `run.cmd`.

## Verification

Run:

```powershell
npm run check
npm run verify:curves
```

`verify:curves` preserves the straight `832 → 746` fixture, asserts fixed-point/sample constants, validates exact straight reuse, freezes a representative novel raster, checks deterministic repeated rasterization, confirms same-edge support, and checks coincident-corner rejection.

## Next

Milestone 3B is the broad curve sweep: generate the planned endpoint/tangent/strength candidate space, reject invalid geometry, deduplicate curves against straights and other curves, measure near-duplicates separately, and produce research statistics/atlases without allocating codepoints yet.
