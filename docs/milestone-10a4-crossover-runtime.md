# Milestone 10A.4 — Single-Glyph Crossover Runtime

Status: **COMPLETE — LAYERED OVERSTRIKE REMOVED, TABLE-AUTHORITATIVE RUNTIME LIVE**

Slice 10A.4 of [`docs/milestone-10a-crossover-resolution-plan.md`](milestone-10a-crossover-resolution-plan.md)
swapped the demo compositor's layered overstrike for the offline resolution
table. Every multi-segment cell now renders **exactly one published glyph**.

## What replaced what

```text
removed  graphscii-demo/crossover-compositor-v2.js
           (union-bitmap lookup + exact layered overstrike fallback)
added    graphscii-demo/crossover-compositor-v3.js
           (crossover-resolution.tsv lookup; one codepoint per cell; never layers)
```

The v1→v2 history is preserved in git; the layered architecture it carried is
gone from the runtime and is forbidden by CI grep gates
(`exact-layered-straights`, `resolution.codepoints`, `unionBitmapKey` must not
reappear).

## v3 runtime contract

1. **Pure core, DOM-guarded** (draw-v6 house pattern): canonicalization,
   state-key construction, table parsing, boundary-attachment labels, mate
   computation, and cell resolution are all Node-testable; CI runs
   `GraphSCIICrossoversV3.selfTest()` headlessly.
2. **Canonical state keys at runtime**: segment keys are canonicalized into
   the six family directions, deduplicated, sorted, then joined — identical
   construction to the generator (plan §4), so unordered cell states map to
   exactly one table row.
3. **One glyph per cell, always**:
   - single distinct segment → its straight owner;
   - two segments → `U+E000 + glyphId` from the resolution table (Tier 0 or
     Tier 1 alike — rendering cannot tell them apart);
   - more than two distinct segments or a table miss → explicit unresolved
     marker (the red box stays visible) with a loud status count. Layering is
     never a fallback.
4. **Fail-open toward honesty**: if the resolution table fails to load,
   crossover cells stay marked unresolved with an explanatory status line.
   The by-bitmap index is now provenance-only: losing it degrades lost-mate
   reporting but never rendering.
5. **Mate-loss provenance**: for every resolved crossover cell the compositor
   computes desired ports, mated ports (canonical nodes shared with other
   cells), and `lostMates = matedPorts \ attachments(winner)` using the
   winner bitmap's boundary pixels. This is plan §7's `ACCEPT_LEAST_DAMAGE`
   reporting surface.
6. **Debug export integration**: `debug-export-v2.js` now embeds a
   `crossovers` section (summary + per-cell provenance) and the panel
   snapshot displays the compositor's final glyph/semantic for crossover
   cells instead of the stale first-pass paint.

## Status line semantics

```text
Continuous shared-port path                                   no crossover cells
Resolution table unavailable: N crossover cells unresolved     fail-open honesty
R crossover cells: X exact, Y best-fit (Z leg-loss), U unresolved
```

## Verification added

- Headless self-test covering reverse-alias canonicalization (`R8>L0 ≡
  L0>R8`), sorted/deduplicated state keys, the boundary-attachment model
  (including edge-running columns attaching all left ports plus T0/B0),
  cross-cell mate computation, and all four resolution kinds (single /
  resolved / unresolved / unsupported).
- CI workflow updated end-to-end: syntax checks, self-test step, v3 grep
  gates (canonicalization, sorted keys, single-glyph emission, table URL,
  MutationObserver trigger, lostMates), anti-layering negative greps,
  obsolete-entrypoint rejection of v2 filenames, server MIME checks extended
  to the TSV (`text/plain`).
- `serve.py` gained an explicit `.tsv → text/plain; charset=utf-8` mapping.
- Local run confirmed: table loads 345,697 lines, zero fill-class winners,
  all three browser scripts pass `node --check`, both self-tests pass.

## Known scope boundaries (unchanged)

- Three-plus distinct segments in one cell are explicitly unsupported
  (red-boxed, counted) until pair data justifies extending enumeration.
- Fill-side/tone compositing remains future work.

## Next slice

```text
10A.5  demo README/PLAN integration + final layered-mode doc sweep
```
