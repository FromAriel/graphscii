# GraphSCII Draw — Slice 1

This is the first implementation slice of the deterministic GraphSCII node-graph drawing tool.

## Core rule

The pointer does not choose arbitrary nearby glyphs and the editor does not search for a bitmap that looks close.

The real pointer trajectory determines which **cell edges are actually crossed**. Each crossing is snapped once to the nearest legal node on that exact edge.

That snapped boundary node is then mated mechanically into the adjacent cell:

```text
R7 ↔ L7
B3 ↔ T3
```

The mate keeps the same canonical node identity. It is never independently re-quantized in the neighboring cell.

Every stored line cell therefore contains exactly:

```text
cell
entry port
exit port
GraphSCII codepoint
```

and every consecutive segment must satisfy:

```text
previous.toNode === next.fromNode
```

## Geometry

The visible node field matches the GraphSCII 8×16 perimeter model:

- 8 top nodes
- 8 bottom nodes
- 16 left nodes
- 16 right nodes
- corner nodes are shared canonical nodes

Top/bottom and side nodes include the corners. They are not half-cell-offset guide points.

## Freehand

The implementation follows the same successful rule as the standalone node demo:

1. collect the real mouse trajectory, including coalesced pointer events when available;
2. find every exact cell-boundary intersection crossed by each mouse segment;
3. snap that intersection to the nearest node on **that edge only**;
4. assign the exit port to the cell being left;
5. obtain the adjacent entry port with the exact `mate()` rule;
6. emit the GraphSCII cell between the current entry and exit ports;
7. render that exact semantic with the published GraphSCII font.

Sparse pointer events are safe because every boundary crossed by the segment between events is enumerated.

Immediate cell backtracking caused by jitter is erased as a stack operation. If the path enters B from A and immediately returns to A, the detour is removed instead of leaving stale geometry behind.

## Other tools

Freehand, Line, Bezier, and Ellipse all use the same edge-crossing compiler. Line/Bezier/Ellipse only differ in how they generate the temporary guide trajectory.

The guide geometry is discarded after compilation. Stored document geometry is GraphSCII cell/port connectivity only.

## Rendering

The editor renders the actual published GraphSCII font. Each stored `fromPort → toPort` semantic resolves directly to the frozen straight-vocabulary codepoint and is drawn with `GraphSCII-Regular.ttf`.

There is no bitmap matcher, Hamming score, candidate ranking, visual fallback, or raster approximation step.

## Crossovers

When two strokes occupy one cell, the compositor resolves the cell to **exactly one published glyph** using the offline crossover-resolution table:

```text
artifacts/manifest/vocabulary-v1/crossover-resolution.tsv
```

That table was generated offline over all 345,696 two-segment cell states with declared topology costs (`W_MISS=100`, `W_EXTRA=10`, `ε=1/128` Hamming tie-break). Tier 0 entries are exact published matches; Tier 1 entries are typed best-fit selections among straight and connector owners only. Fill-class owners are excluded by construction.

Rules:

- every multi-segment cell emits exactly one codepoint — layered overstrike does not exist;
- segment keys are canonicalized into the six family directions before lookup, so reverse-drawn strokes resolve identically;
- three or more distinct segments in one cell are explicitly unsupported and stay red-boxed until pair data justifies extending enumeration;
- if the resolution table fails to load, crossover cells remain honestly unresolved rather than silently approximating.

Every crossover cell records provenance — tier, glyph ID, missed/extra ports, scaled cost, mated ports, and lost mates — visible in the status line and in the Debug Export.

## Runtime

The browser runtime is:

```text
graphscii-demo/draw-v6.js               node-graph stroke compiler and renderer
graphscii-demo/debug-export-v2.js       pointer/segment/provenance debug export
graphscii-demo/crossover-compositor-v3.js  single-glyph crossover resolution
```

All logic above each file's DOM guard is Node-testable; CI runs the self-tests headlessly.

The runtimes contain no dynamic import, Blob-module execution, `eval`, or `new Function`.

## Run

From the repository root:

```powershell
python graphscii-demo/serve.py 8002
```

If already inside `graphscii-demo`:

```powershell
python serve.py 8002
```

Then open:

```text
http://127.0.0.1:8002/graphscii-demo/
```

## Verification

From the repository root:

```powershell
node graphscii-demo/verify.mjs
node --check graphscii-demo/draw-v6.js
node -e "require('./graphscii-demo/draw-v6.js'); GraphSCIIDrawV6.selfTest()"
node -e "require('./graphscii-demo/crossover-compositor-v3.js'); GraphSCIICrossoversV3.selfTest()"
```

The draw self-test verifies:

- every internal `Rk ↔ Lk` mate has identical canonical node identity;
- every internal `Bk ↔ Tk` mate has identical canonical node identity;
- sparse and dense pointer sampling produce the same straight-line topology;
- enter/backtrack/continue jitter does not create duplicate cells or broken nodes;
- exact corner crossings remain continuous;
- every emitted semantic belongs to the frozen straight lookup;
- every consecutive emitted segment shares the exact same canonical node.

The crossover self-test additionally verifies reverse-alias canonicalization
(`R8>L0 ≡ L0>R8`), sorted and deduplicated state keys, the boundary-attachment
model, cross-cell mate computation, and all resolution kinds (single /
resolved / unresolved / unsupported).

The lab chain verifies the resolution table itself byte-for-byte:

```powershell
cd geometric-glyph-lab
npm run verify:crossover-resolution
```

CI also verifies font rendering, strict CSP compatibility, stable JavaScript MIME type, `Cache-Control: no-store`, the crossover table's line count, and zero fill-class winners.

## Deliberately absent

There is no bitmap matching, Hamming distance, supersampling target, glyph candidate scoring, continuity repair, or global route solver.

Crossovers never layer glyphs: every cell carries exactly one codepoint. States with three or more distinct segments are marked unresolved rather than approximated; fill-side and tone composition remain future work.
