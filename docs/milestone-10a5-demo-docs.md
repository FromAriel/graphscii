# Milestone 10A.5 — Demo Documentation Integration

Status: **COMPLETE — DOCS MATCH SHIPPED RUNTIME; LAYERED-MODE DOCTRINE SWEPT**

Slice 10A.5 of [`docs/milestone-10a-crossover-resolution-plan.md`](milestone-10a-crossover-resolution-plan.md)
brought the demo documentation in line with the shipped single-glyph
crossover runtime and removed the last traces of superseded doctrine.

## graphscii-demo/README.md

- Runtime section now lists the real three-file runtime
  (`draw-v6.js`, `debug-export-v2.js`, `crossover-compositor-v3.js`);
  the stale `draw-v5.js` references are gone.
- New **Crossovers** section documents the resolution-table contract:
  345,696 states, declared offline costs, tier semantics, canonicalized
  segment keys, explicit unsupported triples, fail-open honesty, and
  per-cell provenance (including lost mates) in the status line and Debug
  Export.
- Verification section updated: v6/v3 self-test commands, crossover
  self-test coverage summary, `npm run verify:crossover-resolution`, and
  the CI gates (line count, zero fill-class winners).
- "Deliberately absent" rewritten: layering never happens; every cell is
  one codepoint; fill-side/tone composition remains future work.

## graphscii-demo/PLAN.md

- §11 rewritten from the old refusal rule ("unsupported multi-segment
  state → illegal edit") to the adopted contract: tier 0 exact / tier 1
  typed best-fit / explicit unresolved for 3+ segments, with the normative
  never-empty, never-layered, fill-exclusion, and mate-provenance rules.
- §19 runtime-index list gained the crossover table lookup, replacing the
  obsolete per-connector-state index idea.
- §20 verification requirements gained **Crossover coverage** (table row
  count, zero fill winners, byte-identical regeneration, compositor
  self-test) and the round-trip note that one-glyph-per-cell makes the
  Unicode grid serialize as plain text.

## Doctrine sweep

Grep confirms no stale references remain: every surviving mention of
"layered" describes forbidden/historical behavior; no `draw-v5` references
survive outside git history.

## Milestone 10A final state

```text
10A.0  coverage measurement                        COMPLETE
10A.1/10A.2  enumeration + selection + artifact    COMPLETE
10A.3  verifier + npm wiring + CI + promotion      COMPLETE
10A.4  compositor v3 runtime swap                  COMPLETE
10A.5  docs integration + doctrine sweep           COMPLETE
10A.6  REROUTE_LOSER policy                        DEFERRED RESEARCH
```

The drawing tool now answers every two-stroke crossing deterministically,
exactly once per cell, inside the frozen 6,397-owner vocabulary — and the
answer serializes as plain text.
