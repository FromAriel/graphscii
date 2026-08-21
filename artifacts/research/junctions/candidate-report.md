# Milestone 5A.3 Exhaustive Junction Candidate Dedup

Status: **GENERATED RESEARCH — ALLOCATION-FREE**

All 22,528 one-port-per-edge junction semantics are rasterized under all four boundary-safe Milestone 5A.2 geometry models, producing 90,112 semantic-model candidates before exact bitmap dedup. The 100 5A.1 blind spots are deliberately included as breadth-protection candidates.

## Headline measurements

- Semantic universe: **22,528**
- Geometry models: **4**
- Semantic-model candidates: **90,112**
- Valid candidates: **90,112**
- Unique global junction rasters: **82,377**
- Existing graphics-v0 exact-reuse owners: **0**
- Novel junction visual owners: **82,377**
- Owners representing multiple semantic tuples: **1,773**
- Owners reached by multiple geometry models: **4,187**
- PUA junction allocations: **0 of 604**

## Per-model raw populations

| Model | Candidates | Unique rasters | graphics-v0 reuse owners |
| --- | ---: | ---: | ---: |
| mathematical-demand-hub | 22,528 | 21,805 | 0 |
| symmetric-half-pixel-center | 22,528 | 21,499 | 0 |
| central-2x2-kernel | 22,528 | 21,499 | 0 |
| port-centroid-midpoint | 22,528 | 22,011 | 0 |

## Generic/demand 600-set owner footprints

| Strategy | Selected semantics | Visual owners touched | Novel visual owners |
| --- | ---: | ---: | ---: |
| demand-top-600 | 600 | 1558 | 1558 |
| even-topology-balanced-600 | 600 | 1552 | 1552 |
| even-space-proportional-600 | 600 | 1813 | 1813 |
| hybrid-even-demand-600 | 600 | 1619 | 1619 |

Every visual owner carries its exact semantic aliases, unique demand weight, blind-spot status, topology set, contributing geometry models, and membership in all four 5A.2 600-connector baselines. Nearby-port approximation remains metadata only; exact bitmap identity is never inferred from distance.

Next: **Milestone 5A.4 — optimize the deduplicated owner population across budgets K=0..604 using empirical demand and generic-lattice breadth simultaneously.**
