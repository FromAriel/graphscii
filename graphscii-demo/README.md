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

## Runtime

The browser has one runtime:

```text
graphscii-demo/draw-v5.js
```

The obsolete split core/UI runtimes were removed.

The runtime contains no dynamic import, Blob-module execution, `eval`, or `new Function`.

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
node --check graphscii-demo/draw-v5.js
node -e "require('./graphscii-demo/draw-v5.js'); GraphSCIIDrawV5.selfTest()"
```

The executable self-test verifies:

- every internal `Rk ↔ Lk` mate has identical canonical node identity;
- every internal `Bk ↔ Tk` mate has identical canonical node identity;
- sparse and dense pointer sampling produce the same straight-line topology;
- enter/backtrack/continue jitter does not create duplicate cells or broken nodes;
- exact corner crossings remain continuous;
- every emitted semantic belongs to the frozen straight lookup;
- every consecutive emitted segment shares the exact same canonical node.

CI also verifies font rendering, strict CSP compatibility, stable JavaScript MIME type, and `Cache-Control: no-store`.

## Deliberately absent

There is no bitmap matching, Hamming distance, supersampling target, glyph candidate scoring, continuity repair, or global route solver.

Intentional self-intersections that require connector glyph composition remain a later slice. Ordinary non-self-crossing strokes must not produce unresolved overlap cells.
