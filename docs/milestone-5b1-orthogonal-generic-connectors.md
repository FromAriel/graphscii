# Milestone 5B.1 — Orthogonal Generic Connector Basis

Status: **COMPLETE — FULL-CHAIN VERIFIED, ALLOCATION-FREE**

This slice replaces the open-ended junction search with a compact orthogonal basis built from exactly the connector family we want to guarantee.

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

No diagonal/hub search is involved. Edge and corner cases degenerate naturally and are exact-deduplicated.

## Measured result

```text
intersection positions              128
semantic masks / position             5
raw semantic connectors              640
unique exact raster owners           548
semantic duplicates removed           92
owners with semantic aliases          48
maximum semantic aliases / owner      16
graphics-v0 exact-reuse owners         4
novel PUA owners required             544
protected reserve                    604
reserve remaining if allocated        60
```

So the complete 640-semantic orthogonal language fits without trimming. Exact dedup collapses 640 semantic requests to 548 visual owners, and four of those owners are already present in `graphscii-graphics-v0`, leaving only **544 novel glyphs** to allocate later.

## The generic connectors

The basis is exactly five 128-entry semantic sets:

1. **Full cross** — `NESW`, one at every `(x,y)` intersection.
2. **Three-leg, missing north** — `ESW`.
3. **Three-leg, missing east** — `NSW`.
4. **Three-leg, missing south** — `NEW`.
5. **Three-leg, missing west** — `NSE`.

Within each semantic family every `(x,y)` remains addressable. Edge and corner aliases simply point to the same exact visual owner instead of consuming another glyph.

Per-family exact bitmap diversity before cross-family dedup is:

```text
NESW full-cross        128 semantic → 128 unique within family
ESW missing-north      128 semantic → 121 unique within family
NSW missing-east       128 semantic → 113 unique within family
NEW missing-south      128 semantic → 121 unique within family
NSE missing-west       128 semantic → 113 unique within family
```

## Persistent artifacts

```text
artifacts/research/junctions/
├── orthogonal-connectors.json
├── orthogonal-owners.json
├── orthogonal-stats.json
└── orthogonal-report.md

spec/
└── orthogonal-junction-basis-v0.json
```

Permanent commands:

```text
npm run generate:orthogonal-connectors
npm run verify:orthogonal-connectors
```

Both are wired into the aggregate `npm run generate` and `npm run verify` chains.

The complete project typecheck/generate/verify pipeline passed before the generated artifacts were committed.

## Allocation consequence

This slice allocates zero codepoints, but it settles the orthogonal connector question:

> Preserve all 640 generic orthogonal semantics, exact-deduplicate them to 548 visual owners, reuse the 4 existing graphics-v0 owners, and allocate the remaining 544 novel owners in the later registry slice.

That would leave **60 PUA slots** for a small diagonal/special connector family.
