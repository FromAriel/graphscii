# GraphSCII Connectivity

This document defines the current machine-readable connectivity model for GraphSCII straight-line glyphs.

## Ports

GraphSCII v1 uses an 8-column × 16-row cell with these boundary ports:

```text
Top:     T0..T7
Bottom:  B0..B7
Left:    L0..L15
Right:   R0..R15
```

A straight geometric candidate connects exactly two ports.

Examples:

```text
L13 ↔ R4
T2  ↔ B6
L8  ↔ T3
```

## Visual glyphs versus geometric aliases

The canonical bitmap is the visual identity. Different mathematical straight segments may rasterize to exactly the same 8×16 bitmap.

Those candidates share one glyph but remain separate aliases.

For example, one glyph record may contain several aliases:

```json
{
  "connectivity": {
    "semantics": "alternative-alias-pairs",
    "aliasCount": 3
  },
  "aliases": [
    {
      "candidateId": 0,
      "aliasKey": "straight:L0>R0",
      "type": "straight",
      "family": "LR",
      "start": "L0",
      "end": "R0",
      "connections": [
        { "edge": "L", "index": 0 },
        { "edge": "R", "index": 0 }
      ]
    }
  ]
}
```

The important rule is:

> Ports belonging to different aliases are alternatives, not simultaneous branches.

If one raster glyph represents both `L0 ↔ R0` and `L0 ↔ T7`, that does **not** mean the glyph is a three-way junction connecting `L0`, `R0`, and `T7` at once. It means either mathematical interpretation may legitimately produce that same visual bitmap.

Junction glyphs will have their own simultaneous-connection semantics later.

## Direction

Straight geometry is undirected for lookup. The generator still preserves an authored `start` and `end` because generation order and provenance matter, but a program may query either orientation.

Therefore both keys are materialized:

```text
L13>R4
R4>L13
```

Both resolve to the same glyph/candidate alias. The reverse entry carries:

```json
{ "reversed": true }
```

## Generated indexes

Running:

```powershell
npm run generate
```

produces:

```text
artifacts/manifest/indexes/
├── by-codepoint.json
├── by-bitmap.json
├── by-port.json
└── by-connection-pair.json
```

### `by-codepoint.json`

Maps a six-digit Unicode stem directly to a glyph ID.

```json
"U+00E000": 0
```

### `by-bitmap.json`

Maps the canonical 32-character bitmap key directly to a glyph ID.

### `by-port.json`

Maps a boundary port to every straight alias using that port.

Entries are intentionally compact:

```json
{
  "glyphId": 42,
  "candidateId": 51,
  "otherPort": "R4"
}
```

The full glyph and alias metadata is resolved through `glyphs.json`.

### `by-connection-pair.json`

Maps a requested port pair directly to a glyph/candidate alias:

```json
"L13>R4": {
  "glyphId": 42,
  "candidateId": 51,
  "reversed": false
}
```

The reverse query is also present.

## Current verified counts

For the straight-line baseline:

```text
mathematical aliases         832
visual glyphs                746
boundary ports                48
by-codepoint entries         746
by-bitmap entries            746
by-port entries             1664
connection-pair entries     1664
```

`1664 = 832 × 2` because every straight alias touches two ports and because both query orientations are materialized in the connection-pair index.

## Future extension

Curves will extend endpoint metadata with tangent information. Junctions will introduce simultaneous multi-port connectivity. Those additions must preserve the distinction between:

- visual bitmap identity,
- geometric alias/provenance,
- alternative interpretations,
- simultaneous connections.
