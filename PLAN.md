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

### Current straight-line allocation — PROVISIONAL

The first 746 unique straight-line glyphs currently occupy:

```text
glyph IDs    0..745
Unicode      U+00E000..U+00E2E9
assignment   codepoint = U+E000 + glyphId
```

The allocation is explicitly defined by `spec/straight-allocation.json`.

It remains provisional until the GraphSCII v1 codepoint freeze. Generation order is currently:

```text
LR → TB → LT → LB → RT → RB
```

The first raster-unique candidate receives the next glyph ID; later raster-identical candidates become aliases of that visual glyph.

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

## 6. Straight semantic registry — CURRENT

Milestone 2A adds explicit geometry semantics without changing canonical pixels.

Every straight alias now has:

```text
candidate ID
alias key
family
start port
end port
exact endpoint records
```

Example alias key:

```text
straight:L13>R4
```

A visual glyph with multiple aliases uses:

```text
alternative-alias-pairs
```

semantics. Ports belonging to different aliases are alternatives, **not simultaneous junction branches**.

Straight lookup is direction-independent for querying, so both:

```text
L13>R4
R4>L13
```

are materialized and resolve to the same glyph/candidate alias.

Generated lookup indexes:

```text
artifacts/manifest/indexes/
├── by-codepoint.json
├── by-bitmap.json
├── by-port.json
└── by-connection-pair.json
```

Current verified semantic counts:

```text
visual glyphs               746
mathematical aliases        832
boundary ports               48
codepoint lookups           746
bitmap lookups              746
port index entries         1664
connection-pair lookups    1664
```

See [`docs/connectivity.md`](docs/connectivity.md) and [`docs/milestone-2a-semantic-registry.md`](docs/milestone-2a-semantic-registry.md).

---

## 7. Planned shape classes

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

## 8. Repository and artifact structure

```text
graphscii/
├── PLAN.md
├── README.md
├── geometric-glyph-lab/
│   ├── src/core/
│   ├── scripts/
│   ├── dist/
│   └── package.json
├── spec/
│   └── straight-allocation.json
├── artifacts/
│   ├── manifest/
│   │   ├── glyphs.json
│   │   ├── stats.json
│   │   └── indexes/
│   ├── glyphs/
│   │   ├── ascii/
│   │   └── png/
│   ├── classes/
│   ├── atlases/
│   └── font/
└── docs/
    ├── format.md
    ├── connectivity.md
    ├── PLAN-v0.md
    ├── milestone-1-artifacts.md
    ├── milestone-2a-semantic-registry.md
    ├── drawing-api.md              # future
    └── examples/                   # future
```

Do not reorganize working code merely for aesthetics. Refactor when architecture or maintainability actually requires it.

---

## 9. Per-glyph artifact contract

Every assigned glyph should be independently inspectable without opening a font.

### PNG

```text
artifacts/glyphs/png/U+00E000.png
```

Canonical PNGs are native 8×16 RGBA images. Filled pixels are opaque black; empty pixels are transparent.

### ASCII

```text
artifacts/glyphs/ascii/U+00E000.txt
```

Exactly 16 rows × 8 characters using only `#` and `-`.

### JSON

The manifest must be sufficient for software to use GraphSCII without reverse-engineering the font. Records include glyph ID, codepoint, family membership, bitmap rows/key, aliases, connectivity, allocation, and artifact paths.

### Class Markdown

Each shape class eventually gets a large generated catalog containing generation rules, counts, aliases, connectivity metadata, exact ASCII forms, and links to PNG artifacts.

---

## 10. Rendering model

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

## 11. Generation and verification

Current commands from `geometric-glyph-lab/`:

```powershell
npm run generate
npm run verify
```

Generation now has two stages:

```text
Milestone 1 base artifact generation
              ↓
Milestone 2A semantic registry enrichment
```

Specific commands remain available:

```powershell
npm run generate:base
npm run generate:semantic
npm run verify:prebuilt
npm run verify:artifacts
npm run verify:semantic
```

The base generator writes canonical bitmaps, PNGs, ASCII, manifest data, and atlases. The semantic stage enriches the manifest and generates compact lookup indexes.

The full verifier checks:

- frozen 8×16 format contract
- `832 → 746 → 86` raster regression
- exact ASCII artifacts
- deterministic PNG bytes
- atlas dimensions
- provisional allocation bounds
- all 832 alias records
- all endpoint ports
- all forward/reverse connection-pair lookups
- all codepoint/bitmap lookups
- all port-index entries

Reference atlases and statistics are committed. Larger generated manifest/index/per-glyph snapshots may be committed deliberately when useful rather than making every source change carry the complete generated tree.

---

## 12. Testing requirements

### Raster

- deterministic output
- exact 8×16 dimensions
- binary canonical pixels
- known regression fixtures

### Deduplication

- identical bitmaps merge
- aliases survive
- non-identical bitmaps never merge
- bitmap-key serialization remains stable

### Registry/allocation

- unique glyph IDs
- unique codepoints
- allocation spec agrees with generation order and count
- provisional/stable status is explicit
- frozen allocations are preserved after release

### Connectivity

- port indexes are valid
- every straight alias has exactly two endpoint records
- aliases remain alternative interpretations
- both straight query orientations resolve to the same candidate
- port and pair indexes agree with manifest provenance

### Artifacts

For every assigned glyph: PNG exists and is 8×16; ASCII exists and is 8×16; ASCII, PNG, and manifest agree; artifact paths resolve.

### Reproducibility

A clean run from the same source should produce byte-identical canonical artifacts wherever practical.

---

## 13. Codepoint stability policy

During research, provisional glyph IDs/codepoints may move.

After the first stable vocabulary release, codepoints become API:

1. never silently change the visual meaning of an assigned codepoint,
2. never recycle a retired codepoint for unrelated geometry within the same major format version,
3. preserve aliases/renames in metadata,
4. increment the GraphSCII format major version for unavoidable breaking remaps.

---

## 14. Milestone sequence

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
- [x] Document `docs/milestone-1-artifacts.md`.

### Milestone 2A — straight semantic registry — **COMPLETE**

- [x] Define provisional straight-line allocation explicitly in `spec/straight-allocation.json`.
- [x] Enrich aliases with stable keys and endpoint connectivity metadata.
- [x] Preserve all 832 mathematical aliases.
- [x] Define alternative-alias connectivity semantics.
- [x] Generate by-codepoint lookup index.
- [x] Generate by-bitmap lookup index.
- [x] Generate by-port lookup index.
- [x] Generate direction-independent connection-pair lookup index.
- [x] Add semantic verification across all aliases/lookups.
- [x] Document `docs/connectivity.md` and the 2A slice.

### Milestone 2B — straight-line class catalog — **NEXT**

- [ ] Generate `artifacts/classes/straight-lines.md`.
- [ ] Include all 746 exact ASCII forms.
- [ ] Include codepoint, glyph ID, bitmap key, families, aliases, and connectivity.
- [ ] Link every entry to its canonical PNG/ASCII artifact.
- [ ] Add class-count/catalog coverage tests.

### Milestone 2C — straight vocabulary publication snapshot

- [ ] Commit a deliberate complete straight-line artifact snapshot.
- [ ] Include semantic manifest/indexes, per-glyph ASCII/PNG, catalog, atlases, and stats.
- [ ] Record snapshot provenance and regeneration command.

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

## 15. Definition of done for v1

GraphSCII v1 is ready when the canonical 8×16 format is frozen; every assigned glyph reproduces from source; codepoints are stable; every glyph has PNG and ASCII artifacts; major shape classes have generated catalogs; JSON describes identity/connectivity; atlases cover the vocabulary; a fixed-cell font exists; programs can render via font or canonical bitmap data; neighbor compatibility is mechanically queryable; generation is deterministic; and codepoint meanings are ready to be treated as stable API.

---

## 16. Guiding rule

Prefer designs that make GraphSCII more **systematic, reproducible, queryable, composable, inspectable, programmable, and geometrically expressive per codepoint**.

Do not guess how many slots a family deserves when the generator can create the candidates, rasterize them, deduplicate them, measure surviving visual space, and show us the result.

The objective is not to fill 4096 codepoints. It is to make those codepoints behave like a coherent graphical language.
