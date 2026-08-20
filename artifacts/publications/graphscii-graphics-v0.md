# GraphSCII Graphics Vocabulary v0

Status: **provisional**

Publication ID: `graphscii-graphics-v0`

This snapshot freezes the first complete addressable GraphSCII graphics vocabulary. The canonical visual truth remains the 8×16 binary bitmap registry; this publication does not build a TTF/OTF.

## Encoded vocabulary

| Class | Encoded owners |
| --- | ---: |
| Straight | 746 |
| Solid 100% | 1,259 |
| Medium 75% | 1,269 |
| Light 25% | 1,315 |
| Half 50% | 1,207 |
| **Total encoded PUA graphics** | **5,796** |

Printable ASCII remains at `U+0020..U+007E` (95 characters), outside the PUA allocation. Minimum eventual font population with printable ASCII is **5,891 glyphs**.

## Address space

- Encoded: `U+00E000..U+00F6A3`
- Protected reserve: `U+00F6A4..U+00F8FF` — **604 slots**
- Published straight block: `U+00E000..U+00E2E9` — unchanged

## Renderer-only semantics

GraphSCII retains **3,392 renderer-only semantic aliases** without spending more PUA codepoints: **414 exact encoded reuses** and **2,978 derived aliases** across **2,555 globally unique derived bitmaps**. Dense 87.5% and sparse 12.5% remain renderer-capable, and all 64 demoted-half semantics preserve their Hamming-distance-1 fallback relation.

## Canonical publication artifacts

- Registry: `artifacts/manifest/vocabulary/registry.json`
- Registry stats: `artifacts/manifest/vocabulary/stats.json`
- Master text atlas: `artifacts/vocabulary/atlases/master-text-atlas.md`
- Master page atlas: `artifacts/vocabulary/atlases/master-page-atlas.md`
- Master layout map: `artifacts/vocabulary/atlases/master-layout-map.md`
- Renderer-only resolution index: `artifacts/vocabulary/renderer-only/index.json`
- Canonical ASCII glyphs: `artifacts/vocabulary/glyphs/ascii/`
- Canonical PNG glyphs: `artifacts/vocabulary/glyphs/png/`

## Reproducibility

Source baseline: `415e8a0b31b987f72ffd3677a8537acff3c245b2` (verified Milestone 4D.5 input baseline).

Generation: `cd geometric-glyph-lab && npm run generate`

Verification: `cd geometric-glyph-lab && npm run verify`

The publication manifest records SHA-256 digests of its canonical registry, statistics, renderer-only index, and master atlas views. The Milestone 4D.6 completion gate additionally deletes the generated 4D vocabulary outputs, regenerates them from source, and requires the complete project verifier to pass.
