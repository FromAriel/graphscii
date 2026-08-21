# Milestone 5A.3 — Exhaustive Junction Candidates and Global Exact Dedup

Status: **IN IMPLEMENTATION — ALLOCATION-FREE**

Milestone 5A.3 materializes the complete one-port-per-edge junction semantic universe under all four boundary-safe Milestone 5A.2 geometry models.

The research population is deliberately exhaustive:

```text
22,528 semantic tuples
× 4 geometry models
= 90,112 semantic-model candidates
```

The 100 four-port 5A.1 blind spots are included as breadth-protection candidates even though their measured demand is zero.

Every candidate is globally exact-deduplicated in this order:

```text
candidate bitmap
    ↓
exact graphics-v0 bitmap?
    ├── yes → zero-cost graphics-v0 reuse
    └── no
         ↓
existing junction owner with same bitmap?
    ├── yes → semantic/model alias
    └── no  → novel junction visual owner
```

Each resulting visual owner preserves:

- every contributing semantic tuple,
- every contributing geometry model,
- unique demand weight counted once per semantic tuple,
- blind-spot membership,
- topology membership,
- membership in all four 5A.2 600-connector baselines,
- exact graphics-v0 reuse when present.

The slice allocates **zero** PUA codepoints. The full 604-slot `U+F6A4..U+F8FF` reserve remains protected.

Persistent generated outputs:

```text
artifacts/research/junctions/
├── candidate-stats.json
├── candidates.json
├── unique-rasters.json
├── exact-reuse.json
├── classifications.json
└── candidate-report.md

spec/
└── junction-candidate-research-v0.json
```

The resulting owner population is the direct input to Milestone 5A.4, which will optimize exact owners across budgets `K=0..604` using both empirical demand and the evenly distributed connector-lattice coverage signal.
