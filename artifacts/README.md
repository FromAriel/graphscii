# Generated GraphSCII Artifacts

This directory is reserved for reproducible outputs from the GraphSCII geometry generator.

Run from `geometric-glyph-lab/`:

```powershell
npm run generate
```

The command now runs three deterministic stages:

```text
base bitmap/artifact generation
            ↓
straight semantic registry/index generation
            ↓
straight-line Markdown catalog generation
```

The generated tree contains:

- `manifest/glyphs.json` — complete glyph, alias, allocation, and connectivity metadata
- `manifest/stats.json` — regression, lookup, and catalog statistics
- `manifest/indexes/by-codepoint.json`
- `manifest/indexes/by-bitmap.json`
- `manifest/indexes/by-port.json`
- `manifest/indexes/by-connection-pair.json`
- `classes/straight-lines.md` — all 746 visual glyphs with exact inline ASCII and all 832 aliases
- 746 exact ASCII glyph files
- 746 native 8×16 PNG glyph files
- complete/page atlases for the current straight-line vocabulary

Use:

```powershell
npm run verify
```

for the full format + artifact + semantic-registry + catalog verification suite.

The straight catalog is generated, never hand-edited. `npm run verify:catalog` regenerates the expected Markdown in memory and requires byte-for-byte equality, while also checking all 746 glyph headings and all 832 alias records.

Generated artifacts are products of the source generator. They may be committed when a durable snapshot is useful, but they are never the authoritative source of visual identity.

The provisional straight allocation is hand-maintained in `../spec/straight-allocation.json`. The current codepoint range is `U+00E000..U+00E2E9`; those assignments remain provisional until the GraphSCII v1 freeze.

Reference straight-line snapshot statistics and atlases are committed here. The complete manifest/index/per-glyph/catalog snapshot is reserved for the deliberate Milestone 2C publication commit.
