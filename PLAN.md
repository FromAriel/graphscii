# GraphSCII — Living Project Plan

> **Status:** Active project memory and roadmap.
>
> **Repository:** `FromAriel/graphscii`
>
> **Implementation:** `geometric-glyph-lab/`
>
> **Canonical cell:** **8 columns × 16 rows**
>
> The original long-form planning document is preserved verbatim at [`docs/PLAN-v0.md`](docs/PLAN-v0.md).

---

## 1. What GraphSCII is

GraphSCII is a fixed-cell graphics language encoded as Unicode glyphs and machine-readable tile data.

Each assigned glyph is a deterministic 8×16 binary bitmap representing a useful fragment of geometry: straight segments, angled segments, curves, junctions, filled contours, circle/ellipse pieces, blocks, textures, terminals, nodes, arrows, and other primitives that prove useful in real drawings.

The goal is not to collect thousands of unrelated symbols. The goal is to build a compact **2D graphics instruction set** whose cells connect predictably and can be selected mechanically by software.

A program should eventually be able to ask:

- Which glyph connects `L13` to `R4`?
- Which glyph smoothly continues an exit on the previous tile?
- Which glyph best approximates a local line or curve?
- Which junction matches a direction mask?
- Which filled contour crosses a cell in a requested way?
- Which neighboring glyphs are geometrically compatible?

The same vocabulary should support font rendering, direct bitmap rendering, ASCII inspection, generated shape catalogs, JSON lookup, atlases, an interactive editor, and eventually an automatic geometry-to-glyph solver.

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
   exact bitmap deduplication
            ↓
      glyph registry
       ↙    ↓    ↘
    PNG   JSON   ASCII
      \     |     /
       docs / atlases
            ↓
           font
```

The font is a compiled artifact, never the authoritative definition. Generated files may be committed for inspection or consumption, but they must remain reproducible from source.

---

## 3. GraphSCII v1 cell contract — FROZEN

GraphSCII v1 uses:

```text
width  = 8 pixels
height = 16 pixels
```

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

The normative low-level contract is [`docs/format.md`](docs/format.md).

### Bitmap serialization — FROZEN

Each glyph is exactly 16 bytes, one byte per row, top to bottom. Within a row, `x=0` is bit 0 and `x=7` is bit 7. Each row serializes as two lowercase hexadecimal digits; a complete bitmap key is therefore exactly 32 lowercase hex characters.

Serialization identifier:

```text
v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex
```

### ASCII representation — FROZEN

```text
# = filled pixel
- = empty pixel
```

Every canonical ASCII glyph file contains exactly 16 rows × 8 characters plus ordinary line endings and no embedded prose.

### Artifact naming — FROZEN

Codepoint stems use six-digit uppercase hexadecimal:

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

## 4. Vocabulary and address-space target

Working target:

```text
4096 glyph IDs = 12-bit address space
```

Preferred initial Unicode mapping:

```text
glyph 0x000 → U+E000
...
glyph 0xFFF → U+EFFF
```

`4096` is a budget, not a requirement to fill every slot. Shape-family generators should create candidate supersets; exact raster deduplication and coverage analysis determine what actually deserves space.

A provisional reserve remains desirable:

```text
0x000–0xEFF   vocabulary             3840 slots
0xF00–0xFFF   reserved/experimental   256 slots
```

This partition is not frozen.

---

## 5. Current empirical baseline

The straight-line engine generates six edge-to-edge families:

```text
Left → Right      16 × 16 = 256
Top → Bottom       8 ×  8 =  64
Left → Top        16 ×  8 = 128
Left → Bottom     16 ×  8 = 128
Right → Top       16 ×  8 = 128
Right → Bottom    16 ×  8 = 128
                               ───
                               832
```

Current regression fixture:

```text
mathematical candidates    832
unique canonical bitmaps   746
duplicate candidates        86
compression              10.3%
maximum aliases              4
```

This exact result is a GraphSCII v1 regression fixture. Rasterizer or coordinate changes that alter it must be deliberate and investigated.

Several mathematical definitions may rasterize to the same bitmap. Those definitions share one visual glyph but retain all geometric interpretations as aliases.

---

## 6. Planned shape classes

Each major class should ultimately receive generator source, metadata, exact ASCII artifacts, canonical PNGs, statistics, generated Markdown documentation, tests, and provisional then stable codepoint allocation.

### Straight segments

Opposite-edge and adjacent-edge lines, principal horizontal/vertical lines, shallow and steep diagonals, and only those thickness variants that empirical use justifies.

### Curves

Curve grammar should include start port, end port, start tangent, end tangent, and curvature/strength class. Initial research classes may be `gentle`, `normal`, and `tight`. Generate broadly and let raster deduplication reveal the true visual vocabulary.

### Junctions

Corners, T junctions, crosses, forks, diagonal/cardinal combinations, sharp joins, rounded joins, and possibly chamfered joins. Major-direction junctions should use direction masks where practical.

### Filled contours

Straight and curved boundaries combined with a fill-side rule: above/below, left/right, wedges, silhouette boundaries, inside/outside curve pieces, and filled corners.

### Circles and ellipses

Small-, medium-, and large-radius arc fragments, ellipse fragments, and useful filled variants.

### Blocks and partial fills

Full block, halves, quarters, useful eighth-like partitions, progressive fills, and wedges.

### Texture and dithering

Ordered dithers, checker patterns, horizontal/vertical/diagonal hatch, crosshatch, dots/stipple, and phase-shifted variants that tile seamlessly.

### Terminals, nodes, and arrows

Line caps, round/square/diamond nodes, hollow variants, arrowheads, directional terminals, and diagrammatic ports.

### Compound/special and reserved

Keep space for primitives discovered through actual use rather than attempting to predict every useful shape in advance.

---

## 7. Repository and artifact structure

```text
graphscii/
├── PLAN.md                         # current living plan
├── README.md                       # user/programmer overview
├── geometric-glyph-lab/            # active generator/browser
│   ├── src/core/
│   ├── scripts/
│   ├── dist/
│   └── package.json
├── spec/                           # future hand-maintained vocabulary inputs
├── artifacts/
│   ├── manifest/
│   ├── glyphs/
│   │   ├── ascii/
│   │   └── png/
│   ├── classes/
│   ├── atlases/
│   └── font/
└── docs/
    ├── format.md
    ├── PLAN-v0.md
    ├── milestone-1-artifacts.md
    ├── drawing-api.md              # future
    ├── connectivity.md             # future
    └── examples/                   # future
```

Do not reorganize working code merely for aesthetics. Refactor when architecture or maintainability actually requires it.

---

## 8. Per-glyph artifact contract

Every assigned glyph should be independently inspectable without opening a font.

### PNG

```text
artifacts/glyphs/png/U+00E000.png
```

Canonical PNGs are native 8×16 RGBA images. Filled pixels are opaque black; empty pixels are transparent. Human-scale previews may be generated separately with nearest-neighbor enlargement.

### ASCII

```text
artifacts/glyphs/ascii/U+00E000.txt
```

Exactly 16 rows × 8 characters using only `#` and `-`.

### JSON

The manifest must be sufficient for software to use GraphSCII without reverse-engineering the font. Records should include glyph ID, codepoint, family membership, bitmap rows/key, aliases, connectivity, and artifact paths.

### Class Markdown

Each shape class eventually gets a large generated catalog containing generation rules, counts, aliases, connectivity metadata, exact ASCII forms, and links to PNG artifacts.

---

## 9. Rendering model

GraphSCII should support two equivalent paths.

### Font/text path

Load the GraphSCII font and manifest, select glyph IDs, map them to Unicode, and render a fixed-cell text grid.

### Direct bitmap path

Load the manifest/atlas and copy canonical bitmap tiles directly into a framebuffer or canvas. This bypasses platform font rasterization and preserves exact source pixels.

Long-term APIs should support operations conceptually like:

```text
findStraight(startPort, endPort)
findCurve(startPort, endPort, tangents, curvature)
findJunction(directionMask)
findCompatibleNeighbor(glyph, edge)
findClosestGeometry(segmentOrCurve)
```

---

## 10. Artifact generation and verification

Current commands from `geometric-glyph-lab/`:

```powershell
npm run generate
npm run verify:artifacts
npm run verify
```

The artifact generator is independent of the browser UI. It writes only managed subtrees under `artifacts/` so hand-maintained files in the artifact root survive regeneration.

The verifier checks the straight-line regression fixture, manifest counts, exact ASCII output, native PNG dimensions, byte-for-byte deterministic PNG regeneration, and atlas dimensions.

Current generated straight-line snapshot:

```text
832 candidates
746 unique glyphs
746 ASCII files
746 native 8×16 PNG files
1 complete atlas: 128×752
3 page atlases: 256 slots each
```

Reference atlases and statistics are committed in the repository. The full expanded per-glyph tree is reproducibly generated on demand and can be committed as a deliberate snapshot when useful.

Detailed Milestone 1 notes: [`docs/milestone-1-artifacts.md`](docs/milestone-1-artifacts.md).

---

## 11. Testing requirements

### Raster

- deterministic output,
- exact 8×16 dimensions,
- binary canonical pixels,
- known regression fixtures.

### Deduplication

- identical bitmaps merge,
- aliases survive,
- non-identical bitmaps never merge,
- bitmap-key serialization remains stable.

### Registry

- unique glyph IDs,
- unique codepoints,
- valid ranges,
- reserved regions respected,
- frozen allocations preserved after release.

### Artifacts

For every assigned glyph: PNG exists and is 8×16; ASCII exists and is 8×16; ASCII, PNG, and manifest agree; artifact paths resolve.

### Connectivity

Port indexes must be valid, seams must land at expected boundary pixels, smooth joins must satisfy tangent rules, and intentional corners must not be mislabeled smooth.

### Reproducibility

A clean run from the same source should produce byte-identical canonical artifacts wherever practical.

---

## 12. Codepoint stability policy

During research, provisional glyph IDs/codepoints may move.

After the first stable vocabulary release, codepoints become API:

1. never silently change the visual meaning of an assigned codepoint,
2. never recycle a retired codepoint for unrelated geometry within the same major format version,
3. preserve aliases/renames in metadata,
4. increment the GraphSCII format major version for unavoidable breaking remaps.

---

## 13. Milestone sequence

### Milestone 0 — lock fundamentals — **COMPLETE**

- [x] Lock 8 columns × 16 rows.
- [x] Centralize dimensions.
- [x] Preserve `832 → 746`, 86 duplicates, max 4 aliases.
- [x] Freeze bitmap serialization.
- [x] Freeze ASCII convention.
- [x] Freeze artifact filename stems.
- [x] Document `docs/format.md`.
- [x] Add regression verification.

### Milestone 1 — persistent artifact pipeline — **COMPLETE**

- [x] Add generator CLI separate from UI actions.
- [x] Generate main JSON manifest and statistics.
- [x] Generate 746 exact ASCII files.
- [x] Generate 746 native 8×16 PNG files.
- [x] Generate full and page atlases.
- [x] Add artifact consistency/reproducibility verification.
- [x] Commit reference full/page atlases and statistics.
- [x] Document the slice in `docs/milestone-1-artifacts.md`.

### Milestone 2 — straight-line class publication — **NEXT**

- [ ] Define provisional straight-line codepoint allocation explicitly.
- [ ] Add connectivity metadata derived from aliases/ports.
- [ ] Generate `artifacts/classes/straight-lines.md` containing every straight glyph and exact ASCII form.
- [ ] Preserve all mathematical aliases in manifest/catalog output.
- [ ] Add machine lookup indexes for straight geometry.
- [ ] Add tests for class counts, catalog coverage, and connectivity.

### Milestone 3 — curve research engine

- [ ] Define curve grammar and tangent semantics.
- [ ] Implement deterministic curve rasterization.
- [ ] Generate broad candidate families.
- [ ] Deduplicate and measure coverage.
- [ ] Publish curve artifacts/catalog.

### Milestone 4 — junctions

- [ ] Direction-mask model.
- [ ] Sharp and rounded junction generation.
- [ ] Compatibility metadata.
- [ ] Junction catalog/artifacts.

### Milestone 5 — filled contours

- [ ] Fill-side classifier.
- [ ] Straight and curved filled boundaries.
- [ ] Wedges/corners.
- [ ] Filled catalog/artifacts.

### Milestone 6 — circles/ellipses

- [ ] Radius/ellipse grammar.
- [ ] Arc generation.
- [ ] Deduplication/coverage analysis.
- [ ] Catalog/artifacts.

### Milestone 7 — textures/blocks/terminals

- [ ] Partial fills and dithers.
- [ ] Seamless texture phases.
- [ ] Caps/nodes/arrows.
- [ ] Catalogs/artifacts.

### Milestone 8 — vocabulary optimization

- [ ] Generate the full candidate superset.
- [ ] Analyze slot pressure and coverage holes.
- [ ] Score/select competing candidates when necessary.
- [ ] Preserve intentional reserve space.
- [ ] Produce provisional 4K allocation map.

### Milestone 9 — font compiler

- [ ] Bitmap-to-outline compiler.
- [ ] Fixed metrics and PUA cmap.
- [ ] TTF output.
- [ ] WOFF2 output.
- [ ] Font specimen tests.

### Milestone 10 — drawing API

- [ ] Stable JSON schema.
- [ ] Lookup/index library.
- [ ] Neighbor compatibility API.
- [ ] Geometry-to-glyph solver.
- [ ] Multi-cell renderer.

### Milestone 11 — interactive editor

- [ ] Multi-cell canvas.
- [ ] Geometry drawing tools.
- [ ] Automatic glyph solving.
- [ ] Manual cell replacement.
- [ ] Unicode copy/paste.
- [ ] PNG/text/JSON export.

### Milestone 12 — GraphSCII v1

- [ ] Final coverage review.
- [ ] Freeze initial codepoint meanings.
- [ ] Freeze manifest schema v1.
- [ ] Generate release artifact snapshot.
- [ ] Complete programmer/user documentation.
- [ ] Tag/release GraphSCII v1.

---

## 14. Definition of done for v1

GraphSCII v1 is ready when the canonical 8×16 format is frozen; every assigned glyph reproduces from source; codepoints are stable; every glyph has PNG and ASCII artifacts; major shape classes have generated catalogs; JSON describes identity/connectivity; atlases cover the vocabulary; a fixed-cell font exists; programs can render via font or canonical bitmap data; neighbor compatibility is mechanically queryable; generation is deterministic; and codepoint meanings are ready to be treated as stable API.

---

## 15. Guiding rule

Prefer designs that make GraphSCII more **systematic, reproducible, queryable, composable, inspectable, programmable, and geometrically expressive per codepoint**.

Do not guess how many slots a family deserves when the generator can create the candidates, rasterize them, deduplicate them, measure surviving visual space, and show us the result.

The objective is not to fill 4096 codepoints. It is to make those codepoints behave like a coherent graphical language.
