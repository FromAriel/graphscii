# GraphSCII

GraphSCII is an 8×16 fixed-cell graphics vocabulary. Each Unicode Private Use Area glyph is a deterministic binary geometric tile intended to compose with neighboring tiles into larger lines, curves, diagrams, silhouettes, textures, and other graphics.

The canonical source is geometry → deterministic 8×16 bitmap → deduplicated glyph registry. Font files are compiled outputs, not the source of visual truth.

## Current baseline

The straight-line generator currently produces:

- 832 mathematical edge-to-edge candidates
- 746 unique 8×16 bitmaps
- 86 duplicate candidates retained as aliases
- maximum 4 aliases for one bitmap

## Generate the artifact tree

From `geometric-glyph-lab/`:

```powershell
npm run generate
```

This recreates `../artifacts/` and verifies the result immediately.

To verify an existing generated tree without rewriting it:

```powershell
npm run verify:artifacts
```

The generator emits:

```text
artifacts/
├── manifest/
│   ├── glyphs.json
│   └── stats.json
├── glyphs/
│   ├── ascii/
│   │   └── U+00E000.txt ...
│   └── png/
│       └── U+00E000.png ...
└── atlases/
    ├── all.png
    ├── page-0.png
    ├── page-1.png
    └── page-2.png
```

Every current glyph gets one exact 8×16 ASCII bitmap and one native 8×16 transparent PNG. Filled PNG pixels are opaque black; empty pixels are transparent.

## Programmatic use

`artifacts/manifest/glyphs.json` lets software use GraphSCII without reverse-engineering a font file. Each glyph record includes:

- numeric glyph ID and hexadecimal ID
- Unicode codepoint and character
- family membership
- exact 16-row hexadecimal bitmap
- stable 128-bit bitmap key
- every geometric alias that rasterized to that bitmap
- paths to its ASCII and PNG artifacts

A renderer can ultimately either emit GraphSCII Unicode characters using the font or copy the canonical PNG/atlas tile directly.

## Canonical format

See [`docs/format.md`](docs/format.md) for the frozen GraphSCII v1 bitmap contract and [`PLAN.md`](PLAN.md) for the living architecture and roadmap.
