# GraphSCII — Living Project Plan

> **Status:** Active project memory and roadmap.
>
> **Repository:** `FromAriel/graphscii`
>
> **Implementation:** `geometric-glyph-lab/`
>
> **Canonical cell:** **8 columns × 16 rows**
>
> The original long-form planning document is preserved at [`docs/PLAN-v0.md`](docs/PLAN-v0.md). Completed milestone notes live in `docs/` and published generated snapshots live under `artifacts/`.

---

## 1. What GraphSCII is

GraphSCII is a fixed-cell graphics language encoded as Unicode glyphs and machine-readable tile data.

Each glyph is a deterministic 8×16 binary bitmap representing a useful local piece of geometry: straight segments, solid regions, filled boundaries, curves, junctions, circle/ellipse fragments, textures, terminals, nodes, arrows, and other primitives discovered through actual drawing use.

The goal is not a miscellaneous symbol font. The goal is a compact **2D graphics instruction set** whose cells compose predictably and can be selected mechanically by software.

A program should eventually be able to ask questions such as:

```text
Which glyph connects L13 to R4?
Which glyph fills the lower 5/16 of this cell?
Which filled boundary follows this local slope?
Which glyph smoothly continues this curve?
Which junction matches this direction mask?
Which neighboring glyphs are compatible?
```

The same vocabulary should support font rendering, direct bitmap rendering, ASCII inspection, generated class catalogs, JSON lookup, atlases, an editor, and eventually an automatic geometry-to-glyph solver.

---

## 2. Source-of-truth hierarchy

Authority order:

1. **Generator/specification source** — geometry and family rules.
2. **Canonical bitmap** — visual identity.
3. **Glyph registry/allocation** — assigned identity and semantic metadata.
4. **Generated artifacts** — PNG, ASCII, JSON, Markdown, atlases, fonts.

Pipeline:

```text
geometry / family rule
        ↓
deterministic rasterizer
        ↓
canonical 8×16 bitmap
        ↓
exact bitmap deduplication
        ↓
glyph registry + semantic aliases
        ↓
PNG / ASCII / JSON / catalogs / atlases
        ↓
font + drawing APIs
```

The font is always a compiled artifact, never the authoritative visual definition.

---

## 3. GraphSCII v1 cell contract — FROZEN

```text
width  = 8 pixels
height = 16 pixels
x = 0..7   left → right
y = 0..15  top → bottom
```

Ports:

```text
Top:     T0..T7
Bottom:  B0..B7
Left:    L0..L15
Right:   R0..R15
```

Normative contract: [`docs/format.md`](docs/format.md).

### Bitmap serialization

Each glyph is exactly 16 bytes, one byte per row, top to bottom. `x=0` is bit 0 and `x=7` is bit 7. The stable bitmap key is 32 lowercase hexadecimal characters.

```text
v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex
```

### ASCII

```text
# = filled pixel
- = empty pixel
```

Every canonical ASCII glyph is exactly 16 rows × 8 characters.

### Artifact naming

```text
U+00E000.png
U+00E000.txt
```

Codepoint stems use six uppercase hexadecimal digits.

---

## 4. Vocabulary and codepoint budget

Working address-space target:

```text
4096 glyph IDs = 12 bits
```

Preferred PUA mapping:

```text
glyph 0x000 → U+E000
...
glyph 0xFFF → U+EFFF
```

`4096` is a budget, not a requirement to fill every slot.

Provisional reserve goal:

```text
0x000–0xEFF   vocabulary             3840
0xF00–0xFFF   reserved/experimental  256
```

Do not pre-allocate large blocks to shape classes by guesswork. Generate candidate supersets, rasterize them, deduplicate them, measure the surviving visual vocabulary, then allocate intentionally.

---

## 5. Straight-line baseline — COMPLETE AND PUBLISHED

Candidate families:

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

Frozen regression fixture:

```text
mathematical candidates    832
unique canonical bitmaps   746
duplicate candidates        86
compression              10.3%
maximum aliases              4
```

Current provisional straight allocation:

```text
glyph IDs    0..745
Unicode      U+00E000..U+00E2E9
assignment   codepoint = U+E000 + glyphId
```

Source: `spec/straight-allocation.json`.

Generation order:

```text
LR → TB → LT → LB → RT → RB
```

The first raster-unique candidate gets the next glyph ID. Later raster-identical candidates become semantic aliases.

Any rasterizer/coordinate change that alters `832 → 746 → 86` is format-affecting and must be deliberate.

---

## 6. Straight semantic registry — COMPLETE

Every one of the 832 straight definitions is preserved as a semantic alias even when several definitions share one raster glyph.

Example alias:

```text
straight:L13>R4
```

Each alias stores candidate ID, family, start/end ports, and endpoint records.

A multi-alias raster glyph uses `alternative-alias-pairs` semantics: ports from separate aliases are alternatives, **not simultaneous junction branches**.

Generated indexes:

```text
artifacts/manifest/indexes/
├── by-codepoint.json
├── by-bitmap.json
├── by-port.json
└── by-connection-pair.json
```

Verified counts:

```text
visual glyphs               746
aliases                     832
boundary ports               48
codepoint lookups           746
bitmap lookups              746
port index entries         1664
connection-pair lookups    1664
```

See [`docs/connectivity.md`](docs/connectivity.md) and [`docs/milestone-2a-semantic-registry.md`](docs/milestone-2a-semantic-registry.md).

---

## 7. Straight-line class catalog — COMPLETE

Generated artifact:

```text
artifacts/classes/straight-lines.md
```

Every one of the 746 visual glyphs has a human-readable entry containing codepoint, glyph ID, family membership, bitmap key, aliases, connectivity semantics, canonical artifact links, and exact inline 8×16 ASCII.

Current catalog fixture:

```text
catalog bytes      515,888
visual entries         746
alias records          832
```

The verifier regenerates the entire catalog in memory and requires byte-for-byte equality.

See [`docs/milestone-2b-straight-catalog.md`](docs/milestone-2b-straight-catalog.md).

---

## 8. Straight publication snapshot — COMPLETE

Publication:

```text
straight-v0
```

Source commit:

```text
791a0a2175b888ee24061ed92a0d31eaf3342fdc
```

Snapshot commit:

```text
5806d99d73ab635bdbd0b1ff661ed810aeaa995d
```

The repository now contains the complete provisional straight-line artifact tree:

```text
746 ASCII glyph files
746 native 8×16 PNG glyph files
semantic glyph manifest
4 lookup indexes
straight-lines.md
full atlas
3 page atlases
statistics
publication provenance
```

Machine provenance:

```text
artifacts/publications/straight-v0.json
```

The publication is generated and verified by:

```text
.github/workflows/publish-straight-snapshot.yml
```

See [`docs/milestone-2c-straight-publication.md`](docs/milestone-2c-straight-publication.md).

`straight-v0` is a provisional research publication, not the final GraphSCII v1 codepoint freeze.

---

## 9. Current generation pipeline

From `geometric-glyph-lab/`:

```powershell
npm run generate
npm run verify
```

Current pipeline:

```text
base bitmap artifacts
        ↓
straight semantic registry
        ↓
straight-lines.md catalog
```

Specific commands:

```powershell
npm run generate:base
npm run generate:semantic
npm run generate:catalog

npm run verify:prebuilt
npm run verify:artifacts
npm run verify:semantic
npm run verify:catalog
```

As new classes are added, they should join the same deterministic generation/verification model rather than becoming hand-authored exceptions.

---

## 10. Shape-class strategy

### Basic solids — NEXT

GraphSCII needs area-filling primitives early, not only line art.

The first solid family should include deterministic simple regions such as:

```text
empty
full
horizontal progressive fills
vertical progressive fills
halves
quarters
simple corner blocks
simple rectangular partitions
```

We should generate a systematic candidate superset and deduplicate before deciding the exact inventory.

Empty may remain a reserved/structural value rather than consuming a PUA glyph if that proves cleaner; this decision belongs in the basic-solids slice.

### Filled straight contours

Reuse the existing straight geometry as a boundary and classify one side as filled:

```text
boundary only      existing straight glyph
fill side A
fill side B
```

This should produce diagonal solid edges, wedges, slopes, silhouette boundaries, and terrain-like pieces with very little new geometric machinery.

The filled forms must be generated from geometry, not by merely flood-filling arbitrary raster aliases, so side semantics remain stable and queryable.

### Curves

Define start/end ports, start/end tangents, and curvature strength. Initial research strengths:

```text
gentle
normal
tight
```

Generate a broad candidate superset and let raster deduplication reveal the true visual cost.

### Curved filled contours

Apply the same side-fill semantics to curve boundaries after the curve grammar is stable.

### Junctions

Corners, T-junctions, crosses, forks, cardinal/diagonal combinations, sharp joins, rounded joins, and possibly chamfered joins. Prefer direction masks where practical.

### Circles and ellipses

Generate radius/ellipse fragments and retain only raster forms that materially improve geometric coverage beyond the generic curve vocabulary.

### Textures, blocks, terminals

Ordered dithers, hatches, seamless texture phases, stipple, caps, nodes, diamonds, arrowheads, and directional terminals.

### Compound/special + reserve

Use actual drawing failures to justify additions rather than trying to predict every useful primitive in advance.

---

## 11. Repository/artifact structure

```text
graphscii/
├── PLAN.md
├── README.md
├── .github/workflows/
│   └── publish-straight-snapshot.yml
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
│   │   └── straight-lines.md
│   ├── atlases/
│   ├── publications/
│   │   └── straight-v0.json
│   └── font/
└── docs/
    ├── format.md
    ├── connectivity.md
    ├── PLAN-v0.md
    ├── milestone-1-artifacts.md
    ├── milestone-2a-semantic-registry.md
    ├── milestone-2b-straight-catalog.md
    └── milestone-2c-straight-publication.md
```

Generated artifacts may be committed when useful, but remain reproducible outputs rather than source of truth.

---

## 12. Codepoint stability policy

Before v1 freeze, provisional IDs/codepoints may move.

After freeze:

1. never silently change an assigned codepoint's visual meaning,
2. never recycle a retired codepoint for unrelated geometry in the same major version,
3. preserve aliases/renames in metadata,
4. increment the format major version for breaking remaps.

---

## 13. Milestone sequence

### Milestone 0 — fundamentals — **COMPLETE**

- [x] Freeze 8×16 cell/orientation.
- [x] Freeze bitmap serialization.
- [x] Freeze ASCII and artifact naming.
- [x] Preserve `832 → 746 → 86` regression.
- [x] Add format verification.

### Milestone 1 — persistent artifact pipeline — **COMPLETE**

- [x] generator CLI.
- [x] JSON manifest/stats.
- [x] per-glyph ASCII and PNG output.
- [x] full/page atlases.
- [x] artifact reproducibility checks.

### Milestone 2A — straight semantic registry — **COMPLETE**

- [x] provisional straight allocation spec.
- [x] alias keys and endpoint semantics.
- [x] preserve all 832 aliases.
- [x] codepoint/bitmap/port/pair indexes.
- [x] semantic verification.

### Milestone 2B — straight-line class catalog — **COMPLETE**

- [x] generate `straight-lines.md`.
- [x] include all 746 exact ASCII forms.
- [x] include semantic metadata and aliases.
- [x] byte-for-byte catalog verification.

### Milestone 2C — straight vocabulary publication — **COMPLETE**

- [x] generate clean complete straight artifact tree.
- [x] commit semantic manifest/indexes.
- [x] commit all 746 ASCII files.
- [x] commit all 746 PNG files.
- [x] commit class catalog and atlases.
- [x] record publication provenance.
- [x] verify before publication commit.

### Milestone 3A — basic solids — **NEXT**

- [ ] define the basic-solid grammar.
- [ ] generate full/partial rectangular fill candidates.
- [ ] include horizontal/vertical progressive fills.
- [ ] include halves/quarters/corner blocks.
- [ ] decide whether the empty tile consumes a glyph slot.
- [ ] exact raster deduplication against the existing vocabulary.
- [ ] report candidate/unique/collision counts.
- [ ] add browser filters/previews for solids.
- [ ] generate solid ASCII/PNG/catalog artifacts.

### Milestone 3B — filled straight contours

- [ ] define deterministic side-of-line semantics.
- [ ] generate both fill sides for useful straight boundaries.
- [ ] deduplicate against straight/basic-solid vocabulary.
- [ ] retain boundary + fill-side semantic metadata.
- [ ] publish filled-straight catalog/artifacts.

### Milestone 4 — curve research engine

- [ ] define curve grammar and tangent semantics.
- [ ] implement deterministic curve rasterization.
- [ ] build interactive curve explorer.
- [ ] generate broad candidate families.
- [ ] deduplicate and measure new visual coverage.
- [ ] publish curve artifacts/catalog.

### Milestone 5 — curved filled contours

- [ ] fill-side semantics for curves.
- [ ] inside/outside and wedge-like fragments.
- [ ] deduplicate and publish.

### Milestone 6 — junctions

- [ ] direction-mask model.
- [ ] sharp/rounded junction generation.
- [ ] compatibility metadata.
- [ ] catalog/artifacts.

### Milestone 7 — circles/ellipses

- [ ] radius/ellipse grammar.
- [ ] arc generation.
- [ ] deduplication/coverage analysis.
- [ ] catalog/artifacts.

### Milestone 8 — textures/blocks/terminals

- [ ] dithers/hatches/stipple.
- [ ] seamless texture phases.
- [ ] caps/nodes/arrows.
- [ ] catalogs/artifacts.

### Milestone 9 — vocabulary optimization

- [ ] generate full candidate superset.
- [ ] analyze slot pressure and coverage holes.
- [ ] score/select competing candidates where necessary.
- [ ] preserve reserve space.
- [ ] produce provisional 4K allocation map.

### Milestone 10 — font compiler

- [ ] bitmap-to-outline compiler.
- [ ] fixed metrics + PUA cmap.
- [ ] TTF output.
- [ ] WOFF2 output.
- [ ] specimen tests.

### Milestone 11 — drawing API

- [ ] stable JSON schema.
- [ ] lookup library.
- [ ] neighbor compatibility API.
- [ ] geometry-to-glyph solver.
- [ ] multi-cell renderer.

### Milestone 12 — interactive editor

- [ ] multi-cell canvas.
- [ ] line/curve/shape tools.
- [ ] automatic glyph solving.
- [ ] manual replacement.
- [ ] Unicode copy/paste.
- [ ] PNG/text/JSON export.

### Milestone 13 — GraphSCII v1

- [ ] final coverage review.
- [ ] freeze codepoint meanings.
- [ ] freeze manifest schema v1.
- [ ] release artifact snapshot.
- [ ] complete programmer/user docs.
- [ ] tag/release v1.

---

## 14. Definition of done for v1

GraphSCII v1 is ready when every assigned glyph reproduces from source; codepoints are stable; PNG/ASCII artifacts exist; each major class has a generated catalog; JSON fully describes identity/connectivity/fill semantics; atlases cover the vocabulary; a fixed-cell font exists; programs can render through font or canonical bitmap data; neighbor compatibility is mechanically queryable; generation is deterministic; and the codepoint map is ready to be treated as API.

---

## 15. Guiding rule

Prefer designs that make GraphSCII more **systematic, reproducible, queryable, composable, inspectable, programmable, and geometrically expressive per codepoint**.

Do not guess how many slots a family deserves when the generator can create candidates, rasterize them, deduplicate them, measure surviving visual space, and show us what reality says.
