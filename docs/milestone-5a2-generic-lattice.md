# Milestone 5A.2 — Junction Geometry and Generic 600-Lattice Sweep

Status: **IN PROGRESS — ALLOCATION-FREE**

Milestone 5A.1 established that straight-composition demand is broad rather than concentrated in one small region: 22,428 of the 22,528 theoretical one-port-per-edge junction semantics receive measured demand, and the exact half-pixel center accounts for only a small share of total demand.

5A.2 therefore tests a second hypothesis alongside empirical demand search:

> A compact junction vocabulary may work better as an evenly distributed generic connector basis than as a list of only the hottest measured junctions.

No codepoint is allocated in this slice. The existing 604-slot reserve remains protected.

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

Conceptually this means:

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

## Four 600-connector selection strategies

### Demand-top-600

The empirical baseline. Select the 600 demanded semantics with the greatest 5A.1 demand multiplicity.

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

This deliberately over-represents the smaller three-port spaces relative to raw theoretical cardinality in exchange for topology breadth.

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

### Hybrid-even-demand-600

Start with 300 space-proportional dyadic lattice connectors, then add the highest-demand not-yet-selected semantics until the set reaches 600.

This tests the user's proposed idea directly: preserve a broad generic scaffold, then spend remaining capacity where the measured search says it matters most.

## Geometry models

The same slice compares four deterministic raster models over the demanded semantics:

1. **mathematical-demand-hub** — use each semantic's strongest measured exact mathematical hub, rasterized to its nearest pixel/kernel.
2. **symmetric-half-pixel-center** — route spokes toward the symmetric `(3.5, 7.5)` center using directionally selected center pixels.
3. **central-2x2-kernel** — route all spokes through the complete central 2×2 pixel kernel.
4. **port-centroid-midpoint** — route requested boundary ports through the geometric centroid/midpoint of those connection points.

The fourth model is the new generic theory. It is also used to materialize the 600-lattice research selections.

## Metrics

Every strategy reports both exact and approximate-routing behavior.

Exact metrics include:

```text
selected semantic count
selected topology counts
exact weighted-demand coverage
unique raster count after exact bitmap dedup
graphics-v0 exact reuse
novel raster owners
validity failures
boundary-port pixel collisions
```

Breadth is measured by assigning every theoretical semantic to its nearest selected semantic **of the same topology** and measuring normalized boundary-port displacement.

This is only a routing-distance measurement. A nearby connector is never declared raster- or semantics-identical to the requested connector.

Reported distance statistics include:

```text
average normalized maximum port displacement
p50 / p90 / p95 / p99
worst displacement
demand-weighted average and quantiles
```

## Allocation rule

5A.2 remains research-only:

```text
working semantic budget      600
protected PUA reserve        604
actual junction allocation     0
```

The measured output of this slice becomes input to 5A.3 exhaustive candidate generation and global exact bitmap dedup. Only a later Milestone 5B decision may authorize spending reserve codepoints.
