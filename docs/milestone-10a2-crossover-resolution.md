# Milestone 10A.1/10A.2 — Crossover Resolution Table

Status: **COMPLETE — SELECTION TABLE GENERATED, DETERMINISTIC, VERIFICATION-PINNED (RUNTIME UNWIRED)**

Slices 10A.1 and 10A.2 of [`docs/milestone-10a-crossover-resolution-plan.md`](milestone-10a-crossover-resolution-plan.md)
turn the coverage measurement into the offline resolution authority:

> Every one of the 345,696 two-segment cell states now resolves to exactly one published glyph under the never-empty invariant.

## Design decisions frozen by this slice

1. **Typed candidate set.** Straight owners (glyph IDs 0..745) plus connector
   owners (5796..6396) extracted directly from the published
   `by-bitmap.json` index: **746 + 601 = 1,347 candidates**. Fill-class owners
   are excluded by construction; a stroke cell can never resolve into one.
2. **Uniform boundary-attachment model.** A glyph's port set is defined as the
   set of boundary pixels it occupies, over 44 canonical slots (corners owned
   once). Desired ports map through the same slots. This avoids all semantic
   ambiguity (edge-running lines, corner sharing, zero-length connector arms):
   attachment is a pure pixel predicate, identical in every language port.
3. **Integer-scaled cost.**

```text
cost(C) = W_MISS*|D\P(C)| + W_EXTRA*|P(C)\D| + (1/128)*hamming(bitmap(C), unionBitmap)
scaled    costScaled = 128*(100*miss + 10*extra) + hamming      (exact integers)
ties      lexicographic attachment-slot list, then lower glyph ID
```

4. **Mates stay runtime-side.** Offline selection has no mate term because
   mated-ness depends on the committed stroke graph. Under the default
   `ACCEPT_LEAST_DAMAGE` policy the emitted glyph is always this table's
   winner; lost mates (`M \ P(winner)`) are computed at emit time for
   provenance only.
5. **Fill collisions demote to Tier 1.** The 642 states whose union bitmap is
   an exact fill-class owner are resolved by Tier 1 instead, per stroke
   policy.

## Frozen results

```text
pair states resolved                       345,696
tier 0 exact single-glyph                    2,177   (1,700 straight / 477 connector)
tier 1 typed approximation                 343,519   (201,321 straight winners /
                                                      142,198 connector winners)
tier 1 keeping every desired leg             41,521
tier 1 losing exactly one leg               174,349
tier 1 losing exactly two legs              127,649
tier 1 losing three or four legs                 0
```

Notable behaviors:

- The generic connector vocabulary carries more than its Tier 0 share:
  connectors win **142,198 Tier 1 selections (41%)**, confirming they are the
  right approximate basis for crossings.
- No state ever loses more than half its legs. The worst cases (costScaled
  26,914) are far-apart diagonal pairs where both legs survive but geometry
  is coarse.
- Full-edge runners win only where they are the sole connectivity-preserving
  option, paying `W_EXTRA` for their spurious attachments — the "off-angle
  beats empty" directive expressed numerically.

## Artifacts

```text
artifacts/manifest/vocabulary-v1/crossover-resolution.tsv           full table (345,696 rows, sorted)
artifacts/manifest/vocabulary-v1/crossover-resolution-stats.json    weights header, digests, aggregates
artifacts/manifest/vocabulary-v1/crossover-resolution-report.md     human-readable summary
```

`crossover-resolution.tsv` columns: `stateKey`, `tier`, `glyphId`,
`missedPorts`, `extraPorts`, `costScaled`. Codepoint = `U+E000 + glyphId`.
(Promoted from `artifacts/research/crossovers/resolution/` in slice 10A.3.)

Commands:

```powershell
node scripts/generate-crossover-resolution.mjs
node scripts/verify-crossover-resolution.mjs
```

Regeneration is byte-identical; the verifier pins all headline counts,
histograms, and allocation-free gates.

## Standing design note

`W_MATE` does not participate in offline selection: mated-ness depends on the
committed stroke graph and is computed at emit time as provenance under the
default `ACCEPT_LEAST_DAMAGE` policy (plan §7).
