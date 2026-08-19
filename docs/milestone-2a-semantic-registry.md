# Milestone 2A — Straight-Line Semantic Registry

Status: **implemented and locally verified**.

This slice turns the existing 746 straight-line bitmaps into a machine-queryable geometric vocabulary without changing the canonical raster engine.

## What changed

A hand-maintained provisional allocation now lives at:

```text
spec/straight-allocation.json
```

It explicitly records:

```text
glyph IDs      0..745
Unicode        U+00E000..U+00E2E9
status         provisional
generation     LR, TB, LT, LB, RT, RB
assignment     codepoint = U+E000 + glyphId
```

The semantic stage runs after the existing base artifact generator:

```powershell
npm run generate
```

which now performs:

```text
base geometry/artifacts
        ↓
semantic registry enrichment
        ↓
semantic verification
```

## Manifest enrichment

`artifacts/manifest/glyphs.json` gains:

- `manifestSchemaVersion: 2`
- explicit provisional allocation metadata
- total alias count
- lookup-index paths
- per-glyph connectivity semantics
- stable per-alias keys such as `straight:L13>R4`
- exact endpoint records for each alias

Raster-equivalent aliases remain preserved. A multi-alias glyph uses `alternative-alias-pairs` semantics so software does not mistake alternative interpretations for a junction.

## Lookup indexes

The semantic generator emits:

```text
artifacts/manifest/indexes/
├── by-codepoint.json
├── by-bitmap.json
├── by-port.json
└── by-connection-pair.json
```

The indexes deliberately store compact glyph/candidate references rather than duplicating full glyph records.

Verified counts:

```text
visual glyphs               746
mathematical aliases        832
boundary ports               48
codepoint lookups           746
bitmap lookups              746
port index entries         1664
connection-pair lookups    1664
```

Both query orientations of a straight segment are materialized. For example, `L13>R4` and `R4>L13` resolve to the same candidate, with the reverse lookup marked `reversed: true`.

## Verification

`npm run verify` now includes semantic verification in addition to the prebuilt format regression and artifact verification.

The semantic verifier checks:

- allocation range and codepoint bounds
- all 746 glyph/codepoint lookups
- all 746 bitmap-key lookups
- all 832 aliases
- valid endpoint port ranges
- alias keys and endpoint metadata
- forward and reverse connection-pair lookups
- all 1664 port-index entries
- semantic statistics

The canonical `832 → 746 → 86` raster regression remains unchanged.

## Deliberately deferred

This slice does **not** generate the giant human-readable `straight-lines.md` catalog. That is Milestone 2B.

The full expanded semantic manifest/index snapshot also remains reproducibly generated on demand; a deliberate repository snapshot can be committed with the class catalog in the publication slice.
