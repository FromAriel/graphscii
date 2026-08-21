# Milestone 5A.1 — Straight-Composition Junction Demand Map

Status: **COMPLETE — ALLOCATION-FREE DEMAND MODEL MEASURED AND FULL-CHAIN VERIFIED**

Milestone 5A.1 answers the first reserve-budget question before any junction raster is allocated:

> Where does the existing GraphSCII straight language actually need junction capability?

The answer is derived from the authoritative 832 straight mathematical definitions, not from a hand-curated list of familiar junction shapes.

## Demand model

Every unordered pair of straight definitions is tested with exact rational segment intersection arithmetic. Only strict interior intersections are retained.

At each exact intersection, each participating straight contributes two selectable **rays** from the hub to its boundary ports. For two- and three-straight source compositions, every 3-ray and 4-ray subset is considered. A demand event is retained only when it has exactly one port on each participating cell edge and belongs to one of:

```text
LRT
LRB
LTB
RTB
LRTB
```

This selectable-ray formulation is important. An earlier diagnostic formulation treated each straight as an indivisible two-ended segment and therefore produced only four-port crossings. That diagnostic output was rejected before the milestone was frozen because it systematically omitted T/Y junction demand.

Semantic identity is the sorted boundary-port tuple. Exact mathematical hub positions are retained as demand metadata rather than multiplying the semantic universe.

## Frozen measurements

```text
straight mathematical definitions              832
straight visual owners                         746
unordered straight pairs examined          345,696
strict interior intersecting pairs          129,550
exact mathematical hub positions            70,707

pair source compositions with demand        105,546
pair-derived demand events                  257,082

concurrent straight triples examined         92,190
triple source compositions with demand       81,310
triple-derived demand events                671,160

unique demanded port semantics               22,428
theoretical one-port/edge semantics          22,528
coverage                                      99.556108%
total weighted demand events                928,242
```

No junction codepoints were allocated:

```text
junction allocations      0
protected reserve       604
reserve range      U+F6A4..U+F8FF
```

## Topology coverage

```text
Topology   demanded semantics   theoretical   weighted demand
LRT                    2,048         2,048           263,632
LRB                    2,048         2,048           263,632
LTB                    1,024         1,024           141,488
RTB                    1,024         1,024           141,488
LRTB                  16,284        16,384           118,002
```

All **6,144 three-port semantics** are represented by the measured straight-composition language.

Only **100 four-port semantics** receive zero demand under this model. They are persisted in `blind-spots.json` and are explicitly treated as breadth-protection candidates, not rejected junctions. Later optimization must be able to spend a slot on a structurally useful blind spot even when its observed demand is zero.

## Hub distribution

The exact mathematical center is:

```text
(3.5, 7.5)
```

It is the single highest-demand exact hub:

```text
intersecting straight pairs       366
junction demand events         35,982
share of total demand          3.876360%
```

That is a meaningful hotspot, but it is nowhere near a majority of junction demand. The result strongly supports the coverage-first plan: a center-only junction vocabulary would overfit one hotspot and miss the much broader spatial demand field.

The next strongest exact hubs include symmetric locations around the center such as `(4.666667, 10)`, `(4.666667, 5)`, `(2.333333, 10)`, and `(2.333333, 5)`, each with 5,151 measured demand events.

The generated 4×4 hub-zone map preserves the broader spatial distribution for later Pareto optimization.

## Coverage taxonomy

Each demand event contributes to deterministic coverage buckets for:

```text
topology
exact boundary port
normalized 4-band edge position
exact mathematical hub
4x4 hub zone
16 branch-angle sectors
pairwise angular separation
shape character
symmetry/orientation class
```

This means the later budget optimizer can distinguish between:

```text
high raw demand
wide topology coverage
wide port coverage
wide spatial coverage
wide angular coverage
```

rather than collapsing everything into one frequency number.

## Persistent artifacts

```text
artifacts/research/junctions/
├── demand-map.json
├── hub-density.json
├── coverage-buckets.json
├── blind-spots.json
├── stats.json
└── report.md

spec/junction-coverage-research-v0.json
```

The demand map is generated from the frozen straight-language semantics and is deterministic. The verifier freezes every headline measurement above and also requires every topology to remain represented.

`blind-spots.json` independently enumerates all 22,528 theoretical one-port-per-edge semantics and proves that the measured demand set contains 22,428 of them, with the 100 missing semantics all in `LRTB`.

## Permanent commands

From `geometric-glyph-lab/`:

```powershell
npm run generate:junction-demand
npm run verify:junction-demand
npm run generate:junction-blind-spots
npm run verify:junction-blind-spots
```

All four commands are integrated into the aggregate generation and verification pipeline.

## Result

Milestone 5A.1 is complete without spending a single reserve slot.

The central finding is that the existing straight language induces an extremely broad junction demand space: **99.556% of the theoretical one-port-per-edge grammar appears naturally**, while demand itself is spatially distributed rather than center-dominated.

The next slice is **Milestone 5A.2 — deterministic junction raster and hub-model sweep**. It will measure how well mathematical-intersection hubs, the symmetric half-pixel center, and the central 2×2 hub kernel convert this demand space into distinct valid 8×16 junction rasters before any codepoint budget is chosen.
