# GraphSCII Graphics Vocabulary v1

Status: **provisional**

Publication ID: `graphscii-graphics-v1`

Base publication: `graphscii-graphics-v0`

This snapshot extends the frozen graphics-v0 bitmap vocabulary with the final deterministic generic connector basis. It still defines an addressable 8×16 graphics vocabulary rather than a TTF/OTF font.

## Encoded vocabulary

| Class | Encoded owners |
| --- | ---: |
| Straight | 746 |
| Solid 100% | 1,259 |
| Medium 75% | 1,269 |
| Light 25% | 1,315 |
| Half 50% | 1,207 |
| Orthogonal connectors | 544 |
| Diagonal connectors | 57 |
| **Total encoded PUA graphics** | **6,397** |

Printable ASCII remains at `U+0020..U+007E` (95 characters), outside the PUA allocation. Minimum eventual font population with printable ASCII is **6,492 glyphs**.

## Generic connector language

The encoded connector extension contains **601 novel visual owners** resolving **700 deterministic connector semantics**. Exact bitmap reuse is global, so semantic aliases may resolve to pre-existing graphics without consuming another codepoint.

## Address space

- Encoded: `U+00E000..U+00F8FC`
- Connector block: `U+00F6A4..U+00F8FC` — **601 owners**
- Final protected reserve: `U+00F8FD..U+00F8FF` — **3 slots**
- Published straight block: `U+00E000..U+00E2E9` — unchanged

## Semantic population

- graphics-v0 semantic aliases: **10,816**
- connector semantic aliases: **700**
- combined addressable semantic aliases: **11,516**
- inherited renderer-only semantic aliases: **3,392**

## Canonical publication artifacts

- v1 registry: `artifacts/manifest/vocabulary-v1/registry.json`
- v1 registry stats: `artifacts/manifest/vocabulary-v1/stats.json`
- v1 connector semantics: `artifacts/manifest/vocabulary-v1/semantics.json`
- connector alias index: `artifacts/manifest/vocabulary-v1/indexes/by-connector-alias.json`
- connector glyph artifacts: `artifacts/vocabulary/connectors/glyphs/`
- connector atlas index: `artifacts/vocabulary/atlases/connectors/index.json`
- v1 layout map: `artifacts/vocabulary/atlases/master-layout-map-v1.md`
- allocation spec: `spec/generic-connector-allocation-v1.json`

## Reproducibility

Verified Milestone 5C source baseline: `f252a57efb94526e42d7bfd72d65854f2ae756d8`.

Generation: `cd geometric-glyph-lab && npm run generate`

Verification: `cd geometric-glyph-lab && npm run verify`

The manifest freezes SHA-256 digests for the v1 registry, stats, semantics, connector alias index, connector atlas index, v1 layout map, allocation spec, inherited renderer-only index, and base graphics-v0 publication.
