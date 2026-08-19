# GraphSCII

GraphSCII is an 8×16 fixed-cell graphics vocabulary. Each Unicode Private Use Area glyph is a deterministic binary geometric tile intended to compose with neighboring tiles into larger lines, curves, diagrams, silhouettes, textures, and other graphics.

The canonical source is geometry → deterministic 8×16 bitmap → deduplicated glyph registry. Font files are compiled outputs, not the source of visual truth.

## Current baseline

The straight-line generator currently produces:

- 832 mathematical edge-to-edge candidates
- 746 unique 8×16 bitmaps
- 86 duplicate candidates retained as aliases
- maximum 4 aliases for one bitmap

The current straight vocabulary has a **provisional** allocation:

```text
glyph IDs   0..745
Unicode     U+00E000..U+00E2E9
rule        codepoint = U+E000 + glyphId
```

The allocation is explicit in `spec/straight-allocation.json` but is not frozen as a public API until GraphSCII v1.

## Generate the artifact tree

From `geometric-glyph-lab/`:

```powershell
npm run generate
```

Generation now has three stages:

```text
base bitmap/artifact generation
            ↓
straight semantic registry/index generation
            ↓
straight-line Markdown catalog generation
```

To verify an existing generated tree without rewriting it:

```powershell
npm run verify
```

The generator emits:

```text
artifacts/
├── manifest/
│   ├── glyphs.json
│   ├── stats.json
│   └── indexes/
│       ├── by-codepoint.json
│       ├── by-bitmap.json
│       ├── by-port.json
│       └── by-connection-pair.json
├── glyphs/
│   ├── ascii/
│   │   └── U+00E000.txt ...
│   └── png/
│       └── U+00E000.png ...
├── classes/
│   └── straight-lines.md
└── atlases/
    ├── all.png
    ├── page-0.png
    ├── page-1.png
    └── page-2.png
```

Every current glyph gets one exact 8×16 ASCII bitmap and one native 8×16 transparent PNG. Filled PNG pixels are opaque black; empty pixels are transparent.

`artifacts/classes/straight-lines.md` is generated from the semantic manifest plus the canonical per-glyph ASCII files. It contains all 746 visual glyphs, all 832 mathematical aliases, exact 8×16 ASCII renderings, connectivity semantics, bitmap keys, family membership, and links to each glyph's canonical ASCII/PNG artifacts.

The catalog is not hand-maintained. `npm run verify:catalog` regenerates its expected contents in memory and requires byte-for-byte equality.

## Programmatic use

`artifacts/manifest/glyphs.json` lets software use GraphSCII without reverse-engineering a font file. Each glyph record includes:

- numeric glyph ID and hexadecimal ID
- Unicode codepoint and character
- family membership
- exact 16-row hexadecimal bitmap
- stable 128-bit bitmap key
- every geometric alias that rasterized to that bitmap
- explicit connectivity semantics and alias endpoints
- paths to its ASCII and PNG artifacts

Straight aliases have keys such as:

```text
straight:L13>R4
```

Raster-equivalent aliases remain separate geometric interpretations even though they share one visual glyph. Ports from different aliases are **alternatives**, not simultaneous junction branches.

Generated lookup indexes let programs resolve:

```text
codepoint          → glyph ID
bitmap key         → glyph ID
port               → matching aliases
port pair          → glyph ID + candidate alias
```

Both orientations of a straight connection are materialized, so `L13>R4` and `R4>L13` both resolve directly.

A renderer can ultimately either emit GraphSCII Unicode characters using the font or copy the canonical PNG/atlas tile directly.

## Canonical format and connectivity

See:

- [`docs/format.md`](docs/format.md) — frozen GraphSCII v1 bitmap contract
- [`docs/connectivity.md`](docs/connectivity.md) — straight connectivity and lookup semantics
- [`docs/milestone-2a-semantic-registry.md`](docs/milestone-2a-semantic-registry.md) — semantic-registry slice
- [`docs/milestone-2b-straight-catalog.md`](docs/milestone-2b-straight-catalog.md) — generated straight-line catalog slice
- [`PLAN.md`](PLAN.md) — living architecture and roadmap
