# Milestone 5A.2 Junction Geometry and Generic 600-Lattice Sweep

Status: **GENERATED RESEARCH — ALLOCATION-FREE**

The 600-lattice experiment walks edge ports in a dyadic order: extremes, center pair, quarter-region points, then remaining midpoints. Every spoke now leaves its declared boundary port immediately through an interior ingress pixel, preventing shallow Bresenham lines from accidentally activating neighboring boundary ports. No PUA allocation occurs.

## Geometry-model sweep

| Raster model | Valid demanded semantics | Unique rasters | graphics-v0 exact reuse | Novel rasters | Weighted demand valid |
| --- | ---: | ---: | ---: | ---: | ---: |
| mathematical-demand-hub | 22,428 | 21,705 | 0 | 21,705 | 100.000% |
| symmetric-half-pixel-center | 22,428 | 21,399 | 0 | 21,399 | 100.000% |
| central-2x2-kernel | 22,428 | 21,399 | 0 | 21,399 | 100.000% |
| port-centroid-midpoint | 22,428 | 21,911 | 0 | 21,911 | 100.000% |

## 600-connector strategy comparison

Topology counts are LRT/LRB/LTB/RTB/LRTB. Nearest-port distance is normalized to each edge length.

| Strategy | Topology counts | Exact weighted demand | Avg theoretical nearest Δ | P95 theoretical nearest Δ | Demand-weighted nearest Δ | Novel centroid rasters |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| demand-top-600 | 164/164/136/134/2 | 21.358% | 0.5609 | 1.0000 | 0.1819 | 438 |
| even-topology-balanced-600 | 120/120/120/120/120 | 15.089% | 0.2048 | 0.4000 | 0.1269 | 467 |
| even-space-proportional-600 | 55/55/27/27/436 | 7.982% | 0.1633 | 0.2857 | 0.1744 | 552 |
| hybrid-even-demand-600 | 109/110/82/81/218 | 17.255% | 0.1749 | 0.2857 | 0.1518 | 484 |

The even-topology strategy tests 120 connectors per family. The proportional strategy uses 55/55/27/27/436. The hybrid seeds 300 proportional lattice entries, then fills to 600 with the strongest remaining measured demand. The demand-top strategy is the pure search baseline.

Nearest-port coverage is an explicit routing approximation metric only; nearby semantic tuples are never declared identical. Milestone 5A.3 can now generate and globally deduplicate exhaustive visual candidates using these measured baselines.
