# GraphSCII Draw Demo Plan

## Purpose

Build a browser-based drawing program that uses the GraphSCII reference font and canonical registry as its native rendering system.

The program should feel like a small vector drawing application: the user can draw freehand strokes, straight lines, cubic Bézier curves, and ellipses, then edit those objects. Internally, however, the visible artwork is always resolved into actual GraphSCII characters.

The central product rule is:

> **GraphSCII is the document's visible rendering model, not merely an export format.**

The user draws continuous geometry, the application rasterizes that geometry into GraphSCII's logical 8×16 cell space, and the solver continuously chooses the best GraphSCII glyphs. This avoids a late conversion step where a vector drawing looks good until export and then degrades.

The app should remain useful as a static web application with no required backend.

---

## 1. Core processing model

The drawing pipeline is:

```text
USER INPUT
freehand / line / Bézier / ellipse
        │
        ▼
EDITABLE GEOMETRY MODEL
continuous coordinates and object properties
        │
        ▼
SUPERSAMPLED TARGET RASTER
ideal coverage for the affected area
        │
        ▼
GRAPHSCII CELL TARGETS
8×16 logical-pixel targets per character cell
        │
        ▼
GRAPHSCII SOLVER
semantic filtering + bitmap scoring + continuity scoring
        │
        ▼
GRAPHSCII CHARACTER GRID
actual Unicode PUA codepoints
        │
        ▼
GraphSCII-Regular.ttf
        │
        ▼
SCREEN
```

The canonical GraphSCII registry remains the computational source of truth. The TTF is used to display the selected codepoints, not as the source from which glyph bitmaps are repeatedly recovered during drawing.

---

## 2. Coordinate system and document dimensions

Every GraphSCII cell is exactly 8×16 logical binary pixels.

If a document is 100×50 GraphSCII cells, the underlying logical drawing area is:

```text
width:  100 × 8  = 800 logical pixels
height:  50 × 16 = 800 logical pixels
```

Vector objects are stored in continuous logical-pixel coordinates, not character coordinates. A line may therefore have endpoints such as:

```text
(183.4, 221.7) → (619.2, 478.8)
```

This allows normal smooth drawing behavior while preserving exact conversion into GraphSCII cells.

The character grid is derived from the geometry rather than forcing the user to construct shapes one cell at a time.

---

## 3. Initial tool set

The first complete tool palette should be intentionally small:

- Select
- Freehand
- Straight line
- Cubic Bézier
- Ellipse
- Eraser

The MVP should not attempt to become a full Photoshop or Illustrator clone.

Later tools can include rectangle, polygon, bucket fill, text, direct glyph painting, image import, gradients, and airbrush behavior.

---

## 4. Freehand tool

Pointer movement produces sampled points.

The app should not simply create one tiny line segment for every browser pointer event. Instead:

```text
raw pointer samples
        ↓
distance filtering
        ↓
stroke smoothing
        ↓
polyline / spline representation
        ↓
rasterization
        ↓
GraphSCII resolution
```

A lightweight Catmull-Rom spline or similarly predictable smoothing method is sufficient.

The original stroke remains an editable object. Suggested object structure:

```ts
interface FreehandStroke {
  type: "freehand";
  points: Point[];
  width: number;
  smoothing: number;
  tone: GraphSCIITone;
}
```

The GraphSCII cells are a rendered representation of that stroke, not the only surviving source data.

Freehand preview must update while the pointer is moving.

---

## 5. Straight-line tool

Interaction:

```text
pointer down  → set start anchor
pointer drag  → live GraphSCII preview
pointer up    → commit line object
```

Planned modifiers:

- Shift: angle snapping
- Alt: draw from center when appropriate
- optional later modifier: endpoint/grid snapping

Initial angle snapping can use 45-degree increments. Finer snapping can be added later.

The user should see the resolved GraphSCII result during the drag, not only a vector preview.

---

## 6. Cubic Bézier tool

The geometry model uses ordinary cubic Bézier curves:

```text
P0 = start anchor
P1 = first control point
P2 = second control point
P3 = end anchor
```

The editor should display anchors and handles on the overlay canvas while the GraphSCII result updates continuously underneath.

A simple first interaction model:

1. click start anchor;
2. click end anchor;
3. drag first control handle;
4. drag second control handle;
5. commit.

A later version may adopt a more Illustrator-like click-and-drag path workflow.

Bézier paths must remain editable after creation.

---

## 7. Ellipse tool

Ellipse objects should be stored using a geometry model that already supports future rotation:

```ts
interface EllipseObject {
  type: "ellipse";
  center: Point;
  radiusX: number;
  radiusY: number;
  rotation: number;
  strokeWidth: number;
  strokeTone: GraphSCIITone;
  fillEnabled: boolean;
  fillTone: GraphSCIITone;
}
```

The MVP can expose axis-aligned ellipses only, while preserving `rotation` in the model for later use.

Interaction is bounding-box drag with a live GraphSCII preview.

---

## 8. GraphSCII tonal and dithering system

This is a first-class part of the drawing model, not a cosmetic post-process.

GraphSCII v1 contains four canonical tonal classes:

```text
solid   100%
medium   75%
half     50%
light    25%
```

The application must expose these exact four strengths as drawing choices.

Suggested type:

```ts
type GraphSCIITone = 100 | 75 | 50 | 25;
```

### 8.1 UI control

The toolbar should include a compact tonal-density control near the stroke/fill controls.

Possible appearance:

```text
Fill: [████] 100%
Fill: [▓▓▓▓]  75%
Fill: [▒▒▒▒]  50%
Fill: [░░░░]  25%
```

Clicking the button cycles through:

```text
100 → 75 → 50 → 25 → 100
```

A popover may also expose all four choices directly.

### 8.2 Mouse-wheel shortcut

When the canvas is focused, `Alt + mouse wheel` should change the active GraphSCII tonal strength.

Recommended behavior:

```text
Alt + wheel up:
25 → 50 → 75 → 100

Alt + wheel down:
100 → 75 → 50 → 25
```

The value clamps at the ends rather than wrapping during wheel use. The toolbar button may wrap when clicked.

This shortcut should call `preventDefault()` only while the canvas is the active drawing surface and Alt is held, so ordinary page scrolling remains untouched otherwise.

Do not use Ctrl+wheel as the default because browsers commonly reserve it for page zoom and trackpad pinch gestures.

The shortcut should be documented in the tooltips and help panel and should be configurable later.

### 8.3 Fill versus no fill

`No fill` is separate from tone strength.

The four GraphSCII tonal values mean how a filled region is represented. They should not be overloaded to mean transparency or absence of fill.

For an ellipse, for example:

```text
fillEnabled = false
```

means outline only.

Whereas:

```text
fillEnabled = true
fillTone = 25
```

means a light GraphSCII dithered fill.

### 8.4 Tone on freehand and strokes

Tone can also be used by stroke-producing tools.

A 100% stroke produces solid logical coverage. A 75%, 50%, or 25% stroke requests the corresponding GraphSCII phase-locked dither treatment within the stroke's raster footprint.

This creates a useful drawing vocabulary beyond simple solid lines: light construction lines, shaded hatching, ghosted strokes, and tonal texture can all use the same control.

### 8.5 Phase locking

GraphSCII's dither masks are phase-locked to the canonical cell coordinate system. The drawing program must preserve that rule.

A filled region crossing multiple cells must not restart with a randomly shifted dither phase in every cell. The intended global geometry should resolve into GraphSCII fill glyphs whose dither structure remains visually coherent.

This is especially important for large ellipses, later polygons, and bucket fills.

### 8.6 Tone as solver metadata

The solver should know the requested tonal class.

For example, if a filled ellipse has `fillTone = 50`, candidate selection should prefer the GraphSCII half-density vocabulary for interior and partially covered cells rather than treating all 6,397 glyphs as equally appropriate.

The requested tone therefore participates in semantic filtering before bitmap similarity scoring.

---

## 9. GraphSCII glyph solver

Each GraphSCII graphical glyph is exactly one 8×16 binary bitmap: 128 bits.

The baseline matcher can represent a glyph as four 32-bit words:

```text
4 × uint32 = 128 bits
```

For a binary target cell and candidate glyph, the simplest error measure is:

```text
error = popcount(target XOR glyph)
```

The lowest Hamming error wins.

A brute-force comparison against 6,397 glyphs is already practical for small dirty regions, but the full solver should exploit GraphSCII semantics.

Recommended three-stage selection:

```text
semantic candidate filtering
        ↓
cheap bitmap/Hamming ranking
        ↓
coverage + neighbor continuity ranking
```

---

## 10. Semantic filtering

GraphSCII contains useful structural information rather than being an opaque font full of unrelated images.

The solver should use metadata when possible.

Examples:

- line geometry can prefer straight-line and connector classes;
- a path entering at `L11` and leaving at `T4` can prefer candidates with compatible boundary ports;
- a 50% filled shape can prefer half-density fill owners;
- a 25% filled shape can prefer light-density fill owners;
- a solid interior can prefer 100% solid fill owners.

Semantic filtering should reduce the candidate set while preserving an escape path to broader visual matching when necessary.

---

## 11. Supersampling and coverage-aware rasterization

The ideal geometry should not immediately be collapsed to hard binary pixels.

Small changes to a curve can otherwise make pixels flicker abruptly between on and off.

Use approximately 4× supersampling internally for affected regions.

Each logical GraphSCII pixel receives a coverage value from 0 to 1.

Example:

```text
0.00
0.18
0.52
0.91
1.00
```

The final GraphSCII glyph remains binary, but the solver has more information about which binary pattern best approximates the intended continuous geometry.

Recommended matching strategy:

1. convert coverage into a cheap binary target;
2. Hamming-rank all semantically allowed candidates;
3. keep the best ~32;
4. run coverage-aware error over those candidates;
5. keep the best ~4;
6. use neighbor/connectivity scoring to choose the winner.

This avoids expensive floating-point comparison against all 6,397 glyphs for every cell.

---

## 12. Neighbor and connectivity optimization

Cells should not always be optimized independently.

A glyph with one extra mismatched pixel may be visually superior if it joins perfectly to the adjacent cell, while the independently best bitmap may leave a visible discontinuity.

Suggested final score:

```text
score =
    pixelError
  + coverageError × A
  + boundaryMismatch × B
  + connectivityMismatch × C
  + toneMismatch × D
```

Exact weights should be tuned empirically.

A practical local relaxation pass can retain the top 4 candidates for each dirty cell and reconsider adjacent selections. There is no need for an enormous global optimizer in the first implementation.

---

## 13. Dirty-region recomputation

Never re-solve the whole document after every pointer movement.

Each object change produces a dirty bounding box covering:

```text
old object bounds
union
new object bounds
plus one-cell safety margin
```

Only cells intersecting that dirty region are rasterized and solved again.

This should make interactive preview practical even with brute-force candidate comparisons.

---

## 14. Document model

Save both the editable geometry and the exact resolved GraphSCII grid.

Conceptual structure:

```text
GraphSCII Drawing
├── format/version
├── document dimensions
├── vector objects
│   ├── freehand strokes
│   ├── lines
│   ├── Béziers
│   └── ellipses
├── rendering settings
├── tonal/dither settings
├── manual glyph locks
└── resolved GraphSCII character grid
```

Why keep both representations:

- vector objects preserve editability;
- the resolved character grid records the exact visible result;
- manual glyph overrides can coexist with regenerated geometry;
- export is immediate;
- files remain inspectable and testable.

Suggested native extension:

```text
.graphscii
```

Use JSON initially.

---

## 15. Manual glyph override

Automatic solving should not prevent hand tuning.

A cell can eventually be switched from:

```text
AUTO
```

to:

```text
LOCKED
```

A locked cell stores an explicit GraphSCII codepoint and is not replaced by automatic solving until unlocked.

This is important for artists who want to perfect junctions or deliberately choose a visually unusual glyph.

Dirty-region updates must respect locked cells.

---

## 16. Undo and redo

Undo/redo should operate on semantic drawing operations, not full-canvas image snapshots.

Examples:

```text
AddEllipse
MoveEllipse
ChangeFillTone
ChangeStrokeTone
ChangeStrokeWidth
MoveBezierHandle
DeleteObject
LockGlyph
UnlockGlyph
```

After an undo or redo, only the affected dirty region is solved again.

Changing tone from 100% to 25% on a selected object should be one undoable operation.

---

## 17. Rendering architecture

Use the canonical registry for solving and `GraphSCII-Regular.ttf` for display.

Recommended layers:

```text
Offscreen target raster
        ↓
GraphSCII output canvas
        ↓
interaction overlay canvas
```

The output canvas renders resolved GraphSCII codepoints.

The overlay canvas renders temporary UI only:

- selection outlines;
- Bézier handles;
- anchor points;
- bounding boxes;
- guides;
- cursor feedback;
- grid overlays.

The target raster is not normally shown to the user.

Do not depend on browser text flow/layout for the drawing surface. Explicit Canvas 2D placement gives deterministic cell positioning, faster dirty-region rendering, and easier overlays.

---

## 18. Font loading

Ship the existing GraphSCII reference font as a static application asset.

Conceptually:

```css
@font-face {
  font-family: "GraphSCII";
  src: url("./GraphSCII-Regular.ttf") format("truetype");
}
```

Wait for the font to load before declaring the drawing surface ready.

Tests should verify that the browser renderer's placement maintains the expected fixed cell advance.

The canonical raster registry remains authoritative even if the browser visually antialiases the font at some zoom levels.

---

## 19. Worker boundary

Design the solver as a module that can run in a Web Worker.

Main thread responsibilities:

```text
pointer/keyboard input
geometry editing
UI state
canvas presentation
```

Worker responsibilities:

```text
rasterize dirty geometry
build cell targets
candidate selection
coverage scoring
neighbor reconciliation
return resolved codepoints
```

The first prototype may initially run the solver on the main thread if performance is already adequate, but the API boundary should make worker migration straightforward.

---

## 20. Zoom and inspection modes

Zoom must not change document geometry.

Suggested zoom levels:

```text
25%
50%
100%
200%
400%
800%
```

Provide three view modes:

### Art view

Only the finished GraphSCII rendering.

### Cell view

Show GraphSCII character boundaries.

### Pixel view

At high zoom, show the canonical 8×16 logical-pixel structure of each cell.

These modes make the app useful both as an art tool and as a GraphSCII development/debugging tool.

---

## 21. Vector-guide overlay

Expose a prominent toggle:

```text
Vector Guides: On / Off
```

When off, the user sees only the actual GraphSCII artwork.

When on, the ideal vector geometry, anchors, handles, and construction guides appear over the resolved character result.

This makes the translation from continuous geometry into GraphSCII immediately understandable.

---

## 22. Glyph inspector

Hovering or selecting a cell should eventually show information such as:

```text
Codepoint: U+Exxx
GraphSCII owner ID
bitmap preview
pixel density
semantic aliases
boundary ports
solver score
current mode: auto/locked
requested tone
```

This is valuable for debugging the solver and demonstrates the GraphSCII standard itself.

---

## 23. Stroke width

Stroke width is measured in logical GraphSCII pixels rather than CSS pixels.

Initial choices can be integer values such as:

```text
1 px
2 px
3 px
4 px
...
```

Rasterization converts width into logical coverage, and the solver chooses the GraphSCII vocabulary that best represents that stroke.

Stroke width and tone are independent properties.

Examples:

```text
1 px at 100% tone
4 px at 100% tone
4 px at 50% tone
```

are all distinct drawing states.

---

## 24. Erasing

Two concepts are useful:

### Object deletion

Select an editable object and delete it.

### Brush erase

Paint subtractive geometry through the raster/object system.

For the first vertical slice, prioritize object deletion plus a simple eraser stroke implementation. More sophisticated destructive pixel/glyph editing can come later.

---

## 25. UI layout

Keep the application visually simple and artwork-first.

Conceptual desktop layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ GraphSCII Draw   New Open Save Export   Undo Redo    100%   │
├─────────┬──────────────────────────────────────┬─────────────┤
│ Select  │                                      │ Stroke      │
│ Pencil  │                                      │ Width: 1    │
│ Line    │            DRAWING CANVAS            │ Tone: 100%  │
│ Bézier  │                                      │ Fill: On    │
│ Ellipse │                                      │ Fill: 50%   │
│ Eraser  │                                      │ Grid: Off   │
│         │                                      │ Pixels: Off │
├─────────┴──────────────────────────────────────┴─────────────┤
│ Cell 43,18   U+Exxx   100×50 cells   Alt+Wheel: tone       │
└──────────────────────────────────────────────────────────────┘
```

The tonal control should be immediately visible rather than buried in a settings dialog.

---

## 26. Input and shortcut plan

Initial shortcuts:

```text
V              Select
P              Freehand/Pencil
L              Line
B              Bézier
E              Ellipse
X              Eraser
Delete         Delete selected object
Ctrl/Cmd+Z     Undo
Ctrl/Cmd+Y     Redo
Shift          Angle constraint where applicable
Alt+Wheel      Adjust active GraphSCII tone
```

Potential later shortcuts:

```text
[ / ]          stroke width
G              toggle cell grid
Shift+G        toggle pixel view
Space+drag     pan
+ / -          zoom
```

Accessibility requires every mouse-wheel-only convenience to have an equivalent button and keyboard path. `Alt+Wheel` is an accelerator, not the sole method of changing tone.

---

## 27. Export formats

### GraphSCII text

Export the actual Unicode PUA grid.

This is the most direct expression of GraphSCII as an interchange format.

### PNG

Rasterized final image.

### Editable GraphSCII drawing

Save the full JSON-based `.graphscii` document with geometry, settings, locks, and resolved glyphs.

### HTML

Later, export a self-contained or compact HTML presentation using the GraphSCII font and character grid.

### SVG

Later, either place GraphSCII characters as text or convert compiled glyphs to paths.

### Clipboard

A selected rectangular region can be copied as actual GraphSCII Unicode text.

---

## 28. Recommended implementation stack

Use a static, dependency-light web architecture:

```text
TypeScript
Vite
Canvas 2D
GraphSCII-Regular.ttf
canonical registry.json
Web Worker-compatible solver
IndexedDB and/or browser File System APIs for local saves
```

React is not required for the drawing engine. The core editor is inherently imperative, and plain TypeScript with a small component/UI layer may be easier to reason about and test.

No server, account, database, or cloud service is required for the MVP.

This makes GitHub Pages an appropriate deployment target.

---

## 29. Suggested module layout

```text
graphscii-demo/
├── PLAN.md
├── package.json
├── index.html
├── public/
│   └── GraphSCII-Regular.ttf
└── src/
    ├── main.ts
    ├── app/
    │   ├── state.ts
    │   ├── commands.ts
    │   └── shortcuts.ts
    ├── document/
    │   ├── model.ts
    │   ├── serialization.ts
    │   └── migrations.ts
    ├── geometry/
    │   ├── freehand.ts
    │   ├── line.ts
    │   ├── bezier.ts
    │   ├── ellipse.ts
    │   └── bounds.ts
    ├── raster/
    │   ├── supersample.ts
    │   ├── coverage.ts
    │   └── dither.ts
    ├── graphscii/
    │   ├── registry.ts
    │   ├── bitmap.ts
    │   ├── candidates.ts
    │   ├── scoring.ts
    │   ├── continuity.ts
    │   └── solver.ts
    ├── renderer/
    │   ├── glyph-canvas.ts
    │   ├── overlay-canvas.ts
    │   └── viewport.ts
    ├── tools/
    │   ├── select.ts
    │   ├── freehand.ts
    │   ├── line.ts
    │   ├── bezier.ts
    │   ├── ellipse.ts
    │   └── eraser.ts
    └── worker/
        └── solver-worker.ts
```

This is a proposed organization, not a requirement. Keep modules small and testable rather than forcing the exact directory structure if implementation experience suggests something better.

---

## 30. MVP vertical slice

The first shippable demo should include:

### Document

- new document;
- configurable width/height in GraphSCII cells;
- local save/load;
- exact resolved glyph grid preserved.

### Drawing

- freehand;
- straight line;
- cubic Bézier;
- ellipse;
- eraser/delete.

### Editing

- select object;
- move object;
- delete object;
- edit Bézier handles;
- undo/redo.

### Tone and dithering

- 100%, 75%, 50%, and 25% canonical GraphSCII tones;
- visible tone button/control;
- separate fill-enabled toggle;
- `Alt+Wheel` tone adjustment;
- selected-object tone editing;
- phase-locked dither behavior across cell boundaries;
- tone included in undo/redo and serialization.

### GraphSCII rendering

- load the canonical registry;
- represent canonical glyphs as 128-bit bitmaps;
- dirty-cell rasterization;
- nearest-glyph matching;
- semantic tone filtering;
- coverage-aware refinement;
- basic neighbor continuity scoring;
- render actual GraphSCII codepoints using `GraphSCII-Regular.ttf`.

### Inspection

- Art view;
- Cell view;
- Pixel view;
- vector-guide toggle;
- basic glyph inspector.

### Export

- GraphSCII Unicode text;
- PNG;
- editable JSON/`.graphscii`.

---

## 31. Implementation milestones

### Milestone A — bootable canvas

- Vite/TypeScript app starts;
- GraphSCII font loads;
- registry loads;
- fixed cell grid renders known GraphSCII characters;
- zoom/pan foundation works.

**Gate:** known registry codepoints render in the expected cells with deterministic placement.

### Milestone B — exact bitmap matcher

- load all 6,397 canonical graphical bitmaps;
- encode each as 128 bits;
- build Hamming matcher;
- feed arbitrary 8×16 targets into solver;
- return correct nearest candidates deterministically.

**Gate:** exact registry bitmap input always resolves to its canonical owner with zero bitmap error.

### Milestone C — geometry rasterization

- line rasterizer;
- ellipse rasterizer;
- Bézier rasterizer;
- freehand smoothing;
- supersampled coverage targets;
- dirty-region tracking.

**Gate:** moving one object recomputes only intersecting cells and updates interactively.

### Milestone D — GraphSCII tonal classes

- implement 100/75/50/25 tone property;
- integrate GraphSCII's phase-locked dither semantics;
- add toolbar tone control;
- add `Alt+Wheel` control;
- separate fill-enabled state from density;
- serialize tone with objects.

**Gate:** a filled ellipse can be switched among all four GraphSCII tones and each state resolves reproducibly without random dither phase changes.

### Milestone E — continuity solver

- semantic candidate filtering;
- boundary-port scoring;
- top-N candidate retention;
- local neighbor reconciliation.

**Gate:** representative multi-cell lines, curves, and ellipse edges do not develop avoidable single-cell breaks when a connectivity-compatible candidate is available.

### Milestone F — editing

- selection;
- move;
- Bézier handles;
- object deletion;
- undo/redo;
- selected-object stroke/fill tone changes.

**Gate:** edit operations regenerate only dirty regions and undo exactly.

### Milestone G — save/export

- `.graphscii` JSON;
- GraphSCII text export;
- PNG export;
- clipboard export.

**Gate:** save → reload produces the identical resolved GraphSCII grid before additional edits.

### Milestone H — demo polish

- tooltips and keyboard shortcuts;
- accessibility labels;
- keyboard-accessible tone selection;
- glyph inspector;
- Art/Cell/Pixel modes;
- vector-guide toggle;
- performance tuning;
- GitHub Pages build.

**Gate:** the demo can be used end-to-end without developer tools and every core operation has visible feedback.

---

## 32. Testing and verification

The project should inherit GraphSCII's verification philosophy.

Important automated tests:

### Registry tests

- 6,397 PUA graphical owners load;
- canonical codepoint mapping is preserved;
- each bitmap is exactly 8×16;
- tonal classes are indexed correctly.

### Solver tests

- exact bitmap → exact owner;
- deterministic result for identical input;
- tone filter does not select an incompatible density when a canonical matching fill owner exists;
- locked cells remain unchanged;
- neighbor scoring is deterministic.

### Geometry tests

- line bounds;
- ellipse bounds;
- Bézier bounds;
- dirty-region union;
- supersampling reproducibility.

### Dither tests

- 100/75/50/25 values survive serialization;
- phase remains stable when a shape crosses character-cell boundaries;
- changing tone changes only the expected dirty region;
- undo/redo restores the exact prior tone and glyph grid;
- `Alt+Wheel` clamps correctly and does not alter page scroll unless the shortcut is active on the canvas.

### Save/load tests

- save/reload preserves geometry;
- save/reload preserves tone;
- save/reload preserves locked cells;
- save/reload preserves exact glyph grid.

### Export tests

- Unicode text export has the expected number of rows/cells;
- PNG dimensions are deterministic for a specified scale;
- copied GraphSCII text round-trips back into the grid.

---

## 33. Accessibility requirements

The demo should be keyboard-operable even though freehand drawing is naturally pointer-oriented.

Requirements:

- all toolbar controls have accessible names;
- tool state is exposed programmatically;
- selected tone is announced as `100 percent`, `75 percent`, `50 percent`, or `25 percent` rather than only through texture;
- tone can be changed without a mouse wheel;
- visible focus states;
- shortcuts documented in an accessible help surface;
- no critical meaning communicated only by dither appearance;
- reduced-motion preference respected for UI transitions;
- canvas has an accessible textual status region announcing selection/tool/cell changes where practical.

---

## 34. Performance target

The MVP should feel interactive on ordinary desktop hardware.

Target behavior:

- pointer movement remains responsive while drawing;
- only dirty cells are solved;
- full-grid redraw is avoided during ordinary editing;
- top-N expensive coverage/continuity scoring occurs only after cheap semantic/Hamming pruning;
- solver can be moved into a worker if main-thread latency becomes visible.

A useful target is to keep ordinary drag-preview work within a single animation-frame budget whenever possible, but correctness and deterministic output take priority over premature micro-optimization.

---

## 35. Future directions

Once the vertical slice is solid, likely extensions include:

- filled rectangles and polygons;
- bucket fill;
- direct glyph brush;
- pixel-target editing mode;
- image import and GraphSCII conversion;
- grayscale image conversion using the four canonical dither strengths;
- airbrush/shading tools;
- layers;
- transformations;
- rotation;
- text using printable ASCII support;
- palette/color extensions at the document/rendering level;
- HTML/SVG export;
- animation;
- collaborative or embedded editor variants.

A particularly useful eventual interaction model is three editing levels:

```text
VECTOR MODE
continuous editable geometry
        ↓
PIXEL MODE
edit desired logical raster
        ↓
GLYPH MODE
edit/lock actual GraphSCII characters
```

This mirrors GraphSCII's own geometry → bitmap → encoded-glyph structure.

---

## 36. Definition of success

The demo succeeds when a user can open the web app, draw a smooth line or curve without thinking about character codes, change its tonal strength from solid through the canonical GraphSCII dither levels, and immediately see an honest rendering made from actual GraphSCII characters.

The critical demonstration should be something like:

1. draw a large ellipse;
2. enable fill;
3. switch fill through 100%, 75%, 50%, and 25%;
4. use `Alt+Wheel` to change density interactively;
5. draw a Bézier curve across the ellipse;
6. zoom into Cell and Pixel views;
7. inspect the GraphSCII glyphs selected along the boundaries;
8. copy or export the result as actual GraphSCII Unicode text;
9. save the editable `.graphscii` document and reopen it with the exact same resolved grid.

At that point GraphSCII is no longer only a font and static graphical vocabulary. It is functioning as a live graphical interchange system underneath an ordinary-feeling drawing application.
