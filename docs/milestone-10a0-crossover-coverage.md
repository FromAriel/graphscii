# Milestone 10A.0 — Crossover Cell Coverage Measurement

Status: **COMPLETE — ALLOCATION-FREE MEASUREMENT, DETERMINISTIC ARTIFACTS VERIFIED**

Milestone 10A.0 answers the first question of the crossover resolution plan
([`docs/milestone-10a-crossover-resolution-plan.md`](milestone-10a-crossover-resolution-plan.md)) before any cost weights are chosen:

> When two legal straight segments occupy one GraphSCII cell, how often does an exact single published glyph already represent their union?

The answer is derived from the frozen 832 straight mathematical definitions and the published `graphscii-graphics-v1` `by-bitmap.json` index. No codepoints are allocated.

## Measurement model

- Cell states: all unordered pairs of distinct canonical straight definitions,
  C(832,2) = 345,696 states.
- Desired cell state: bitwise OR of both segment bitmaps plus the union of the
  four endpoint ports.
- Tier 0 test: union bitmap key looked up in the published v1 by-bitmap index;
  accepted only for straight owners (glyph IDs 0..745) or connector owners
  (5796..6396). Fill-class owners (746..5795) are counted separately as
  policy-forbidden collisions.
- Canonicalization guard: reversing every definition maps it back onto itself,
  mirroring the compositor's reverse-alias rule.
- Published index digest at measurement time:
  `3466bbcaa18184c552d6cdfed353b461f63bb0bcf5e7e678fdb26013577bd06c`.

## Frozen measurements

```text
straight mathematical definitions              832
straight visual owners                         746
published owners measured against            6,397

unordered pair states examined             345,696
tier 0 exact single-glyph states             2,177        0.629744%
  resolved by a straight owner               1,700
  resolved by a connector owner                477
fill-class bitmap collisions                   642   policy-excluded
unresolved pair states                     342,877       99.184544%
distinct unresolved bitmaps                267,771
subset unions (one segment contains the other) 1,348
```

Per family class:

```text
class                 states   tier 0   unresolved   unresolved%
axis+axis              51,040      164       50,860     99.647335%
axis+diagonal         163,840      684      163,064     99.526367%
diagonal+diagonal     130,816    1,329      128,953     98.575862%
```

## Findings

1. **Exact coverage is nearly zero everywhere**, not merely on diagonals. The
   generic connector vocabulary was generated for shared-hub junction demand,
   not for arbitrary port-pair crossings; it resolves only 477 pair states
   (0.14%).
2. **Straight owners out-resolve connectors** (1,700 vs 477). Most Tier 0 hits
   occur when two segments share lattice structure so their union collapses
   onto another single straight line (for example near-vertical `LB` pairs).
3. **642 stroke unions form exact solid-fill boundary bitmaps.** This is direct
   evidence that the fill-side grammar is reachable from pure strokes, which
   validates the boundary-fill design while remaining policy-excluded here.
4. **Tier 1 typed approximation carries ~99.4% of all crossover cells.** The
   cost constants proposed in the plan remain provisional until slice 10A.2
   reviews these breakdowns; the mate-loss weight will dominate because most
   misses are four-port states whose mated ports cannot all survive.
5. Full exhaustive single-glyph encoding of the missing space would require
   267,771 novel owners — quantifying why composition, not enumeration, is the
   only viable strategy.

## Artifacts

```text
artifacts/research/crossovers/coverage/stats.json
artifacts/research/crossovers/coverage/report.md
```

Commands:

```powershell
node scripts/generate-crossover-coverage.mjs
node scripts/verify-crossover-coverage.mjs
```

npm wiring into the aggregate chains lands with slice 10A.3 per the sub-plan.

## Next slices

```text
10A.1/10A.2  canonical state keys + typed candidates + resolution artifact
10A.3        verifier + npm wiring + CI
10A.4        compositor v3 runtime swap
```
