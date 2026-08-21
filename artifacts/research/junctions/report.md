# Milestone 5A.1 Junction Demand Map

Status: **GENERATED RESEARCH — ALLOCATION-FREE**

This artifact measures where the existing 832-definition straight GraphSCII language naturally creates junction demand. At every exact interior straight-line intersection, each contributing straight supplies two selectable rays from the hub to its boundary ports. Valid 3-ray and 4-ray subsets become junction demand events. No junction codepoints are allocated.

## Headline measurements

- Straight mathematical definitions: **832**
- Unordered straight pairs examined: **345,696**
- Strict interior intersecting pairs: **129,550**
- Exact mathematical hub positions: **70,707**
- Pair source compositions producing demand: **105,546**
- Pair-derived junction demand events: **257,082**
- Concurrent straight triples examined: **92,190**
- Triple source compositions producing demand: **81,310**
- Triple-derived junction demand events: **671,160**
- Unique demanded port semantics: **22,428 of 22,528** (99.556%)
- Total weighted demand multiplicity: **928,242**
- Exact center-hub demand share: **3.876%**
- PUA reserve consumed: **0 of 604**

## Topology demand

| Topology | Unique semantics | Weighted demand |
| --- | ---: | ---: |
| LRT | 2,048 | 263,632 |
| LRB | 2,048 | 263,632 |
| LTB | 1,024 | 141,488 |
| RTB | 1,024 | 141,488 |
| LRTB | 16,284 | 118,002 |

## Highest-demand exact hubs

| Rank | Exact hub | Decimal hub | Intersecting pairs | Junction demand | Zone |
| ---: | --- | --- | ---: | ---: | --- |
| 1 | 7/2,15/2 | 3.5, 7.5 | 366 | 35,982 | z11 |
| 2 | 14/3,10/1 | 4.666667, 10 | 99 | 5,151 | z22 |
| 3 | 14/3,5/1 | 4.666667, 5 | 99 | 5,151 | z12 |
| 4 | 7/3,10/1 | 2.333333, 10 | 99 | 5,151 | z21 |
| 5 | 7/3,5/1 | 2.333333, 5 | 99 | 5,151 | z11 |
| 6 | 7/2,21/2 | 3.5, 10.5 | 116 | 4,524 | z21 |
| 7 | 7/2,9/2 | 3.5, 4.5 | 116 | 4,524 | z11 |
| 8 | 2/1,10/1 | 2, 10 | 74 | 3,134 | z21 |
| 9 | 2/1,5/1 | 2, 5 | 74 | 3,134 | z11 |
| 10 | 5/1,10/1 | 5, 10 | 74 | 3,134 | z22 |
| 11 | 5/1,5/1 | 5, 5 | 74 | 3,134 | z12 |
| 12 | 21/4,15/4 | 5.25, 3.75 | 71 | 3,124 | z02 |

## Coarse 4×4 hub-zone demand

| Zone | Unique semantics | Weighted demand |
| --- | ---: | ---: |
| z11 | 13,436 | 139,050 |
| z21 | 10,545 | 99,987 |
| z22 | 9,925 | 94,584 |
| z12 | 10,339 | 93,516 |
| z20 | 7,156 | 61,875 |
| z10 | 7,475 | 60,616 |
| z02 | 6,334 | 57,624 |
| z00 | 5,113 | 56,589 |
| z01 | 6,237 | 49,143 |
| z30 | 4,116 | 39,810 |
| z32 | 4,980 | 37,836 |
| z31 | 4,967 | 34,200 |
| z13 | 4,483 | 28,362 |
| z03 | 3,360 | 26,994 |
| z23 | 4,224 | 26,590 |
| z33 | 2,882 | 21,466 |

The demand semantics are keyed by boundary-port tuple, matching the 22,528 one-port-per-edge reference universe. Exact hub positions remain a measured distribution attached to those semantics rather than multiplying the semantic address space.

Milestone 5A.2 will use this demand field to compare mathematical-intersection, symmetric half-pixel-center, and central-2×2 raster models.
