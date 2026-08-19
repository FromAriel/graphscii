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

Each assigned glyph is a deterministic 8×16 binary bitmap representing a useful local piece of geometry: straight segments, curves, junctions, filled contours, circle/ellipse fragments, blocks, textures, terminals, nodes, arrows, and other primitives discovered through real use.

The project is not a miscellaneous symbol font. The goal is a compact **2D graphics instruction set** whose cells connect predictably and can be selected mechanically by software.

A program should eventually be able to ask:

```text
Which glyph connects L13 to R4?
Which glyph smoothly continues this exit?
Which glyph best approximates this local curve?
Which junction matches this direction mask?
Which neighboring glyphs are geometrically compatible?
```

The same vocabulary should support font rendering, direct bitmap rendering, ASCII inspection, generated class catalogs, JSON lookup, atlases, an editor, and eventually an automatic geometry-to-glyph solver.

---

## 2. Source-of-truth hierarchy

Authority order:

1. **Generator/specification source** — geometry and family rules.
2. **Canonical bitmap** — visual identity.
3. **Glyph registry/allocation** — assigned identity and metadata.
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

Normative low-level contract: [`docs/format.md`](docs/format.md).

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

### Current straight allocation — PROVISIONAL

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

The first raster-unique candidate gets the next glyph ID. Later raster-identical candidates become aliases.

---

## 5. Current straight-line baseline

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

Any rasterizer/coordinate change that alters this result is format-affecting and must be deliberate.

---

## 6. Straight semantic registry — COMPLETE

Every one of the 832 straight definitions is retained as a semantic alias even when several definitions share one raster glyph.

Alias example:

```text
straight:L13>R4
```

Each alias stores:

```text
candidate ID
alias key
family
start port
end port
exact endpoint records
```

A multi-alias visual glyph uses `alternative-alias-pairs` semantics: ports from separate aliases are alternatives, **not simultaneous junction branches**.

Generated indexes:

```text
artifacts/manifest/indexes/
├── by-codepoint.json
├── by-bitmap.json
├── by-port.json
└── by-connection-pair.json
```

Verified semantic counts:

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

Milestone 2B adds the first generated human-readable class publication:

```text
artifacts/classes/straight-lines.md
```

The file is generated from the semantic manifest plus canonical ASCII glyph files. It is never hand-edited.

Every one of the 746 glyph entries contains:

- full Unicode codepoint,
- decimal/hex glyph ID,
- provisional allocation status,
- family membership,
- bitmap key,
- alias count,
- connectivity semantics,
- every mathematical alias and candidate ID,
- links to canonical PNG and ASCII files,
- exact inline 8×16 ASCII.

The catalog verifier regenerates the whole Markdown document in memory and requires byte-for-byte equality. It additionally checks all 746 headings and all 832 alias keys.

A local reconstructed generation of the current vocabulary produced:

```text
catalog bytes      515,888
visual entries         746
alias records          832
```

See [`docs/milestone-2b-straight-catalog.md`](docs/milestone-2b-straight-catalog.md).

---

## 8. Current generation pipeline

From `geometric-glyph-lab/`:

```powershell
npm run generate
npm run verify
```

Pipeline:

```text
Milestone 1 base artifacts
          ↓
Milestone 2A semantic registry
          ↓
Milestone 2B straight-lines.md
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

The full verifier now checks canonical format, raster regression, exact ASCII, deterministic PNG bytes, atlas dimensions, allocation bounds, all aliases/lookups, and exact class-catalog reproduction.

---

## 9. Repository/artifact structure

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
│   │   └── straight-lines.md
│   ├── atlases/
│   └── font/
└── docs/
    ├── format.md
    ├── connectivity.md
    ├── PLAN-v0.md
    ├── milestone-1-artifacts.md
    ├── milestone-2a-semantic-registry.md
    └── milestone-2b-straight-catalog.md
```

Generated artifacts may be committed when useful, but remain reproducible outputs rather than source of truth.

---

## 10. Planned shape classes

### Curves

Define start/end ports, start/end tangents, and curvature strength. Initial research strengths: `gentle`, `normal`, `tight`. Generate a broad superset and let raster deduplication determine the real visual cost.

### Junctions

Corners, T-junctions, crosses, forks, cardinal/diagonal mixtures, sharp joins, rounded joins, possibly chamfered joins. Prefer direction masks where practical.

### Filled contours

Straight/curved boundaries plus fill-side rules: above/below, left/right, inside/outside, wedges, silhouette fragments, filled corners.

### Circles and ellipses

Sample useful radius/ellipse fragments and retain only raster forms that materially improve coverage.

### Blocks, textures, terminals

Partial fills, dithers, hatches, phase-compatible textures, caps, nodes, diamonds, arrowheads, directional terminals.

### Compound/special + reserve

Use real drawing failures to justify additions instead of trying to predict all useful primitives in advance.

---

## 11. Codepoint stability policy

Before v1 freeze, provisional IDs/codepoints may move.

After freeze:

1. never silently change an assigned codepoint's visual meaning,
2. never recycle a retired codepoint for unrelated geometry in the same major version,
3. preserve aliases/renames in metadata,
4. increment the format major version for breaking remaps.

---

## 12. Milestone sequence

### Milestone 0 — fundamentals — **COMPLETE**

- [x] Freeze 8×16 cell/orientation.
- [x] Freeze bitmap serialization.
- [x] Freeze ASCII and artifact naming.
- [x] Preserve `832 → 746 → 86` regression.
- [x] Add format verification.

### Milestone 1 — persistent artifact pipeline — **COMPLETE**

- [x] Generator CLI.
- [x] JSON manifest/stats.
- [x] 746 ASCII files.
- [x] 746 native PNG files.
- [x] full/page atlases.
- [x] artifact consistency/reproducibility checks.

### Milestone 2A — straight semantic registry — **COMPLETE**

- [x] provisional allocation spec.
- [x] alias keys and endpoint semantics.
- [x] 832 aliases preserved.
- [x] codepoint/bitmap/port/pair indexes.
- [x] semantic verification.

### Milestone 2B — straight-line class catalog — **COMPLETE**

- [x] generated `artifacts/classes/straight-lines.md`.
- [x] 746 exact inline ASCII forms.
- [x] codepoint/glyph/bitmap/family/alias/connectivity metadata.
- [x] links to canonical ASCII/PNG artifacts.
- [x] byte-for-byte regeneration verification.
- [x] heading and alias coverage checks.

### Milestone 2C — straight vocabulary publication snapshot — **NEXT**

- [ ] generate a clean complete straight-line artifact tree.
- [ ] commit semantic manifest/indexes.
- [ ] commit all 746 ASCII files.
- [ ] commit all 746 PNG files.
- [ ] commit `straight-lines.md`.
- [ ] commit atlases/stats.
- [ ] record snapshot provenance and regeneration command.
- [ ] verify repository snapshot against fresh generation.

### Milestone 3 — curve research engine

- [ ] define curve grammar and tangent semantics.
- [ ] implement deterministic curve rasterization.
- [ ] build interactive curve explorer.
- [ ] generate broad candidate families.
- [ ] deduplicate and measure new visual coverage.
- [ ] publish curve artifacts/catalog.

### Milestone 4 — junctions

- [ ] direction-mask model.
- [ ] sharp/rounded junction generation.
- [ ] compatibility metadata.
- [ ] catalog/artifacts.

### Milestone 5 — filled contours

- [ ] fill-side classifier.
- [ ] straight/curved filled boundaries.
- [ ] wedges/corners.
- [ ] catalog/artifacts.

### Milestone 6 — circles/ellipses

- [ ] radius/ellipse grammar.
- [ ] arc generation.
- [ ] deduplication/coverage analysis.
- [ ] catalog/artifacts.

### Milestone 7 — textures/blocks/terminals

- [ ] partial fills/dithers.
- [ ] seamless texture phases.
- [ ] caps/nodes/arrows.
- [ ] catalogs/artifacts.

### Milestone 8 — vocabulary optimization

- [ ] generate full candidate superset.
- [ ] analyze slot pressure and coverage holes.
- [ ] score/select competing candidates where necessary.
- [ ] preserve reserve space.
- [ ] produce provisional 4K allocation map.

### Milestone 9 — font compiler

- [ ] bitmap-to-outline compiler.
- [ ] fixed metrics + PUA cmap.
- [ ] TTF output.
- [ ] WOFF2 output.
- [ ] specimen tests.

### Milestone 10 — drawing API

- [ ] stable JSON schema.
- [ ] lookup library.
- [ ] neighbor compatibility API.
- [ ] geometry-to-glyph solver.
- [ ] multi-cell renderer.

### Milestone 11 — interactive editor

- [ ] multi-cell canvas.
- [ ] line/curve/shape tools.
- [ ] automatic glyph solving.
- [ ] manual replacement.
- [ ] Unicode copy/paste.
- [ ] PNG/text/JSON export.

### Milestone 12 — GraphSCII v1

- [ ] final coverage review.
- [ ] freeze codepoint meanings.
- [ ] freeze manifest schema v1.
- [ ] release artifact snapshot.
- [ ] complete programmer/user docs.
- [ ] tag/release v1.

---

## 13. Definition of done for v1

GraphSCII v1 is ready when every assigned glyph reproduces from source; codepoints are stable; PNG/ASCII artifacts exist; each major class has a generated catalog; JSON fully describes identity/connectivity; atlases cover the vocabulary; a fixed-cell font exists; programs can render through font or canonical bitmap data; neighbor compatibility is mechanically queryable; generation is deterministic; and the codepoint map is ready to be treated as API.

---

## 14. Guiding rule

Prefer designs that make GraphSCII more **systematic, reproducible, queryable, composable, inspectable, programmable, and geometrically expressive per codepoint**.

Do not guess how many slots a family deserves when the generator can create candidates, rasterize them, deduplicate them, measure surviving visual space, and show us what reality says.
