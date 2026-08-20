# Milestone 5A.1 Junction Demand Map

Status: **GENERATED RESEARCH — ALLOCATION-FREE**

This artifact measures where the existing 832-definition straight GraphSCII language naturally creates 3-port and 4-port junction demand. No junction codepoints are allocated.

## Headline measurements

- Straight mathematical definitions: **832**
- Unordered straight pairs examined: **345,696**
- Strict interior intersecting pairs: **129,550**
- Exact mathematical hub positions: **70,707**
- Valid pair junction compositions: **15,330**
- Concurrent straight triples examined: **92,190**
- Valid triple junction compositions: **2,168**
- Unique demanded junction semantics: **15,872**
- Total weighted demand multiplicity: **17,498**
- Exact center-hub demand share: **0.766%**
- PUA reserve consumed: **0 of 604**

## Topology demand

| Topology | Unique semantics | Weighted demand |
| --- | ---: | ---: |
| LRT | 0 | 0 |
| LRB | 0 | 0 |
| LTB | 0 | 0 |
| RTB | 0 | 0 |
| LRTB | 15,872 | 17,498 |

## Highest-density exact hubs

| Rank | Exact hub | Decimal hub | Intersecting pairs | Junction demand | Zone |
| ---: | --- | --- | ---: | ---: | --- |
| 1 | 7/2,15/2 | 3.5, 7.5 | 366 | 134 | z11 |
| 2 | 14/3,10/1 | 4.666667, 10 | 99 | 35 | z22 |
| 3 | 14/3,5/1 | 4.666667, 5 | 99 | 35 | z12 |
| 4 | 7/3,10/1 | 2.333333, 10 | 99 | 35 | z21 |
| 5 | 7/3,5/1 | 2.333333, 5 | 99 | 35 | z11 |
| 6 | 21/4,15/4 | 5.25, 3.75 | 71 | 21 | z02 |
| 7 | 21/4,45/4 | 5.25, 11.25 | 71 | 21 | z22 |
| 8 | 7/4,15/4 | 1.75, 3.75 | 71 | 21 | z00 |
| 9 | 7/4,45/4 | 1.75, 11.25 | 71 | 21 | z20 |
| 10 | 14/5,6/1 | 2.8, 6 | 59 | 21 | z11 |
| 11 | 14/5,9/1 | 2.8, 9 | 59 | 21 | z21 |
| 12 | 21/5,6/1 | 4.2, 6 | 59 | 21 | z12 |

## Coarse 4×4 hub-zone demand

| Zone | Unique semantics | Weighted demand |
| --- | ---: | ---: |
| z11 | 2,596 | 2,887 |
| z21 | 2,183 | 2,384 |
| z12 | 1,886 | 2,036 |
| z22 | 1,791 | 1,998 |
| z00 | 872 | 1,070 |
| z20 | 956 | 1,034 |
| z02 | 901 | 1,000 |
| z10 | 898 | 919 |
| z01 | 786 | 786 |
| z30 | 612 | 753 |
| z32 | 562 | 604 |
| z03 | 415 | 514 |
| z31 | 465 | 465 |
| z33 | 323 | 422 |
| z23 | 326 | 326 |
| z13 | 300 | 300 |

The 4×4 zones are deliberately coarse. They are coverage buckets, not a proposal to quantize junction hubs. Later slices compare exact mathematical hubs with centered and 2×2 hub raster models.

## Interpretation

Milestone 5A.1 establishes the empirical demand distribution that later budget optimization will use. High-demand regions matter, but rare topology/port/angle buckets remain visible so the optimizer can maximize broad drawability rather than overfit the busiest hub cluster.
