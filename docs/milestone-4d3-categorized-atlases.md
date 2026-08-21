# Milestone 4D.3 — Categorized visual and text atlases

Status: **COMPLETE ON `milestone-4d-publication-plan`**

Milestone 4D.3 turns the canonical 4D.1 registry and 4D.2 per-glyph artifacts into deterministic, navigable category and reference atlases. It does not create new glyph owners or allocate any additional Unicode positions.

## Canonical page contract

Every visual atlas page is a fixed 16×16 grid of GraphSCII cells:

```text
page slots       256
columns           16
rows              16
cell               8×16 pixels
page             128×256 pixels
```

PNG pages are generated directly from canonical bitmap keys with black opaque ON pixels and transparent OFF pixels. There is no font rendering, antialiasing, browser screenshotting, or filesystem-order dependence.

Text pages carry the same ordered visual population and include codepoint/research ID, bitmap key, semantic metadata, and the exact 8×16 `#` / `-` raster.

## Encoded category atlases

The encoded categories are separated for human inspection while preserving canonical owner ordering inside each category:

```text
category        owners    pages
straight           746        3
solid 100%        1259        5
medium 75%        1269        5
half 50%          1207        5
light 25%         1315        6
                         -----
category PNG pages          24
```

Each category directory contains matching `page-NN.png` and `page-NN.txt` files plus `index.md`.

## Combined encoded atlas

The complete 5,796-owner encoded vocabulary is also emitted in raw canonical codepoint order:

```text
encoded owners        5,796
page size                256
combined pages            23
```

This `combined/` atlas is the page-level input for the more heavily formatted master publication artifacts in Milestone 4D.4.

## Renderer-only reference atlas

Renderer-only semantics remain visible without duplicating already encoded pixels:

```text
renderer-only semantic aliases       3,392
exact encoded-reuse aliases             414
derived aliases                       2,978
unique derived bitmaps shown          2,555
renderer-only visual pages               10
```

Exact-reuse aliases are counted in the renderer-only index but are not duplicated visually. The 2,555 genuinely derived bitmaps receive deterministic research IDs (`R0000`, ...), sorted by bitmap key. Their text entries retain styles, reasons, semantic aliases, and any Hamming-distance fallback metadata.

## Protected reserve layout

The reserve remains unallocated:

```text
U+F6A4..U+F8FF
604 slots
3 text pages
0 PNG pages
```

There is deliberately no bitmap atlas for the reserve because no canonical glyph exists there. The reserve directory is an address-space map only.

## Persistent output tree

```text
artifacts/vocabulary/atlases/
├── stats.json
├── straight/
├── solid/
├── medium/
├── half/
├── light/
├── combined/
├── renderer-only/
└── reserve-layout/
```

The complete generated tree contains **126 files**.

## Permanent commands

```powershell
npm run generate:vocabulary-atlases
npm run verify:vocabulary-atlases
```

Both are included in the aggregate `npm run generate` and `npm run verify` pipelines.

## Verification gates

Milestone 4D.3 verification rebuilds every expected page in memory and checks the complete output tree byte-for-byte. It freezes:

```text
straight pages          3
solid pages             5
medium pages            5
half pages              5
light pages             6
combined pages         23
renderer-only pages    10
reserve text pages      3
```

It also verifies the 5,796 encoded-owner baseline, 3,392 renderer-only semantic aliases, 2,978 renderer-only derived aliases, 2,555 unique renderer-only derived bitmaps, and the protected 604-slot reserve.

## Result

Milestone 4D.3 is complete. GraphSCII now has deterministic categorized visual and text views of both its encoded vocabulary and its unencoded semantic extensions.

**Next: Milestone 4D.4 — master text atlas, master page atlas, category master text atlases, and master layout map.**
