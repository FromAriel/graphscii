# GraphSCII — Persistent Project Plan

> **Status:** Living design document and project memory.
>
> **Repository:** `FromAriel/graphscii`
>
> **Implementation seed:** `geometric-glyph-lab/`
>
> **Canonical cell:** **8 columns × 16 rows** (GraphSCII v1 format lock)

---

## 1. Vision

GraphSCII is a fixed-cell graphics language encoded as a font and as machine-readable glyph data.

Each assigned character represents a deterministic 8×16 binary bitmap describing a useful fragment of geometry: straight segments, angled segments, curves, junctions, filled contours, circle/ellipse pieces, blocks, textures, terminals, nodes, arrows, and other primitives proven useful by actual drawing.

The goal is not a miscellaneous symbol font. The goal is a compact **2D graphics instruction set** whose cells can be composed into larger images and queried by software.

A program should eventually be able to ask:

- Which glyph connects `L13` to `R4`?
- Which glyph smoothly continues this right-side exit?
- Which glyph best approximates this local line or curve?
- Which glyph represents a given junction mask?
- Which filled contour crosses a cell in this way?
- Which neighboring glyphs are geometrically compatible?

The same canonical vocabulary should support:

1. a fixed-cell font,
2. direct PNG/tile rendering,
3. exact ASCII representations,
4. human-readable shape catalogs,
5. JSON metadata and indexes,
6. atlases/specimen sheets,
7. an interactive research/browser tool,
8. a drawing editor,
9. eventually an automatic geometry-to-glyph solver.

---

## 2. Source-of-truth hierarchy

GraphSCII uses this authority order:

1. **Generator/specification source** — geometry and family rules.
2. **Canonical bitmap** — visual identity.
3. **Glyph registry/allocation** — assigned identity and metadata.
4. **Generated artifacts** — PNG, ASCII, JSON, Markdown, atlases, fonts.

Pipeline:

```text
geometric definition / family rule
            ↓
    deterministic rasterizer
            ↓
      canonical bitmap
            ↓
   exact visual deduplication
            ↓
      glyph registry
       ↙    ↓    ↘
    PNG   JSON   ASCII
      \     |     /
       docs / atlases
            ↓
           font
```

The font is a compiled artifact, never the authoritative definition. Every committed generated artifact must be reproducible from source.

---

## 3. Canonical GraphSCII v1 cell — LOCKED

GraphSCII v1 uses:

```text
width  = 8 pixels
height = 16 pixels
```

That means **8 columns × 16 rows**.

The 16×8 ASCII example that appeared during early planning was an orientation/presentation mismatch. The working implementation and measured baseline already used 8×16, so GraphSCII preserves that orientation rather than invalidating the existing experiment.

Coordinates:

```text
x = 0..7    left → right
y = 0..15   top → bottom
```

Boundary ports:

```text
Top:     T0..T7
Bottom:  B0..B7
Left:    L0..L15
Right:   R0..R15
```

The normative low-level contract is documented in [`docs/format.md`](docs/format.md).

### Canonical bitmap serialization — LOCKED

GraphSCII v1 serializes each glyph as exactly 16 bytes:

- one byte per row,
- rows top-to-bottom,
- `x=0` is bit 0 / least-significant bit,
- `x=7` is bit 7,
- each row is two lowercase hex digits,
- the bitmap key concatenates all 16 row bytes,
- every bitmap key is therefore exactly 32 lowercase hex characters.

Identifier:

```text
v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex
```

### Canonical ASCII — LOCKED

```text
# = filled pixel
- = empty pixel
```

Each per-glyph ASCII file is exactly 16 rows × 8 characters plus ordinary line endings, with no labels or prose inside the file.

### Artifact filename stem — LOCKED

Codepoints use six-digit, zero-padded uppercase hexadecimal:

```text
U+00E000
U+00E001
U+00E23A
```

Examples:

```text
U+00E000.png
U+00E000.txt
```

---

## 4. Target vocabulary and address space

Working target:

```text
4096 glyph IDs = 12-bit address space
```

Preferred initial mapping:

```text
glyph 0x000 → U+E000
...
glyph 0xFFF → U+EFFF
```

`4096` is a budget, not a requirement to fill every slot.

We should generate candidate supersets, rasterize them, deduplicate exact visual identities, measure coverage, and only then decide how much address space each class deserves.

Provisional idea:

```text
0x000–0xEFF   assigned vocabulary    3840 slots
0xF00–0xFFF   reserved/experimental  256 slots
```

This allocation is not frozen.

---

## 5. Existing straight-line baseline — REGRESSION FIXTURE

The current lab generates six edge-to-edge straight families:

- Left → Right: `16 × 16 = 256`
- Top → Bottom: `8 × 8 = 64`
- Left → Top: `16 × 8 = 128`
- Left → Bottom: `16 × 8 = 128`
- Right → Top: `16 × 8 = 128`
- Right → Bottom: `16 × 8 = 128`

Current measured result:

```text
mathematical candidates    832
unique canonical bitmaps   746
duplicate candidates        86
compression              10.3%
maximum aliases              4
```

This exact result is now a permanent GraphSCII v1 regression fixture. A future change that alters it must be intentional and treated as raster/format-affecting until understood.

---

## 6. Geometry identity vs visual identity

A geometric primitive and its raster bitmap are related but not identical concepts.

Several mathematical definitions may rasterize to the exact same 8×16 bitmap. Those candidates must share one visual glyph while preserving every geometric interpretation as an alias.

Example:

```json
{
  "glyphId": 376,
  "bitmapKey": "...",
  "aliases": [
    { "type": "straight", "start": "L4", "end": "R5" },
    { "type": "straight", "start": "L4", "end": "R6" }
  ]
}
```

This prevents codepoint waste while allowing software to retain geometric intent.

---

## 7. Planned shape classes

Every major class eventually receives:

1. generator source,
2. machine-readable metadata,
3. exact ASCII artifacts,
4. canonical PNGs,
5. statistics,
6. generated Markdown catalog,
7. tests,
8. provisional then stable codepoint allocation.

### 7.1 Straight segments

- opposite-edge segments,
- adjacent-edge segments,
- shallow and steep diagonals,
- principal horizontal/vertical lines,
- thickness variants only if empirical coverage justifies them.

### 7.2 Curves

Curve grammar should include at minimum:

- start port,
- end port,
- start tangent,
- end tangent,
- curvature/strength class.

Initial curvature candidates:

```text
gentle
normal
tight
```

Generate many candidates and let raster deduplication reveal the true visual vocabulary size.

### 7.3 Junctions

- two-way corners,
- T junctions,
- crosses,
- forks,
- diagonal/cardinal mixtures,
- sharp joins,
- rounded joins,
- possibly chamfered joins.

Major-direction junctions should use direction masks where practical.

### 7.4 Filled contours

Generated from boundary geometry plus a fill-side rule:

- solid above/below a line,
- solid left/right,
- diagonal wedges,
- curved silhouette boundaries,
- inside/outside curve pieces,
- filled corners.

### 7.5 Circles and ellipses

- small-radius arcs,
- medium-radius arcs,
- large-radius nearly-flat arcs,
- ellipse fragments,
- useful filled inside/outside variants.

### 7.6 Blocks and partial fills

- full block,
- halves,
- quarters,
- useful eighth-like partitions,
- progressive fills,
- wedges.

### 7.7 Texture and dithering

- ordered dither levels,
- checker patterns,
- horizontal/vertical hatch,
- `/` and `\` hatch,
- crosshatch,
- dots/stipple,
- phase-shifted variants that tile seamlessly.

### 7.8 Terminals, nodes, and arrows

- line caps,
- round/square nodes,
- diamonds,
- hollow variants,
- arrowheads,
- directional terminals,
- diagrammatic ports.

### 7.9 Compound/special primitives

Reserve these for shapes that actual drawing experiments prove valuable but that do not fit the systematic families.

### 7.10 Reserved/experimental

Keep real uncommitted address space until broad usage reveals missing primitives.

---

## 8. Repository structure

Current/target structure:

```text
graphscii/
├── PLAN.md
├── README.md
│
├── geometric-glyph-lab/
│   ├── src/
│   │   └── core/
│   ├── scripts/
│   ├── tests/
│   ├── dist/
│   └── package.json
│
├── spec/
│   ├── classes/
│   ├── allocation.json
│   └── schema/
│
├── artifacts/
│   ├── manifest/
│   │   ├── glyphs.json
│   │   ├── aliases.json
│   │   ├── stats.json
│   │   └── compatibility.json
│   ├── glyphs/
│   │   ├── png/
│   │   └── ascii/
│   ├── classes/
│   ├── atlases/
│   └── font/
│
└── docs/
    ├── format.md
    ├── drawing-api.md
    ├── connectivity.md
    └── examples/
```

Do not reorganize the working lab merely for aesthetics. Refactor only when the architecture needs it.

---

## 9. Per-glyph artifact contract

Every assigned glyph must be independently inspectable without opening a font file.

### PNG

```text
artifacts/glyphs/png/U+00E000.png
```

Requirements:

- exact canonical 8×16 dimensions,
- binary visual content,
- transparent background unless a later artifact format explicitly specifies otherwise,
- no interpolation or pre-scaling in the canonical file.

Human-scale preview images may be generated separately with nearest-neighbor scaling.

### ASCII

```text
artifacts/glyphs/ascii/U+00E000.txt
```

Requirements:

- exactly 16 rows,
- exactly 8 characters per row,
- `#` filled,
- `-` empty,
- no metadata inside the file.

### Metadata

The main JSON manifest is the authoritative generated metadata index. Per-glyph JSON is optional and should only be added if it materially improves consumers.

---

## 10. Shape-class Markdown catalogs

Each class gets one large generated file, for example:

```text
artifacts/classes/straight-lines.md
artifacts/classes/curves.md
artifacts/classes/junctions.md
```

Each catalog should contain:

- class description,
- generation rules,
- candidate count,
- unique count,
- duplicate/alias count,
- provisional/stable codepoint ranges,
- semantic tags,
- exact ASCII rendering of every glyph,
- all aliases,
- connectivity and tangent information,
- path/link to the tiny PNG.

Catalogs are generated documentation and should not be hand-maintained glyph by glyph.

---

## 11. JSON manifest contract

The manifest must be sufficient for a program to use GraphSCII without reverse-engineering the font.

Proposed top-level form:

```json
{
  "format": "graphscii",
  "formatVersion": 1,
  "generatorVersion": "...",
  "cell": {
    "width": 8,
    "height": 16,
    "orientation": "8-columns-by-16-rows"
  },
  "bitmapSerialization": "v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex",
  "codepointBase": "U+00E000",
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
  "codepointHex": "U+00E23A",
  "family": "straight-left-right",
  "tags": ["straight", "diagonal", "left-right"],
  "bitmap": {
    "rowsHex": ["00", "01"],
    "key": "...32 lowercase hex chars..."
  },
  "connections": [
    { "edge": "left", "port": 13, "tangent": "east" },
    { "edge": "right", "port": 4, "tangent": "east" }
  ],
  "aliases": [
    { "type": "straight", "start": "L13", "end": "R4" }
  ],
  "artifacts": {
    "png": "../glyphs/png/U+00E23A.png",
    "ascii": "../glyphs/ascii/U+00E23A.txt"
  }
}
```

The external schema is not frozen yet. The canonical bitmap serialization is.

---

## 12. Lookup indexes

Consumers should not need to scan the whole vocabulary for common queries.

Generated indexes may include:

- by codepoint,
- by glyph ID,
- by bitmap key,
- by family,
- by tag,
- by entry port,
- by exit port,
- by port+tangent,
- by geometric alias,
- by compatibility.

---

## 13. Connectivity model

Eventually each geometric connection should carry:

```text
edge
port index
tangent
join semantics
```

Possible join semantics:

- smooth continuation,
- intentional corner,
- junction,
- terminal,
- fill boundary.

Example future query:

```text
current glyph exits R7 with tangent east
            ↓
return glyphs entering L7 with compatible tangent
```

A generated compatibility index can make neighbor selection cheap.

---

## 14. Rendering and drawing paths

### Path A — font/text

1. Load GraphSCII font.
2. Load manifest/indexes.
3. Solve/select glyph ID.
4. Convert to assigned codepoint.
5. Write character into a fixed-cell text grid.
6. Render using GraphSCII metrics.

The drawing can then be serialized as Unicode text.

### Path B — direct bitmap/tile rendering

1. Load manifest or atlas index.
2. Select the same glyph IDs.
3. Copy canonical PNG/atlas cells into canvas/framebuffer.

This bypasses font rasterization and reproduces canonical pixels exactly.

### Long-term solver API

Conceptually:

```text
findStraight(startPort, endPort)
findCurve(startPort, endPort, tangents, curvature)
findJunction(directionMask)
findCompatibleNeighbor(glyph, edge)
findClosestGeometry(segmentOrCurve)
```

A higher-level solver should sample vector geometry cell-by-cell and choose the best GraphSCII glyph for each cell.

---

## 15. Font compilation

Font outlines derive deterministically from canonical bitmaps.

Initial strategy:

- each filled pixel becomes a rectangle,
- adjacent rectangles may be unioned,
- identical fixed advance for every glyph,
- no kerning,
- no proportional metrics,
- no default ligatures,
- no shaping-dependent geometry.

For 8×16, a convenient scale is:

```text
1 canonical pixel = 128 font units
cell width         = 1024 units
cell height        = 2048 units
```

PNG/bitmap output remains authoritative because platform font rasterizers may differ at arbitrary scales.

---

## 16. Atlas generation

Stable page model:

```text
256 glyphs per page
16 columns × 16 rows
16 pages for 4096 slots
```

```text
page 0 = 000–0FF
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

Family-specific atlases may also be generated.

---

## 17. Deterministic artifact generation

One command should eventually regenerate the distributable state:

```text
bun run generate
```

Target pipeline:

1. load specification,
2. generate mathematical candidates,
3. rasterize deterministically,
4. deduplicate visual identities,
5. preserve aliases,
6. allocate/freeze codepoints,
7. validate metadata/connectivity,
8. write manifests/indexes,
9. write per-glyph ASCII,
10. write per-glyph PNG,
11. write class Markdown catalogs,
12. write atlases,
13. compile fonts,
14. write statistics/provenance,
15. verify committed artifacts.

---

## 18. Artifact commit policy

GraphSCII intentionally commits useful generated products:

- canonical tiny PNGs,
- exact ASCII glyph files,
- JSON manifests/indexes,
- class Markdown catalogs,
- reference atlases,
- release fonts.

Do not commit:

- dependency directories,
- caches,
- temporary canvases,
- debug intermediates,
- local state.

A verification command should eventually fail if regeneration unexpectedly changes committed canonical artifacts.

---

## 19. Codepoint stability

During research, glyph IDs and provisional codepoints may move.

After the first stable vocabulary release, codepoints become API.

After freeze:

1. never silently give an existing codepoint a different visual meaning,
2. never recycle a retired codepoint for unrelated geometry in the same major version,
3. record aliases/renames,
4. increment the GraphSCII format major version for unavoidable breaking remaps.

---

## 20. Candidate selection when slot pressure appears

Do not hand-design 4096 isolated glyphs.

Family generators should create candidate supersets. Measure:

- exact duplicates,
- symmetry,
- connectivity coverage,
- tangent coverage,
- visual novelty,
- family importance,
- expected drawing utility.

If candidates exceed the address budget, introduce an inspectable deterministic scoring stage.

Possible score terms:

- unique connectivity signature,
- unique tangent behavior,
- geometric coverage,
- perceptual bitmap distance,
- symmetry completion,
- expected utility,
- family priority.

---

## 21. Symmetry and transforms

Generators may derive:

- horizontal mirror,
- vertical mirror,
- 180° rotation.

Because the cell is non-square, 90° rotation changes dimensions and is not automatically valid.

Transforms must update geometry metadata as well as pixels. Deduplication runs after transforms.

---

## 22. Testing requirements

### Raster tests

- deterministic output,
- exact 8×16 dimensions,
- known fixtures,
- binary-only canonical pixels.

### Deduplication tests

- identical bitmaps merge,
- aliases survive,
- non-identical bitmaps never merge,
- bitmap key serialization stays stable.

### Registry tests

- unique glyph IDs,
- unique codepoints,
- valid ranges,
- reserved regions respected,
- frozen allocations unchanged.

### Artifact tests

For every assigned glyph:

- PNG exists,
- PNG is exactly 8×16,
- ASCII exists,
- ASCII is exactly 8×16,
- ASCII equals PNG/manifest bitmap,
- manifest artifact paths resolve.

### Catalog tests

- every assigned glyph appears in correct catalogs,
- class counts match manifest,
- links/codepoints are current.

### Connectivity tests

- port indexes valid,
- seams match expected boundary pixels,
- smooth joins satisfy tangent rules,
- intentional corners are not mislabeled smooth.

### Reproducibility

A clean run from the same source commit should produce byte-identical canonical artifacts wherever practical.

---

## 23. Interactive lab roadmap

Existing/early:

- candidate-family generation,
- candidate/unique/duplicate counts,
- atlas browsing,
- glyph inspector,
- nearest-neighbor preview,
- exact ASCII view,
- alias inspection,
- PNG/JSON export.

Next:

- shape-class selector,
- curve parameter explorer,
- tangent visualization,
- seam/neighbor preview,
- compatibility search,
- candidate→deduplicated-survivor comparison,
- codepoint allocation display,
- symmetry inspection.

Later:

- multi-cell drawing canvas,
- line/curve tools,
- automatic glyph solving,
- per-cell manual replacement,
- Unicode copy/paste,
- PNG/text/JSON drawing export.

---

## 24. Documentation goals

The README should eventually explain GraphSCII at three levels:

### Human overview

What GraphSCII is and why a geometric text/tile vocabulary is useful.

### Artist/user usage

- install/use the font,
- browse atlases,
- copy glyphs,
- understand codepoint pages,
- inspect class catalogs.

### Programmer usage

- load manifest,
- locate by ID/codepoint,
- query ports/tangents,
- render through font or bitmap atlas,
- match compatible neighbors,
- serialize drawings.

Detailed contracts belong in `docs/`.

---

## 25. Milestone sequence

### Milestone 0 — lock fundamentals — **COMPLETE**

- [x] Canonical orientation locked: **8 columns × 16 rows**.
- [x] Cell dimensions centralized as constants.
- [x] Straight-line baseline preserved and re-verified: `832 → 746`, 86 duplicates, max 4 aliases.
- [x] Permanent bitmap serialization format established.
- [x] Artifact filename convention established: `U+00E000.*`.
- [x] Canonical ASCII convention established: `#` / `-`.
- [x] Low-level format documented in `docs/format.md`.
- [x] Prebuilt regression verification checks the format contract.

### Milestone 1 — persistent artifact pipeline — **NEXT**

- [ ] Add generator CLI separate from UI actions.
- [ ] Generate main JSON manifest.
- [ ] Generate per-glyph exact ASCII files.
- [ ] Generate per-glyph canonical PNG files.
- [ ] Generate complete/page atlases.
- [ ] Add artifact consistency tests.

### Milestone 2 — straight-line class publication

- [ ] Allocate provisional codepoints to unique straight glyphs.
- [ ] Generate `straight-lines.md` containing every exact ASCII form.
- [ ] Preserve all mathematical aliases in JSON/docs.
- [ ] Add connectivity metadata.

### Milestone 3 — curve research engine

- [ ] Define curve grammar.
- [ ] Implement deterministic curve rasterization.
- [ ] Generate large candidate families.
- [ ] Deduplicate.
- [ ] Compare curvature/tangent coverage.
- [ ] Publish curve artifacts/catalog.

### Milestone 4 — junctions

- [ ] Direction-mask model.
- [ ] Sharp junction generation.
- [ ] Rounded junction generation.
- [ ] Compatibility metadata.
- [ ] Junction artifacts/catalog.

### Milestone 5 — filled contours

- [ ] Fill-side classifier.
- [ ] Straight filled boundaries.
- [ ] Curved filled boundaries.
- [ ] Wedges/corners.
- [ ] Filled artifacts/catalog.

### Milestone 6 — circles/ellipses

- [ ] Radius/ellipse grammar.
- [ ] Arc generation.
- [ ] Deduplication/coverage analysis.
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
- [ ] Geometric drawing tools.
- [ ] Automatic glyph solving.
- [ ] Manual tile replacement.
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

- canonical 8×16 cell format is frozen,
- all assigned glyphs reproduce from source,
- every glyph has a stable codepoint,
- every glyph has canonical PNG and ASCII artifacts,
- every major class has a generated Markdown catalog,
- JSON completely describes identity/connectivity,
- atlases cover the assigned vocabulary,
- a usable fixed-cell font exists,
- programs can render through font or canonical bitmap artifacts,
- neighbor compatibility is mechanically queryable,
- generation/tests are deterministic,
- README/programmer docs explain the format,
- codepoint meanings are ready to be treated as stable API.

---

## 27. Guiding rule

When deciding whether to add a hand-authored glyph, generator rule, artifact, metadata field, or subsystem, prefer the choice that makes GraphSCII more:

- **systematic**,
- **reproducible**,
- **queryable**,
- **composable**,
- **inspectable**,
- **programmable**,
- **geometrically expressive per codepoint**.

The generator should let empirical results determine the vocabulary. We should not assume how many slots a class deserves when we can generate the candidates, rasterize them, deduplicate them, measure surviving visual space, and inspect the result.

The objective is not to fill 4096 codepoints. It is to make those codepoints behave like a coherent graphical language.
