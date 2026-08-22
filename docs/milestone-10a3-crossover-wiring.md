# Milestone 10A.3 — Crossover Wiring, Promotion, and CI

Status: **COMPLETE — MANIFEST AUTHORITY, AGGREGATE-CHAIN WIRED, CI GATED**

Slice 10A.3 of [`docs/milestone-10a-crossover-resolution-plan.md`](milestone-10a-crossover-resolution-plan.md)
promoted the crossover resolution table from research output to a first-class
manifest artifact and wired it into every automation surface.

## What changed

### 1. Manifest promotion

The canonical resolution table now lives beside the frozen v1 registry:

```text
artifacts/manifest/vocabulary-v1/crossover-resolution.tsv           345,696 rows + header
artifacts/manifest/vocabulary-v1/crossover-resolution-stats.json    weights header + digests + aggregates
artifacts/manifest/vocabulary-v1/crossover-resolution-report.md     human summary
```

Format decision: **compact sorted TSV** rather than per-entry JSON. A
pretty-printed JSON map of 345,696 entries would cost tens of megabytes; the
TSV is 9.6 MB and loads into a runtime `Map` in one pass. Status inside the
stats sidecar is `10A.3-wired-and-promoted`.

The research copy under `artifacts/research/crossovers/resolution/` was
removed; single source of truth. The 10A.0 coverage measurement remains under
`artifacts/research/crossovers/coverage/` as research.

### 2. Strengthened verifier gates (plan §8)

The generator now self-audits the emitted table before writing:

```text
1  strictly ascending state keys (byte order), no duplicates;
2  every state key is a canonical sorted pair of legal distinct segments;
3  zero winners from fill-class owners (glyph IDs 746..5795);
4  every Tier 0 row re-derived against the published by-bitmap index;
5  tier values restricted to {0,1}; missed ≤ 4; extra ≤ 44;
6  allocation-free and protected-reserve fixtures asserted.
```

Byte-compare regeneration plus these gates run in both the standalone
verifier and the aggregate chain.

### 3. npm wiring

```text
generate:crossover-coverage      generate:crossover-resolution
verify:crossover-coverage        verify:crossover-resolution
```

Both steps are inserted into the aggregate `generate` and `verify` chains
immediately after `vocabulary-artifacts` — the first point where the
published `by-bitmap.json` index exists.

### 4. CI

New path-filtered workflow `.github/workflows/verify-crossover-resolution.yml`
runs both verifiers on changes to the crossover scripts, the manifest table,
the published index, or the registry, and greps the generator for the
never-empty and fill-exclusion error strings so those invariants cannot be
silently deleted.

## Spec correction caught by the new audit

The audit's canonical-key gate exposed that state keys were built in
enumeration order (`i<j`) instead of plan §4's sorted segment list. This
mattered for the upcoming runtime: a compositor must rebuild identical keys
from an unordered cell state. Key construction now sorts the two segment
keys; selections were unchanged (same states, relabeled keys) and all pinned
fixtures still verify.

## Commands

```powershell
npm run generate:crossover-coverage
npm run generate:crossover-resolution
npm run verify:crossover-coverage
npm run verify:crossover-resolution
```

## Next slice

```text
10A.4  demo compositor v3 runtime swap over crossover-resolution.tsv
```
