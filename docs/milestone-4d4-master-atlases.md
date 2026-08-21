# Milestone 4D.4 — Master Text Atlas, Page Atlas, and Layout Map

Status: **COMPLETE — GENERATED, FULL-CHAIN VERIFIED, AND BYTE-STABLE**

Milestone 4D.4 turns the categorized 4D.3 atlas population into the publication-facing master reference for the complete GraphSCII graphics vocabulary.

The canonical bitmap registry remains the source of truth. The master atlas layer does not invent or renumber glyphs; it reorganizes already-verified canonical data into human-auditable views.

## Generated outputs

```text
artifacts/vocabulary/atlases/
├── master-text-atlas.md
├── master-text-atlas.txt
├── master-page-atlas.md
├── master-page-atlas.txt
├── master-layout-map.md
├── straight-text-atlas.md
├── solid-text-atlas.md
├── medium-text-atlas.md
├── half-text-atlas.md
└── light-text-atlas.md
```

Exactly **10 deterministic 4D.4 files** are generated.

## Master text atlas

The master text atlas is the single human-readable reference for the complete encoded vocabulary plus renderer-only and reserve information.

Its conceptual category order is frozen as:

```text
1. STRAIGHT
2. SOLID 100%
3. MEDIUM 75%
4. HALF 50%
5. LIGHT 25%
6. RENDERER-ONLY REFERENCE
7. RESERVED PUA MAP
```

Every encoded entry inherits the verified 4D.3 text representation:

```text
codepoint
glyphId
canonical class
bitmap key
semantic alias count
representative semantic alias
exact 8×16 ASCII bitmap
```

The Markdown and plain-text master forms are generated from the same source data.

## Per-category text atlases

The five encoded classes also receive single-file Markdown references:

```text
straight-text-atlas.md     746 owners
solid-text-atlas.md      1,259 owners
medium-text-atlas.md     1,269 owners
half-text-atlas.md       1,207 owners
light-text-atlas.md      1,315 owners
```

Within every category, canonical codepoint order is preserved.

## Master page atlas

The encoded allocation occupies exactly **23 codepoint pages** of at most 256 glyphs each.

The page atlas mirrors the same Unicode neighborhoods as the 4D.3 combined PNG pages while using a compact 16×16 textual grid.

Legend:

```text
ST  straight
SO  solid 100%
M   medium 75%
H   half 50%
L   light 25%
--  unallocated
```

Frozen boundaries:

```text
page 1   U+E000..U+E0FF
...
page 23  U+F600..U+F6A3
```

The final page contains 164 allocated owners; codepoints after U+F6A3 remain outside the encoded population.

## Master layout map

`master-layout-map.md` records the authoritative address-space summary:

```text
Printable ASCII  U+0020..U+007E       95   outside PUA
Straight         U+E000..U+E2E9      746   encoded
Solid 100%       U+E2EA..U+E7D4    1,259   encoded
Medium 75%       U+E7D5..U+ECC9    1,269   encoded
Light 25%        U+ECCA..U+F1EC    1,315   encoded
Half 50%         U+F1ED..U+F6A3    1,207   encoded
Reserve          U+F6A4..U+F8FF      604   protected/unallocated
```

Totals:

```text
encoded PUA graphics                       5,796
printable ASCII                               95
minimum physical font population          5,891
renderer-only semantic aliases            3,392
renderer-only exact encoded reuses          414
renderer-only derived aliases             2,978
unique renderer-only derived bitmaps      2,555
protected BMP PUA reserve                   604
```

The master text atlas intentionally places HALF before LIGHT for conceptual tonal ordering. The allocation map remains authoritative and therefore records LIGHT before HALF because that is the frozen 4C/4D codepoint layout.

## Pipeline ownership fix discovered by 4D.4

The first full-chain 4D.4 run exposed an important generator-boundary defect: Milestone 4D.3 previously treated the entire `artifacts/vocabulary/atlases/` directory as its private output tree.

That behavior was correct while 4D.3 was the only producer, but it became incorrect as soon as 4D.4 added publication files at the atlas root.

The permanent fix is ownership-based:

```text
4D.3 owns and strictly verifies:
  straight/
  solid/
  medium/
  half/
  light/
  combined/
  renderer-only/
  reserve-layout/
  stats.json

4D.4 owns and strictly verifies:
  master-text-atlas.md
  master-text-atlas.txt
  master-page-atlas.md
  master-page-atlas.txt
  master-layout-map.md
  *-text-atlas.md
```

4D.3 generation now clears only its managed subtrees instead of deleting the complete atlas root. Its verifier still rejects unexpected files inside every 4D.3-owned subtree, but correctly ignores later milestone files at the root.

This preserves strict verification without making one milestone destroy another milestone's deterministic artifacts.

## Permanent commands

From `geometric-glyph-lab/`:

```powershell
npm run generate:vocabulary-master-atlas
npm run verify:vocabulary-master-atlas
```

Both commands are included in the aggregate pipeline:

```powershell
npm run generate
npm run verify
```

Generation order is intentionally:

```text
4D.3 categorized atlases
        ↓
4D.4 master atlases
```

so every master publication view is rebuilt from the latest deterministic categorized data.

## Verification gates

The 4D.4 verifier reconstructs all ten master files and requires byte identity with the committed artifacts.

It additionally freezes:

```text
encoded owners                         5,796
master files                               10
combined codepoint pages                  23
renderer-only semantic aliases         3,392
renderer-only unique derived bitmaps   2,555
reserve slots                             604
first page                    U+E000..U+E0FF
last page                     U+F600..U+F6A3
master category order                    fixed
```

The complete project generation, TypeScript check, and full verification chain passed before the final artifacts were committed.

## Result

Milestone 4D.4 is complete.

GraphSCII now has both machine-facing canonical data and publication-facing human references for the entire currently encoded graphics vocabulary.

The next slice is **Milestone 4D.5 — renderer-only resolution registry**, which will turn the dense, sparse, and demoted-half semantics into explicit persistent resolution artifacts rather than leaving them only inside the global vocabulary index and reference atlas.
