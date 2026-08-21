# Milestone 5 — Generic Junction and Connector Vocabulary

Status: **COMPLETE — PUBLISHED AS `graphscii-graphics-v1`**

Milestone 5 began as a coverage-optimization study over the 604-slot BMP PUA reserve and ended with a deliberately simpler result: a deterministic, rule-generated generic connector language that is easy to reason about, easy to select programmatically, and small enough to fit after exact bitmap dedup.

The broad research is preserved, but it is no longer the normative selection rule.

---

## 1. Frozen starting point

Milestone 5 started from the completed graphics-v0 publication:

```text
publication                 graphscii-graphics-v0
encoded graphics            5,796
allocated PUA               U+E000..U+F6A3
protected reserve           U+F6A4..U+F8FF
protected reserve slots        604
straight semantic inputs       832
straight visual owners         746
```

All 5A research allocated zero new codepoints.

---

## 2. 5A.1 — straight-composition demand map — COMPLETE

The first research slice derived junction demand directly from the authoritative 832 straight mathematical definitions.

At each strict interior exact rational intersection, each straight contributes selectable rays from the common hub to its boundary endpoints. Three-ray and four-ray subsets were retained when they formed one-port-per-participating-edge junction semantics.

Frozen result:

```text
straight semantic definitions            832
straight visual owners                    746
interior intersecting pairs           129,550
exact hub positions                    70,707
pair demand events                    257,082
triple demand events                  671,160
weighted demand events total          928,242
unique demanded semantics              22,428
theoretical reference semantics        22,528
theoretical coverage                99.556108%
```

Topology coverage:

```text
LRT      2,048 / 2,048 demanded
LRB      2,048 / 2,048 demanded
LTB      1,024 / 1,024 demanded
RTB      1,024 / 1,024 demanded
LRTB    16,284 /16,384 demanded
```

All **6,144 possible three-port semantics** occur in measured straight composition. The only 100 theoretical blind spots are four-port `LRTB` cases.

The exact center `(3.5, 7.5)` is the single highest-demand hub but represents only **3.87636%** of weighted demand, ruling out a center-only vocabulary.

Completion note: [`docs/milestone-5a1-junction-demand-map.md`](docs/milestone-5a1-junction-demand-map.md)

---

## 3. 5A.2 — boundary-safe geometry and generic-lattice research — COMPLETE

The first raster experiments exposed a boundary-grazing artifact in ordinary spoke rasterization. The connector rule was corrected so every declared boundary port turns inward immediately before traveling toward the hub. With boundary-safe ingress, all 22,428 demanded semantics pass all validity gates under every tested geometry model.

The research compared frequency-driven and evenly distributed 600-semantic bases.

Measured summary:

```text
strategy                      exact demand   avg breadth Δ   p95 breadth Δ
pure demand-top                 21.358223%       0.560884        1.000000
even topology-balanced          15.088953%       0.204765        0.400000
even space-proportional          7.981755%       0.163349        0.285714
hybrid even + demand            17.255414%       0.174906        0.285714
```

The result that mattered was architectural: pure frequency leaves severe geometric holes, while evenly spaced bases are far easier to reason about and cover the port space more uniformly.

Completion note: [`docs/milestone-5a2-generic-lattice.md`](docs/milestone-5a2-generic-lattice.md)

---

## 4. 5A.3 — exhaustive candidate generation and exact dedup — COMPLETE / SUPERSEDED

Before the curated-basis decision, all measured semantics were rasterized under four geometry models.

Frozen exhaustive result:

```text
semantic universe                       22,528
geometry models                              4
semantic/model candidates               90,112
valid candidates                         90,112
invalid candidates                            0
unique exact visual owners               82,377
graphics-v0 exact owner reuses                0
multi-semantic owners                     1,773
multi-model owners                        4,187
max semantic aliases per owner                7
max candidate aliases per owner              14
```

The exhaustive data is retained as research evidence and deterministic sharded artifacts. It demonstrated why selecting from tens of thousands of owner candidates was the wrong abstraction for a generic drawing vocabulary.

Milestone 5 therefore intentionally superseded the planned 5A.4/5A.5 Pareto optimization with a smaller human-readable rule system.

---

## 5. Curated-basis decision

The final design principle became:

> **Encode a generic connector grammar, not an enumeration of every junction that could exist.**

The grammar has two components:

1. every orthogonal crossing position with a full four-arm form and all four one-arm-removed forms;
2. a small diagonal family derived directly from progressively squashing an X across the 8×16 cell.

Exact bitmap dedup determines physical glyph cost.

---

## 6. 5B.1 — orthogonal generic connector basis — COMPLETE

For every intersection coordinate:

```text
x = 0..7
y = 0..15
```

retain five arm masks:

```text
NESW   full four-arm cross
ESW    missing north
NSW    missing east
NEW    missing south
NSE    missing west
```

Raw semantic count:

```text
8 × 16 × 5 = 640 semantics
```

Exact dedup result:

```text
raw orthogonal semantics             640
unique exact raster owners           548
semantic duplicates collapsed         92
graphics-v0 exact owner reuses         4
novel orthogonal owners               544
```

No manual trimming was required. Edge and corner degeneracies supply the needed compression automatically.

Completion note: [`docs/milestone-5b1-orthogonal-generic-connectors.md`](docs/milestone-5b1-orthogonal-generic-connectors.md)

---

## 7. 5B.2 — deterministic diagonal generic connector basis — COMPLETE

The diagonal family also avoids random or demand-picked sampling.

Start with an X spanning the cell and progressively squash its bounding box along each axis.

```text
16 vertical-squash rules    DV00..DV15
 8 horizontal-squash rules  DH00..DH07
                           --------------
24 full-X semantic rules
```

Each X is split deterministically into four named legs:

```text
NW
NE
SE
SW
```

Exhaustively testing all missing-one-leg forms produced:

```text
24 full-X semantics
96 three-leg semantics
120 tested diagonal semantics
107 unique exact raster owners
2 graphics-v0 exact reuses
105 incremental novel owners
```

Keeping every three-leg form would exceed the remaining budget. The final selection therefore keeps all 24 full X rules and selects nine evenly distributed squash-angle rules for three-leg forms:

```text
vertical:    DV00 DV03 DV06 DV08 DV11 DV14
horizontal:  DH02 DH04 DH06
```

Each of those nine rules keeps all four missing-leg orientations.

Final diagonal semantic language:

```text
24 full-X semantics
36 three-leg semantics
----------------------
60 diagonal semantics
```

Exact dedup result:

```text
selected diagonal semantics             60
selected exact raster owners             59
graphics-v0 exact owner reuses            2
novel diagonal owners                     57
```

Completion note: [`docs/milestone-5b2-diagonal-generic-connectors.md`](docs/milestone-5b2-diagonal-generic-connectors.md)

---

## 8. Final generic connector language

Semantic population:

```text
orthogonal connector semantics          640
diagonal connector semantics             60
                                        ---
connector semantic aliases total         700
```

Novel encoded visual cost:

```text
orthogonal owners                       544
diagonal owners                          57
                                        ---
novel connector owners                  601
```

The semantic language is therefore richer than the physical connector block because exact bitmap reuse and internal dedup are global.

---

## 9. 5C — connector allocation and v1 registry — COMPLETE

Milestone 5C extended the frozen 5,796-owner graphics-v0 registry without renumbering any existing glyph.

Final provisional allocation:

```text
U+E000..U+F6A3    5,796   unchanged graphics-v0 owners
U+F6A4..U+F8FC      601   generic connector owners
U+F8FD..U+F8FF        3   protected reserve
```

New connector glyph IDs:

```text
5796..6396
```

The v1 registry contains:

```text
encoded owners                       6,397
connector semantic aliases             700
```

Milestone 5C also materialized:

```text
601 connector ASCII glyph artifacts
601 connector PNG glyph artifacts
3 paged connector atlases
```

Completion note: [`docs/milestone-5c-connector-allocation.md`](docs/milestone-5c-connector-allocation.md)

---

## 10. 5D — canonical connector artifacts and atlas integration — COMPLETE

5D was completed as part of the 5C integration slice rather than as a separate implementation branch.

Canonical outputs include:

```text
artifacts/manifest/vocabulary-v1/
artifacts/vocabulary/connectors/glyphs/
artifacts/vocabulary/atlases/connectors/
artifacts/vocabulary/atlases/master-layout-map-v1.md
spec/generic-connector-allocation-v1.json
```

Connector atlas pages contain:

```text
page 0    256 owners
page 1    256 owners
page 2     89 owners
          ---
total     601 owners
```

---

## 11. 5E — `graphscii-graphics-v1` publication — COMPLETE

Formal publication:

```text
graphscii-graphics-v1
```

Publication files:

```text
artifacts/publications/graphscii-graphics-v1.json
artifacts/publications/graphscii-graphics-v1.md
```

Final encoded class counts:

```text
straight                              746
solid 100%                          1,259
medium 75%                         1,269
light 25%                          1,315
half 50%                           1,207
connector orthogonal                 544
connector diagonal                    57
                                    -----
encoded graphics                    6,397
```

Final address-space accounting:

```text
BMP PUA capacity                    6,400
encoded graphics                    6,397
protected reserve                       3
last allocated codepoint          U+F8FC
reserve                           U+F8FD..U+F8FF
```

With printable ASCII:

```text
6,397 + 95 = 6,492 minimum eventual physical glyphs
```

Combined addressable semantics recorded by the publication:

```text
base graphics-v0 aliases           10,816
connector aliases                     700
                                    ------
combined aliases                    11,516
```

Inherited renderer-only layer remains unchanged:

```text
semantic aliases                    3,392
exact encoded reuses                  414
derived aliases                     2,978
unique derived bitmaps              2,555
encoded codepoints consumed             0
```

Completion note: [`docs/milestone-5e-graphics-v1-publication.md`](docs/milestone-5e-graphics-v1-publication.md)

Summary: [`docs/milestone-5-complete.md`](docs/milestone-5-complete.md)

---

## 12. Final execution table

```text
5A.1  straight-composition demand map + coverage taxonomy       COMPLETE
5A.2  boundary-safe geometry + generic lattice research         COMPLETE
5A.3  exhaustive candidate generation + global exact dedup      COMPLETE / SUPERSEDED
5A.4  Pareto owner optimization                                 SUPERSEDED BY CURATED BASIS
5A.5  exhaustive recommendation atlas                           SUPERSEDED BY CURATED BASIS
5B.1  orthogonal generic connector basis                        COMPLETE
5B.2  deterministic diagonal generic connector basis            COMPLETE
5C    connector registry + provisional codepoint allocation     COMPLETE
5D    canonical connector artifacts + atlas integration         COMPLETE
5E    graphics-v1 publication + final reserve accounting        COMPLETE
```

---

## 13. Resulting policy

The milestone leaves only three BMP PUA slots unallocated. Broad future vocabulary families therefore cannot be handled by continued enumeration inside the BMP PUA.

Future work should prefer:

```text
semantic composition
renderer-derived output
exact raster reuse
small explicitly justified specials
or a separately versioned address-space strategy
```

The final three PUA slots remain protected.

---

## 14. Guiding rule

> **Spend encoded glyphs on a small rule system that makes GraphSCII composable, not on enumerating every geometry that can mathematically occur.**

The published `graphscii-graphics-v1` registry is now the source of truth for downstream font compilation, drawing APIs, solvers, and editors.
