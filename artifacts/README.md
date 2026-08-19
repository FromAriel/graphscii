# Generated GraphSCII Artifacts

This directory is reserved for reproducible outputs from the GraphSCII geometry generator.

Run from `geometric-glyph-lab/`:

```powershell
npm run generate
```

The command recreates the expanded artifact tree containing the JSON manifest, 746 exact ASCII glyph files, 746 native 8×16 PNG glyph files, and the complete/page atlases for the current straight-line vocabulary. It then verifies every artifact against a fresh regeneration.

Generated artifacts are products of the source generator. They may be committed when a durable snapshot is useful, but they are never the authoritative source of visual identity.

Current straight-line snapshot statistics are committed in `manifest/stats.json`.
