# Milestone 5 — Junction Coverage and Reserve-Budget Strategy

Status: **IN PROGRESS — 5A.1 + 5A.2 COMPLETE; 5A.3 NEXT**

Milestone 5 extends `graphscii-graphics-v0` with junction capability without treating the remaining 604 BMP PUA slots as free space to fill. The primary objective is **widest useful junction coverage per encoded codepoint**.

The core question is:

> Where does the existing GraphSCII line language actually need junctions most, and what smallest encoded junction basis covers the widest useful drawing space?

Milestone 5 therefore begins with research only. No new codepoints are allocated until measured coverage curves justify a budget.

## 1. Frozen input

Milestone 5 consumes the completed Milestone 4 publication without changing it:

```text
publication                 graphscii-graphics-v0
encoded graphics            5,796
allocated PUA               U+E000..U+F6A3
protected reserve           U+F6A4..U+F8FF
protected reserve slots        604
straight semantic inputs       832
straight visual owners         746
```

Hard rule for all 5A research:

```text
new junction allocations = 0
```

Any candidate bitmap already present in `graphscii-graphics-v0` is a zero-cost exact reuse. Every novel junction remains research-only until a later allocation gate.

## 2. Coverage-first principle

Junctions are not selected by visual intuition, generation order, or raw frequency alone.

The optimizer must balance two goals:

1. **Demand coverage** — cover the junction configurations that naturally arise most often when the existing straight language is composed.
2. **Geometric breadth** — avoid spending the whole budget on one dense central cluster while leaving major topology, port, hub-location, and angle regions unsupported.

The final recommendation must therefore report both total weighted coverage and worst/under-covered regions.

## 3. Derive junction demand from the existing straight language

The primary demand universe is generated from the authoritative **832 straight mathematical definitions**, not merely the 746 deduplicated straight bitmaps.

### 3.1 Straight-composition demand map

Enumerate compatible combinations of existing straight definitions whose mathematical segments intersect within one canonical 8x16 cell.

For each composition:

```text
straight definition A
+ straight definition B
(+ optional straight definition C)
        ↓
interior intersection / common hub
        ↓
union of unique boundary ports
        ↓
3-port or 4-port junction demand instance
```

Retain compositions that produce exactly three or four unique boundary ports and a valid interior meeting region.

Each resulting semantic junction records a **demand multiplicity**: the number of distinct existing straight-language compositions that require that junction configuration.

This creates an empirical map of where GraphSCII needs junctions rather than assuming that every theoretical port tuple is equally important.

### 3.2 Hub-demand field

Do not assume that the center of the cell is automatically the most useful hub.

Measure the intersection density of the existing straight language across the cell, including subpixel mathematical intersections before rasterization.

Produce:

```text
hub demand by exact/subpixel position
hub demand by raster pixel
hub demand by coarse spatial zone
hub demand by topology
```

The research should answer whether useful junction demand is strongly center-weighted or whether significant demand exists away from the center.

### 3.3 Full theoretical comparison universe

In parallel, retain the simple one-port-per-edge theoretical grammar as a coverage reference.

Ports:

```text
L = 16
R = 16
T =  8
B =  8
```

Three-port edge sets:

```text
LRT     16 × 16 × 8      = 2,048
LRB     16 × 16 × 8      = 2,048
LTB     16 × 8 × 8       = 1,024
RTB     16 × 8 × 8       = 1,024
                              -----
                              6,144
```

Four-port edge set:

```text
LRTB    16 × 16 × 8 × 8 = 16,384
```

Total theoretical one-port-per-edge semantics:

```text
22,528
```

This theoretical universe is not a frequency model. It is used to measure breadth and identify blind spots in the demand-derived candidate population.

## 4. Coverage dimensions

Every valid junction semantic must be tagged with a coverage vector so selection can be evaluated beyond raw count.

Required dimensions:

```text
topology class
  LRT / LRB / LTB / RTB / LRTB

hub location
  exact mathematical position
  raster hub pixels
  coarse spatial zone

edge participation
  which cell edges are used

port coverage
  exact boundary ports
  normalized port bands along each edge

branch direction
  angle sector from hub
  pairwise angular separation

shape character
  T-like
  Y-like
  cross-like
  X-like
  mixed-angle
  strongly asymmetric
  near-degenerate

symmetry/orientation class
straight-composition demand multiplicity
exact graphics-v0 reuse versus novel bitmap
```

Port-band coverage prevents the optimizer from selecting hundreds of visually similar center-entry junctions while ignoring useful high/low/left/right routing regions.

## 5. Junction geometry research

Milestone 5A must not freeze a single hub/raster model before measurement.

Candidate geometry models should include at least:

### Model A — mathematical intersection hub

Use the actual intersection point implied by the composing straight semantics. Spokes are rasterized deterministically from each requested boundary port to that mathematical hub.

This is the primary model because it measures closure of the existing straight language directly.

### Model B — symmetric half-pixel center hub

```text
x = 3.5
y = 7.5
```

This measures a deliberately regular center-junction vocabulary.

### Model C — central 2x2 hub kernel

```text
x = 3,4
y = 7,8
```

This tests whether a slightly thicker symmetric hub improves connectivity or visual recognition enough to justify its raster behavior.

The report must compare the models rather than selecting one by intuition.

## 6. Validity gates

Every accepted junction candidate must satisfy:

```text
canonical dimensions = 8x16
all declared boundary ports are ON
no undeclared boundary ports are ON
foreground is connected
hub connects to every requested spoke
deterministic bitmap serialization
```

Also measure near-degeneracy, including spokes that overlap for most of their length before separating. Such semantics may remain valid but should receive a lower distinctiveness score.

## 7. Global exact dedup

All junction candidates pass through the existing global bitmap identity rule:

```text
junction semantic
      ↓
rasterize
      ↓
bitmap already in graphics-v0?
      ├── yes → encoded exact reuse; cost 0
      └── no
           ↓
       earlier junction owns bitmap?
           ├── yes → semantic alias; cost 0
           └── no  → novel junction visual candidate
```

One novel bitmap can therefore cover many semantic junction demands.

The optimizer works on **visual owners with attached semantic-demand sets**, not on semantic rows independently.

## 8. Coverage optimization

The selection problem is a budgeted set-coverage problem.

For each candidate visual owner, calculate the semantic demand instances and geometric coverage buckets it represents exactly.

Produce three optimization views:

### A. Demand-maximizing curve

Select glyphs that maximize weighted straight-composition demand coverage.

This answers:

> If we only cared about where the current line language needs junctions most often, what would we encode?

### B. Breadth-maximizing curve

Weight topology, hub zones, port bands, and angle classes approximately uniformly.

This answers:

> If we cared primarily about covering the widest geometric territory, what would we encode?

### C. Balanced Pareto curve

Find candidate sets that retain high demand coverage while maximizing the least-covered important geometric buckets.

Do not hide the tradeoff inside one arbitrary scalar weight. Publish the Pareto frontier between demand coverage and breadth coverage.

The final 5A recommendation should come from the balanced frontier unless a clearly dominant solution exists.

## 9. Budget sweep

Evaluate the coverage curve for every budget from 0 through the full protected reserve:

```text
K = 0..604 novel junction owners
```

Highlight these checkpoints for human review:

```text
64
128
192
256
320
384
448
512
604
```

For every K report:

```text
novel codepoints hypothetically consumed
remaining reserve
weighted demand coverage
unique semantic coverage
3-port coverage
4-port coverage
hub-zone coverage
port-band coverage
angle-class coverage
worst major coverage bucket
marginal coverage gained by the Kth slot
```

The optimizer must identify the **coverage knee**: the point after which additional codepoints produce sharply diminishing gains.

Milestone 5A does not automatically recommend spending to the knee if that would leave inadequate room for terminals, specials, or later curated geometry. It reports the tradeoff explicitly.

## 10. Reserve policy

The 604 slots are the absolute current capacity, not the default junction budget.

5A must publish recommendations under several reserve-retention scenarios, including at least:

```text
keep 412 slots → junction budget 192
keep 348 slots → junction budget 256
keep 284 slots → junction budget 320
keep 220 slots → junction budget 384
```

The report should state what additional coverage each larger junction budget buys so the later allocation decision is evidence-based.

No 5A step changes `U+F6A4..U+F8FF` allocation state.

## 11. Research artifacts

Planned outputs:

```text
artifacts/research/junctions/
├── demand-map.json
├── hub-density.json
├── candidates.json
├── unique-rasters.json
├── exact-reuse.json
├── classifications.json
├── coverage-buckets.json
├── budget-curves.json
├── pareto-frontier.json
├── stats.json
├── report.md
└── atlases/
    ├── demand-hotspots.png
    ├── three-port-samples.png
    ├── four-port-samples.png
    ├── hub-model-comparison.png
    └── selected-budget-samples.png

spec/
└── junction-coverage-research-v0.json
```

The report must make it visually obvious **where junction demand is concentrated** and **which geometric regions remain uncovered at each practical budget**.

## 12. Execution slices

```text
5A.1  straight-composition demand map + coverage taxonomy       COMPLETE
5A.2  deterministic raster + generic 600-lattice sweep           COMPLETE
5A.3  exhaustive candidate generation + global exact dedup       NEXT
5A.4  demand/breadth/Pareto budget optimization, K=0..604
5A.5  research atlases + measured recommendation

5B    selected junction budget/allocation decision
5C    junction registry + provisional codepoint allocation
5D    canonical junction artifacts + master atlas integration
5E    graphics publication update + reserve accounting
```

## 13. Current execution state

### 5A.1 — COMPLETE

The straight-composition demand map measured 22,428 of 22,528 theoretical one-port-per-edge junction semantics (99.556108%) with 928,242 weighted demand events. All 6,144 three-port semantics occur; the 100 zero-demand blind spots are four-port LRTB breadth-protection cases.

### 5A.2 — COMPLETE

Boundary-safe inward ingress removes accidental neighboring edge activation. All 22,428 demanded semantics pass every validity gate under all four tested raster models.

The 600-entry generic theory is now a first-class optimization input:

```text
strategy                      exact demand   avg breadth Δ   p95 breadth Δ
pure demand-top                 21.358223%       0.560884        1.000000
even topology-balanced          15.088953%       0.204765        0.400000
even space-proportional          7.981755%       0.163349        0.285714
hybrid even + demand            17.255414%       0.174906        0.285714
```

The pure frequency list leaves severe four-port coverage holes. The even lattice dramatically improves geometric breadth, and the hybrid retains much of that breadth while recovering substantial measured demand. The next optimizer therefore carries both empirical demand and generic evenly spaced coverage.

Completion note: [`docs/milestone-5a2-generic-lattice.md`](docs/milestone-5a2-generic-lattice.md)

### 5A.3 — NEXT

Exhaustively materialize boundary-safe junction candidates from the measured semantic universe and geometry models, globally exact-deduplicate them against `graphscii-graphics-v0` and one another, attach both demand and generic-lattice coverage sets to every visual owner, and produce the owner population that 5A.4 will optimize across budgets 0..604.

## 14. Guiding rule

> **Spend junction codepoints on coverage, not on enumeration.**

A good encoded junction basis is the smallest set of visual owners that makes the existing GraphSCII geometry substantially more composable across the widest useful range of local drawing situations.
