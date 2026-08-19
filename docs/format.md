# GraphSCII Canonical Cell Format v1

This document freezes the low-level bitmap contract used by the GraphSCII generator and generated artifacts.

## Canonical cell

GraphSCII v1 uses an **8-column × 16-row** binary cell.

```text
width  = 8 pixels
height = 16 pixels
```

Coordinates are zero-based:

- `x = 0..7`, left to right
- `y = 0..15`, top to bottom

The 16×8 example that appeared during early planning was a presentation/orientation mismatch, not a second canonical format. The working 8×16 implementation and its measured straight-line baseline are retained.

## Boundary ports

The canonical edge ports are:

```text
Top:     T0..T7
Bottom:  B0..B7
Left:    L0..L15
Right:   R0..R15
```

A port maps to the boundary pixel with the same index.

## Canonical bitmap serialization

Serialization identifier:

```text
v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex
```

A bitmap is exactly 16 bytes:

1. one byte per row,
2. rows ordered from `y=0` through `y=15`,
3. within a row, `x=0` is bit 0 (the least-significant bit),
4. `x=7` is bit 7,
5. the stable text key is two lowercase hexadecimal characters per row concatenated in row order.

Therefore every GraphSCII v1 bitmap key is exactly **32 lowercase hexadecimal characters**.

Example row:

```text
#-------
```

sets `x=0`, so its byte is:

```text
01
```

while:

```text
-------#
```

sets `x=7`, so its byte is:

```text
80
```

The canonical bitmap, not a font outline, defines visual identity.

## ASCII form

The exact textual bitmap representation uses:

```text
# = filled pixel
- = empty pixel
```

Each glyph ASCII file contains exactly 16 rows of 8 characters, with no labels or metadata inside the file.

Example:

```text
-------#
------#-
------#-
-----#--
----#---
----#---
---#----
---#----
--#-----
--#-----
-#------
-#------
#-------
#-------
#-------
#-------
```

## Artifact codepoint names

Assigned glyph artifacts use the full six-digit, zero-padded Unicode scalar value in uppercase hexadecimal:

```text
U+00E000
U+00E001
U+00E23A
```

Derived filenames use that stem unchanged:

```text
U+00E000.png
U+00E000.txt
```

The six-digit convention is intentionally wider than the BMP requirement so naming remains unambiguous if a future major GraphSCII version uses non-BMP codepoints.

## Straight-line regression fixture

Under this exact format and the current deterministic Bresenham rasterizer, the six baseline straight families must produce:

```text
mathematical candidates    832
unique canonical bitmaps   746
duplicate candidates        86
maximum aliases              4
```

A change to the rasterizer, coordinate model, port mapping, or bitmap serialization that changes this fixture is a format-affecting change and must be deliberate.

## Status

This file completes the low-level format decisions required by GraphSCII Milestone 0. Later manifest/schema versions may add metadata without changing this canonical bitmap contract.
