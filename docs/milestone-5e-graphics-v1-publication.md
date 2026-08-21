# Milestone 5E — GraphSCII Graphics Vocabulary v1 Publication

Status: **COMPLETE — FULL-CHAIN VERIFIED AND PUBLISHED**

Milestone 5E turns the verified Milestone 5C connector allocation into the formal `graphscii-graphics-v1` publication snapshot.

## Frozen population

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

Frozen publication digests:

```text
registry                      92ce5ff5a2b8d9b3a9e4d6aff26278cb69b23df459ec8406e04477afeb61103f
registry stats                0b6e298de0a6884150be0b1770c0c62216ed126a7ccd1e7309709bdd35145262
connector semantics           9ad365584304c0bc249317fc784fc4568d7152ce1803f5c0166b288d56c39d2c
connector alias index         78a7a0715be567675b1fe4e1a5516d6f99ec6daebb9b7711159f32e5aedf88d6
connector atlas index         09bdead08785f43c36b4b9f5b80043c86ae4a9597cde43e58385dd0d6c9dcd01
master layout map v1          cdc79f85f1541ad04eab8b62448f2f6ae7439e2dccb45271225b3f3bcf6aa911
allocation spec               d51b9640c40e333c5c8507e6985cf22581feaa932ed602eb36a67bf3e7582a92
renderer-only index           df36d6bde741976714b27ac3cec286680d83a5a03dc782c3820ff115c87dcdd1
base graphics-v0 publication  c935284d0f9873416ae835f60dc7754692cafc3e58dcc0a4fa8f7c8c760add81
```

## Permanent commands

```text
npm run generate:graphics-publication-v1
npm run verify:graphics-publication-v1
```

Both commands are part of the aggregate `npm run generate` / `npm run verify` chain.

## Verification result

The clean CI checkout passed:

```text
npm install
npm run check
npm run generate
npm run verify
```

The full-chain verification run was GitHub Actions run `32453875746`. The persisted source correction was then regenerated successfully and the deterministic publication artifacts were committed as:

```text
e9d3106f655ffb83850712b8af94d0f68c530a00  Publish GraphSCII graphics vocabulary v1
```

Hard publication fixtures are therefore frozen as:

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

No TTF/OTF is built in this milestone. `graphscii-graphics-v1` freezes the complete addressable bitmap vocabulary that the later font-build milestone will consume.
