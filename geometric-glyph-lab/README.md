# Geometric Glyph Lab

A first-stage research tool for designing a fixed-cell 8×16 graphics font.

The program generates every selected straight edge-to-edge geometric primitive, rasterizes each one into a canonical binary 8×16 bitmap, deduplicates raster-equivalent candidates, and preserves every geometric interpretation as an alias on the surviving glyph.

## Baseline families

- Left → Right: 16 × 16 = 256 candidates
- Top → Bottom: 8 × 8 = 64 candidates
- Left → Top: 16 × 8 = 128 candidates
- Left → Bottom: 16 × 8 = 128 candidates
- Right → Top: 16 × 8 = 128 candidates
- Right → Bottom: 16 × 8 = 128 candidates

All six families together generate exactly 832 mathematical candidates before deduplication.

## Canonical model

- Cell size: 8 × 16 pixels
- Bitmap representation: 16 bytes, one byte per row
- Visual identity: 128 binary pixels serialized as a 32-hex-character key
- Intended future font mapping: glyph `0x000` → `U+E000`, through glyph `0xFFF` → `U+EFFF`
- Rasterization: deterministic integer Bresenham line drawing

The bitmap is the source of truth. A later font compiler should derive outlines from these exact pixels rather than treating arbitrary vector outlines as canonical.

## Run

```powershell
npm install
npm run dev
```

Vite will print the local URL, normally `http://localhost:5173/`.

## Verify / build

```powershell
npm run check
npm run build
```

The production web app is written to `dist/`.

## Current capabilities

- Generate any combination of the six straight-line families
- Automatic deduplication by exact 8×16 bitmap identity
- Preserve duplicate candidate geometry as aliases
- Show candidate, unique, duplicate, and compression counts
- Browse all unique glyphs in a clickable 16-column atlas
- Inspect a glyph at 16× and true 1× size
- Inspect the exact 8×16 ASCII bitmap
- Show every geometric alias that produced a given bitmap
- Jump to a glyph by hexadecimal ID
- Export the unique glyph atlas as transparent PNG
- Export complete glyph/alias/bitmap metadata as JSON

## Deliberately not in this first slice

- Curves / Bézier families
- Junction masks
- Filled contours
- Circle / ellipse pieces
- Texture families
- Automatic 4,096-glyph scoring/allocation
- TTF/OTF/WOFF2 compilation

Those should be added only after the straight-line experiment tells us how much of the 4,096-slot vocabulary straight geometry actually consumes.

## First measured result

With all six straight families enabled, the current canonical rasterizer produces:

- 832 mathematical candidates
- 746 unique 8×16 bitmaps
- 86 duplicate candidates
- 10.3% candidate compression from exact raster equivalence
- Maximum of 4 geometric aliases sharing one bitmap

This is the first useful design result: straight edge-to-edge geometry currently consumes 746 visual glyphs, leaving most of a 4,096-glyph target space available for curves, junctions, fills, circles, textures, and specialized primitives.

## Run the included prebuilt version on Windows

A dependency-free compiled copy is included in `dist/`.

Double-click:

```text
run-local.cmd
```

Then open:

```text
http://localhost:5173/
```

This only requires Python to be available as `python`. It does not require `npm install`.

You can verify the prebuilt geometry engine with:

```powershell
node scripts/verify-prebuilt.mjs
```
