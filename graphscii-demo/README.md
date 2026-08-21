# GraphSCII Draw Demo

A browser-native drawing application that renders continuous drawing geometry into the frozen **GraphSCII — Graphical Standard for Computer Information Interchange** vocabulary by Ariel Williams.

GraphSCII Draw is intentionally GraphSCII-native rather than a vector editor with a conversion button. Freehand strokes, straight lines, cubic Béziers, and ellipses remain editable geometry, while the visible canvas is continuously resolved to actual GraphSCII PUA characters and displayed with `GraphSCII-Regular.ttf`.

## Current vertical slice

- Select and move objects
- Freehand drawing
- Straight lines with Shift 45° snapping
- Four-click cubic Bézier construction
- Ellipses, with Shift circle constraint and Alt/Option center-out drawing
- GraphSCII-native 100%, 75%, 50%, and 25% tonal strengths
- Toolbar tone control plus **Alt/Option + mouse wheel** density adjustment
- Optional ellipse fill
- Exact semantic straight resolution through the published 1,664-entry connection-pair index
- Exact fill resolution through the published GraphSCII boundary/side/style grammar
- Connector resolution only for genuine multi-object authored T/X-style junctions
- Single authored strokes never gain connector semantics merely because they self-cross inside one character cell
- Deterministic DDA fitting of authored strokes to GraphSCII cell boundaries before glyph lookup
- First-visit fragment covering that preserves revisited freehand cells instead of deleting authored loops
- Deterministic terminal projection for sub-cell same-edge U-turns that have no exact straight owner
- Fail-closed conversion issues for geometry that GraphSCII v1 cannot encode exactly
- Undo/redo
- GraphSCII character-cell inspection
- Editable `.graphscii` JSON save/open
- GraphSCII Unicode text export
- Exact canonical-pixel PNG export
- Cell-grid viewing mode and zoom

## Exact conversion model

The current solver does **not** search the full glyph corpus by visual similarity. It derives geometry first and then asks the published GraphSCII semantic tables for the exact owner allowed by that geometry.

```text
editable geometry
      ↓
continuous centerline / ellipse geometry
      ↓
GraphSCII 8×16 cell geometry
      ↓
DDA stroke fitting + shared-port invariant
      ↓
semantic classification
  ├── straight: published connection-pair table
  ├── fill: published boundary/side/style grammar
  └── connector: published orthogonal/diagonal connector tables
      ↓
exact GraphSCII PUA character grid
      ↓
GraphSCII-Regular.ttf
```

For an ordinary open stroke, each retained GraphSCII cell is required to finish with exactly two boundary ports. Revisited cells split the stroke into deterministic straight fragments rather than authorizing a connector or globally erasing a loop. A connector is eligible only when multiple authored objects create a genuine three- or four-arm junction.

A tiny U-turn can enter and leave the same edge of one 8×16 character cell. GraphSCII v1 has no straight owner for a same-edge pair such as `R5 ↔ R8`. The fitter preserves that authored cell and projects only the fragment terminal to the nearest different boundary edge, after which the result must still resolve through the published straight table.

Filled ellipses use the published fill grammar directly. Unsupported overlaps or partial-fill cases that have no exact GraphSCII v1 semantic are reported as conversion issues rather than silently substituted with visually similar glyphs.

## One-command launch

From `graphscii-demo/`:

```powershell
python launch.py
```

The launcher uses only Python's standard library. It installs the npm dependencies when `node_modules/` is missing, runs the production build, self-hosts `dist/` at `http://127.0.0.1:5174/`, opens the browser, and stays running until Ctrl+C.

The self-host server deliberately sends `Cache-Control: no-store` and opens a build-fingerprinted URL such as `?build=abc123...`. This prevents Chrome from silently reusing an older JavaScript bundle after a solver rebuild.

For a simple rebuild loop while editing:

```powershell
python launch.py --watch
```

Useful options:

```text
--host 0.0.0.0    expose the local server on the LAN
--port 8080        use another port
--no-open          do not open a browser automatically
--no-build         serve the existing dist/ without rebuilding
--install          force npm install before building
```

## Run with npm directly

From `graphscii-demo/`:

```powershell
npm install
npm run dev
```

`predev` synchronizes the frozen GraphSCII font and canonical semantic assets from the repository into the demo's ignored `public/assets/` directory. The demo does not maintain a second authored copy of the font or registry.

## Verify and build

```powershell
npm run verify
```

The verification chain is:

```text
verify:assets
      ↓
verify:semantic
      ↓
verify:runtime
      ↓
TypeScript strict check
      ↓
production Vite build
```

The gates verify the frozen 6,397-owner vocabulary, the 1,664 straight connection-pair rules, exact fill semantics, orthogonal and selected diagonal connector semantics, fitted shared-port invariants, and the actual runtime solver.

The main freehand regression is the original supplied 379-point failing drawing. Its authored centerline touches 397 GraphSCII cells. The runtime gate requires the real solver to emit exactly 397 registered **straight** owners, with zero conversion issues, zero fill/connector glyphs, and exactly the same occupied-cell count in Unicode text export. The historical invalid export occupied 424 cells because the old heuristic path spilled beyond the authored footprint.

## Display and export

The reference font is used for the interactive character-grid display. Exact PNG export is rasterized directly from the selected canonical registry bitmaps, so browser font antialiasing cannot alter exported canonical pixels.

See [`PLAN.md`](PLAN.md) for the original broader architecture and roadmap. Some solver sections in that planning document describe earlier exploratory raster/scoring approaches; this README describes the current exact semantic implementation.
