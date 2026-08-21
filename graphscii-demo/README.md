# GraphSCII Draw — Slice 1

This is the first implementation slice of the deterministic GraphSCII node-graph drawing tool.

## Rule

The editor does **not** draw into an arbitrary raster target and does not search for a glyph that looks close.

The only committed drawing geometry is:

```text
GraphSCII node → GraphSCII node
```

Every committed segment stores its cell, from-port, and to-port.

## Tools in Slice 1

- Freehand
- Line
- Bezier
- Ellipse
- Undo
- Clear

All four drawing tools produce the same stored result: an ordered sequence of exact node-to-node segments.

Bezier control points, ellipse bounds, and normalized pointer samples are temporary input construction only. They are not retained as hidden drawing geometry after the node path is committed.

## Freehand topology rule

Freehand input is bridged, spatially resampled, and lightly smoothed before GraphSCII compilation. The compiler then builds a **cell-boundary crossing walk before choosing any GraphSCII node**.

Immediate cell backtracking is cancelled at that level:

```text
A → B
B → A
```

becomes no movement before either crossing is quantized to a GraphSCII port.

Only surviving crossings are quantized. Each crossing becomes one authoritative shared GraphSCII node used by both adjacent cells.

Before a path can be committed, the runtime verifies:

```text
previous.toNode === next.fromNode
```

Same-edge segments and broken shared-node continuity are rejected rather than rendered.

## Exact display rendering

The editor does **not** use `CanvasRenderingContext2D.fillText()` to display GraphSCII line cells.

For every stored `fromPort → toPort` semantic, the display renderer executes the canonical GraphSCII 8×16 integer line raster rule directly and paints the resulting 8×16 cell at exactly 3×3 display pixels per GraphSCII pixel.

That means a right-edge endpoint and the adjacent cell's left-edge endpoint physically meet at the same cell boundary. Font baselines, hinting, text metrics, glyph bearings, and browser text rasterization cannot shift a displayed segment.

The font/codepoint mapping remains relevant for eventual text export, but it is no longer trusted as the editor's visual placement mechanism.

## Browser runtime

```text
graphscii-demo/draw-core-v3.js
graphscii-demo/draw-ui-v4.js
```

`draw-core-v3.js` owns node topology, pointer normalization, crossing-walk normalization, and continuity validation.

`draw-ui-v4.js` owns browser input and exact 8×16 cell bitmap display.

There are no dynamic imports, Blob-module execution, eval, `new Function`, or runtime source-code evaluation.

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

## Verify

From the repository root:

```powershell
node graphscii-demo/verify.mjs
node --check graphscii-demo/draw-core-v3.js
node --check graphscii-demo/draw-ui-v4.js
node -e "global.window=global; require('./graphscii-demo/draw-core-v3.js'); GraphSCIICore.selfTest()"
```

CI additionally rejects `fillText`, font loading, CSP-hostile execution, and stale browser runtimes from the editor display path.

## Deliberately absent

There is no bitmap matching, Hamming distance, supersampling, glyph candidate scoring, visual fallback, neighbor continuity repair, line/fill family guessing, or global route solver.

If a user intentionally produces a real multi-segment cell, Slice 1 still marks it as unresolved until exact connector composition is implemented.
