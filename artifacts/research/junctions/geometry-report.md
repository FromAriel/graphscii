# Milestone 5A.2 Junction Geometry and Generic 600-Lattice Sweep

Status: **GENERATED RESEARCH — ALLOCATION-FREE**

Milestone 5A.2 adds an explicit generic-coverage theory to the demand search. The generic theory walks each edge's ports in a dyadic order: endpoints, center pair, quarter-region points, then the remaining midpoints between already represented positions. It tests 600 semantic connectors while leaving four of the 604 reserve slots outside the working experiment. No PUA allocation occurs.

## Geometry-model sweep over the 22,428 demanded semantics

| Raster model | Valid semantics | Unique rasters | graphics-v0 exact-reuse rasters | Novel rasters | Weighted demand valid |
| --- | ---: | ---: | ---: | ---: | ---: |
| mathematical-demand-hub | 12,240 | 12,110 | 18 | 12,092 | 55.046% |
| symmetric-half-pixel-center | 10,834 | 10,834 | 6 | 10,828 | 41.095% |
| central-2x2-kernel | 10,834 | 10,834 | 0 | 10,834 | 41.095% |
| port-centroid-midpoint | 13,642 | 13,446 | 28 | 13,418 | 57.288% |

The fourth model, **port-centroid-midpoint**, is the new generic theory: connect the requested boundary ports through their geometric midpoint/centroid and deterministically rasterize the nearest hub pixel/kernel.

## 600-connector strategy comparison

Topology counts are shown as LRT/LRB/LTB/RTB/LRTB. Nearest-port distance is normalized to each edge length, so 0 is exact and 1 spans an entire edge.

| Strategy | Topology counts | Exact weighted demand | Avg theoretical nearest Δ | P95 theoretical nearest Δ | Demand-weighted nearest Δ | Novel centroid rasters |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| demand-top-600 | 164/164/136/134/2 | 21.358% | 0.5609 | 1.0000 | 0.1819 | 402 |
| even-topology-balanced-600 | 120/120/120/120/120 | 15.089% | 0.2048 | 0.4000 | 0.1269 | 423 |
| even-space-proportional-600 | 55/55/27/27/436 | 7.982% | 0.1633 | 0.2857 | 0.1744 | 534 |
| hybrid-even-demand-600 | 109/110/82/81/218 | 17.255% | 0.1749 | 0.2857 | 0.1518 | 444 |

## Generic allocation hypotheses

- **even-topology-balanced-600:** 120 connectors in each of the five topology families.
- **even-space-proportional-600:** 55 / 55 / 27 / 27 / 436, proportional to the 22,528-semantic theoretical space.
- **hybrid-even-demand-600:** first 300 space-proportional lattice connectors, then the strongest remaining empirical-demand semantics until 600.
- **demand-top-600:** pure search baseline using the 600 highest weighted-demand semantics.

These are research selections, not codepoint assignments. Exact boundary-port semantics outside a selected set are not silently treated as identical; the nearest-port metrics only quantify how far a routing solver would need to move a connection to use the sampled basis.

Milestone 5A.3 can now exhaustively generate/deduplicate visual owners using both the empirical demand field and these generic lattice baselines.
