# Milestone 5C — Connector Allocation and v1 Integration

Status: **COMPLETE — FULL-CHAIN VERIFIED**

Milestone 5C turns the measured generic connector basis into a provisional addressable extension without rewriting the frozen `graphscii-graphics-v0` publication.

Verified inputs and allocation:

```text
graphics-v0 owners                  5,796
novel orthogonal connector owners     544
novel selected diagonal owners         57
novel connector owners total          601
selected connector semantics           700
v1 encoded owners total              6,397
```

Provisional v1 address map:

```text
U+E000..U+F6A3    5,796   unchanged graphics-v0 owners
U+F6A4..U+F8FC      601   generic connector owners
U+F8FD..U+F8FF        3   final protected reserve
```

The extension preserves glyph IDs `0..5795` and all existing codepoints/bitmaps unchanged. New connector glyph IDs are `5796..6396` and are assigned in deterministic semantic-rule order: orthogonal basis first, followed by the selected diagonal basis. Exact bitmap reuse remains global and costs no new codepoint.

Persistent generated outputs:

```text
artifacts/manifest/vocabulary-v1/
├── registry.json
├── semantics.json
├── stats.json
├── report.md
└── indexes/
    ├── by-codepoint.json
    ├── by-bitmap.json
    └── by-connector-alias.json

artifacts/vocabulary/connectors/glyphs/
├── ascii/    601 files
└── png/      601 files

artifacts/vocabulary/atlases/connectors/
├── index.json
├── page-00.png / page-00.md
├── page-01.png / page-01.md
└── page-02.png / page-02.md

artifacts/vocabulary/atlases/master-layout-map-v1.md
spec/generic-connector-allocation-v1.json
```

Permanent commands:

```text
npm run generate:connector-allocation
npm run verify:connector-allocation
```

The complete project `check → generate → verify` chain passed before the generated allocation registry, 1,202 per-glyph connector artifacts, and three paged connector atlases were committed. The deterministic generated artifact commit is `f252a57efb94526e42d7bfd72d65854f2ae756d8`.

Milestone 5C therefore freezes the provisional connector allocation at **601 new owners**, with exactly **3 BMP PUA slots remaining**. The next slice is publication/update work: fold the v1 extension into the formal graphics publication and reserve accounting without renumbering any existing owner.
