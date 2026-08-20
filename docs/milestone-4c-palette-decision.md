# Milestone 4C — BMP PUA Palette and Headroom Decision

Status: **COMPLETE — PALETTE SELECTED; NEW FILL/DITHER CODEPOINT ALLOCATION DEFERRED TO 4D**

Milestone 4C converts the Milestone 4B dither measurements into a concrete BMP Private Use Area strategy.

## Capacity target

The full BMP Private Use Area is:

```text
U+E000..U+F8FF = 6,400 codepoints
```

GraphSCII now treats that full range as the graphics address space.

Printable ASCII remains at its normal Unicode positions:

```text
U+0020..U+007E = 95 printable characters
```

Those 95 characters do **not** consume PUA slots.

The planning target is:

```text
encoded GraphSCII graphics   <= 5,800
reserved BMP PUA slots       >=   600
```

## Added 50% research mask

Milestone 4C adds a true 50% phase-locked checkerboard research style:

```text
#-#-#-#-
-#-#-#-#
#-#-#-#-
-#-#-#-#
#-#-#-#-
-#-#-#-#
#-#-#-#-
-#-#-#-#
```

The phase rule is unchanged: local cell `(x,y)` determines the mask bit, and the 8×8 pattern repeats vertically in the 8×16 cell.

## Exhaustive palette comparison

The optimizer evaluates all 3-style and 4-style palettes containing solid from this six-style research set:

```text
solid      100.0%
dense       87.5%
medium      75.0%
half        50.0%
light       25.0%
sparse      12.5%
```

That produces exactly 20 candidate palettes.

Every candidate cost is measured as the global union of:

```text
746 published straight rasters
+ selected fill-style rasters
```

No per-style count is merely added; exact bitmap deduplication remains global.

## Selected tonal palette

The selected encoded semantic palette is:

```text
solid      100%
medium      75%
half        50%
light       25%
```

This is the only evaluated four-level palette with exact quarter-step spacing across the main tonal range:

```text
100 → 75 = 25 points
 75 → 50 = 25 points
 50 → 25 = 25 points
```

Dense 87.5% and sparse 12.5% remain valid semantic/renderer styles, but they do not receive complete codepoint-owning classes.

## Exact cost before compression

The exact globally deduplicated four-level union is:

```text
straight + solid + 75% + 50% + 25% = 5,858 visuals
```

That leaves only 542 PUA slots and misses the 5,800 / 600 planning target by 58 visuals.

## One-pixel 50% compression rule

The optimizer then asks a narrower question only of globally novel 50% visuals:

> Does this 50% bitmap differ by exactly one pixel from any visual already present in the straight + solid + 75% + 25% encoded base?

Measured result:

```text
globally novel 50% owners before compression   1,269
one-pixel-near 50% owners                         62
semantic definitions represented by those        64
50% owners retained for encoding                1,207
```

Those 62 one-pixel-near visual owners remain renderer-only. Their mathematical/appearance semantics are preserved; they are not deleted.

This is deterministic and auditable. Every demotion records both its bitmap key and the exact one-pixel-neighbor encoded bitmap key in:

```text
artifacts/research/palette/half-demotions.json
```

## Final planned encoded population

```text
published straight visuals      746
novel solid visuals            1,259
75% medium additions           1,269
25% light additions            1,315
50% half additions             1,207
                               -----
planned encoded PUA graphics   5,796
```

Therefore:

```text
BMP PUA capacity               6,400
planned encoded graphics       5,796
                               -----
reserved PUA headroom            604
```

Including normal printable ASCII in the physical font gives at least:

```text
5,796 PUA graphics
   95 printable ASCII
-----
5,891 physical glyphs
```

while still consuming only 5,796 PUA positions.

## Planned PUA layout

These ranges are a **4C plan**, not yet a 4D allocation:

```text
U+E000..U+E2E9      746   published straight visuals
U+E2EA..U+E7D4    1,259   solid fill visuals
U+E7D5..U+ECC9    1,269   75% medium visuals
U+ECCA..U+F1EC    1,315   25% light visuals
U+F1ED..U+F6A3    1,207   retained 50% half visuals
U+F6A4..U+F8FF      604   reserved
```

Milestone 4C does not mutate the current fill registry to assign those codepoints. Milestone 4D is the publication/allocation gate.

## Renderer-only semantics

Renderer-only does not mean unsupported.

The semantic system retains:

```text
dense  87.5%
sparse 12.5%
62 one-pixel-near 50% visual owners
```

For any renderer-only semantic definition:

1. derive the bitmap from mathematical boundary + side + phase-locked mask;
2. if that bitmap exactly matches an encoded owner, use the existing codepoint;
3. otherwise render/generate the bitmap without allocating another PUA character.

This preserves a richer appearance language than the font's finite codepoint inventory.

## Persistent artifacts

Milestone 4C generates:

```text
artifacts/research/palette/
├── decision.json
├── candidate-palettes.json
├── half-demotions.json
└── report.md

spec/straight-fill-palette-v0.json
```

The normal generation pipeline now includes the palette decision.

Commands:

```powershell
npm run generate:palette
npm run verify:palette
npm run generate
npm run verify
```

## Next milestone

**Milestone 4D — filled/dither publication and provisional allocation**

4D should materialize the selected 5,796-graphics plan into the canonical registry, assign provisional codepoints to the retained novel visual owners, generate the font-facing bitmap/PNG/ASCII artifacts and indexes, and preserve explicit renderer-only resolution metadata for dense, sparse, and the 62 demoted 50% owners.
