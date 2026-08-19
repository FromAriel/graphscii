# Generated GraphSCII Artifacts

This directory is reserved for reproducible outputs from the GraphSCII geometry generator.

Run from `geometric-glyph-lab/`:

```powershell
npm run generate
```

The command recreates the expanded base artifact tree and then enriches it with the straight-line semantic registry.

The generated tree contains:

- `manifest/glyphs.json` — complete glyph, alias, allocation, and connectivity metadata
- `manifest/stats.json` — regression and lookup statistics
- `manifest/indexes/by-codepoint.json`
- `manifest/indexes/by-bitmap.json`
- `manifest/indexes/by-port.json`
- `manifest/indexes/by-connection-pair.json`
- 746 exact ASCII glyph files
- 746 native 8×16 PNG glyph files
- complete/page atlases for the current straight-line vocabulary

Use:

```powershell
npm run verify
```

for the full format + artifact + semantic-registry verification suite.

Generated artifacts are products of the source generator. They may be committed when a durable snapshot is useful, but they are never the authoritative source of visual identity.

The provisional straight allocation is hand-maintained in `../spec/straight-allocation.json`. The current codepoint range is `U+00E000..U+00E2E9`; those assignments remain provisional until the GraphSCII v1 freeze.

Reference straight-line snapshot statistics and atlases are committed here. The larger manifest/index/per-glyph tree remains reproducibly generated on demand until a deliberate publication snapshot is made.
