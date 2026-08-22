# GraphSCII

## Graphical Standard for Computer Information Interchange

**By Ariel Williams**

GraphSCII is a fixed-cell graphical character system for drawing with text-addressable 8×16 tiles.

Instead of treating characters only as letters, GraphSCII gives software a deterministic vocabulary of lines, filled geometry, tonal patterns, and connectors that can be placed next to one another to form larger graphics.

> **Study it. Draw with it. Modify it. Share it.**  
> **Keep forks open.**  
> **Don't commercially exploit it without permission.**  
> **Indies: just ask.**

The formal graphical contract is in [`GRAPHSCII-STANDARD.md`](GRAPHSCII-STANDARD.md).

## What is published

The current canonical graphical vocabulary is **`graphscii-graphics-v1.1`** (v1 plus one reserved-slot special).

```text
straight visual owners                 746
solid 100% visual owners             1,259
medium 75% visual owners             1,269
light 25% visual owners              1,316
half 50% visual owners               1,207
orthogonal connector owners            544
diagonal connector owners               57
interior tone special                    1
                                       -----
encoded PUA graphics                  6,398
```

The GraphSCII reference font also includes the 95 printable ASCII characters at `U+0020..U+007E`, giving **6,493 encoded characters** plus the mandatory `.notdef` font glyph.

The GraphSCII BMP PUA allocation now ends at `U+F8FD` (the `tone-interior:light` special, per [`docs/specials-light-interior-plan.md`](docs/specials-light-interior-plan.md)); `U+F8FE..U+F8FF` remains a protected two-slot reserve.

## The important design rule

Every canonical GraphSCII graphical owner is exactly one deterministic **8×16 binary bitmap**.

```text
semantic or mathematical definition
        ↓
deterministic 8×16 raster
        ↓
global exact bitmap deduplication
        ↓
one canonical visual owner
```

If two definitions produce exactly the same pixels, they share one encoded owner. GraphSCII does not spend a second codepoint on the same visual bitmap.

The machine-readable source of truth is:

```text
artifacts/manifest/vocabulary-v1/registry.json
```

The frozen publication manifest is:

```text
artifacts/publications/graphscii-graphics-v1.json
```

## The GraphSCII font

Milestone 9 adds a deterministic TrueType compiler that consumes the frozen v1 registry rather than independently redrawing the glyphs.

The reference output is:

```text
artifacts/fonts/GraphSCII-Regular.ttf
artifacts/fonts/manifest.json
```

Font identity:

```text
Family:          GraphSCII
Full name:       GraphSCII Regular
PostScript name: GraphSCII-Regular
Designer:        Ariel Williams
Standard:        Graphical Standard for Computer Information Interchange
```

The font uses a 1024-unit em, with each canonical bitmap pixel represented by an exact 64×64 font-unit square. Every generated glyph is decoded back from its TrueType outline during verification and compared against the source 8×16 bitmap.

That means the font is a compiled representation of the standard. **The registry remains the source of visual truth.**

## Build the font

From `geometric-glyph-lab/`:

```powershell
npm run generate:font
npm run verify:font
```

To regenerate and verify the entire GraphSCII artifact chain:

```powershell
npm run generate
npm run verify
```

The font build is dependency-free JavaScript and writes deterministic TTF bytes and a manifest containing the source-registry SHA-256, font SHA-256, glyph counts, metrics, provenance, and verification state.

## Licensing

GraphSCII uses a dual-path licensing approach.

### Noncommercial public use

Original GraphSCII material is licensed for qualifying noncommercial use under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International — CC BY-NC-SA 4.0**.

You can study it, draw with it, modify it, fork it, and share it subject to those terms. If you share an adaptation, the ShareAlike requirement keeps that shared adaptation under the same open noncommercial terms.

Read the actual terms and scope in [`FONT-LICENSE.txt`](FONT-LICENSE.txt).

### Commercial use

Commercial exploitation is **not** granted by the public CC BY-NC-SA license.

Businesses and commercial projects must obtain separate written permission from Ariel Williams. There is intentionally no universal fixed price; the commercial terms are negotiated around the real project and scale.

See [`COMMERCIAL-LICENSE.md`](COMMERCIAL-LICENSE.md).

### Indies

**Indies: just ask.**

If you are a solo developer, tiny team, hobbyist, small artist, game-jam creator, or early-stage project and the project is commercial, contact Ariel Williams and describe what you are making. The intended policy is friendly and will often be **free or low-cost** for genuinely small projects.

See [`INDIE-LICENSE.md`](INDIE-LICENSE.md).

### Printable ASCII provenance

The reference font's printable ASCII bitmaps are derived from public-domain IBM VGA-style 8×8 material distributed through `dhepper/font8x8`, then doubled vertically into GraphSCII's 8×16 cell.

That underlying public-domain material remains public domain. See [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

## Useful project documents

- [`GRAPHSCII-STANDARD.md`](GRAPHSCII-STANDARD.md) — the GraphSCII v1 graphical and font-facing standard
- [`FONT-LICENSE.txt`](FONT-LICENSE.txt) — actual noncommercial public-license terms and commercial boundary
- [`COMMERCIAL-LICENSE.md`](COMMERCIAL-LICENSE.md) — business/commercial licensing explanation
- [`INDIE-LICENSE.md`](INDIE-LICENSE.md) — friendly indie permission path
- [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) — public-domain ASCII provenance
- [`PLAN.md`](PLAN.md) — living architecture and roadmap
- [`docs/format.md`](docs/format.md) — canonical bitmap serialization details
- [`docs/connectivity.md`](docs/connectivity.md) — connectivity semantics

## The project in one sentence

**GraphSCII is a deterministic 8×16 graphical standard that lets programs interchange composable computer graphics as characters without losing the exact underlying pixel geometry.**
