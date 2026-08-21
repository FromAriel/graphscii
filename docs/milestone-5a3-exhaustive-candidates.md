# Milestone 5A.3 — Exhaustive Junction Candidates and Global Exact Dedup

Status: **COMPLETE — ALLOCATION-FREE, FULL-CHAIN VERIFIED**

Milestone 5A.3 materializes the complete one-port-per-edge junction semantic universe under all four boundary-safe Milestone 5A.2 geometry models, then globally exact-deduplicates every resulting 8×16 bitmap.

## Exhaustive population

```text
22,528 semantic tuples
× 4 geometry models
= 90,112 semantic-model candidates
```

All **90,112** candidates pass the boundary-safe validity gates. The 100 four-port 5A.1 blind spots are deliberately included as breadth-protection candidates even though their measured empirical demand is zero.

## Global exact-dedup result

```text
semantic-model candidates               90,112
valid candidates                         90,112
invalid candidates                            0
unique junction raster owners            82,377
graphics-v0 exact-reuse owners                0
novel junction visual owners             82,377
candidate / owner compression           1.093898
owners with >1 semantic tuple             1,773
owners reached by >1 geometry model       4,187
maximum semantic aliases / owner              7
maximum candidate aliases / owner             14
```

Per-model raw populations are:

```text
mathematical-demand-hub          22,528 → 21,805 unique rasters
symmetric-half-pixel-center      22,528 → 21,499 unique rasters
central-2x2-kernel               22,528 → 21,499 unique rasters
port-centroid-midpoint           22,528 → 22,011 unique rasters
```

None of these boundary-safe junction rasters is exactly identical to an already encoded `graphscii-graphics-v0` bitmap. Junction codepoint cost therefore starts at one slot per **selected novel visual owner**, not at zero-cost reuse.

## What the 600-semantic baselines mean after visual dedup

The four 5A.2 semantic baselines touch substantially more than 600 visual owners when all four geometry alternatives are retained:

```text
demand-top-600                    600 semantics → 1,558 owners
even-topology-balanced-600        600 semantics → 1,552 owners
even-space-proportional-600       600 semantics → 1,813 owners
hybrid-even-demand-600            600 semantics → 1,619 owners
```

This is a crucial architecture result. Milestone 5A.4 cannot encode “600 semantics under every geometry model.” The **allocation variable must be the deduplicated visual owner**. A selected owner may cover several semantic/model interpretations, and the optimizer must choose which owner variants buy the best exact demand plus generic routing breadth per codepoint.

## Demand accounting discipline

The owner catalog records `exactWeightedDemand` once per unique semantic tuple represented by that owner. Because one semantic may have different raster owners under different geometry models, summing demand over *all* owners gives **3,502,010**, which intentionally exceeds the original **928,242** event total.

That number is **not a coverage percentage denominator**. Milestone 5A.4 must count a requested semantic's empirical demand at most once when evaluating a selected owner set, regardless of how many selected geometry variants could satisfy it.

## Persistent sharded artifacts

The first exhaustive serialization produced files too large for a safe GitHub publication layout, so the result is persisted deterministically as small manifests plus shards without changing any measured raster or owner identity:

```text
artifacts/research/junctions/
├── candidate-stats.json
├── candidates.json                       # manifest
├── candidates/
│   ├── mathematical-demand-hub.json
│   ├── symmetric-half-pixel-center.json
│   ├── central-2x2-kernel.json
│   └── port-centroid-midpoint.json
├── unique-rasters.json                   # manifest
├── unique-rasters/
│   ├── 0.json
│   ├── 1.json
│   ├── ...
│   └── f.json
├── exact-reuse.json
├── classifications.json
└── candidate-report.md

spec/
└── junction-candidate-research-v0.json
```

Candidate shards are partitioned by geometry model. Visual-owner shards are partitioned by the first lowercase hexadecimal nibble of the canonical 32-character bitmap key. The verifier regenerates and byte-compares all **4 candidate shards + 16 owner shards + manifests and summary artifacts**.

## Verification gate

The permanent verifier freezes:

```text
semantic universe                       22,528
demanded semantics                      22,428
blind-spot semantics                       100
weighted demand                         928,242
geometry models                               4
candidate count                          90,112
valid candidates                         90,112
unique visual owners                     82,377
graphics-v0 reuse owners                      0
novel visual owners                      82,377
multi-semantic owners                     1,773
multi-model owners                        4,187
maximum semantic aliases / owner              7
maximum candidate aliases / owner             14
candidate shards                              4
owner shards                                 16
junction codepoints allocated                  0
protected reserve                            604
```

The complete project `check → generate → verify` chain passes with those fixtures frozen.

## Consequence for 5A.4

The junction problem is now a genuine **coverage-constrained visual-owner selection problem**:

```text
82,377 novel exact visual owners
              ↓
choose K owners, 0 ≤ K ≤ 604
              ↓
maximize unique empirical-demand coverage
+
maximize evenly distributed port/topology breadth
+
protect the 100 empirical blind spots
+
avoid paying repeatedly for redundant geometry variants
```

No PUA codepoints were allocated in 5A.3. The full `U+F6A4..U+F8FF` 604-slot reserve remains protected.

Next: **Milestone 5A.4 — demand/breadth/Pareto owner optimization across budgets K=0..604.**
