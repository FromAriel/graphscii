# Milestone 4D.6 — GraphSCII Graphics Vocabulary v0 Publication

Status: **COMPLETE — FRESH-BUILD VERIFIED, BYTE-STABLE, AND PUBLISHED ON THE FEATURE BRANCH**

Milestone 4D.6 freezes the complete Milestone 4D graphics vocabulary as the deterministic `graphscii-graphics-v0` publication snapshot.

No additional graphics were introduced in this slice. The publication records and verifies the vocabulary produced by Milestones 4D.1 through 4D.5.

## Publication outputs

```text
artifacts/publications/
├── straight-v0.json
├── graphscii-graphics-v0.json
└── graphscii-graphics-v0.md
```

The publication generator and verifier are permanent pipeline components:

```powershell
npm run generate:graphics-publication
npm run verify:graphics-publication
```

Both are included in the aggregate `npm run generate` and `npm run verify` commands.

## Frozen publication population

```text
encoded PUA graphics                         5,796
printable ASCII characters                     95
minimum eventual physical glyph population   5,891
semantic aliases                            10,816

renderer-only semantic aliases               3,392
  exact encoded reuses                         414
  derived aliases                            2,978
  globally unique derived bitmaps            2,555

protected BMP PUA reserve                      604
```

Canonical encoded classes remain:

```text
straight                                      746
solid 100%                                  1,259
medium 75%                                 1,269
light 25%                                  1,315
half 50%                                   1,207
                                           -----
total                                      5,796
```

## Frozen address space

```text
U+E000..U+E2E9      746   published straight visuals
U+E2EA..U+E7D4    1,259   solid 100%
U+E7D5..U+ECC9    1,269   medium 75%
U+ECCA..U+F1EC    1,315   light 25%
U+F1ED..U+F6A3    1,207   retained half 50%
U+F6A4..U+F8FF      604   unallocated protected reserve
```

The original 746 straight codepoints remain unchanged.

## Publication integrity record

`graphscii-graphics-v0.json` records SHA-256 digests for:

```text
canonical vocabulary registry
vocabulary statistics
renderer-only resolution index
categorized atlas statistics
master text atlas
master page atlas
master layout map
```

The source baseline is the verified Milestone 4D.5 commit `415e8a0b31b987f72ffd3677a8537acff3c245b2`. Keeping the baseline fixed makes the publication output reproducible rather than allowing the manifest to rewrite itself with every later repository commit.

## Fresh-build gate

The temporary Milestone 4D.6 verification workflow performed two complete generation passes.

First it ran:

```text
npm run check
npm run generate
npm run verify
```

It then recorded SHA-256 hashes for the entire generated Milestone 4D vocabulary tree and the two publication files, deleted the generated 4D registry, glyph, atlas, renderer-only, and `graphscii-graphics-v0` outputs, and ran a second complete generation and verification pass.

The before/after digest sets were required to be byte-identical. The workflow also required no drift in the previously committed Milestone 4D outputs before publishing the snapshot.

The publication snapshot was committed only after those gates passed.

## Result

Milestone 4D is complete.

GraphSCII now has a deterministic, addressable, publication-facing graphics vocabulary with:

- one global 5,796-owner encoded registry;
- exact 8×16 ASCII and PNG artifacts for every encoded owner;
- categorized and combined visual/text atlases;
- the master categorized text atlas and codepoint page atlas;
- explicit renderer-only resolution for dense, sparse, and demoted-half semantics;
- a protected 604-slot BMP PUA reserve; and
- the reproducible `graphscii-graphics-v0` publication manifest.

The next milestone is **Milestone 5 — junction vocabulary and reserve-budget strategy**. Any future use of the 604-slot reserve must be measured and explicitly promoted rather than silently allocated.
