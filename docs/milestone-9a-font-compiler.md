# Milestone 9A — GraphSCII Reference TrueType Compiler

Status: **IN IMPLEMENTATION — CI PUBLICATION GATE NEXT**

Milestone 9A turns the frozen `graphscii-graphics-v1` bitmap vocabulary into the first deterministic installable GraphSCII font and freezes the public identity of the standard.

## Public identity

```text
GraphSCII
Graphical Standard for Computer Information Interchange
By Ariel Williams
```

Reference font naming:

```text
family            GraphSCII
subfamily         Regular
full name         GraphSCII Regular
PostScript name   GraphSCII-Regular
designer          Ariel Williams
version           1.0
```

## Source contract

The font compiler consumes:

```text
artifacts/manifest/vocabulary-v1/registry.json
```

It does not independently regenerate GraphSCII geometry.

Frozen graphical input:

```text
PUA graphical owners              6,397
first PUA codepoint             U+E000
last PUA codepoint              U+F8FC
protected reserve               U+F8FD..U+F8FF
```

Printable support layer:

```text
U+0020..U+007E                      95 characters
source                              public-domain font8x8/IBM VGA-derived bitmaps
transformation                      each 8x8 source row doubled vertically to 8x16
```

The public-domain ASCII provenance is documented in `THIRD-PARTY-NOTICES.md`.

## Deterministic font geometry

The compiler is dependency-free JavaScript and emits a TrueType sfnt directly.

```text
canonical cell                    8×16 pixels
font units per pixel                64
units per em                      1024
advance width                      512
```

Every contiguous run of ON pixels in one canonical bitmap row becomes one exact grid-aligned rectangular TrueType contour. No antialiasing state is encoded into the canonical geometry.

The compiler emits these required tables:

```text
OS/2
cmap
glyf
head
hhea
hmtx
loca
maxp
name
post
```

Font timestamps are deterministic. The sfnt checksum-adjustment gate requires the final whole-font checksum to equal `0xB1B0AFBA`.

## Glyph population

Expected cmap population:

```text
printable ASCII                    95
GraphSCII PUA graphics          6,397
                               -----
encoded characters             6,492
```

Expected sfnt glyph population:

```text
.notdef                            1
encoded characters             6,492
                               -----
sfnt glyphs                    6,493
```

Reference glyph order:

```text
GID 0          .notdef
GID 1..95      U+0020..U+007E
GID 96..6492   U+E000..U+F8FC
```

For a GraphSCII registry owner:

```text
sfnt GID = 96 + GraphSCII owner glyphId
```

The stable GraphSCII public address remains the Unicode codepoint and canonical bitmap; sfnt GID is a compiled implementation detail.

## Exact round-trip gate

Verification decodes every generated simple glyph directly from `glyf` and `loca`, converts its grid-aligned contours back into an 8×16 bitmap, and compares that bitmap against the expected source.

```text
6,493 generated glyphs
        ↓
decode TrueType coordinates
        ↓
recover canonical pixel runs
        ↓
compare every 8×16 raster
        ↓
all exact or FAIL
```

No sample-only gate is accepted.

Additional hard gates:

```text
registry owner count                     6,397
registry codepoint order preserved          YES
printable ASCII count                       95
encoded character count                  6,492
sfnt glyph count                         6,493
unitsPerEm                               1,024
advance width                              512
required sfnt tables present                 YES
whole-font sfnt checksum valid               YES
deterministic byte rebuild                   YES
all-glyph raster round-trip                   YES
```

## Outputs

```text
artifacts/fonts/
├── GraphSCII-Regular.ttf
└── manifest.json
```

The generated manifest freezes:

- GraphSCII standard and designer identity;
- source publication and registry path;
- source registry SHA-256;
- font SHA-256;
- metrics;
- ASCII/PUA/total glyph counts;
- licensing document pointers;
- printable ASCII provenance; and
- verification assertions.

## Licensing/publication layer

Milestone 9A also adds:

```text
GRAPHSCII-STANDARD.md
FONT-LICENSE.txt
COMMERCIAL-LICENSE.md
INDIE-LICENSE.md
THIRD-PARTY-NOTICES.md
README.md
```

Public licensing model:

```text
noncommercial public use    CC BY-NC-SA 4.0
commercial use              separate written permission from Ariel Williams
business pricing            negotiated per project
indie commercial use        ask first; intended to be free or low-cost for small projects
```

Project principle:

> Study it. Draw with it. Modify it. Share it. Keep forks open.  
> Don't commercially exploit GraphSCII without permission. Indies: just ask.

## Permanent commands

From `geometric-glyph-lab/`:

```text
npm run generate:font
npm run verify:font
```

Both are integrated into the aggregate generation and verification chain.

## Completion gate

Milestone 9A becomes COMPLETE only after a clean GitHub Actions checkout successfully runs:

```text
npm install
npm run check
npm run generate:font
npm run verify:font
```

and the resulting `GraphSCII-Regular.ttf` and `manifest.json` are persisted byte-for-byte from that verified build.
