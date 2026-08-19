# GraphSCII â€” Persistent Project Plan

> **Status:** Living design document and project memory.
>
> **Repository:** `FromAriel/graphscii`
>
> **Implementation seed:** `geometric-glyph-lab/`
>
> **Canonical cell:** **8 columns Ã— 16 rows** (GraphSCII v1 format lock)

---

## 1. Vision

GraphSCII is a fixed-cell graphics language encoded as a font and as machine-readable glyph data.

Each assigned character represents a deterministic 8Ã—16 binary bitmap describing a useful fragment of geometry: straight segments, angled segments, curves, junctions, filled contours, circle/ellipse pieces, blocks, textures, terminals, nodes, arrows, and other primitives proven useful by actual drawing.

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

1. **Generator/specification source** â€” geometry and family rules.
2. **Canonical bitmap** â€” visual identity.
3. **Glyph registry/allocation** â€” assigned identity and metadata.
4. **Generated artifacts** â€” PNG, ASCII, JSON, Markdown, atlases, fonts.

Pipeline:

```text
geometric definition / family rule
            â†“
    deterministic rasterizer
            â†“
      canonical bitmap
            â†“
   exact visual deduplication
            â†“
      glyph registry
       â†™    â†“    â†˜
    PNG   JSON   ASCII
      \     |     /
       docs / atlases
            â†“
           font
```

The font is a compiled artifact, never the authoritative definition. Every committed generated artifact must be reproducible from source.

---

## 3. Canonical GraphSCII v1 cell â€” LOCKED

GraphSCII v1 uses:

```text
width  = 8 pixels
height = 16 pixels
```

That means **8 columns Ã— 16 rows**.

The 16Ã—8 ASCII example that appeared during early planning was an orientation/presentation mismatch. The working implementation and measured baseline already used 8Ã—16, so GraphSCII preserves that orientation rather than invalidating the existing experiment.

Coordinates:

```text
x = 0..7    left â†’ right
y = 0..15   top â†’ bottom
```

Boundary ports:

```text
Top:     T0..T7
Bottom:  B0..B7
Left:    L0..L15
Right:   R0..R15
```

The normative low-level contract is documented in [`docs/format.md`](docs/format.md).

### Canonical bitmap serialization â€” LOCKED

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

### Canonical ASCII â€” LOCKED

```text
# = filled pixel
- = empty pixel
```

Each per-glyph ASCII file is exactly 16 rows Ã— 8 characters plus ordinary line endings, with no labels or prose inside the file.

### Artifact filename stem â€” LOCKED

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
glyph 0x000 â†’ U+E000
...
glyph 0xFFF â†’ U+EFFF
```

`4096` is a budget, not a requirement to fill every slot.

We should generate candidate supersets, rasterize them, deduplicate exact visual identities, measure coverage, and only then decide how much address space each class deserves.

Provisional idea:

```text
0x000â€“0xEFF   assigned vocabulary    3840 slots
0xF00â€“0xFFF   reserved/experimental  256 slots
```

This allocation is not frozen.

---

## 5. Existing straight-line baseline â€” REGRESSION FIXTURE

The current lab generates six edge-to-edge straight families:

- Left â†’ Right: `16 Ã— 16 = 256`
- Top â†’ Bottom: `8 Ã— 8 = 64`
- Left â†’ Top: `16 Ã— 8 = 128`
- Left â†’ Bottom: `16 Ã— 8 = 128`
- Right â†’ Top: `16 Ã— 8 = 128`
- Right â†’ Bottom: `16 Ã— 8 = 128`

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

Several mathematical definitions may rasterize to the exact same 8Ã—16 bitmap. Those candidates must share one visual glyph while preserving every geometric interpretation as an alias.

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
- `/` and `\`  hatch,
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
â”‚â”€â”€ PLAN.md
â”‚â”€â”€ README.md
â”‚
â”‚â”€â”€ geometric-glyph-lab/
â‚   â”œâ”€â”€ src/
â‚   â”‚   â””â”€â”€ core/
â”‚   â”œâ”€â”€ scripts/
â”‚   â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ dist/
â”‚   â””â”€â”€ package.json
â”‚
â”‚â”€â”€ spec/
â‚   â”œâ”€â”€ classes/
â”‚   â”œâ”€â”€ allocation.json
b‚   â””â”€â”€ schema/
â”‚
â”‚â”€â”€ artifacts/
â”‚   â”œâ”€â”€ manifest/
â‚   â”‚   â”œâ”€â”€ glyphs.json
â”‚   â”‚   â”œâ”€â”€ aliases.json
b‚   â”‚   â”œâ”€â”€ stats.json
b‚   â”‚   â””â”€â”€ compatibility.json
â”‚   â”œâ”€â”€ glyphs/
â”‚   â”‚   â”£â”€â”€ png/
â”‚   â”‚   â””â”€â”€…Í¥¤¼+Š€€ƒŠRsŠRŠR ±…ÍÍ•Ì¼+ŠR€€ƒŠRsŠRŠR …Ñ±…Í•Ì¼+ŠR€€ƒŠRãŠRŠR ™½¹Ð¼+ŠR+ŠRSŠRŠR ‘½Ì¼+Š €€€ƒŠRŠRŠRf÷&ÖBæÖ@¢)J>)H)H˜]Ú[™ËX\K›Yˆ8¥'8¥ 8¥ ÛÛ›™XÝ]š]K›Yˆ8¥.8¥ 8¥  examples/
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

- exact canonical 8Ã—16 dimensions,
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
- connectivity/tangent information,
- path to the canonical PNG.

The catalogs are generated documentation, not hand-edited source.

---

## 11. JSON manifest goals

The manifest must be sufficient for a program to use GraphSCII without reverse-engineering the font.

Target top-level shape:

```json
{
  "format": "graphscii",
  "formatVersion": 1,
  "generatorVersion": "...",
  "cell": { "width": 8, "height": 16 },
  "bitmapSerialization": "v1:...",
  "codepointBase": "U+E000",
  "glyphCount": 746,
  "glyphs": []
}
```

Thirst for each glyph:

```json
{
  "glyphId": 570,
  "glyphIdHex": "23A",
  "codepoint": 57914,
  "codepointHex": "U+E23A",
  "character": "...",
  ""family": "straight-left-right",
  "tags": ["straight", "diagonal", "left-right"],
  "bitmap": {
    "rowsHex": ["00", "01", "02"],
    "key": "..."
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

The schema remains provisional until a stable external consumer is expected to rely on it.

---

## 12. Derived lookup indexes

Consumers should not need to scan the entire vocabulary for every query.

Possible derived indexes:

- by codepoint,
- by glyph ID,
- by bitmap key,
- by family,
- by tags,
- by entry port,
- by exit port,
- by port + tangent,
- by geometric alias,
- by compatibility.

These may be contained in the main manifest or derived into separate files as size/usability dictates.

---

## 13. Connectivity model

A port connection eventually needs:

```text
edge
port index
connected/not connected
tangent
join semantics
```

Join semantics may include:

- smooth continuation,
- intentional corner,
- junction,
- terminal,
- fill boundary.

Example future query:

```text
current glyph exits R7 with tangent east
            â†“
return all glyphs entering L7 with compatible tangent
```

---

## 14. How a program should draw with GraphSCII

Two equivalent rendering paths should be supported.

### Path A â€” font/text rendering

1. Load `GraphSCII.ttf` or `GraphSCIIÝ™˜É€¸(È¸1½…±åÁ µ•Ñ…‘…Ñ„¸(Ì¸M•±•Ð½ÈÍ½±Ù”Ñ¡”¹••‘•±åÁ %¸4Ð¸½¹Ù•ÉÐ±åÁ %Ñ¼…ÍÍ¥¹•U¹¥½‘”¸(Ô¸]É¥Ñ”Ñ¡”¡…É…Ñ•È¥¹Ñ¼„™¥á•µ•±°Ñ•áÐÉ¥¸(Ø¸I•¹‘•ÈÝ¥Ñ É…Á¡M%$¸((ŒŒŒA…Ñ ƒŠP‘¥É•Ð‰¥Ñµ…À½Ñ¥±”É•¹‘•É¥¹œ((Ä¸1½…±åÁ µ•Ñ…‘…Ñ„½È…¸…Ñ±…Ì¥¹‘•à¸(È¸M•±•Ð±åÁ %ÌÕÍ¥¹œÑ¡”Í…µ”•½µ•ÑÉäµ•Ñ…‘…Ñ„¸(Ì¸½Áä…¹½¹¥…°‰¥Ñµ…À½¥µ…”Ñ¥±•Ì¥¹Ñ¼„™É…µ•‰Õ™™•È½…¹Ù…Ì¸()Q¡¥ÌÁ…Ñ ‰åÁ…ÍÍ•Ì™½¹ÐÉ…ÍÑ•É¥é…Ñ¥½¸…¹ÁÉ½‘Õ•Ì•á…Ð…¹½¹¥…°Á¥á•±Ì¸((ŒŒŒ1½¹œµÑ•É´Í½±Ù•È()Ù•¹ÑÕ…±±ä•áÁ½Í”½Á•É…Ñ¥½¹Ì½¹•ÁÑÕ…±±ä±¥­”è()Ñ•áÐ)™¥¹‘MÑÉ…¥¡Ð¡ÍÑ…ÉÑA½ÉÐ°•¹‘A½ÉÐ¤)™¥¹‘ÕÉÙ”¡ÍÑ…ÉÑA½ÉÐ°•¹‘A½ÉÐ°Ñ…¹•¹ÑÌ°ÕÉÙ…ÑÕÉ”¤)™¥¹‘)Õ¹Ñ¥½¸¡‘¥É•Ñ¥½¹5…Í¬¤)™¥¹‘½µÁ…Ñ¥‰±•9•¥¡‰½È¡±åÁ °•‘”¤)™¥¹‘±½Í•ÍÑ•½µ•ÑÉä¡Í•µ•¹Ñ=ÉÕÉÙ”¤)€()¡¥¡•Èµ±•Ù•°Í½±Ù•È…¸Í…µÁ±”„Ù•Ñ½ÈÁ…Ñ •±°µ‰äµ•±°…¹Í•±•ÐÑ¡”‰•ÍÐÉ…Á¡M%$Ñ¥±”™½È•… •±°¸((´´´((ŒŒ€ÄÔ¸½¹Ð½µÁ¥±…Ñ¥½¸()…¹½¹¥…°‰¥Ñµ…ÁÌÍ¡½Õ±½µÁ¥±”‘•Ñ•Éµ¥¹¥ÍÑ¥…±±ä¥¹Ñ¼™½¹Ð½ÕÑ±¥¹•Ì¸()M¥µÁ±”¥¹¥Ñ¥…°ÍÑÉ…Ñ•äè((´•… ™¥±±•Á¥á•°‰•½µ•Ì„Ù•Ñ½ÈÉ•Ñ…¹±”°(´…‘©…•¹ÐÉ•Ñ…¹±•Ìµ…ä‰”Õ¹¥½¹•™½ÈÍµ…±±•È½ÕÑ±¥¹•Ì°(´•Ù•Éä±åÁ ÕÍ•Ì¥‘•¹Ñ¥…°…‘Ù…¹”Ý¥‘Ñ °(´¹¼­•É¹¥¹œ°(´¹¼ÁÉ½Á½ÉÑ¥½¹…°µ•ÑÉ¥Ì°(´¹¼‘•™…Õ±Ð±¥…ÑÕÉ•Ì°(´¹¼Í¡…Á¥¹œµ‘•Á•¹‘•¹Ð•½µ•ÑÉä¸()U¹¥Ð¥‘•„™½È€ã\ÄØè()Ñ•áÐ(Ä…¹½¹¥…°Á¥á•°€ô€ÄÈà™½¹ÐÕ¹¥ÑÌ)•±°Ý¥‘Ñ €€€€€€€€€ô€ÄÀÈÐ•±°¡•…ÉÑ €€€€€€€€ô€ÈÀÐà)€()…¹½¹¥…°A9½‰¥Ñµ…ÀÍÑ…åÌ…ÕÑ¡½É¥Ñ…Ñ¥Ù”‰•…ÕÍ”Á±…Ñ™½É´™½¹ÐÉ…ÍÑ•É¥é•ÉÌ…É”¹½ÐÕ…É…¹Ñ••Ñ¼ÁÉ½‘Õ”¥‘•¹Ñ¥…°Á¥á•±Ì¸((´´´((ŒŒ€ÄØ¸Ñ±…Ì•¹•É…Ñ¥½¸()I•½µµ•¹‘•Á…”µ½‘•°è()Ñ•áÐ(ÈÔØ±åÁ¡ÌÁ•ÈÁ…”(ÄØ½±Õµ¹Ìƒ\€ÄØÉ½ÝÌ(ÄØÁ…•Ì™½È„€ÐÀäØµÍ±½ÐÙ½…‰Õ±…Éä)€()9…µ¥¹œè()Ñ•áÐ)…ÉÑ¥™…ÑÌ½…Ñ±…Í•Ì½…±°¹Á¹œ)…ÉÑ¥™…ÑÌ½…Ñ±…Í•Ì½Á…”´À¹Á¹œ(¸°¸¸)…ÉÑ¥™…ÑÌ½…Ñ±…Í•Ì½Á…”µ¹Á¹œ)€()…µ¥±äµÍÁ•¥™¥Œ…Ñ±…Í•Ìµ…ä…±Í¼‰”•¹•É…Ñ•¸((´´´((ŒŒ€ÄÜ¸•Ñ•Éµ¥¹¥ÍÑ¥Œ…ÉÑ¥™…Ð•¹•É…Ñ¥½¸()=¹”½µµ…¹Í¡½Õ±•Ù•¹ÑÕ…±±äÉ••¹•É…Ñ”Ñ¡”‘¥ÍÑÉ¥‰ÕÑ…‰±”ÍÑ…Ñ”è()Ñ•áÐ)‰Õ¸ÉÕ¸•¹•É…Ñ”)€()Q…É•ÐÁ¥Á•±¥¹”è((Ä¸±½…ÍÁ•¥™¥…Ñ¥½¸°(È¸•¹•É…Ñ”µ…Ñ¡•µ…Ñ¥…°…¹‘¥‘…Ñ•Ì°(Ì¸É…ÍÑ•É¥é”‘•Ñ•Éµ¥¹¥ÍÑ¥…±±ä°(Ð¸‘•‘ÕÁ±¥…Ñ”Ù¥ÍÕ…°¥‘•¹Ñ¥Ñ¥•Ì°(Ô¸ÁÉ•Í•ÉÙ”…±¥…Í•Ì°(Ø¸…±±½…Ñ”½™É••é”½‘•Á½¥¹ÑÌ°(Ü¸Ù…±¥‘…Ñ”µ•Ñ…‘…Ñ„½½¹¹•Ñ¥Ù¥Ñä°(à¸ÝÉ¥Ñ”µ…¹¥™•ÍÑÌ½¥¹‘•á•Ì°(ä¸ÝÉ¥Ñ”Á•Èµ±åÁ M%$°(ÄÀ¸ÝÉ¥Ñ”Á•Èµ±åÁ A9°(ÄÄ¸ÝÉ¥Ñ”±…ÍÌ5…É­‘½Ý¸…Ñ…±½Ì°(ÄÈ¸ÝÉ¥Ñ”…Ñ±…Í•Ì°(ÄÌ¸½µÁ¥±”™½¹ÑÌ°(ÄÐ¸ÝÉ¥Ñ”ÍÑ…Ñ¥ÍÑ¥Ì½ÁÉ½Ù•¹…¹”°(ÄÔ¸Ù•É¥™ä½µµ¥ÑÑ•…ÉÑ¥™…ÑÌ¸((´´´((ŒŒ€Äà¸ÉÑ¥™…Ð½µµ¥ÐÁ½±¥ä()É…Á¡M%$¥¹Ñ•¹Ñ¥½¹…±±ä½µµ¥ÑÌÕÍ•™Õ°•¹•É…Ñ•ÁÉ½‘ÕÑÌè((´…¹½¹¥…°Ñ¥¹äA9Ì°(´•á…ÐM%$±åÁ ™¥±•Ì°(´)M=8µ…¹¥™•ÍÑÌ½¥¹‘•á•Ì°(´±…ÍÌ5…É­‘½Ý¸…Ñ…±½Ì°(´É•™•É•¹”…Ñ±…Í•Ì°(´É•±•…Í”™½¹ÑÌ¸()¼¹½Ð½µµ¥Ðè((´‘•Á•¹‘•¹ä‘¥É•Ñ½É¥•Ì°(´…¡•Ì°(´Ñ•µÁ½É…Éä…¹Ù…Í•Ì°(´‘•‰Õœ¥¹Ñ•Éµ•‘¥…Ñ•Ì°(´±½…°ÍÑ…Ñ”¸()Ù•É¥™¥…Ñ¥½¸½µµ…¹Í¡½Õ±•Ù•¹ÑÕ…±±ä™…¥°¥˜É••¹•É…Ñ¥½¸Õ¹•áÁ•Ñ•‘±ä¡…¹•Ì½µµ¥ÑÑ•…¹½¹¥…°…ÉÑ¥™…ÑÌ¸((´´´((ŒŒ€Ää¸½‘•Á½¥¹ÐÍÑ…‰¥±¥Ñä()ÕÉ¥¹œÉ•Í•…É °±åÁ %Ì…¹ÁÉ½Ù¥Í¥½¹…°½‘•Á½¥¹ÑÌµ…äµ½Ù”¸()™Ñ•ÈÑ¡”™¥ÉÍÐÍÑ…‰±”Ù½…‰Õ±…ÉäÉ•±•…Í”°½‘•Á½¥¹ÑÌ‰•½µ”A$¸()™Ñ•È™É••é”è((Ä¸¹•Ù•ÈÍ¥±•¹Ñ±ä¥Ù”…¸•á¥ÍÑ¥¹œ½‘•Á½¥¹Ð„‘¥™™•É•¹ÐÙ¥ÍÕ…°µ•…¹¥¹œ°(È¸¹•Ù•ÈÉ•å±”„É•Ñ¥É•½‘•Á½¥¹Ð™½ÈÕ¹É•±…Ñ••½µ•ÑÉä¥¸Ñ¡”Í…µ”µ…©½ÈÙ•ÉÍ¥½¸°(Ì¸É•½É…±¥…Í•Ì½É•¹…µ•Ì°(Ð¸¥¹É•µ•¹ÐÑ¡”É…Á¡M%$™½Éµ…Ðµ…©½ÈÙ•ÉÍ¥½¸™½ÈÕ¹…Ù½¥‘…‰±”‰É•…­¥¹œÉ•µ…ÁÌ¸((´´´((ŒŒ€ÈÀ¸…¹‘¥‘…Ñ”Í•±•Ñ¥½¸Ý¡•¸Í±½ÐÁÉ•ÍÍÕÉ”…ÁÁ•…ÉÌ()¼¹½Ð¡…¹µ‘•Í¥¸€ÐÀäØ¥Í½±…Ñ•±åÁ¡Ì¸()…µ¥±ä•¹•É…Ñ½ÉÌÍ¡½Õ±É•…Ñ”…¹‘¥‘…Ñ”ÍÕÁ•ÉÍ•ÑÌ¸5•…ÍÕÉ”è((´•á…Ð‘ÕÁ±¥…Ñ•Ì°(´Íåµµ•ÑÉä°(´½¹¹•Ñ¥Ù¥Ñä½Ù•É…”°(´Ñ…¹•¹Ð½Ù•É…”°(´Ù¥ÍÕ…°¹½Ù•±Ñä°(´™…µ¥±ä¥µÁ½ÉÑ…¹”°(´•áÁ•Ñ•‘É…Ý¥¹œÕÑ¥±¥Ñä¸()%˜…¹‘¥‘…Ñ•Ì•á••Ñ¡”…‘‘É•ÍÌ‰Õ‘•Ð°¥¹ÑÉ½‘Õ”…¸¥¹ÍÁ•Ñ…‰±”‘•Ñ•Éµ¥¹¥ÍÑ¥ŒÍ½É¥¹œÍÑ…”¸()A½ÍÍ¥‰±”Í½É”Ñ•ÉµÌè((´Õ¹¥ÅÕ”½¹¹•Ñ¥Ù¥ÑäÍ¥¹…ÑÕÉ”°(´Õ¹¥ÅÕ”Ñ…¹•¹Ð‰•¡…Ù¥½È°(´•½µ•ÑÉ¥Œ½Ù•É…”°(´Á•É•ÁÑÕ…°‰¥Ñµ…À‘¥ÍÑ…¹”°(´Íåµµ•ÑÉä½µÁ±•Ñ¥½¸°(´•áÁ•Ñ•ÕÑ¥±¥Ñä°(´™…µ¥±äÁÉ¥½É¥Ñä¸((´´´((ŒŒ€ÈÄ¸Måµµ•ÑÉä…¹ÑÉ…¹Í™½ÉµÌ()•¹•É…Ñ½ÉÌµ…ä‘•É¥Ù”è((´¡½É¥é½¹Ñ…°µ¥ÉÉ½È°(´Ù•ÉÑ¥…°µ¥ÉÉ½È°(´€ÄàÃ
ÀÉ½Ñ…Ñ¥½¸¸()	•…ÕÍ”Ñ¡”•±°¥Ì¹½¸µÍÅÕ…É”°€äÃ
ÀÉ½Ñ…Ñ¥½¸¡…¹•Ì‘¥µ•¹Í¥½¹Ì…¹¥Ì¹½Ð…ÕÑ½µ…Ñ¥…±±äÙ…±¥¸()QÉ…¹Í™½ÉµÌµÕÍÐÕÁ‘…Ñ”•½µ•ÑÉäµ•Ñ…‘…Ñ„…ÌÝ•±°…ÌÁ¥á•±Ì¸•‘ÕÁ±¥…Ñ¥½¸ÉÕ¹Ì…™Ñ•ÈÑÉ…¹Í™½ÉµÌ¸((´´´((ŒŒ€ÈÈ¸Q•ÍÑ¥¹œÉ•ÅÕ¥É•µ•¹ÑÌ((ŒŒŒI…ÍÑ•ÈÑ•ÍÑÌ((´‘•Ñ•Éµ¥¹¥ÍÑ¥Œ½ÕÑÁÕÐ°(´•á…Ð€ã\ÄØ‘¥µ•¹Í¥½¹Ì°(´­¹½Ý¸™¥áÑÕÉ•Ì°(´‰¥¹…Éäµ½¹±ä…¹½¹¥…°Á¥á•±Ì¸((ŒŒŒ•‘ÕÁ±¥…Ñ¥½¸Ñ•ÍÑÌ((´¥‘•¹Ñ¥…°‰¥Ñµ…ÁÌµ•É”°(´…±¥…Í•ÌÍÕÉÙ¥Ù”°(´¹½¸µ¥‘•¹Ñ¥…°‰¥Ñµ…ÁÌ¹•Ù•Èµ•É”°(´‰¥Ñµ…À­•äÍ•É¥…±¥é…Ñ¥½¸ÍÑ…åÌÍÑ…‰±”¸((ŒŒŒI•¥ÍÑÉäÑ•ÍÑÌ((´Õ¹¥ÅÕ”±åÁ %Ì°(´Õ¹¥ÅÕ”½‘•Á½¥¹ÑÌ°(´Ù…±¥É…¹•Ì°(´É•Í•ÉÙ•É•¥½¹ÌÉ•ÍÁ•Ñ•°(´™É½é•¸…±±½…Ñ¥½¹ÌÕ¹¡…¹•¸((ŒŒŒÉÑ¥™…ÐÑ•ÍÑÌ()½È•Ù•Éä…ÍÍ¥¹•±åÁ è((´A9•á¥ÍÑÌ°(´A9¥Ì•á…Ñ±ä€ã\ÄØ°(´M%$•á¥ÍÑÌ°(´M%$¥Ì•á…Ñ±ä€ã\ÄØ°(´M%$•ÅÕ…±ÌA9½µ…¹¥™•ÍÐ‰¥Ñµ…À°(´µ…¹¥™•ÍÐ…ÉÑ¥™…ÐÁ…Ñ¡ÌÉ•Í½±Ù”¸((ŒŒŒ…Ñ…±½œÑ•ÍÑÌ((´•Ù•Éä…ÍÍ¥¹•±åÁ …ÁÁ•…ÉÌ¥¸½ÉÉ•Ð…Ñ…±½Ì°(´±…ÍÌ½Õ¹ÑÌµ…Ñ µ…¹¥™•ÍÐ°(´±¥¹­Ì½½‘•Á½¥¹ÑÌ…É”ÕÉÉ•¹Ð¸((ŒŒŒ½¹¹•Ñ¥Ù¥ÑäÑ•ÍÑÌ((´Á½ÉÐ¥¹‘•á•ÌÙ…±¥°(´Í•…µÌµ…Ñ •áÁ•Ñ•‰½Õ¹‘…ÉäÁ¥á•±Ì°(´Íµ½½Ñ ©½¥¹ÌÍ…Ñ¥Í™äÑ…¹•¹ÐÉÕ±•Ì°(´¥¹Ñ•¹Ñ¥½¹…°½É¹•ÉÌ…É”¹½Ðµ¥Í±…‰•±•Íµ½½Ñ ¸((ŒŒŒI•ÁÉ½‘Õ¥‰¥±¥Ñä()±•…¸ÉÕ¸™É½´Ñ¡”Í…µ”Í½ÕÉ”½µµ¥ÐÍ¡½Õ±ÁÉ½‘Õ”‰åÑ”µ¥‘•¹Ñ¥…°…¹½¹¥…°…ÉÑ¥™…ÑÌÝ¡•É•Ù•ÈÁÉ…Ñ¥…°¸((´´´((ŒŒ€ÈÌ¸%¹Ñ•É…Ñ¥Ù”±…ˆÉ½…‘µ…À()á¥ÍÑ¥¹œ½•…É±äè((´…¹‘¥‘…Ñ”µ™…µ¥±ä•¹•É…Ñ¥½¸°(´…¹‘¥‘…Ñ”½Õ¹¥ÅÕ”½‘ÕÁ±¥…Ñ”½Õ¹ÑÌ°(´…Ñ±…Ì‰É½ÝÍ¥¹œ°(´±åÁ ¥¹ÍÁ•Ñ½È°(´¹•…É•ÍÐµ¹•¥¡‰½ÈÁÉ•Ù¥•Ü°(´•á…ÐM%$Ù¥•Ü°(´…±¥…Ì¥¹ÍÁ•Ñ¥½¸°(´A9½)M=8•áÁ½ÉÐ¸()9•áÐè((´Í¡…Á”µ±…ÍÌÍ•±•Ñ½È°(´ÕÉÙ”Á…É…µ•Ñ•È•áÁ±½É•È°(´Ñ…¹•¹ÐÙ¥ÍÕ…±¥é…Ñ¥½¸°(´Í•…´½¹•¥¡‰½ÈÁÉ•Ù¥•Ü°(´½µÁ…Ñ¥‰¥±¥ÑäÍ•…É °(´…¹‘¥‘…Ñ—ŠI‘•‘ÕÁ±¥…Ñ•µÍÕÉÙ¥Ù½È½µÁ…É¥Í½¸°(´½‘•Á½¥¹Ð…±±½…Ñ¥½¸‘¥ÍÁ±…ä°(´Íåµµ•ÑÉä¥¹ÍÁ•Ñ¥½¸¸()1…Ñ•Èè((´µÕ±Ñ¤µ•±°‘É…Ý¥¹œ…¹Ù…Ì°(´±¥¹”½ÕÉÙ”Ñ½½±Ì°(´…ÕÑ½µ…Ñ¥Œ±åÁ Í½±Ù¥¹œ°(´Á•Èµ•±°µ…¹Õ…°É•Á±…•µ•¹Ð°(´U¹¥½‘”½Áä½Á…ÍÑ”°(´A9½Ñ•áÐ½)M=8‘É…Ý¥¹œ•áÁ½ÉÐ¸((´´´((ŒŒ€ÈÐ¸½Õµ•¹Ñ…Ñ¥½¸½…±Ì()Q¡”I5Í¡½Õ±•Ù•¹ÑÕ…±±ä•áÁ±…¥¸É…Á¡M%$…ÐÑ¡É•”±•Ù•±Ìè((ŒŒŒ!Õµ…¸½Ù•ÉÙ¥•Ü()]¡…ÐÉ…Á¡M%$¥Ì…¹Ý¡ä„•½µ•ÑÉ¥ŒÑ•áÐ½Ñ¥±”Ù½…‰Õ±…Éä¥ÌÕÍ•™Õ°¸((ŒŒŒÉÑ¥ÍÐ½ÕÍ•ÈÕÍ…”((´¥¹ÍÑ…±°½ÕÍ”Ñ¡”™½¹Ð°(´‰É½ÝÍ”…Ñ±…Í•Ì°(´½Áä±åÁ¡Ì°(´Õ¹‘•ÉÍÑ…¹½‘•Á½¥¹ÐÁ…•Ì°(´¥¹ÍÁ•Ð±…ÍÌ…Ñ…±½Ì¸((ŒŒŒAÉ½É…µµ•ÈÕÍ…”((´±½…µ…¹¥™•ÍÐ°(´±½…Ñ”‰ä%½½‘•Á½¥¹Ð°(´ÅÕ•ÉäÁ½ÉÑÌ½Ñ…¹•¹ÑÌ°(´É•¹‘•ÈÑ¡É½Õ ™½¹Ð½È‰¥Ñµ…À…Ñ±…Ì°(´µ…Ñ ½µÁ…Ñ¥‰±”¹•¥¡‰½ÉÌ°(´Í•É¥…±¥é”‘É…Ý¥¹Ì¸()•Ñ…¥±•½¹ÑÉ…ÑÌ‰•±½¹œ¥¸‘½Ì½€¸((´´´((ŒŒ€ÈÔ¸5¥±•ÍÑ½¹”Í•ÅÕ•¹”((ŒŒŒ5¥±•ÍÑ½¹”€ÀƒŠP±½¬™Õ¹‘…µ•¹Ñ…±ÌƒŠP€¨©=5A1Q¨¨((´mát…¹½¹¥…°½É¥•¹Ñ…Ñ¥½¸±½­•è€¨¨à½±Õµ¹Ìƒ\€ÄØÉ½ÝÌ¨¨¸(´mát•±°‘¥µ•¹Í¥½¹Ì•¹ÑÉ…±¥é•…Ì½¹ÍÑ…¹ÑÌ¸(´mátMÑÉ…¥¡Ðµ±¥¹”‰…Í•±¥¹”ÁÉ•Í•ÉÙ•…¹É”µÙ•É¥™¥•è€àÌÈƒŠH€ÜÐÙ€°€àØ‘ÕÁ±¥…Ñ•Ì°µ…à€Ð…±¥…Í•Ì¸(´mátA•Éµ…¹•¹Ð‰¥Ñµ…ÀÍ•É¥…±¥é…Ñ¥½¸™½Éµ…Ð•ÍÑ…‰±¥Í¡•¸(´mátÉÑ¥™…Ð™¥±•¹…µ”½¹Ù•¹Ñ¥½¸•ÍÑ…‰±¥Í¡•èT¬ÀÁÀÀÀ¸©€¸(´mát…¹½¹¥…°M%$½¹Ù•¹Ñ¥½¸•ÍÑ…‰±¥Í¡•è€€€¼€µ€¸(´mát1½Üµ±•Ù•°™½Éµ…Ð‘½Õµ•¹Ñ•¥¸‘½Ì½™½Éµ…Ð¹µ‘€¸(´mátAÉ•‰Õ¥±ÐÉ•É•ÍÍ¥½¸Ù•É¥™¥…Ñ¥½¸¡•­ÌÑ¡”™½Éµ…Ð½¹ÑÉ…Ð¸((ŒŒŒ5¥±•ÍÑ½¹”€ÄƒŠPÁ•ÉÍ¥ÍÑ•¹Ð…ÉÑ¥™…ÐÁ¥Á•±¥¹”ƒŠP€¨©=5A1Q¨¨((´mát‘•¹•É…Ñ½È1$Í•Á…É…Ñ”™É½´U$…Ñ¥½¹Ì¸(´mát•¹•É…Ñ”µ…¥¸)M=8µ…¹¥™•ÍÐ…¹ÍÑ…Ñ¥ÍÑ¥Ìµ…¹¥™•ÍÐ¸(´mát•¹•É…Ñ”Á•Èµ±åÁ •á…ÐM%$™¥±•Ì¸(´mát•¹•É…Ñ”Á•Èµ±åÁ …¹½¹¥…°A9™¥±•Ì¸(´mát•¹•É…Ñ”½µÁ±•Ñ”½Á…”…Ñ±…Í•Ì¸(´mát‘…ÉÑ¥™…Ð½¹Í¥ÍÑ•¹äÑ•ÍÑÌ¸(´mátAÕ‰±¥Í É•™•É•¹”½µÁ±•Ñ”½Á…”…Ñ±…Í•Ì…¹µ•…ÍÕÉ•ÍÑ…Ñ¥ÍÑ¥Ì¥¸Ñ¡”É•Á½Í¥Ñ½Éä¸()5•…ÍÕÉ•ÍÑÉ…¥¡Ðµ±¥¹”…ÉÑ¥™…ÐÍ¹…ÁÍ¡½Ðè()Ñ•áÐ(àÌÈ…¹‘¥‘…Ñ•Ì(ÜÐØ±åÁ¡Ì(ÜÐØM%$™¥±•Ì(ÜÐØ¹…Ñ¥Ù”€ã\ÄØA9™¥±•Ì(Ä½µÁ±•Ñ”…Ñ±…Ì€ ÄÈã\ÜÔÈ¤(Ì€ÈÔØµÍ±½ÐÁ…”…Ñ±…Í•Ì)€()Q¡”…¹½¹¥…°•¹•É…Ñ½ÈÝÉ¥Ñ•ÌÑ¡”™Õ±±ä•áÁ…¹‘•…ÉÑ¥™…ÑÌ½€ÑÉ•”±½…±±ä¸I•™•É•¹”…Ñ±…Í•Ì…¹ÍÑ…Ñ¥ÍÑ¥Ì…É”½µµ¥ÑÑ•¹½Üì±…É•È•áÁ…¹‘•Í¹…ÁÍ¡½ÑÌ…¸‰”½µµ¥ÑÑ•¥¹Ñ•¹Ñ¥½¹…±±äÝ¡•¸Ñ¡•ä…É”ÕÍ•™Õ°É…Ñ¡•ÈÑ¡…¸µ…­¥¹œ•Ù•ÉäÍ½ÕÉ”¡…¹”…ÉÉäÑ¡½ÕÍ…¹‘Ì½˜•¹•É…Ñ•‰¥¹…Éä™¥±•Ì¸((ŒŒŒ5¥±•ÍÑ½¹”€ÈƒŠPÍÑÉ…¥¡Ðµ±¥¹”±…ÍÌÁÕ‰±¥…Ñ¥½¸ƒŠP€¨©9aP¨¨((´lt±±½…Ñ”ÁÉ½Ù¥Í¥½¹…°½‘•Á½¥¹ÑÌÑ¼Õ¹¥ÅÕ”ÍÑÉ…¥¡Ð±åÁ¡Ì¸(´lt•¹•É…Ñ”ÍÑÉ…¥¡Ðµ±¥¹•Ì¹µ‘€½¹Ñ…¥¹¥¹œ•Ù•Éä•á…ÐM%$™½É´¸(´ltAÉ•Í•ÉÙ”…±°µ…Ñ¡•µ…Ñ¥…°…±¥…Í•Ì¥¸)M=8½‘½Ì¸(´lt‘½¹¹•Ñ¥Ù¥Ñäµ•Ñ…‘…Ñ„¸((ŒŒŒ5¥±•ÍÑ½¹”€ÌƒŠPÕÉÙ”É•Í•…É •¹¥¹”((´lt•™¥¹”ÕÉÙ”É…µµ…È¸(´lt%µÁ±•µ•¹Ð‘•Ñ•Éµ¥¹¥ÍÑ¥ŒÕÉÙ”É…ÍÑ•É¥é…Ñ¥½¸¸(´lt•¹•É…Ñ”±…É”…¹‘¥‘…Ñ”™…µ¥±¥•Ì¸(´lt•‘ÕÁ±¥…Ñ”¸(´lt½µÁ…É”ÕÉÙ…ÑÕÉ”½Ñ…¹•¹Ð½Ù•É…”¸(´ltAÕ‰±¥Í ÕÉÙ”…ÉÑ¥™…ÑÌ½…Ñ…±½œ¸((ŒŒŒ5¥±•ÍÑ½¹”€ÐƒŠP©Õ¹Ñ¥½¹Ì((´lt¥É•Ñ¥½¸µµ…Í¬µ½‘•°¸(´ltM¡…ÉÀ©Õ¹Ñ¥½¸•¹•É…Ñ¥½¸¸(´ltI½Õ¹‘•©Õ¹Ñ¥½¸•¹•É…Ñ¥½¸¸(´lt½µÁ…Ñ¥‰¥±¥Ñäµ•Ñ…‘…Ñ„¸(´lt)Õ¹Ñ¥½¸…ÉÑ¥™…ÑÌ½…Ñ…±½œ¸((ŒŒŒ5¥±•ÍÑ½¹”€ÔƒŠP™¥±±•½¹Ñ½ÕÉÌ((´lt¥±°µÍ¥‘”±…ÍÍ¥™¥•È¸(´ltMÑÉ…¥¡Ð™¥±±•‰½Õ¹‘…É¥•Ì¸(´ltÕÉÙ•™¥±±•‰½Õ¹‘…É¥•Ì¸(´lt]•‘•Ì½½É¹•ÉÌ¸(´lt¥±±•…ÉÑ¥™…ÑÌ½…Ñ…±½œ¸((ŒŒŒ5¥±•ÍÑ½¹”€ØƒŠP¥É±•Ì½•±±¥ÁÍ•Ì((´ltI…‘¥ÕÌ½•±±¥ÁÍ”É…µµ…È¸(´ltÉŒ•¹•É…Ñ¥½¸¸(´lt•‘ÕÁ±¥…Ñ¥½¸½½Ù•É…”…¹…±åÍ¥Ì¸(´lt±…ÍÌ…ÉÑ¥™…ÑÌ½…Ñ…±½œ¸((ŒŒŒ5¥±•ÍÑ½¹”€ÜƒŠPÑ•áÑÕÉ•Ì½‰±½­Ì½Ñ•Éµ¥¹…±Ì((´ltA…ÉÑ¥…°™¥±±Ì¸(´lt¥Ñ¡•È™…µ¥±¥•Ì¸(´ltM•…µ±•ÍÌÑ•áÑÕÉ”Á¡…Í•Ì¸(´lt…ÁÌ½¹½‘•Ì½…ÉÉ½ÝÌ¸(´lt±…ÍÌ…ÉÑ¥™…ÑÌ½…Ñ…±½Ì¸((ŒŒŒ5¥±•ÍÑ½¹”€àƒŠPÙ½…‰Õ±…Éä½ÁÑ¥µ¥é…Ñ¥½¸((´lt•¹•É…Ñ”™Õ±°…¹‘¥‘…Ñ”ÍÕÁ•ÉÍ•Ð¸(´lt¹…±åé”Í±½ÐÁÉ•ÍÍÕÉ”¸(´lt%‘•¹Ñ¥™ä½Ù•É…”¡½±•Ì¸(´ltM½É”½Í•±•Ð½µÁ•Ñ¥¹œ…¹‘¥‘…Ñ•Ì¸(´ltAÉ•Í•ÉÙ”É•Í•ÉÙ•ÍÁ…”¸(´ltAÉ½‘Õ”ÁÉ½Ù¥Í¥½¹…°€Ñ,…±±½…Ñ¥½¸µ…À¸((ŒŒŒ5¥±•ÍÑ½¹”€äƒŠP™½¹Ð½µÁ¥±•È((´lt	¥Ñµ…ÀµÑ¼µ½ÕÑ±¥¹”½µÁ¥±•È¸(´lt¥á•µ•ÑÉ¥Ì¸(´ltAUµ…À¸(´ltQQ½ÕÑÁÕÐ¸(´lt]=È½ÕÑÁÕÐ¸(´lt½¹ÐÍÁ•¥µ•¸Ñ•ÍÑÌ¸((ŒŒŒ5¥±•ÍÑ½¹”€ÄÀƒŠPÁÉ½É…µµ…Ñ¥Œ‘É…Ý¥¹œA$((´ltMÑ…‰±”)M=8Í¡•µ„¸(´lt1½½­ÕÀ½¥¹‘•à±¥‰É…Éä¸(´lt9•¥¡‰½È½µÁ…Ñ¥‰¥±¥ÑäA$¸(´lt•½µ•ÑÉäµÑ¼µ±åÁ Í½±Ù•È¸(´lt5Õ±Ñ¤µ•±°É…ÍÑ•ÈÉ•¹‘•É•È¸((ŒŒŒ5¥±•ÍÑ½¹”€ÄÄƒŠP¥¹Ñ•É…Ñ¥Ù”É…Á¡M%$•‘¥Ñ½È((´lt5Õ±Ñ¤µ•±°…¹Ù…Ì¸(´lt•½µ•ÑÉ¥Œ‘É…Ý¥¹œÑ½½±Ì¸(´ltÕÑ½µ…Ñ¥Œ±åÁ Í½±Ù¥¹œ¸(´lt5…¹Õ…°Ñ¥±”É•Á±…•µ•¹Ð¸(´ltU¹¥½‘”½Áä½Á…ÍÑ”¸(´ltA9½Ñ•áÐ½)M=8•áÁ½ÉÐ¸((ŒŒŒ5¥±•ÍÑ½¹”€ÄÈƒŠP™¥ÉÍÐÍÑ…‰±”Ù½…‰Õ±…ÉäÉ•±•…Í”((´lt¥¹…°½Ù•É…”É•Ù¥•Ü¸(´ltÉ••é”¥¹¥Ñ¥…°½‘•Á½¥¹Ðµ•…¹¥¹Ì¸(´ltÉ••é”µ…¹¥™•ÍÐÍ¡•µ„ØÄ¸(´lt•¹•É…Ñ”…±°½µµ¥ÑÑ•…ÉÑ¥™…ÑÌ¸(´lt½µÁ±•Ñ”I5½ÁÉ½É…µµ•È‘½Õµ•¹Ñ…Ñ¥½¸¸(´ltQ…œ½É•±•…Í”É…Á¡M%$ØÄ¸((´´´((ŒŒ€ÈØ¸•™¥¹¥Ñ¥½¸½˜‘½¹”™½ÈÉ…Á¡M%$ØÄ()ØÄÉ•±•…Í”¥ÌÉ•…‘äÝ¡•¸è((´…¹½¹¥…°€ã\ÄØ•±°™½Éµ…Ð¥Ì™É½é•¸°(´…±°…ÍÍ¥¹•±åÁ¡ÌÉ•ÁÉ½‘Õ”™É½´Í½ÕÉ”°(´•Ù•Éä±åÁ ¡…Ì„ÍÑ…‰±”½‘•Á½¥¹Ð°(´•Ù•Éä±åÁ ¡…Ì…¹½¹¥…°A9…¹M%$…ÉÑ¥™…ÑÌ°(´•Ù•Éäµ…©½È±…ÍÌ¡…Ì„•¹•É…Ñ•5…É­‘½Ý¸…Ñ…±½œ°(´)M=8½µÁ±•Ñ•±ä‘•ÍÉ¥‰•Ì¥‘•¹Ñ¥Ñä½½¹¹•Ñ¥Ù¥Ñä°(´…Ñ±…Í•Ì½Ù•ÈÑ¡”…ÍÍ¥¹•Ù½…‰Õ±…Éä°(´„ÕÍ…‰±”™¥á•µ•±°™½¹Ð•á¥ÍÑÌ°(´ÁÉ½É…µÌ…¸É•¹‘•ÈÑ¡É½Õ ™½¹Ð½È…¹½¹¥…°‰¥Ñµ…À…ÉÑ¥™…ÑÌ°(´¹•¥¡‰½È½µÁ…Ñ¥‰¥±¥Ñä¥Ìµ•¡…¹¥…±±äÅÕ•Éå…‰±”°(´•¹•É…Ñ¥½¸½Ñ•ÍÑÌ…É”‘•Ñ•Éµ¥¹¥ÍÑ¥Œ°(´I5½ÁÉ½É…µµ•È‘½Ì•áÁ±…¥¸Ñ¡”™½Éµ…Ð°(´½‘•Á½¥¹Ðµ•…¹¥¹Ì…É”É•…‘äÑ¼‰”ÑÉ•…Ñ•…ÌÍÑ…‰±”A$¸((´´´((ŒŒ€ÈÜ¸Õ¥‘¥¹œÉÕ±”()]¡•¸‘•¥‘¥¹œÝ¡•Ñ¡•ÈÑ¼…‘„¡…¹µ…ÕÑ¡½É•±åÁ °•¹•É…Ñ½ÈÉÕ±”°…ÉÑ¥™…Ð°µ•Ñ…‘…Ñ„™¥•±°½ÈÍÕ‰ÍåÍÑ•´°ÁÉ•™•ÈÑ¡”¡½¥”Ñ¡…Ðµ…­•ÌÉ…Á¡M%$µ½É”è((´€¨©ÍåÍÑ•µ…Ñ¥Œ¨¨°(´€¨©É•ÁÉ½‘Õ¥‰±”¨¨°(´€¨©ÅÕ•Éå…‰±”¨¨°(´€¨©½µÁ½Í…‰±”¨¨°(´€¨©¥¹ÍÁ•Ñ…‰±”¨¨°(´€¨©ÁÉ½É…µµ…‰±”¨¨°(´€¨©•½µ•ÑÉ¥…±±ä•áÁÉ•ÍÍ¥Ù”Á•È½‘•Á½¥¹Ð¨¨¸()Q¡”•¹•É…Ñ½ÈÍ¡½Õ±±•Ð•µÁ¥É¥…°É•ÍÕ±ÑÌ‘•Ñ•Éµ¥¹”Ñ¡”Ù½…‰Õ±…Éä¸]”Í¡½Õ±¹½Ð…ÍÍÕµ”¡½Üµ…¹äÍ±½ÑÌ„±…ÍÌ‘•Í•ÉÙ•ÌÝ¡•¸Ý”…¸•¹•É…Ñ”Ñ¡”…¹‘¥‘…Ñ•Ì°É…ÍÑ•É¥é”Ñ¡•´°‘•‘ÕÁ±¥…Ñ”Ñ¡•´°µ•…ÍÕÉ”ÍÕÉÙ¥Ù¥¹œÙ¥ÍÕ…°ÍÁ…”°…¹¥¹ÍÁ•ÐÑ¡”É•ÍÕ±Ð¸()Q¡”½‰©•Ñ¥Ù”¥Ì¹½ÐÑ¼™¥±°€ÐÀäØ½‘•Á½¥¹ÑÌ¸%Ð¥ÌÑ¼µ…­”Ñ¡½Í”½‘•Á½¥¹ÑÌ‰•¡…Ù”±¥­”„½¡•É•¹ÐÉ…Á¡¥…°±…¹Õ…”¸