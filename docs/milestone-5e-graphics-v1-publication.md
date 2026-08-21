# Milestone 5E — GraphSCII Graphics Vocabulary v1 Publication

Status: **IN IMPLEMENTATION — PUBLICATION GATE NEXT**

Milestone 5E turns the verified Milestone 5C connector allocation into the formal `graphscii-graphics-v1` publication snapshot.

## Frozen inputs

```text
graphics-v0 owners                    5,796
new generic connector owners            601
-------------------------------------------
v1 encoded PUA graphics               6,397

base semantic aliases                10,816
connector semantic aliases              700
-------------------------------------------
combined addressable semantics       11,516

printable ASCII                          95
minimum eventual physical glyphs       6,492
```

The previous 5,796 owner identities remain immutable. Connector owners occupy the contiguous extension selected in Milestone 5C.

## Final address map

```text
U+E000..U+E2E9      746   straight
U+E2EA..U+E7D4    1,259   solid 100%
U+E7D5..U+ECC9    1,269   medium 75%
U+ECCA..U+F1EC    1,315   light 25%
U+F1ED..U+F6A3    1,207   half 50%
U+F6A4..U+F8FC      601   generic connectors
U+F8FD..U+F8FF        3   protected reserve
```

The final reserve is exactly three BMP PUA slots.

## Publication outputs

Milestone 5E adds:

```text
artifacts/publications/
├── graphscii-graphics-v1.json
└── graphscii-graphics-v1.md
```

The publication manifest freezes:

- v1 owner count and canonical class counts,
- connector owner and semantic counts,
- final allocation boundaries,
- final three-slot reserve,
- inherited renderer-only semantic counts,
- canonical artifact counts,
- SHA-256 digests of the v1 registry, allocation stats, connector semantics, connector alias index, connector atlas index, v1 master layout map, allocation spec, inherited renderer-only index, and `graphscii-graphics-v0` publication.

## Permanent commands

```text
npm run generate:graphics-publication-v1
npm run verify:graphics-publication-v1
```

Both commands are part of the aggregate `npm run generate` / `npm run verify` chain.

## Completion gate

Milestone 5E is complete only when a clean CI checkout passes:

```text
npm install
npm run check
npm run generate
npm run verify
```

and the generated `graphscii-graphics-v1.json` and `.md` are committed byte-for-byte from that verified run.

Hard publication fixtures:

```text
encoded graphics                    6,397
connector owners                      601
connector semantic aliases            700
combined semantic aliases           11,516
minimum physical glyphs              6,492
last allocated codepoint          U+F8FC
reserve                           U+F8FD..U+F8FF
reserve slots                            3
straight codepoints unchanged          YES
```

No TTF/OTF is built in this milestone. The publication freezes the complete addressable bitmap vocabulary that a later font-build milestone will consume.
