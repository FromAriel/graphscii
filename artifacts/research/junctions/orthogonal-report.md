# Orthogonal Generic Connector Basis

Status: **GENERATED — RESEARCH-ONLY, UNALLOCATED**

The basis is exactly five semantic masks at every one of the 128 canonical 8×16 intersection positions: one full cross plus four one-arm-removed three-leg connectors.

## Counts

```text
intersection positions           128
masks per position                 5
raw semantic connectors          640
unique exact raster owners       548
semantic duplicates removed       92
graphics-v0 exact reuse owners     4
novel PUA owners required        544
available reserve                604
reserve remaining if allocated    60
```

## Generic families

- `NESW`: 128 full four-leg crossings.
- `ESW`: 128 three-leg connectors missing north.
- `NSW`: 128 three-leg connectors missing east.
- `NEW`: 128 three-leg connectors missing south.
- `NSE`: 128 three-leg connectors missing west.

Edge and corner positions intentionally degenerate. Exact bitmap dedup preserves every semantic alias while paying for a visual only once. Existing graphics-v0 reuse is also free.

The family fits the 604-slot reserve after exact dedup. No codepoints are allocated by this slice.
