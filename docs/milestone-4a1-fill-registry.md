# Milestone 4A.1 — Persistent Straight-Fill Registry

Status: **COMPLETE — GENERATED, INDEXED, AND VERIFIED; NO NEW FILL CODEPOINTS ALLOCATED**

Milestone 4A proved that the 832 mathematical straight definitions produce 1,664 solid side-fill semantics and 1,259 genuinely new fill visuals after global exact deduplication. Milestone 4A.1 turns that research result into persistent machine-readable data.

## Generated registry

`npm run generate` now includes a fill-registry stage and writes:

```text
artifacts/manifest/fills/
├── registry.json
├── stats.json
└── indexes/
    ├── by-alias.json
    ├── by-bitmap.json
    ├── by-boundary-side.json
    ├── by-owner.json
    └── by-straight-candidate.json
```

The registry is regenerated deterministically from the existing 832 straight mathematical definitions and the Milestone 4A fill algorithm.

## Registry counts

```text
straight mathematical definitions       832
semantic solid fills                   1,664
unique fill rasters                    1,347

fill candidates reusing a straight       100
straight visuals reused                   88
fill candidates reusing earlier fill     305
new fill visual owners                 1,259

published straight visuals               746
combined straight + solid visuals      2,005
```

Lookup counts:

```text
by-alias                 1,664
by-bitmap                1,347
by-boundary-side         1,664
by-straight-candidate      832
by-owner                 1,347
```

## Semantic candidate records

Every one of the 1,664 fill semantics persists independently, even when its raster reuses another visual.

Each candidate includes:

```text
fillCandidateId
straightCandidateId
type = straight-fill
style = solid
family
start / end ports
side = A | B
aliasKey
boundarySideKey
canonical bitmap
visualDisposition
visual owner
```

Visual disposition is one of:

```text
reuse-existing-straight
reuse-existing-fill
new-fill-unallocated
```

If a fill exactly matches a published straight glyph, its owner points to that existing glyph ID and Unicode codepoint.

If a fill matches an earlier novel fill raster, it points to that fill visual ID.

A genuinely new fill visual receives a deterministic research `fillVisualId`, but no glyph ID or Unicode codepoint yet.

## Allocation contract

All 1,259 novel fill visuals remain:

```text
allocationStatus = unallocated-research
glyphId           = null
codepoint          = null
```

The first unused provisional codepoint remains `U+00E2EA`, but Milestone 4A.1 does not consume it.

Unicode allocation remains deferred until the Milestone 4C palette/address-space decision after the dither experiment.

## Index contracts

### `by-alias.json`

Maps the complete semantic alias, for example:

```text
straight-fill:LR:L0>R0:sideA:solid
```

to one `fillCandidateId`.

### `by-bitmap.json`

Maps each canonical 32-character bitmap key to:

```text
visual owner
all fillCandidateIds sharing those pixels
```

This is the global visual-dedup lookup for fill semantics.

### `by-boundary-side.json`

Maps:

```text
FAMILY:START>END:sideA|sideB
```

to the corresponding fill candidate.

### `by-straight-candidate.json`

Maps each of the 832 source straight candidate IDs to:

```json
{
  "A": "fillCandidateId",
  "B": "fillCandidateId"
}
```

This is the direct bridge from a mathematical boundary to its two solid regions.

### `by-owner.json`

Maps canonical visual ownership keys:

```text
straight-glyph:ID
fill-visual:ID
```

to every semantic fill candidate rendered by that visual.

## Commands

From `geometric-glyph-lab/`:

```powershell
npm run generate:fills
npm run verify:fill-registry
```

The normal project commands now include the registry automatically:

```powershell
npm run generate
npm run verify
```

## Verification

The verifier regenerates the registry and all five indexes from source and requires structural byte-equivalent JSON data after parsing. It freezes the Milestone 4A counts, checks every alias/boundary/bitmap/source-boundary lookup, and rejects any accidental Unicode allocation for research fill visuals.

The feature-branch GitHub Actions run completed `npm run generate` and the full `npm run verify` before committing the generated registry artifacts.

## Next

Milestone 4B applies the phase-locked dither palette to the same 1,664 underlying side-fill semantics.

The persistent fill registry is now the semantic foundation for that work, but dither generation must still begin from the mathematical boundary + side region, not from a deduplicated solid bitmap.
