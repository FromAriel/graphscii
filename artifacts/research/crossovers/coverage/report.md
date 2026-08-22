# Milestone 10A.0 — Crossover Cell Coverage Measurement

Status: **RESEARCH — ALLOCATION-FREE**

Measures how often an exact single-glyph resolution (Tier 0 of the crossover
resolution plan) already exists when two legal straight segments occupy one
cell. No codepoints are allocated and no weights are frozen by this document.

## Method

- Canonical segment universe: the frozen 832 straight mathematical definitions
  rasterized by the compiled core (`dist/core`), byte-identical to the registry.
- Cell states: all unordered pairs of distinct definitions, C(832,2) =
  345,696 states.
- Desired state per cell: bitwise OR of both segment bitmaps plus the union of
  endpoint ports.
- Tier 0 test: the union bitmap key is looked up in the published v1
  `by-bitmap.json` index; hits are accepted only for straight owners
  (glyph IDs 0..745) or connector owners (5796..6396). Fill-class owners are
  recorded separately because stroke policy forbids them.
- Published index digest: `3466bbcaa18184c552d6cdfed353b461f63bb0bcf5e7e678fdb26013577bd06c`.

## Headline result

```text
measured pair states                345696
tier 0 exact single-glyph             2177   (0.629744%)
  via straight owners                 1700
  via connector owners                 477
fill-class collisions                  642   (exact bitmap exists, policy-excluded)
unresolved (needs Tier 1/2)         342877   (99.184544%)
distinct unresolved bitmaps         267771
```

## Breakdowns

### By segment-family class

family-class / edges / ports   states   exact-straight   exact-connector   fill-collision   unresolved   unresolved%
---------------------------   ------   --------------   ---------------   --------------   ----------   ------------
axis+axis                   51040               14               150               16        50860     99.647335%
axis+diagonal              163840              394               290               92       163064     99.526367%
diagonal+diagonal          130816             1292                37              534       128953     98.575862%
-------------------------  345696

### By desired boundary-edge set

family-class / edges / ports   states   exact-straight   exact-connector   fill-collision   unresolved   unresolved%
---------------------------   ------   --------------   ---------------   --------------   ----------   ------------
LB                           8128              169                 1              121         7837     96.419783%
LR                          32640                8                12                8        32612     99.914216%
LRB                         81920              188               101               21        81610     99.621582%
LRT                         81920              188               101               21        81610     99.621582%
LRTB                        49152               14               142                0        48996     99.682617%
LT                           8128              169                 1              130         7828     96.309055%
LTB                         32768              313                56               33        32366     98.773193%
RB                           8128              169                 1              130         7828     96.309055%
RT                           8128              169                 1              137         7821     96.222933%
RTB                         32768              313                53               33        32369     98.782349%
TB                           2016                0                 8                8         2000     99.206349%
-------------------------  345696

### By desired port count

family-class / edges / ports   states   exact-straight   exact-connector   fill-collision   unresolved   unresolved%
---------------------------   ------   --------------   ---------------   --------------   ----------   ------------
2                               0                0                 0                0            0      0.000000%
3                            9920              682                 0              130         9108     91.814516%
4                          335776             1018               477              512       333769     99.402280%
-------------------------  345696

## Findings

- Exact single-glyph coverage is nearly zero in every family class
  (0.32%..1.02%). The connector vocabulary was built for shared-hub junction
  demand, not arbitrary port-pair crossings, so Tier 1 approximation carries
  almost the entire crossover burden.
- Straight owners supply more exact unions than connector owners do
  (1700 vs 477): most Tier 0 states occur when two
  segments share a lattice region and their union collapses onto yet another
  single straight line.
- The 642 fill-class collisions confirm that multi-stroke unions can form
  exact solid-fill boundary bitmaps; they remain policy-excluded.
- No cost weights are frozen by this measurement. Constants are chosen in
  slice 10A.2 after reviewing these breakdowns.

Next slice: 10A.1/10A.2 — canonical state keys, typed candidate port sets,
and the offline `crossover-resolution.json` artifact.
