# GraphSCII Draw Demo

A browser-native drawing application that renders continuous drawing geometry into the frozen **GraphSCII — Graphical Standard for Computer Information Interchange** vocabulary by Ariel Williams.

This demo is intentionally a GraphSCII-native editor rather than a vector editor with a conversion button. Freehand strokes, straight lines, cubic Béziers, and ellipses remain editable geometry, while the visible canvas is continuously resolved to actual GraphSCII PUA characters and displayed with `GraphSCII-Regular.ttf`.

## Current vertical slice

- Select and move objects
- Freehand drawing with smoothed rasterization
- Straight lines with Shift 45° snapping
- Four-click cubic Bézier construction
- Ellipses, with Shift circle constraint and Alt/Option center-out drawing
- GraphSCII-native 100%, 75%, 50%, and 25% phase-locked dither strengths
- Toolbar dither control plus **Alt/Option + mouse wheel** density adjustment
- Optional ellipse fill
- Dirty-region glyph solving with 4× supersampling
- Canonical-registry glyph matching plus neighbor continuity scoring
- Undo/redo
- GraphSCII character-cell inspection
- Editable `.graphscii` JSON save/open
- GraphSCII Unicode text export
- Exact canonical-pixel PNG export
- Cell-grid viewing mode and zoom

## Run locally

From `graphscii-demo/`:

```powershell
npm install
npm run dev
```

`predev` copies the frozen assets from the repository into the demo's ignored `public/assets/` directory:

```text
../artifacts/fonts/GraphSCII-Regular.ttf
../artifacts/manifest/vocabulary-v1/registry.json
```

The demo does not maintain a second copy of the font or registry.

## Verify and build

```powershell
npm run verify
```

That verifies the frozen GraphSCII assets, type-checks the application, and produces a static build in `dist/`.

## Rendering model

```text
editable geometry
      ↓
4× supersampled coverage
      ↓
phase-locked GraphSCII dither mask
      ↓
8×16 target cell
      ↓
canonical 6,397-glyph registry match
      ↓
neighbor continuity relaxation
      ↓
GraphSCII PUA character grid
      ↓
GraphSCII-Regular.ttf
```

The reference font is used for the interactive character-grid display. Exact PNG export is rasterized directly from the selected registry bitmaps, so browser font antialiasing cannot alter exported canonical pixels.

See [`PLAN.md`](PLAN.md) for the broader architecture and roadmap.
