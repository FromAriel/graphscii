# Milestone 4B — Phase-Locked Straight-Fill Dither Sweep

Status: **COMPLETE — GENERATED, MEASURED, ATLASSED, AND VERIFIED; NO DITHER CODEPOINTS ALLOCATED**

Milestone 4B applies the frozen phase-locked brightness masks to the same mathematical side regions established by Milestone 4A.

The important architectural rule remains unchanged:

```text
832 mathematical straight boundaries
        ↓
side A / side B
        ↓
phase-locked fill mask
        ↓
Bresenham boundary forced ON
        ↓
canonical 8×16 bitmap
        ↓
global exact raster deduplication
```

Dither generation starts from the original mathematical boundary and selected side. It does **not** start from the 1,347 deduplicated solid rasters, because definitions that collapse visually under one fill style may separate under another.

## Frozen style palette

The research sweep contains five total styles:

```text
solid       64/64   100.0%
dense       56/64    87.5%
medium      48/64    75.0%
light       16/64    25.0%
sparse       8/64    12.5%
```

Every non-solid mask is an 8×8 binary pattern phase-locked to cell coordinates:

```text
mask(x, y) = pattern[x, y mod 8]
```

The same local `(x,y)` always sees the same mask bit. The 8×8 mask repeats exactly in the lower half of the 8×16 GraphSCII cell and therefore also remains aligned across neighboring cells.

The exact masks are persisted at:

```text
artifacts/research/dithers/masks.json
spec/straight-fill-dither-research.json
```

## Raw semantic population

Each of the 832 mathematical straight definitions has two selected sides under each of five styles:

```text
832 × 2 × 5 = 8,320 styled semantic candidates
```

Of those, 6,656 are non-solid dither semantics:

```text
1,664 side semantics × 4 dither styles = 6,656
```

All semantics survive visual deduplication.

## Measured global result

```text
styled semantic candidates               8,320
unique styled rasters                    6,500

published straight visuals                 746
novel solid visual owners                1,259
novel dither visual owners               5,077

combined straight + solid + dither       7,082
```

Across the four dither styles:

```text
dither semantics reusing straights         539
dither semantics reusing solid fills       139
same-style duplicate candidates             840
cross-style dither reuses                    61
```

The 5,077 dither owners are globally novel against both the 746 published straight visuals and the 1,259 novel solid owners.

## Per-style exact-dedup result

| Style | Mask | Semantics | Unique rasters | Straight reuse candidates | Solid reuse candidates | Same-style duplicates | Prior-style dither reuse | New visual owners |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| solid | 64/64 | 1,664 | 1,347 | 100 | 0 | 305 | 0 | 1,259 |
| dense | 56/64 | 1,664 | 1,393 | 102 | 81 | 254 | 0 | 1,227 |
| medium | 48/64 | 1,664 | 1,409 | 102 | 54 | 238 | 24 | 1,246 |
| light | 16/64 | 1,664 | 1,466 | 154 | 2 | 180 | 13 | 1,315 |
| sparse | 8/64 | 1,664 | 1,478 | 181 | 2 | 168 | 24 | 1,289 |

Cross-style exact dither reuse observed during canonical owner assignment:

```text
medium → dense            24
light  → dense             2
light  → medium           11
sparse → medium            2
sparse → light            22
```

The registry therefore cannot treat a brightness style as an independent visual namespace. Exact bitmap ownership is global across geometry and appearance.

## Hamming-distance research

Milestone 4B also measures pixel Hamming distance between different styles applied to the **same mathematical boundary and side**.

Adjacent research levels:

| Pair | Exact | ≤1 pixel | ≤2 pixels | Mean distance | Maximum |
|---|---:|---:|---:|---:|---:|
| solid → dense | 181 | 299 | 423 | 7.318510 | 16 |
| dense → medium | 180 | 298 | 418 | 7.332332 | 16 |
| medium → light | 117 | 141 | 175 | 29.292067 | 64 |
| light → sparse | 180 | 298 | 418 | 7.326322 | 16 |

This is useful evidence for Milestone 4C. The largest tonal/geometric jump is between medium and light, while the neighboring pairs on either side often differ by only a few pixels for small regions. That does not by itself choose the palette, but it identifies where visual inspection and vocabulary-cost tradeoffs matter most.

Full pairwise histograms are persisted in:

```text
artifacts/research/dithers/stats.json
spec/straight-fill-dither-research.json
```

## Address-space result

The most important 4B conclusion is numerical:

```text
preferred PUA window capacity         4,096
all-five-style visual vocabulary      7,082
                                      -----
over budget                            2,986
```

Therefore **all five styles cannot be assigned inside the current U+E000..U+EFFF window**.

This is exactly why allocation was deferred. Milestone 4C must now make an explicit palette/address-space decision rather than spending codepoints incrementally.

Available policy directions include:

```text
prune one or more brightness levels
keep some brightness levels renderer-only
expand GraphSCII into another Private Use range
combine palette pruning with an expanded reserve policy
```

No 4B result receives a Unicode codepoint.

## Static research atlases

The deterministic artifact pipeline generates ten atlases:

```text
artifacts/research/dithers/atlases/
├── solid-side-a.png
├── solid-side-b.png
├── dense-side-a.png
├── dense-side-b.png
├── medium-side-a.png
├── medium-side-b.png
├── light-side-a.png
├── light-side-b.png
├── sparse-side-a.png
└── sparse-side-b.png
```

Each atlas contains all 832 mathematical boundaries for one style and one side, in frozen straight candidate order, laid out as 32 columns × 26 rows. The atlas manifest records the dimensions and ordering contract.

## Browser research UI

The prebuilt Geometric Glyph Lab now upgrades the Straight Fill Explorer into a fill+dither explorer.

It provides:

```text
straight definition selector
fill-style selector
atlas-side selector
stroke preview
styled side-A preview
styled side-B preview
exact visual-owner disposition
live 832-definition style/side atlas
```

The existing launcher remains unchanged.

## Reproducible artifacts

`npm run generate` now includes:

```text
npm run generate:dithers
```

which deterministically writes:

```text
artifacts/research/dithers/
├── masks.json
├── stats.json
├── report.md
├── atlases.json
└── atlases/*.png

spec/straight-fill-dither-research.json
```

Verification includes:

```text
npm run verify:dithers
npm run verify:dither-research
```

and both are included in the normal full-project `npm run verify` command.

The verifier freezes:

- the 832 → 746 straight baseline;
- the 1,664 → 1,347 solid-fill baseline;
- all five exact mask definitions and densities;
- eight-row phase repetition;
- all 8,320 styled semantic candidates;
- all per-style and global exact-dedup counts;
- forced boundary preservation;
- global visual-owner uniqueness;
- absence of any new Unicode allocation;
- selected Hamming-distance regression fixtures;
- deterministic research JSON, Markdown, and all ten PNG atlases.

## Next

**Milestone 4C — palette and address-space decision.**

4C now has real data rather than estimates. It should compare useful retained subsets of the five styles, measure their resulting global visual budgets, inspect the generated atlases, and decide whether GraphSCII should stay within one 4,096-slot PUA window or deliberately expand.
