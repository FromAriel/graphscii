# Milestone 5B.1 — Orthogonal Generic Connector Basis

Status: **IN IMPLEMENTATION**

This slice deliberately replaces the open-ended junction search with a compact orthogonal basis.

For every canonical cell intersection `(x,y)` with `x=0..7` and `y=0..15`, generate exactly five semantic connector masks:

```text
NESW  full four-leg cross
ESW   missing north
NSW   missing east
NEW   missing south
NSE   missing west
```

Raw semantic population:

```text
8 x positions × 16 y positions × 5 masks = 640 semantics
```

The raster is intentionally literal and generic:

- north arm: `(x,0)..(x,y)`
- east arm: `(x,y)..(7,y)`
- south arm: `(x,y)..(x,15)`
- west arm: `(0,y)..(x,y)`
- the intersection pixel `(x,y)` is always ON

No diagonal/hub search is involved. Edge and corner cases are allowed to degenerate naturally; exact bitmap dedup then identifies which of the 640 semantics are genuinely distinct visual owners.

The generator must report:

- unique orthogonal raster owners,
- semantic aliases created by edge/corner degeneracy,
- exact reuse against `graphscii-graphics-v0`,
- total novel PUA cost,
- whether the deduplicated family fits the 604-slot reserve,
- if trimming is still required, a deterministic low-value trim list ranked by zero/one-pixel arm degeneracy before any interior connector is considered.

The full-cross family is mandatory in intent: all 128 `(x,y)` crossing positions remain addressable semantically even if an edge/corner raster aliases a three-leg form.

This slice does not allocate codepoints. It identifies the generic orthogonal connector owners that a later allocation step will freeze.
