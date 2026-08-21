# GraphSCII Draw — Slice 1

This is the first implementation slice of the deterministic GraphSCII node-graph drawing tool.

## Rule

The editor does **not** draw into an 8×16 pixel target and does not search for a glyph that looks close.

The only drawing geometry is:

```text
GraphSCII node → GraphSCII node
```

Every committed segment stores:

```text
cell
from port
to port
```

and directly resolves that exact semantic to the existing GraphSCII straight codepoint.

## Tools in Slice 1

- Freehand
- Line
- Bezier
- Ellipse
- Undo
- Clear

All four drawing tools produce the same stored result: an ordered sequence of exact node-to-node segments.

Bezier control points and ellipse bounds are temporary input construction only. They are snapped to GraphSCII nodes and are not retained as a hidden vector drawing after the node path is committed.

## Deliberately absent

There is no:

- bitmap matching
- Hamming distance
- supersampling
- glyph candidate scoring
- visual fallback
- neighbor continuity repair
- line/fill family guessing
- global route solver

If more than one distinct segment occupies one cell, Slice 1 marks that cell as an unresolved overlap. It does not guess. Exact connector composition is a later slice.

## Run

Use the included server. It serves the repository root and explicitly sends `.mjs` as JavaScript, avoiding Windows/Python MIME-table differences:

```powershell
python graphscii-demo/serve.py 8002
```

Then open:

```text
http://127.0.0.1:8002/graphscii-demo/
```

You can choose another port by replacing `8002`.

Do **not** serve only the `graphscii-demo` directory: the demo also needs the canonical font under `artifacts/fonts/`.

## Verify

From the repository root:

```powershell
node graphscii-demo/verify.mjs
node --check graphscii-demo/app.mjs
python -m py_compile graphscii-demo/serve.py
```

The verifier freezes the direct straight-lookup contract:

- 1,664 directed port-pair entries
- 746 visual straight owners
- both directions of every pair resolve to the same codepoint
- every codepoint remains inside `U+E000..U+E2E9`
- no same-edge segment is present
