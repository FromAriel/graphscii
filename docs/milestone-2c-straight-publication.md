# Milestone 2C — Straight Vocabulary Publication Snapshot

Status: **COMPLETE**.

Milestone 2C publishes the complete provisional straight-line vocabulary as a durable repository snapshot rather than leaving the expanded tree only as a reproducible local build.

## Publication identity

```text
publication       straight-v0
source commit     791a0a2175b888ee24061ed92a0d31eaf3342fdc
snapshot commit   5806d99d73ab635bdbd0b1ff661ed810aeaa995d
status            provisional
cell              8×16
glyphs            746
aliases           832
Unicode           U+00E000..U+00E2E9
```

The machine-readable provenance record is:

```text
artifacts/publications/straight-v0.json
```

## Published tree

The snapshot includes:

```text
artifacts/
├── manifest/
│   ├── glyphs.json
│   ├── stats.json
│   └── indexes/
│       ├── by-codepoint.json
│       ├── by-bitmap.json
│       ├── by-port.json
│       └── by-connection-pair.json
├── glyphs/
│   ├── ascii/
│   │   └── 746 × U+00E000.txt ... U+00E2E9.txt
│   └── png/
│       └── 746 × U+00E000.png ... U+00E2E9.png
├── classes/
│   └── straight-lines.md
├── atlases/
│   ├── all.png
│   ├── page-0.png
│   ├── page-1.png
│   └── page-2.png
└── publications/
    └── straight-v0.json
```

The class catalog is 515,888 bytes and contains all 746 visual glyph entries and all 832 mathematical aliases.

## Reproduction

From `geometric-glyph-lab/`:

```powershell
npm run generate
npm run verify
```

The snapshot was generated and verified on GitHub Actions before being committed. The publication workflow additionally required exactly 746 ASCII files, exactly 746 PNG files, all four semantic lookup indexes, the complete class catalog, and all four atlas files before allowing the snapshot commit.

Publisher workflow:

```text
.github/workflows/publish-straight-snapshot.yml
```

The generated artifact commit only changes `artifacts/`, so it does not recursively trigger the publisher again.

## Stability

`straight-v0` is a **provisional research publication**, not the GraphSCII v1 API freeze. Its purpose is to provide a concrete, inspectable, program-consumable baseline while later shape classes are developed and the final 4K vocabulary is optimized.

The source geometry and deterministic rasterizer remain authoritative. The committed snapshot is a verified derivative of that source.
