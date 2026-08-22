# GraphSCII

## Graphical Standard for Computer Information Interchange

**By Ariel Williams**

GraphSCII is a fixed-cell graphical character standard for composing computer graphics from deterministic Unicode-addressed tiles.

Its core idea is simple: every GraphSCII graphical character is an exact **8×16 binary bitmap**, and those characters can be placed next to one another to form larger lines, filled regions, diagrams, silhouettes, textures, interfaces, maps, and other graphics.

> **Study it. Draw with it. Modify it. Share it. Keep forks open.**

This document defines the GraphSCII v1 graphical and font-facing contract.

---

## 1. Canonical cell

Every GraphSCII graphical tile occupies exactly:

```text
width   8 pixels
height 16 pixels
```

Coordinates are:

```text
x = 0..7    left → right
y = 0..15   top → bottom
```

A pixel is either OFF or ON. There is no grayscale in the canonical bitmap identity.

The graphical cell is the source of truth. Font outlines, PNGs, atlases, text previews, and other representations are compiled views of that bitmap.

---

## 2. Canonical bitmap serialization

A GraphSCII bitmap is serialized as sixteen row bytes in top-to-bottom order.

Within each row byte:

```text
x = 0 → bit 0, least significant bit
x = 7 → bit 7, most significant bit
```

The canonical string form is thirty-two lowercase hexadecimal characters:

```text
v1:rows-top-to-bottom;one-byte-per-row;x0-is-bit0;lowercase-hex
```

Example shape:

```text
ff010101010101010101010101010101
```

Human-readable ASCII raster notation uses:

```text
# = ON
- = OFF
```

A canonical ASCII artifact therefore contains exactly sixteen lines of eight characters.

---

## 3. Global visual identity rule

GraphSCII has one fundamental ownership rule:

> **One exact 8×16 bitmap gets at most one canonical encoded graphical owner.**

Two mathematical or semantic definitions that rasterize to the same bitmap do not consume two codepoints. They become aliases of the same visual owner.

This rule applies globally across straight lines, fills, tonal patterns, connectors, and later compatible extensions.

Semantic identity and visual identity are therefore distinct:

```text
semantic definition
        ↓
deterministic rasterization
        ↓
exact 8×16 bitmap
        ↓
global exact deduplication
        ↓
canonical visual owner
```

GraphSCII never treats a merely similar bitmap as exact. Approximation or renderer fallback must be identified explicitly.

---

## 4. Boundary ports and composition

The perimeter of an 8×16 cell exposes named boundary positions:

```text
Top:    T0..T7
Bottom: B0..B7
Left:   L0..L15
Right:  R0..R15
```

Graphical semantics may describe which boundary ports a line or connector reaches. Adjacent cells can therefore be selected so corresponding edge positions meet exactly.

A semantic alias describes a meaning or construction that resolves to a visual owner. Multiple aliases may share one visual owner when their exact raster is identical.

---

## 5. GraphSCII graphics-v1.1 encoded vocabulary

The normative GraphSCII graphical publication is:

```text
graphscii-graphics-v1.1
```

It contains **6,398 encoded Private Use Area graphical owners**: the frozen
graphics-v1 vocabulary plus one reserved-slot special, the `tone-interior:light`
full-cell 25% interior glyph at `U+F8FD`
(see [`docs/specials-light-interior-plan.md`](docs/specials-light-interior-plan.md)).

```text
straight visual owners                 746
solid 100% visual owners             1,259
medium 75% visual owners             1,269
light 25% visual owners              1,316   (includes the interior special)
half 50% visual owners               1,207
orthogonal connector owners            544
diagonal connector owners               57
interior tone special                    1
                                       -----
total encoded PUA graphics            6,398
```

The publication also preserves a richer semantic layer. Exact semantic aliases can resolve to an existing owner without consuming another codepoint.

The machine-readable source of truth is:

```text
artifacts/manifest/vocabulary-v1.1/registry.json
```

The publication manifest is:

```text
artifacts/publications/graphscii-graphics-v1.1.json
```

---

## 6. Unicode address map

GraphSCII v1.1 uses the BMP Private Use Area as follows:

```text
U+E000..U+E2E9      746   straight
U+E2EA..U+E7D4    1,259   solid 100%
U+E7D5..U+ECC9    1,269   medium 75%
U+ECCA..U+F1EC    1,315   light 25% (boundary fills)
U+F1ED..U+F6A3    1,207   half 50%
U+F6A4..U+F8FC      601   generic connector owners
U+F8FD                1   interior tone special (tone-interior:light)
U+F8FE..U+F8FF        2   protected reserve
```

The final two BMP PUA slots are not implicitly available for arbitrary additions. They remain reserved unless a later GraphSCII version explicitly allocates them.

Existing v1 and v1.1 graphical codepoints must not be silently renumbered.

---

## 7. Tonal graphical classes

The encoded tonal vocabulary contains four deterministic levels:

```text
solid   100%
medium   75%
half     50%
light    25%
```

The dither masks are phase-locked to the canonical cell coordinate system. Their phase does not randomly change from glyph to glyph.

Additional dense and sparse semantic appearances may exist as renderer-derived output without consuming encoded PUA codepoints. Renderer-derived output is not automatically part of the encoded font vocabulary.

---

## 8. Generic connector language

GraphSCII v1 adds a deliberately rule-generated connector basis instead of attempting to encode every possible junction.

Its published semantic connector language contains:

```text
orthogonal connector semantics          640
diagonal connector semantics             60
                                         ---
connector semantic aliases total         700
```

After global exact bitmap deduplication, those semantics require 601 new PUA owners:

```text
novel orthogonal owners                  544
novel diagonal owners                     57
                                         ---
novel connector owners                   601
```

The rule-generated language is intended to be predictable enough for software to select connectors directly rather than search a large opaque enumeration.

---

## 9. Printable ASCII support

A conforming reference GraphSCII font includes printable ASCII:

```text
U+0020..U+007E = 95 characters
```

These support characters do not consume GraphSCII PUA slots.

The GraphSCII reference font's printable ASCII bitmaps are derived from public-domain IBM VGA-style 8×8 material distributed through `dhepper/font8x8`. Each 8×8 row is doubled vertically to create an 8×16 cell.

See [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

The public-domain ASCII glyph source is support material; the defining GraphSCII graphical vocabulary is the PUA registry.

---

## 10. Reference font conformance

The canonical reference font family is:

```text
Family:          GraphSCII
Subfamily:       Regular
Full name:       GraphSCII Regular
PostScript name: GraphSCII-Regular
Designer:        Ariel Williams
Standard:        Graphical Standard for Computer Information Interchange
```

The reference TrueType compiler uses deterministic fixed metrics:

```text
canonical bitmap cell       8×16
font units per bitmap pixel   64
units per em                1024
advance width                512
```

A reference font contains:

```text
95 printable ASCII characters
6,398 GraphSCII PUA characters
--------------------------------
6,493 encoded characters

+ 1 mandatory .notdef glyph
--------------------------------
6,494 sfnt glyphs total
```

Reference glyph-order mapping is:

```text
sfnt GID 0             .notdef
sfnt GID 1..95         U+0020..U+007E
sfnt GID 96..6493      U+E000..U+F8FD
```

For a GraphSCII v1 registry owner:

```text
sfnt GID = 96 + GraphSCII owner glyphId
```

This sfnt GID is a compiled-font implementation detail. The stable public graphical address is the Unicode codepoint and canonical bitmap identity.

---

## 11. Exact font raster requirement

The reference font compiler converts canonical ON pixels into grid-aligned TrueType outlines.

A conforming reference build must be able to recover the exact 8×16 source bitmap from every generated GraphSCII outline without changing a pixel.

The reference build gate verifies every glyph, not only samples:

```text
canonical bitmap
      ↓
TrueType outline
      ↓
decode outline back to pixel grid
      ↓
exact 8×16 bitmap equality
```

The font compiler must also preserve the v1 PUA registry order, cmap coverage, deterministic metrics, deterministic metadata, and valid sfnt checksum.

The canonical bitmap registry remains authoritative if a rendering environment applies antialiasing or scaling that visually blurs the installed font.

---

## 12. Generated artifacts

The reference compiler emits:

```text
artifacts/fonts/GraphSCII-Regular.ttf
artifacts/fonts/manifest.json
```

The manifest records the source registry digest, resulting font digest, font names, metrics, glyph counts, provenance, and verification state.

A font file is a compiled artifact. It must not become an independent source of graphical truth that silently diverges from `graphscii-graphics-v1`.

---

## 13. Versioning and compatibility

This document describes the GraphSCII v1 graphical contract and the reference GraphSCII Regular font representation.

Compatible implementations may use different programming languages or font-generation software provided that they preserve the normative graphical identities and codepoint assignments they claim to implement.

A future version that changes an existing canonical bitmap at an existing GraphSCII codepoint is a compatibility-breaking change and must not be presented as the same frozen v1 vocabulary.

New semantic capabilities should prefer exact reuse, composition, or renderer-derived behavior before consuming additional encoded address space.

---

## 14. Licensing

Original GraphSCII material is publicly licensed for qualifying noncommercial use under **CC BY-NC-SA 4.0**, with separately negotiated permission available for commercial use.

Read:

- [`FONT-LICENSE.txt`](FONT-LICENSE.txt) — actual public licensing terms and commercial-permission boundary
- [`COMMERCIAL-LICENSE.md`](COMMERCIAL-LICENSE.md) — commercial licensing explanation
- [`INDIE-LICENSE.md`](INDIE-LICENSE.md) — friendly indie permission path
- [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) — public-domain printable ASCII provenance

The short version is:

> **Study it. Draw with it. Modify it. Share it.**  
> **Keep forks open.**  
> **Don't commercially exploit GraphSCII without permission.**  
> **Indies: just ask.**

---

## 15. Authorship

**GraphSCII — Graphical Standard for Computer Information Interchange**  
Created and designed by **Ariel Williams**.
