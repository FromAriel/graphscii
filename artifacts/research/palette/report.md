# GraphSCII Milestone 4C — BMP PUA Palette Decision

Status: **DECISION COMPLETE — CODEPOINT PUBLICATION DEFERRED TO 4D**

## Decision

Encode four tonal levels:

```text
solid      100%
medium      75%
half        50%
light       25%
```

Keep `dense` (87.5%) and `sparse` (12.5%) as renderer-only semantic styles. They may still resolve to an encoded codepoint whenever their exact raster already has an encoded owner.

The 50% level uses a phase-locked checkerboard. Exact materialization of the four selected levels would require 5,858 PUA graphics. To preserve the 5,800 target, a deterministic compression rule leaves the 62 globally novel 50% visual owners that are exactly one pixel from an already-encoded straight/solid/75%/25% visual as renderer-only. Those 62 owners cover 64 semantic definitions.

```text
exact selected four-level visuals       5,858
one-pixel 50% owners renderer-only         62
encoded GraphSCII PUA graphics          5,796
BMP PUA reserve                           604
printable ASCII outside PUA                 95
physical glyphs incl. printable ASCII    5,891
```

## Planned PUA layout

| Family | Count | Start | End |
|---|---:|---:|---:|
| straight | 746 | U+00E000 | U+00E2E9 |
| solid | 1259 | U+00E2EA | U+00E7D4 |
| medium | 1269 | U+00E7D5 | U+00ECC9 |
| light | 1315 | U+00ECCA | U+00F1EC |
| half | 1207 | U+00F1ED | U+00F6A3 |
| reserve | 604 | U+00F6A4 | U+00F8FF |

These are planned ranges only. Milestone 4C does not assign new fill/dither codepoints; Milestone 4D performs publication/allocation.

## Four-style exact candidates

| Styles | Exact visuals | PUA reserve | Target ≤5800 | Max density gap | Gap spread |
|---|---:|---:|---:|---:|---:|
| solid / dense / medium / half | 5780 | 620 | yes | 0.250 | 0.125 |
| solid / dense / medium / sparse | 5788 | 612 | yes | 0.625 | 0.500 |
| solid / dense / medium / light | 5793 | 607 | yes | 0.500 | 0.375 |
| solid / dense / light / sparse | 5845 | 555 | no | 0.625 | 0.500 |
| solid / dense / half / light | 5855 | 545 | no | 0.375 | 0.250 |
| solid / medium / half / light | 5858 | 542 | no | 0.250 | 0.000 |
| solid / medium / light / sparse | 5878 | 522 | no | 0.500 | 0.375 |
| solid / dense / half / sparse | 5880 | 520 | no | 0.375 | 0.250 |
| solid / medium / half / sparse | 5883 | 517 | no | 0.375 | 0.125 |
| solid / half / light / sparse | 5922 | 478 | no | 0.500 | 0.375 |

## Why this palette

`100% / 75% / 50% / 25%` is the only evaluated four-level palette with exact quarter-step spacing across the main tonal range. The exact union is only 58 visuals above the 5,800 target. The one-pixel-near compression rule removes 62 low-distinctiveness 50% owners, reaching 5,796 encoded graphics and leaving 604 BMP PUA slots reserved.

Standard printable ASCII remains at U+0020..U+007E and consumes zero PUA slots.

## Renderer contract

The semantic vocabulary remains richer than the encoded font. Dense, sparse, and the 62 demoted 50% visual owners remain reproducible from mathematical boundary + side + phase-locked mask. If a renderer-only semantic raster exactly matches an encoded owner, use that existing codepoint; otherwise generate the bitmap through the renderer rather than allocating another PUA character.

