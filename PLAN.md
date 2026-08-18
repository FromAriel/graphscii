# GraphSCII — Persistent Project Plan

> **Status:** Living design document. This file is the persistent architectural plan for GraphSCII. Update it as decisions are made, experiments produce evidence, and milestones are completed.
>
> **Repository:** `FromAriel/graphscii`
>
> **Current implementation seed:** `geometric-glyph-lab/`

---

## 1. Project idea

GraphSCII is a fixed-cell graphics language encoded as a font and as machine-readable glyph data.

Each glyph is a tiny deterministic bitmap representing a geometric primitive: straight segments, angled segments, curves, junctions, filled contours, circle/ellipse fragments, textures, terminals, arrows, nodes, and related building blocks. Neighboring glyphs are designed to connect predictably so programs and humans can assemble larger graphics from text-like cells.

The project is not merely a font containing miscellaneous symbols. The long-term goal is a **small 2D graphics instruction set** in which every assigned character has explicit geometry, connectivity, provenance, and reproducible raster output.

A program should eventually be able to ask questions such as:

- Which glyph connects `L13` to `R4`?
- Which glyph continues smoothly from this cell's right-side port?
- Which glyph best approximates this local piece of a line or curve?
- Which junction connects north, west, and southeast?
- Which filled contour best represents this boundary crossing?
- Which glyphs are compatible with the glyph already placed to the left?

The same canonical data should support:

1. a font,
2. a PNG sprite/tile library,
3. exact ASCII representations,
4. human-readable shape catalogs,
5. JSON metadata for programs,
6. atlases and specimen sheets,
7. an interactive browser/editor,
8. eventually an automatic drawing solver.

---

## 2. Core design principle

The canonical source of visual truth is the **binary cell bitmap**, not an arbitrary font outline.

The intended pipeline is:

```text
geometric definition / family rule
            ↓
    deterministic rasterizer
            ↓
      canonical bitmap
            ↓
     deduplicate visually
            ↓
      glyph registry
       ↙    ↓    ↘
    PNG   JSON   ASCII
      \     |     /
       font outlines
```

A font file is therefore a compiled artifact. It must be possible to delete every generated font, PNG, atlas, Markdown catalog, and JSON export and regenerate them from source/specification with the same results.

### Source of truth hierarchy

1. **Generator/specification source** — defines geometry and generation rules.
2. **Canonical bitmap** — defines visual identity.
3. **Glyph registry** — defines stable assigned identity and metadata.
4. **Generated artifacts** — PNG, ASCII, JSON, Markdown catalogs, atlases, fonts.

Generated artifacts may be committed to Git for inspection and consumption, but they must never become the only authoritative representation.

---

## 3. Immediate decision gate: cell orientation

The original lab currently treats the cell as:

```text
width  = 8 pixels
height = 16 pixels
```

or **8 columns × 16 rows**.

The recent ASCII example supplied during planning is 16 columns × 8 rows:

```text
-------------#--
-------------#--
-------------#--
-------------#--
-------------#--
-------------#--
-------------#--
-------------#--
```

Before expanding the vocabulary beyond the existing straight-line research slice, we must explicitly lock one canonical orientation:

- **Option A:** 8 columns × 16 rows — matches the current implementation.
- **Option B:** 16 columns × 8 rows — matches the recent ASCII example.

This is intentionally unresolved in this plan. Once codepoint assignments become stable, changing orientation would effectively define a new glyph system, so the decision must happen before the curve/codepoint-freeze stage.

The generator should eventually express the dimensions as explicit constants rather than scattering `8` and `16` throughout the code.

---

## 4. Target vocabulary and codepoint space

The working target is approximately **4,096 assigned glyphs**.

The preferred initial mapping is the Unicode Basic Multilingual Plane Private Use Area:

```text
glyph 0x000 → U+E000
...
glyph 0xFFF → U+EFFF
```

This yields a clean 12-bit internal glyph ID while using ordinary Unicode text storage.

### Important rule

`4096` is a **budget and address-space target**, not a requirement to fill every slot immediately.

We should generate more candidates than can fit, measure them empirically, deduplicate raster-equivalent candidates, evaluate coverage, and only then stabilize allocations.

A sensible release may initially reserve a portion of the 4,096-space for discoveries made during real use.

Example provisional policy:

```text
0x000–0xEFF   assigned/generated vocabulary   (3840 slots)
0xF00–0xFFF   reserved/experimental            (256 slots)
```

This remains provisional until coverage experiments justify a final partition.

---

## 5. Existing baseline

The existing `geometric-glyph-lab/` is the first empirical slice.

It currently defines six straight edge-to-edge families:

- Left → Right: `16 × 16 = 256`
- Top → Bottom: `8 × 8 = 64`
- Left → Top: `16 × 8 = 128`
- Left → Bottom: `16 × 8 = 128`
- Right → Top: `16 × 8 = 128`
- Right → Bottom: `16 × 8 = 128`

Current measured baseline:

```text
mathematical candidates    832
unique canonical bitmaps   746
duplicate candidates        86
compression              10.3%
maximum aliases              4
```

This baseline should become a permanent regression fixture after the orientation decision is locked.

---

## 6. Geometry model

### Boundary ports

Each cell exposes discrete connection points on its four edges.

For the current 8-wide × 16-high model:

```text
Top:     T0..T7
Bottom:  B0..B7
Left:    L0..L15
Right:   R0..R15
```

A geometric alias should be able to describe a primitive independently of its raster identity.

Examples:

```text
straight(L13, R4)
straight(T2, B6)
curve(L8, B5, tangent=east→south, curvature=normal)
junction(N | E | SW)
```

### Geometry and visual identity are different concepts

Several mathematical definitions may rasterize to the exact same bitmap.

Those must produce **one visual glyph** with **multiple geometric aliases**, not multiple wasted character slots.

Example conceptual record:

```json
{
  "glyphId": 376,
  "bitmapKey": "...128-bit visual identity...",
  "aliases": [
    { "type": "straight", "start": "L4", "end": "R5" },
    { "type": "straight", "start": "L4", "end": "R6" }
  ]
}
```

Programs may care about the intended alias even when two aliases share identical pixels.

---

## 7. Shape classes

Each major shape class gets:

1. generator source,
2. machine-readable metadata,
3. generated exact ASCII catalog,
4. generated PNGs,
5. statistics,
6. tests,
7. eventually a stable codepoint allocation.

Planned major classes:

### 7.1 Straight segments

- opposite-edge segments
- adjacent-edge segments
- shallow/steep diagonals
- principal horizontal/vertical lines
- possible thickness variants only if they add enough value

### 7.2 Curves

Curve identity should include at minimum:

- start port
- end port
- start tangent
- end tangent
- curvature/strength class

Candidate curvature classes may begin as:

- gentle
- normal
- tight

We should generate many candidate curves and let raster deduplication tell us how many genuinely distinct 8×16 shapes survive.

### 7.3 Junctions

- two-way corners
- T junctions
- crosses
- forks
- diagonal/cardinal mixtures
- sharp joins
- rounded joins
- possibly chamfered joins

Major-direction junctions can be represented naturally as direction masks.

### 7.4 Filled contours

Generated from boundary geometry plus a fill-side rule:

- solid above/below a line
- solid left/right of a boundary
- diagonal wedges
- curved silhouette boundaries
- inside/outside curve pieces
- filled corners

### 7.5 Circles and ellipses

Explicit families for common local arc behavior:

- small-radius arcs
- medium-radius arcs
- large-radius nearly-flat arcs
- ellipse fragments
- inside/outside filled variants when useful

### 7.6 Blocks and partial fills

- full block
- halves
- quarters
- eighth-like partitions where useful
- progressive fills
- geometric wedges

### 7.7 Texture and dithering

- ordered dither levels
- checker patterns
- horizontal hatch
- vertical hatch
- `/` hatch
- `\` hatch
- crosshatch
- dots/stipple
- phase-shifted variants that tile seamlessly

### 7.8 Terminals, nodes, and arrows

- line caps
- round nodes
- square nodes
- diamonds
- hollow variants
- arrowheads
- directional terminals
- diagrammatic ports

### 7.9 Compound/special primitives

Reserved for shapes proven useful during actual drawing but not well expressed by the primary generators.

### 7.10 Reserved/experimental

Keep an intentionally uncommitted region until substantial real-world usage tells us what is missing.

---

## 8. Proposed repository structure

The current working program remains in `geometric-glyph-lab/` initially. We should not reorganize working code merely for aesthetics before the architecture needs it.

Proposed long-term structure:

```text
graphscii/
├── PLAN.md                         # this living plan
├── README.md                       # public/user-facing project explanation
│
├── geometric-glyph-lab/            # current generator/browser implementation
│   ├── src/
│   ├── scripts/
│   ├── tests/
│   ├── package.json
│   └── ...
│
├── spec/                           # hand-maintained vocabulary/spec inputs
│   ├── classes/
│   ├── allocation.json
│   └── schema/
│
├── artifacts/                      # reproducibly generated, commit-worthy outputs
│   ├── manifest/
│   │   ├── glyphs.json
│   │   ├── aliases.json
│   │   ├── stats.json
│   │   └── compatibility.json
│   │
│   ├── glyphs/
│   │   ├── png/
│   │   │   ├── U+00E000.png
│   │   │   ├── U+00E001.png
│   │   │   └── ...
│   │   └── ascii/
│   │       ├── U+00E000.txt
│   │       ├── U+00E001.txt
│   │       └── ...
│   │
│   ├── classes/
│   │   ├── straight-lines.md
│   │   ├── curves.md
│   │   ├── junctions.md
│   │   ├── filled-contours.md
│   │   ├── circles-ellipses.md
│   │   ├── blocks-fills.md
│   │   ├── textures.md
│   │   └── terminals-nodes-arrows.md
│   │
│   ├── atlases/
│   │   ├── all.png
│   │   ├── page-0.png
│   │   ├── page-1.png
│   │   └── ...
│   │
│   └── font/
│       ├── GraphSCII.ttf
│       ├── GraphSCII.otf            # only if useful
│       └── GraphSCII.woff2
│
└── docs/
    ├── format.md
    ├── drawing-api.md
    ├── connectivity.md
    └── examples/
```

The exact layout may evolve, but the separation between **source/spec** and **generated artifacts** should remain.

---

## 9. Per-glyph artifact contract

Every assigned glyph should be independently inspectable without opening the font.

### 9.1 PNG

Every assigned codepoint gets an exact canonical tiny PNG.

Filename convention:

```text
U+00E000.png
U+00E001.png
...
```

Use the **full zero-padded Unicode scalar value** in filenames so the naming convention remains unambiguous even if later versions use codepoints outside the BMP.

The canonical PNG should be the true native bitmap dimensions, not a pre-scaled preview.

For human inspection, atlases or optional preview PNGs may use nearest-neighbor enlargement.

### 9.2 ASCII

Every glyph gets an exact text representation:

```text
U+00E000.txt
```

The ASCII export should contain exactly one character per canonical bitmap cell plus line endings.

Initial display convention:

```text
# = filled pixel
- = empty pixel
```

Example form:

```text
-------------#--
-------------#--
-------------#--
-------------#--
-------------#--
-------------#--
-------------#--
-------------#--
```

The exact row/column dimensions depend on the orientation decision in Section 3.

No labels or prose belong inside the per-glyph `.txt` file; it should be machine-trivial to parse.

### 9.3 Metadata

The main JSON manifest is the authoritative generated metadata index. Per-glyph JSON files are optional and should only be added if they materially simplify consumers.

---

## 10. Shape-class Markdown catalogs

Each shape class gets one large generated `.md` file containing every glyph in that class.

A class document should contain:

- class description
- generation rules
- candidate count
- unique bitmap count
- duplicate/alias count
- codepoint range(s)
- semantic tags
- exact ASCII rendering of every glyph
- aliases that produced that glyph
- connectivity/tangent information where applicable
- links/paths to the tiny PNG artifact

Conceptual entry:

```markdown
### U+E23A — glyph 0x23A

Family: `straight-left-right`

Aliases:
- `L13 → R4`
- `L13 → R5`

Connections:
- left: 13
- right: 4

```text
--------
-------#
------#-
------#-
-----#--
----#---
----#---
---#----
---#----
--#-----
-#------
-#------
#-------
--------
--------
--------
```

PNG: `../glyphs/png/U+00E23A.png`
```

These files are generated documentation, not hand-edited catalogs.

---

## 11. JSON manifest design

The generated JSON must be sufficient for a program to use GraphSCII without reverse-engineering the font.

Proposed top-level structure:

```json
{
  "format": "graphscii",
  "formatVersion": 1,
  "generatorVersion": "...",
  "cell": {
    "width": 8,
    "height": 16
  },
  "codepointBase": "U+E000",
  "glyphCount": 746,
  "glyphs": []
}
```

Proposed glyph record:

```json
{
  "glyphId": 570,
  "glyphIdHex": "23A",
  "codepoint": 57914,
  "codepointHex": "U+E23A",
  "character": "...",
  "family": "straight-left-right",
  "tags": ["straight", "diagonal", "left-right"],
  "bitmap": {
    "rowsHex": ["00", "01", "02"],
    "key": "128-bit-canonical-key"
  },
  "connections": [
    {
      "edge": "left",
      "port": 13,
      "tangent": "east"
    },
    {
      "edge": "right",
      "port": 4,
      "tangent": "east"
    }
  ],
  "aliases": [
    {
      "type": "straight",
      "start": "L13",
      "end": "R4"
    }
  ],
  "artifacts": {
    "png": "../glyphs/png/U+00E23A.png",
    "ascii": "../glyphs/ascii/U+00E23A.txt"
  }
}
```

The final schema will be versioned before external programs are expected to rely on it.

---

## 12. Machine-readable lookup indexes

A consumer should not need to scan 4,096 records for every query.

The build may produce derived indexes such as:

- by codepoint
- by glyph ID
- by bitmap key
- by family
- by tags
- by entry port
- by exit port
- by port + tangent
- by geometric alias
- by compatibility

These may be embedded into one manifest or split into derived JSON files depending on size and usability.

---

## 13. Connectivity model

A connection is more than a filled boundary pixel.

For each geometric connection we eventually want to know:

```text
edge
port index
connected/not connected
tangent
join semantics
```

Possible join semantics:

- smooth continuation
- intentional corner
- junction
- terminal
- fill boundary

This enables automatic neighbor search.

Example future query:

```text
current glyph exits R7 with tangent east
            ↓
return all glyphs entering L7 with compatible tangent
```

A generated compatibility table can make this operation extremely cheap for game/rendering code.

---

## 14. How a program should be able to draw with GraphSCII

The project should support two equivalent rendering paths.

### Path A — font/text rendering

1. Load `GraphSCII.ttf` or `GraphSCII.woff2`.
2. Load `glyphs.json`.
3. Solve or select the needed glyph ID.
4. Convert glyph ID to assigned Unicode codepoint.
5. Write the character into a fixed-cell text grid.
6. Render with GraphSCII at the intended cell size.

This makes a drawing serializable as Unicode text.

### Path B — direct bitmap/tile rendering

1. Load `glyphs.json` or an atlas index.
2. Select glyph IDs using the same geometry metadata.
3. Copy canonical PNG/atlas tiles into a framebuffer/canvas.

This bypasses font rasterization and guarantees exact canonical pixels.

### Long-term drawing solver

Eventually expose operations conceptually like:

```text
findStraight(startPort, endPort)
findCurve(startPort, endPort, tangents, curvature)
findJunction(directionMask)
findCompatibleNeighbor(glyph, edge)
findClosestGeometry(segmentOrCurve)
```

A higher-level solver can sample a vector path cell-by-cell and choose the best matching GraphSCII glyph for each visited cell.

The serialized result can then be ordinary Unicode characters plus optional alias metadata if geometric intent needs to be preserved beyond visual identity.

---

## 15. Font compilation

The canonical bitmap should be converted to a vector font deterministically.

One straightforward strategy:

- each filled canonical pixel becomes a vector rectangle,
- adjacent rectangles may be unioned for smaller outlines,
- every glyph has identical advance width,
- no kerning,
- no proportional metrics,
- no default ligatures,
- no shaping-dependent geometry.

A convenient font-unit scale for an 8×16 orientation is:

```text
1 canonical pixel = 128 font units
cell width         = 1024 units
cell height        = 2048 units
```

If the canonical orientation becomes 16×8, metrics will be adjusted accordingly while retaining power-of-two-friendly scaling.

The PNG/bitmap representation remains authoritative because platform font rasterizers are not guaranteed to reproduce identical pixels under all scaling and hinting conditions.

---

## 16. Atlas generation

Generate both complete and page-based atlases.

Recommended stable page model:

```text
256 glyphs per page
16 columns × 16 rows
16 pages for a 4096-slot vocabulary
```

Therefore:

```text
page 0 = glyph IDs 000–0FF
page 1 = 100–1FF
...
page F = F00–FFF
```

Artifacts:

```text
artifacts/atlases/all.png
artifacts/atlases/page-0.png
...
artifacts/atlases/page-F.png
```

Additional family atlases may be generated when useful.

---

## 17. Deterministic artifact generation

One command should ultimately regenerate the entire distributable state.

Conceptually:

```text
bun run generate
```

should perform:

1. load specification,
2. generate mathematical candidates,
3. rasterize deterministically,
4. deduplicate exact visual identities,
5. preserve all aliases,
6. allocate/freeze codepoints according to allocation rules,
7. validate connectivity and metadata,
8. write JSON,
9. write per-glyph ASCII,
10. write per-glyph PNG,
11. write class Markdown catalogs,
12. write atlases,
13. compile fonts,
14. write generation statistics,
15. run artifact consistency checks.

Generated files should include enough version/provenance information to determine which generator/spec version produced them.

---

## 18. Artifact commit policy

GraphSCII intentionally differs from projects that ignore all build output.

Some generated outputs are part of the useful product and **should be committed**:

- canonical tiny PNGs
- exact ASCII glyph files
- JSON manifests/indexes
- class Markdown catalogs
- reference atlases
- release fonts

Temporary files should not be committed:

- caches
- intermediate canvases
- temporary debug exports
- dependency directories
- local dev state

The generated tree must be reproducible. A verification command should eventually fail if running the generator changes committed artifacts unexpectedly.

---

## 19. Codepoint stability policy

During research, glyph IDs may move.

After the first public/stable vocabulary release, assigned codepoints should be treated as an API.

Rules after freeze:

1. Never silently give an existing codepoint a different visual meaning.
2. Never recycle a retired codepoint for an unrelated glyph in the same major format version.
3. Record aliases/renames in metadata.
4. If a breaking remap becomes unavoidable, increment the GraphSCII format major version.

Before freeze, the allocator may rearrange glyphs freely to improve the vocabulary.

---

## 20. Candidate generation and selection

We should not hand-design 4,096 individual glyphs.

Each family generator should be capable of producing a candidate superset. The pipeline then measures:

- exact duplicates
- symmetry
- connectivity coverage
- visual novelty
- family importance
- useful geometric range
- redundancy with already-selected glyphs

If candidate count exceeds the slot budget, introduce a scoring/selection stage.

Possible score components:

- unique connectivity signature
- unique tangent behavior
- geometric coverage
- perceptual distance from existing bitmaps
- symmetry completion
- expected drawing utility
- family priority

The score must be inspectable and reproducible rather than a hidden heuristic.

---

## 21. Symmetry and transforms

Generators should support derived transforms where meaningful:

- horizontal mirror
- vertical mirror
- 180° rotation

For a non-square cell, 90° rotation changes dimensions and is not automatically valid.

Transforms must update geometry metadata as well as pixels.

Deduplication runs after transforms, so symmetric shapes that collapse visually do not waste slots.

---

## 22. Testing requirements

### Raster tests

- deterministic output for every primitive
- exact dimensions
- exact known fixtures
- no anti-aliasing states in canonical binary mode

### Deduplication tests

- identical bitmaps merge
- aliases are preserved
- non-identical bitmaps never merge
- bitmap key serialization is stable

### Registry tests

- glyph IDs unique
- codepoints unique
- valid range only
- reserved regions respected
- stable allocations preserved after freeze

### Artifact tests

For every assigned glyph:

- PNG exists
- PNG has exact canonical dimensions
- ASCII file exists
- ASCII dimensions are exact
- ASCII bitmap equals PNG/manifest bitmap
- manifest points to valid artifact paths

### Catalog tests

- every assigned glyph appears in appropriate class catalog(s)
- class counts match manifest statistics
- no stale codepoint links

### Connectivity tests

- port indices are in range
- paired seams match expected boundary positions
- smooth connections satisfy tangent rules
- intentional corners are not incorrectly marked smooth

### Reproducibility test

A clean generation run from the same source commit should produce byte-identical canonical artifacts wherever practical.

---

## 23. Interactive lab roadmap

The browser lab should evolve into the primary research interface.

Planned capabilities:

### Existing/early

- generate candidate families
- show candidate/unique/duplicate counts
- atlas browsing
- glyph inspector
- enlarged nearest-neighbor view
- exact ASCII view
- alias inspection
- PNG/JSON export

### Next

- shape-class selector
- curve parameter explorer
- tangent visualization
- seam/neighbor preview
- compatibility search
- compare candidate against deduplicated survivor
- show codepoint allocation state
- inspect symmetry variants

### Later

- multi-cell drawing canvas
- draw a line/curve and let the solver choose tiles
- visualize why each glyph was selected
- replace individual cells manually
- copy resulting GraphSCII Unicode text
- export drawing as bitmap/PNG/JSON/text

---

## 24. Documentation goals

The repository README should eventually explain GraphSCII at three levels.

### Human overview

What it is and why a geometric font is useful.

### Artist/user usage

- install/use the font
- browse the atlas
- copy glyphs
- understand codepoint pages
- inspect shape catalogs

### Programmer usage

- load manifest
- locate glyph by codepoint/ID
- query ports/tangents
- render through font or PNG atlas
- perform neighbor matching
- serialize drawings

Detailed programmatic contracts belong under `docs/` and should be linked from the README.

---

## 25. Milestone sequence

### Milestone 0 — lock fundamentals

- [ ] Decide canonical orientation: 8×16 vs 16×8.
- [ ] Centralize cell dimensions.
- [ ] Preserve/re-verify straight-line baseline under the chosen orientation.
- [ ] Establish permanent bitmap serialization format.
- [ ] Establish artifact filename convention.

### Milestone 1 — persistent artifact pipeline

- [ ] Add generator CLI separate from UI actions.
- [ ] Generate main JSON manifest.
- [ ] Generate per-glyph exact ASCII files.
- [ ] Generate per-glyph canonical PNG files.
- [ ] Generate complete/page atlases.
- [ ] Add artifact consistency tests.

### Milestone 2 — straight-line class publication

- [ ] Allocate provisional codepoints to unique straight glyphs.
- [ ] Generate `straight-lines.md` with every exact ASCII form.
- [ ] Preserve all mathematical aliases in JSON/docs.
- [ ] Add connectivity metadata.

### Milestone 3 — curve research engine

- [ ] Define curve grammar.
- [ ] Implement deterministic curve rasterization.
- [ ] Generate large candidate families.
- [ ] Deduplicate.
- [ ] Compare curvature/tangent coverage.
- [ ] Publish curve artifact catalog.

### Milestone 4 — junctions

- [ ] Direction-mask model.
- [ ] Sharp junction generation.
- [ ] Rounded junction generation.
- [ ] Compatibility metadata.
- [ ] Junction class artifacts/catalog.

### Milestone 5 — filled contours

- [ ] Fill-side classifier.
- [ ] Straight filled boundaries.
- [ ] Curved filled boundaries.
- [ ] Wedges/corners.
- [ ] Filled class artifacts/catalog.

### Milestone 6 — circles/ellipses

- [ ] Radius/ellipse parameter grammar.
- [ ] Arc generation.
- [ ] Deduplication and coverage analysis.
- [ ] Class artifacts/catalog.

### Milestone 7 — textures/blocks/terminals

- [ ] Partial fills.
- [ ] Dither families.
- [ ] Seamless texture phases.
- [ ] Caps/nodes/arrows.
- [ ] Class artifacts/catalogs.

### Milestone 8 — vocabulary optimization

- [ ] Generate full candidate superset.
- [ ] Analyze slot pressure.
- [ ] Identify coverage holes.
- [ ] Score/select competing candidates.
- [ ] Preserve reserved space.
- [ ] Produce provisional 4K allocation map.

### Milestone 9 — font compiler

- [ ] Bitmap-to-outline compiler.
- [ ] Fixed metrics.
- [ ] PUA cmap.
- [ ] TTF output.
- [ ] WOFF2 output.
- [ ] Font specimen tests.

### Milestone 10 — programmatic drawing API

- [ ] Stable JSON schema.
- [ ] Lookup/index library.
- [ ] Neighbor compatibility API.
- [ ] Geometry-to-glyph solver.
- [ ] Multi-cell raster renderer.

### Milestone 11 — interactive GraphSCII editor

- [ ] Multi-cell canvas.
- [ ] geometric drawing tools.
- [ ] automatic glyph solving.
- [ ] manual tile replacement.
- [ ] Unicode copy/paste.
- [ ] PNG/text/JSON export.

### Milestone 12 — first stable vocabulary release

- [ ] Final coverage review.
- [ ] Freeze initial codepoint meanings.
- [ ] Freeze manifest schema v1.
- [ ] Generate all committed artifacts.
- [ ] Complete README/programmer documentation.
- [ ] Tag/release GraphSCII v1.

---

## 26. Definition of done for GraphSCII v1

A v1 release is ready when:

- canonical cell dimensions/orientation are frozen,
- all assigned glyphs are reproducible from source,
- every glyph has a stable codepoint,
- every glyph has canonical PNG and ASCII artifacts,
- every major shape class has a generated Markdown catalog,
- the JSON manifest completely describes glyph identity and connectivity,
- atlases cover the full assigned set,
- a usable fixed-cell font is generated,
- programs can render either through the font or directly through bitmap artifacts,
- neighbor compatibility can be determined mechanically,
- generation/tests are deterministic,
- README and programmer docs explain the format,
- codepoint meanings are ready to be treated as stable API.

---

## 27. Guiding rule for future work

When deciding whether to add a hand-authored glyph, generator rule, artifact, metadata field, or new subsystem, prefer the choice that makes the vocabulary more:

- **systematic**,
- **reproducible**,
- **queryable**,
- **composable**,
- **inspectable**,
- **programmable**,
- **geometrically expressive per codepoint**.

The generator should let empirical results determine the vocabulary. We should not assume in advance how many glyphs a family deserves when we can generate the candidates, rasterize them, deduplicate them, measure the surviving visual space, and inspect the result.

The long-term objective is not simply to fill 4,096 codepoints. It is to make those codepoints behave like a compact, coherent graphic language.
