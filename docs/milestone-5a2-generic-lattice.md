# Milestone 5A.2 — Junction Geometry and Generic 600-Lattice Sweep

Status: **COMPLETE — ALLOCATION-FREE**

Milestone 5A.1 established that straight-composition demand is broad rather than concentrated in one small region: 22,428 of the 22,528 theoretical one-port-per-edge junction semantics receive measured demand, and the exact half-pixel center accounts for only a small share of total demand.

5A.2 therefore tested a second hypothesis alongside empirical demand search:

> A compact junction vocabulary may work better as an evenly distributed generic connector basis than as a list of only the hottest measured junctions.

The result supports keeping that generic theory as a first-class optimization baseline. No codepoint was allocated in this slice; all 604 reserve slots remain protected.

## Working 600-slot experiment

The research uses **600 semantic connector slots** as a working budget and deliberately leaves four of the 604 reserve slots outside the experiment.

The 600 are not assigned Unicode values. They are research selections used to compare coverage, raster identity, exact reuse, and nearest-port routing distance.

## Dyadic edge-port order

Instead of simply taking port indices numerically, each edge is visited in an evenly spreading order:

```text
16-port edge:
0, 15,
7, 8,
3, 4, 11, 12,
1, 2, 5, 6, 9, 10, 13, 14

8-port edge:
0, 7,
3, 4,
1, 2, 5, 6
```

Conceptually:

```text
extremes
  ↓
middle pair
  ↓
quarter-region points
  ↓
midpoints between already represented positions
```

Cartesian junction semantics are ranked by the deepest dyadic level needed by any participating port, then by total level/rank, with a deterministic stable tie-break.

## Boundary-safe connector rasterization

The first exploratory raster pass exposed a Bresenham boundary-entry artifact: shallow lines could travel along the outer row or column before turning inward and therefore activate an undeclared neighboring boundary port.

The final 5A.2 rasterizer makes boundary behavior explicit:

```text
declared boundary port
        ↓
immediate interior ingress pixel
        ↓
interior Bresenham spoke
        ↓
interior hub / hub kernel
```

Hub pixels are likewise clamped to the interior. With that change, **all 22,428 demanded semantics pass the validity gates under all four geometry models**.

Measured model sweep:

| Model | Valid semantics | Unique rasters | Weighted demand valid |
| --- | ---: | ---: | ---: |
| mathematical-demand-hub | 22,428 | 21,705 | 100% |
| symmetric-half-pixel-center | 22,428 | 21,399 | 100% |
| central-2x2-kernel | 22,428 | 21,399 | 100% |
| port-centroid-midpoint | 22,428 | 21,911 | 100% |

None of these boundary-safe junction rasters is an exact bitmap reuse of the existing graphics-v0 vocabulary. That means later budget work must count actual novel junction owners after junction-to-junction exact dedup rather than assuming existing glyphs will absorb a significant fraction.

## Four 600-connector selection strategies

### Demand-top-600

The pure empirical baseline selects the 600 demanded semantics with the greatest 5A.1 demand multiplicity.

Measured topology mix:

```text
LRT     164
LRB     164
LTB     136
RTB     134
LRTB      2
        ---
        600
```

It captures **21.358223%** of weighted demand exactly, but its geometric breadth is poor:

```text
theoretical average nearest-port delta   0.560884
theoretical p95 nearest-port delta       1.000000
demand-weighted average nearest delta    0.181920
```

The fact that only two four-port connectors survive in the hottest 600 is the clearest evidence that frequency alone is not an acceptable basis.

### Even-topology-balanced-600

Give every topology exactly 120 entries:

```text
LRT     120
LRB     120
LTB     120
RTB     120
LRTB    120
        ---
        600
```

Measured result:

```text
exact weighted demand coverage            15.088953%
theoretical average nearest-port delta     0.204765
theoretical p95 nearest-port delta         0.400000
demand-weighted average nearest delta      0.126919
unique centroid rasters                         467
```

This has the **best demand-weighted nearest-port distance** of the four tested strategies.

### Even-space-proportional-600

Distribute 600 according to each topology's share of the complete 22,528-semantic theoretical universe:

```text
LRT      55
LRB      55
LTB      27
RTB      27
LRTB    436
        ---
        600
```

Measured result:

```text
exact weighted demand coverage             7.981755%
theoretical average nearest-port delta     0.163349
theoretical p95 nearest-port delta         0.285714
demand-weighted average nearest delta      0.174405
unique centroid rasters                         552
```

This gives the **best raw theoretical breadth** of the four current 600-entry baselines.

### Hybrid-even-demand-600

Start with 300 space-proportional dyadic lattice connectors, then add the highest-demand not-yet-selected semantics until the set reaches 600.

The 300-entry generic seed is:

```text
LRT      27
LRB      27
LTB      14
RTB      14
LRTB    218
        ---
        300
```

After demand fill, the 600-entry set is:

```text
LRT     109
LRB     110
LTB      82
RTB      81
LRTB    218
        ---
        600
```

Measured result:

```text
exact weighted demand coverage            17.255414%
theoretical average nearest-port delta     0.174906
theoretical p95 nearest-port delta         0.285714
demand-weighted average nearest delta      0.151839
unique centroid rasters                         484
```

This is the strongest current **middle-ground baseline**: materially more exact demand than the fully proportional lattice while preserving much better theoretical breadth than demand-top-600.

## What 5A.2 establishes

The generic theory earns its place in the optimizer.

The main comparison is:

```text
                            exact demand     avg breadth Δ     p95 breadth Δ
pure demand-top                 21.358%          0.560884          1.000000
balanced even                   15.089%          0.204765          0.400000
space-proportional even          7.982%          0.163349          0.285714
hybrid even + demand            17.255%          0.174906          0.285714
```

So spending all 600 hypothetical slots on the most frequent observed semantics is not justified. It gains only about four percentage points of exact weighted demand over the hybrid while producing dramatically worse geometric coverage.

The measured evidence therefore supports the user's proposed architecture:

```text
generic evenly distributed connector scaffold
                    +
measured demand-driven additions
                    ↓
coverage-aware junction basis
```

5A.3 should not choose one of these four lists as final. It should generate the candidate visual owners exhaustively, globally deduplicate them, and then optimize a basis using both generic-lattice breadth and empirical demand.

## Metrics and semantic discipline

Breadth is measured by assigning every theoretical semantic to its nearest selected semantic **of the same topology** and measuring normalized boundary-port displacement.

This is only a routing-distance measurement. A nearby connector is never declared raster- or semantics-identical to the requested connector.

The exact semantic request remains preserved even if a future solver elects to route through a nearby encoded connector.

## Allocation rule

5A.2 remained research-only:

```text
working semantic budget      600
protected PUA reserve        604
experimental slack             4
actual junction allocation     0
```

Persistent generated outputs:

```text
artifacts/research/junctions/
├── geometry-stats.json
├── geometry-model-sweep.json
├── generic-lattice-600.json
└── geometry-report.md

spec/
└── junction-geometry-research-v0.json
```

Next: **Milestone 5A.3 — exhaustive junction candidate generation + global exact bitmap dedup**, carrying both empirical-demand and generic-lattice coverage signals forward.
