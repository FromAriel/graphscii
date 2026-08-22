# Specials — Light Interior Tone Glyph (`graphscii-graphics-v1.1`)

> **Status:** COMPLETE — ALL SLICES EXECUTED AND VERIFIED
>
> **Authority:** amends [`GRAPHSCII_PLAN.md`](GRAPHSCII_PLAN.md) §5.4 behavior;
> permitted by root `PLAN.md` §9.2 ("final three slots … unless a tiny
> exceptional semantic is explicitly justified").

## 1. Justification

Phase 0 of the ASkyVideo integration discovered that the full-cell 25% light
dither mask has **no published owner**, so the lookup-pack fallback rule
selected a near-blank 4-pixel glyph as the "light" interior fill. Every
tone-mode image would carry that defect. A canonical interior tone glyph is a
tiny, permanent, fully-determined semantic — the textbook justified use of a
protected reserve slot.

## 2. The semantic (decision-complete)

```text
bitmapKey        55005500550055005500550055005500   (55 00 tiled ×8)
ink              32 / 128 px = exactly 25% nominal
phase-lock       identical in every cell (cell offsets mod 8 == 0)
glyphId          6397            (sequential continuation past 6396)
codepoint        U+F8FD          (first protected reserve slot)
canonicalClass   light-25
allocationStatus published-special-interior
semanticAliases  ["tone-interior:light"]
```

After allocation: encoded graphics 6,397 → **6,398**; protected reserve
3 → **2** (`U+F8FE..U+F8FF`). No other tone needs this — solid, medium, and
half interiors resolve to existing owners directly.

## 3. Publication strategy

New publication **`graphscii-graphics-v1.1`**, generated into
`artifacts/manifest/vocabulary-v1.1/` (registry + by-bitmap + by-codepoint +
copied connector-alias index) plus `artifacts/publications/graphscii-graphics-v1.1.json`
recording the base-v1 SHA-256 provenance. Frozen v0/v1 artifacts are never
mutated; v1 remains historical truth for its 6,397 owners.

Reachability note: `5500×8` cannot be formed as the union of two port-to-port
straight segments (only-even left-edge pixels), so crossover resolution output
is expected unchanged — verified empirically, never assumed.

## 4. Slices and gates

```text
S1  v1.1 publication generator + verifier                     COMPLETE WHEN:
      byte-determinism across two runs; new-owner fields exact;
      v1 files provably untouched (hash-pinned inside v1.1 publication);
      reserve accounting asserted (end U+F8FD, 2 slots).

S2  font recompile against v1.1 + doc sweep                   COMPLETE WHEN:
      TTF carries 6,494 sfnt glyphs incl .notdef; raster round-trip decodes
      the new glyph exactly; verify:font green; README / GRAPHSCII-STANDARD /
      root PLAN address-map counts swept (6,398 graphics · 6,493 chars ·
      font SHA recorded).

S3  downstream bumps                                          COMPLETE WHEN:
      lab crossover scripts read v1.1 and pass with pinned fixtures intact
      (proving Tier 0 unchanged); demo compositor index URL + entryCount =
      6398; CI workflow checks updated; npm lookup-pack verifier green.

S4  host sync                                                 COMPLETE WHEN:
      mirrored pack regenerated into askyvideo/graphscii_data with
      interiorFallbacks == []; loader goldens assert light fallback:false;
      full unittest suite green.
```

## 5. Non-goals

No speculative allocation of the remaining two slots; no container/demo logic
changes; no mutation of any frozen v0/v1 artifact; no new tone levels.

## 6. Decisions (recorded)

| # | Decision |
|---|---|
| D1 | Alias grammar: `tone-interior:light` |
| D2 | Publication: `graphscii-graphics-v1.1`, full regeneration layout |
| D3 | Slot order: lowest-first (`U+F8FD`) |
| D4 | Public docs updated immediately, not deferred to release freeze |
| D5 | Crossover table: verify-only first; rewrite only if bytes change |
| D6 | New `allocationStatus`: `published-special-interior` |
