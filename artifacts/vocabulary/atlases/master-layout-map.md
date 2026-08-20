# GraphSCII master layout map

GraphSCII graphics use the full BMP Private Use Area as a deterministic address space. Printable ASCII remains at its normal Unicode positions and does not consume PUA slots.

| Segment | Unicode range | Count | Status |
| --- | --- | ---: | --- |
| Printable ASCII | `U+0020..U+007E` | 95 | normal Unicode, outside PUA |
| Straight | `U+E000..U+E2E9` | 746 | encoded |
| Solid 100% | `U+E2EA..U+E7D4` | 1,259 | encoded |
| Medium 75% | `U+E7D5..U+ECC9` | 1,269 | encoded |
| Light 25% | `U+ECCA..U+F1EC` | 1,315 | encoded |
| Half 50% | `U+F1ED..U+F6A3` | 1,207 | encoded |
| Reserve | `U+F6A4..U+F8FF` | 604 | **unallocated / protected** |

Encoded PUA graphics: **5,796**

Minimum physical font population when printable ASCII is included: **5,891 glyphs**.

Renderer-only semantics remain outside the PUA allocation: **3,392 aliases**, including **414 exact encoded reuses** and **2,978 derived aliases** across **2,555 unique derived bitmaps.

The master text atlas is intentionally ordered STRAIGHT → SOLID → MEDIUM → HALF → LIGHT for conceptual readability. The actual allocation range places LIGHT before HALF, as shown above; codepoints are authoritative.
