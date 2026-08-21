# GraphSCII Draw — Slice 1

This is the first implementation slice of the deterministic GraphSCII node-graph drawing tool.

## Rule

The editor does **not** draw into an 8×16 pixel target and does not search for a glyph that looks close.

The only committed drawing geometry is:

```text
GraphSCII node → GraphSCII node
```

Every committed segment stores its cell, from-port, and to-port and directly resolves that exact semantic to the existing GraphSCII straight codepoint.

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

becomes no movement before either crossing is quantized to a GraphSCII port. This prevents mouse jitter from leaving a stale segment in a cell or re-entering the same cell through a different port.

Only the surviving crossings are quantized. Each crossing therefore becomes one authoritative shared GraphSCII node used by both adjacent cells.

Before a path can be committed, the runtime verifies:

```text
previous.toNode === next.fromNode
```

for every consecutive segment. Same-edge segments and broken shared-node continuity are rejected rather than rendered.

## Browser runtime

The browser runtime is split into two ordinary scripts:

```text
graphscii-demo/draw-core-v3.js
graphscii-demo/draw-ui-v3.js
```

`draw-core-v3.js` contains the node lattice, deterministic straight lookup, pointer normalization, crossing-walk normalization, and topology validation. `draw-ui-v3.js` contains only browser/canvas interaction.

There are no dynamic imports, Blob-module execution, eval, `new Function`, or runtime source-code evaluation.

## Run

From the repository root:

```powershell
python graphscii-demo/serve.py 8002
```

If you are already inside `graphscii-demo`:

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
node --check graphscii-demo/draw-ui-v3.js
node -e "global.window=global; require('./graphscii-demo/draw-core-v3.js'); GraphSCIICore.selfTest()"
```

CI also runs the topology self-test under Node and verifies the strict CSP/no-cache development server.

## Deliberately absent

There is no bitmap matching, Hamming distance, supersampling, glyph candidate scoring, visual fallback, neighbor continuity repair, line/fill family guessing, or global route solver.

If a user intentionally produces a real multi-segment cell, Slice 1 still marks it as unresolved until exact connector composition is implemented. Accidental overlap from pointer backtracking is not an accepted state.
