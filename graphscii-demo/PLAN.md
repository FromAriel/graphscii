# GraphSCII Draw — Deterministic Node-Graph Plan

## Status

This plan **replaces the previous drawing-plan architecture in full**.

The previous plan treated GraphSCII as a target for continuous vector geometry, rasterization, supersampling, Hamming matching, candidate scoring, and neighbor repair. That is not the intended drawing model and must not be used as the basis for GraphSCII Draw.

GraphSCII Draw is a **discrete node-graph drawing system**.

The central rule is:

> **The only geometry that exists in a GraphSCII drawing is a legal connection from one GraphSCII node to another GraphSCII node.**

Everything else follows from that rule.

---

## 1. The world is the GraphSCII node graph

A GraphSCII cell exposes the existing boundary ports:

```text
Top:    T0..T7
Bottom: B0..B7
Left:   L0..L15
Right:  R0..R15
```

These ports are the drawing nodes.

The application does not treat the 8×16 bitmap pixels as drawing coordinates. The pixels belong to the already-generated glyph artwork, not to the editor's geometry model.

The application also does not store arbitrary floating-point drawing coordinates such as:

```text
(183.4, 221.7)
```

as graphical truth.

Pointer coordinates exist only long enough to determine which GraphSCII node the user is selecting.

Once a node has been selected, the pointer coordinates are irrelevant to the drawing.

Conceptually:

```text
physical pointer position
        ↓
currently selected GraphSCII node
        ↓
node identity
```

The GraphSCII node identity is the geometry.

---

## 2. A line segment is exactly NODE → NODE

A legal line segment connects two ports on different edges of one GraphSCII cell.

The existing straight vocabulary already defines the complete set of these connections:

```text
L ↔ R
T ↔ B
L ↔ T
L ↔ B
R ↔ T
R ↔ B
```

The current straight semantic population is:

```text
L ↔ R      16 × 16 = 256
T ↔ B       8 ×  8 =  64
L ↔ T      16 ×  8 = 128
L ↔ B      16 ×  8 = 128
R ↔ T      16 ×  8 = 128
R ↔ B      16 ×  8 = 128
                         ---
                         832 legal straight semantics
```

Therefore a line segment needs only:

```ts
interface GraphSCIISegment {
  cellX: number;
  cellY: number;
  from: Port;
  to: Port;
}
```

For example:

```text
cell (12, 7)
L13 → R4
```

means exactly one thing:

```text
straight:L13>R4
```

The renderer performs a direct semantic lookup and emits the corresponding GraphSCII codepoint.

There is no candidate search.

There is no visual comparison.

There is no scoring.

There is no fallback.

---

## 3. Continuity is guaranteed by shared nodes

Adjacent cells continue through corresponding ports:

```text
R0..R15 ↔ neighboring L0..L15
L0..L15 ↔ neighboring R0..R15
B0..B7  ↔ neighboring T0..T7
T0..T7  ↔ neighboring B0..B7
```

If a path leaves one cell through `R7`, the next cell begins through `L7`.

If a path leaves through `B3`, the cell below begins through `T3`.

The shared port is not something to verify after rendering. It is the path itself.

Example:

```text
cell A                  cell B

L12 ─────────→ R7   |   L7 ─────────→ R2
                    ^
                    |
              same continuation
```

A continuous GraphSCII path therefore cannot contain a visual break unless the underlying font or lookup table is incorrect.

No continuity scoring or repair pass is needed.

---

## 4. A stroke is an ordered node path

A stroke is simply an ordered sequence of legal node-to-node segments.

Conceptually:

```text
N0 → N1 → N2 → N3 → N4 → N5
```

becomes:

```text
segment 0: N0 → N1
segment 1: N1 → N2
segment 2: N2 → N3
segment 3: N3 → N4
segment 4: N4 → N5
```

The document stores this node path.

It does not store a hidden higher-resolution line that must later be approximated.

Suggested structure:

```ts
interface GraphSCIIPath {
  id: string;
  segments: GraphSCIISegment[];
  closed: boolean;
  fill: null | GraphSCIIFill;
}
```

The GraphSCII path is the editable object and the rendered object.

---

## 5. Pointer behavior

The pointer should behave as though it is constrained to the GraphSCII node graph.

The visible cursor may move smoothly on screen, but the drawing cursor snaps to GraphSCII nodes.

Basic interaction:

```text
pointer down
    ↓
select start node
    ↓
move pointer
    ↓
select next legal node
    ↓
commit NODE → NODE segment
    ↓
that node becomes the new current node
    ↓
repeat until pointer up
```

The editor should show the currently selected node clearly so the user can see exactly where the next segment will connect.

The node hit area can be larger than the visual point to make drawing comfortable. That is only UI hit testing. It must not create another geometry system.

If browser pointer events skip across screen positions, the input layer may interpolate pointer motion only to determine which node regions were crossed. It must still emit only node-selection events. No interpolated pixels, vectors, or raster geometry are stored.

---

## 6. Legal movement rule

From the current node inside the active cell, the next segment must terminate on a node belonging to a different edge of that cell.

Examples:

```text
L11 → R5    legal
L11 → T3    legal
L11 → B6    legal
T4  → B2    legal
T4  → R9    legal
```

Same-edge segments are not part of the v1 straight language:

```text
L4 → L12    not legal
T2 → T6     not legal
```

This is not a condition to approximate or repair.

It is simply not a legal GraphSCII move.

The UI should not offer illegal destination nodes for the current segment.

---

## 7. Direct lookup only

The runtime should load or generate a compact direct lookup table for the 832 straight semantic definitions.

Conceptual API:

```ts
function straightCodepoint(from: Port, to: Port): number;
```

Both directions must resolve:

```text
L13 → R4
R4  → L13
```

The visual owner may be shared by multiple semantic aliases because GraphSCII globally deduplicates exact bitmaps. That does not change the drawing rule.

The editor selects the semantic connection first. The semantic connection then identifies its visual owner/codepoint.

Required principle:

> **Semantics select the glyph. Pixels never select the glyph.**

---

## 8. Filled shapes use the same boundary path

A filled object is not a separate geometry model.

It is:

```text
closed GraphSCII node path
+
which side of the directed boundary is inside
+
fill tone
```

Suggested type:

```ts
type GraphSCIITone = 100 | 75 | 50 | 25;
type FillSide = "left" | "right";

interface GraphSCIIFill {
  side: FillSide;
  tone: GraphSCIITone;
}
```

A boundary segment remains the same node pair.

Example:

```text
L11 → R5
```

For an unfilled path, use the straight semantic.

For a filled path, use:

```text
same node pair
+
selected interior side
+
selected tone
```

and directly select the corresponding GraphSCII side-fill semantic.

Conceptual API:

```ts
function fillBoundaryCodepoint(
  from: Port,
  to: Port,
  inside: FillSide,
  tone: GraphSCIITone,
): number;
```

The existing GraphSCII fill data already derives fill boundaries from the straight definitions plus side A/B. The drawing app should expose the simpler user-facing idea of left/right of the directed segment and normalize that deterministically to the existing semantic alias.

There is no shape matching.

---

## 9. Interior fill cells

Once a closed path has an inside, cells wholly inside that boundary use one full-cell tone glyph.

Required full-cell tones:

```text
100%   full solid
 75%   full medium dither
 50%   full half dither
 25%   full light dither
```

The 100%, 75%, and 50% exact full-cell bitmaps already exist in the current vocabulary.

The exact full-cell 25% light pattern is currently missing and must be added before 25% filled objects are considered complete.

Planned correction:

```text
U+F8FD = full-cell 25% phase-locked light fill
```

This consumes one of the three protected reserve slots and leaves two reserve slots.

The new glyph must use the same canonical phase-locked 25% mask as the existing light side-fill family, then all affected manifests, indexes, atlases, publication counts, font artifacts, and verification gates must be regenerated and updated deliberately.

Until that change is made, the drawing app must not fake a full 25% interior cell with a visually similar glyph.

---

## 10. Determining the filled interior

For a closed path, filling needs only two classifications:

```text
boundary cell
interior cell
```

Boundary cells already contain exact node-pair segments and therefore use exact boundary-fill semantics.

Whole cells enclosed by the closed path use the selected full-tone glyph.

The fill algorithm may use an ordinary cell-level flood fill or scan fill over the character-cell grid to determine which whole cells lie inside the closed boundary.

This calculation decides **which cells are inside**. It does not select glyphs by visual resemblance.

The output rule remains deterministic:

```text
boundary segment + side + tone → exact boundary-fill semantic
whole interior cell + tone     → exact full-tone glyph
outside cell                   → empty
```

---

## 11. Junctions and overlapping paths

A cell normally contains one legal straight segment.

If multiple paths occupy the same cell, their combined semantic state may be represented only when GraphSCII already contains an exact published connector semantic for that state.

The runtime should use a direct connector lookup table.

Conceptual rule:

```text
exact supported multi-segment state
        → exact connector semantic

unsupported multi-segment state
        → illegal edit
```

Do not approximate an unsupported junction.

Do not search the 6,397 glyphs.

Do not choose the closest-looking connector.

If a second stroke would create an unsupported cell state, the UI should refuse that insertion or keep the new stroke uncommitted until the user chooses another legal node route.

This keeps the drawing language exact.

---

## 12. Empty cells

An empty drawing cell is simply empty.

Use the GraphSCII font's normal space character:

```text
U+0020 SPACE
```

Empty cells do not enter any graphical lookup process.

---

## 13. Initial tool set

The first implementation should prove the node model before adding convenience tools.

### MVP tools

```text
Node Pen
Select/Edit Path
Fill On/Off
Fill Side Left/Right
Fill Tone 100/75/50/25
Eraser
```

### Node Pen

Draws an ordered sequence of legal node-to-node segments.

### Select/Edit Path

Allows a path's nodes to be selected and moved to other legal nodes. Editing a node directly updates the affected node-pair semantics.

### Fill

May be enabled only on a closed path. The user chooses inside side and tone.

### Eraser

Removes paths or selected segments semantically. It does not erase bitmap pixels.

---

## 14. Future shape tools

Rectangle, polygon, ellipse, Bézier-like, and other convenience tools may be added later, but they must obey one absolute rule:

> **They must produce GraphSCII node paths directly.**

They must not store an arbitrary vector shape and then solve it into GraphSCII afterward.

A future ellipse tool therefore produces an ellipse-like closed sequence of legal GraphSCII node connections and stores that node sequence as the object.

Once created, there is no hidden mathematical ellipse underneath the GraphSCII path.

The same rule applies to every future shape helper.

---

## 15. Document model

The native document should preserve semantic GraphSCII paths, not higher-resolution source geometry.

Conceptual structure:

```ts
interface GraphSCIIDocument {
  format: "graphscii-draw";
  version: 1;
  widthCells: number;
  heightCells: number;
  paths: GraphSCIIPath[];
}
```

A cached resolved character grid may be stored for fast loading or export, but it is derived data.

The authoritative editable content is the node graph.

Recommended native extension:

```text
.graphscii
```

---

## 16. Rendering model

Rendering is a deterministic compilation step:

```text
GraphSCII node paths
        ↓
cell semantic states
        ↓
direct semantic lookup
        ↓
GraphSCII Unicode codepoints
        ↓
GraphSCII-Regular.ttf
        ↓
screen
```

There is no offscreen target raster.

There is no glyph solver.

There is no supersampling.

There is no Hamming distance.

There is no coverage calculation.

There is no neighbor scoring.

There is no continuity repair.

There is no visual fallback.

---

## 17. UI layers

The browser implementation can still use Canvas 2D for presentation and interaction.

Recommended layers:

```text
GraphSCII glyph canvas
+
node/interaction overlay
```

The glyph canvas displays the exact resolved GraphSCII characters.

The overlay may display:

```text
visible node points
current selected node
legal next nodes
selected paths
fill-side indicator
selection handles
cell boundaries when requested
```

These overlays are editor UI only and are never part of the GraphSCII artwork.

---

## 18. Zoom

Zoom changes presentation only.

It must never change node identity or document geometry.

At high zoom the editor should make the node lattice easy to inspect.

Useful modes:

```text
Art view   — final GraphSCII glyphs only
Node view  — GraphSCII glyphs + selectable node points
Cell view  — node view + character-cell boundaries
```

A pixel-editing mode is intentionally not part of GraphSCII Draw's core model.

---

## 19. Required runtime indexes

The drawing app should consume small purpose-built direct indexes rather than scanning the full registry.

Minimum runtime lookups:

```text
straight:        fromPort + toPort → semantic owner/codepoint
fill boundary:   fromPort + toPort + side + tone → semantic owner/codepoint
connector:       exact supported connector state → semantic owner/codepoint
full tone:       tone → full-cell codepoint
```

These may be generated from the canonical GraphSCII artifacts at build time.

The editor should never need to iterate over all 6,397 glyphs during ordinary drawing.

---

## 20. Verification requirements

The implementation is not complete until these invariants are mechanically tested.

### Straight coverage

Every one of the 832 legal straight semantics must resolve by direct node-pair lookup.

Both directions must resolve to the same semantic visual owner.

### Shared-boundary continuity

For every path transition:

```text
Rk → neighboring Lk
Lk → neighboring Rk
Bk → neighboring Tk
Tk → neighboring Bk
```

must be exact.

### No solver dependency

The drawing runtime must contain no Hamming matcher, visual candidate ranker, coverage scorer, or neighbor-relaxation system.

### Fill-boundary coverage

Every supported straight node pair must resolve for both fill sides at every published tone.

### Full-tone coverage

Exactly one intended full-cell glyph must exist for each:

```text
100
75
50
25
```

The 25% test must fail until the missing full light glyph is intentionally added.

### Illegal-state rejection

Unsupported same-edge segments and unsupported multi-segment junction states must be rejected rather than approximated.

### Round trip

Save a `.graphscii` document, reload it, and reproduce exactly the same node paths and Unicode grid.

---

## 21. Implementation order

### Step 1 — Runtime node graph

Build the canonical port/node types and direct 832-entry straight lookup.

Verify all connections and both orientations.

### Step 2 — Node canvas

Display GraphSCII cells with an optional node overlay.

Implement pointer-to-node selection and visible snapping.

### Step 3 — Node Pen

Implement pointer-down, node transition, direct segment commit, shared-boundary continuation, pointer-up.

At this milestone the user must be able to draw continuous GraphSCII line art with no raster solver anywhere in the application.

### Step 4 — Editing and erasing

Select paths, move nodes only to legal nodes, delete paths/segments, and support undo/redo over semantic operations.

### Step 5 — Add the missing full 25% glyph

Allocate the planned full light tile, regenerate the canonical publication/font artifacts, and pass all verification gates.

### Step 6 — Closed-path fills

Add fill enabled/disabled, fill side, fill tone, exact boundary-fill lookup, and whole-cell interior fill.

### Step 7 — Exact connector composition

Add direct lookup for supported multi-segment connector states and reject unsupported ones.

### Step 8 — Save/export

Save semantic `.graphscii` documents and export the exact Unicode character grid.

### Step 9 — Convenience tools

Only after the node pen and fills are correct, consider rectangle, polygon, ellipse-like, or other node-path construction helpers.

---

## 22. Explicitly rejected architecture

The following ideas belong to the superseded plan and must not re-enter the implementation unless the GraphSCII standard itself is intentionally changed later:

```text
continuous vector geometry as document truth
floating-point drawing coordinates as document truth
supersampled target rasters
per-cell bitmap targets
glyph fitting
shape matching
Hamming-distance glyph selection
coverage-aware candidate scoring
semantic candidate filtering followed by visual matching
neighbor continuity scoring
local relaxation
broad visual fallback
repairing broken lines after glyph selection
dithered stroke raster footprints
```

If the implementation starts needing any of those mechanisms to draw an ordinary GraphSCII line, the implementation has departed from this plan.

---

## 23. Final rule

The entire drawing system can be summarized as:

> **Pick a node. Pick the next legal node. Draw the exact GraphSCII segment between them. Continue from that node. For a closed filled path, choose which side is inside and replace the boundary with the corresponding fill semantics; fill whole interior cells with the selected full dither tile. Never solve for a glyph that the node graph has already determined.**
