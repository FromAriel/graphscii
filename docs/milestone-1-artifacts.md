# Milestone 1 — Persistent Artifact Pipeline

Status: **implemented and locally verified**.

The artifact pipeline is independent of the browser UI and can regenerate the current straight-line vocabulary directly from the prebuilt deterministic geometry core.

From `geometric-glyph-lab/`:

```powershell
npm run generate
npm run verify:artifacts
```

The measured output is:

```text
mathematical candidates    832
unique glyphs              746
duplicate candidates        86
ASCII files                746
PNG files                  746
complete atlas          128×752
256-slot page atlases        3
```

Generated tree:

```text
artifacts/
├── manifest/
│   ├── glyphs.json
│   └── stats.json
├── glyphs/
│   ├── ascii/
│   │   └── U+00E000.txt ...
│   └── png/
│       └── U+00E000.png ...
└── atlases/
    ├── all.png
    ├── page-0.png
    ├── page-1.png
    └── page-2.png
```

The verifier checks every ASCII file against a fresh raster generation, checks all PNG dimensions, regenerates every PNG and requires byte-for-byte equality, checks the manifest baseline, and validates the full atlas dimensions.

Canonical per-glyph PNGs are 8×16 RGBA PNGs with opaque black filled pixels and transparent empty pixels.

The generator only replaces the managed generated subtrees (`manifest/`, `glyphs/`, and `atlases/`), preserving hand-maintained files such as `artifacts/README.md`.

The fully expanded artifact tree is reproducible and may be committed as a durable snapshot when useful; generated artifacts never supersede the geometry/raster source of truth.
