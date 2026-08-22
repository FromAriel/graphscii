# GRAPHSCII_MODE_PLAN — GraphSCII Encoding Mode for ASkyVideo

> **Status:** APPROVED AND ACTIVE — Phase 0 in progress
>
> **Host project:** ASkyVideo (`J:\pyproj\ASkyVideo`)
> **Upstream vocabulary:** GraphSCII / `geometric-glyph-lab` (`J:\WEB\graphscii`)
> **Companion doc:** `graphscii_CHECKLIST.md` (created after this plan is approved; ordered tasks only, never architecture)

This plan is **decision-complete**: where a value or rule is stated, it is the
decision. Where something is deliberately deferred, it is named as a seam in
§12 — never left silently open.

---

## 1. Project goals

1. Add a GraphSCII encoding mode to ASkyVideo that converts still images and
   video into `.asky` containers whose palettes carry GraphSCII PUA codepoints
   (`U+E000..U+F8FC`) rendered with `GraphSCII-Regular.ttf`.
2. Implement the two-channel model:
   - **STRUCTURE** — detected image edges become GraphSCII topology (straight /
     boundary-fill / connector glyphs snapped to the node graph);
   - **TONE** — per-cell luma quantized to the five legal states
     (blank, 25%, 50%, 75%, 100%).
3. Exploit the one-glyph boundary-fill semantics so a single character can mean
   "edge here, darker on this side, this density".
4. Reuse ASkyVideo's container (ASKYBIN1 v3), temporal machinery, workbench,
   web player, and CLI without format changes.
5. Remain deterministic end to end: identical input frames plus identical
   settings produce byte-identical `.asky` output.

## 2. Non-goals

1. No new GraphSCII codepoints; the BMP PUA allocation is closed.
2. No renderer-only tones (`dense`, `sparse`) in output — they have no
   codepoints.
3. No nearest-bitmap matching against the full 6,397-glyph vocabulary.
4. No changes to the `.asky` binary container format, the existing ASCII ramp
   libraries, `matcher.py`, `luma.py`, or `container.py` internals.
5. No Rust engine parity in Phases 0–4 (declared seam, §12).
6. No live/streaming capture; offline files only (matches ASkyVideo today).
7. No color, audio, or editing features.

## 3. Architectural direction

Two independent channels resolve per cell; a fixed-priority compositor merges
them into exactly one codepoint per cell.

```text
                    ┌──────────────────────────────┐
 decoded frame ────►│ STRUCTURE channel            │
 (cols*8 x          │  edge backend (swappable)    │
  rows*16 gray)     │  → contour tracing           │
                    │  → cell-crossing enumeration │
                    │  → port snapping + mates     │
                    │  → per-cell segment sets     │
                    └──────────────┬───────────────┘
                                   │
 decoded frame ────►┌──────────────▼───────────────┐
 (same buffer)      │ COMPOSITOR (fixed priority)  │──► one codepoint per cell
                    │  crossing > interior > blank │
                    └──────────────┬───────────────┘
                                   │
 decoded frame ────►┌──────────────┴───────────────┐
 (luma stats)       │ TONE channel                 │
                    │  normalize (black/white/gamma│
                    │   — existing machinery)      │
                    │  → per-cell level ∈ {ø,25,   │
                    │     50,75,100}               │
                    └──────────────────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │ PALETTE + CONTAINER EMIT     │
                    │ (existing writer, untouched) │
                    └──────────────────────────────┘
```

### 3.1 Module boundaries (new package `askyvideo/graphscii_mode/`)

| Module | Responsibility | Must never |
|---|---|---|
| `lookup_pack.py` | load + SHA-256-validate the frozen GraphSCII data pack; expose typed queries | derive codepoints from bitmaps |
| `settings.py` | dataclasses holding every tunable; named default constants | contain magic numbers elsewhere |
| `edges/backend.py` | `EdgeBackend` Protocol: `detect(gray) -> EdgeMap` | choose algorithms internally |
| `edges/sobel_thin.py` | first backend: Sobel magnitude + non-max thinning + hysteresis | know about cells/ports |
| `trace.py` | EdgeMap → polylines (contour walk, simplification tolerance) | snap to nodes |
| `nodesnap.py` | polylines → cell crossings → entry/exit ports → segments (mate rule across shared boundaries) | decide glyphs |
| `tone_quantizer.py` | cell luma means → level in `{blank,25,50,75,100}` (+ optional error-diffusion strategy) | know about glyphs |
| `cell_resolver.py` | segment sets → state keys → table/boundary-fill lookups; emits per-cell decisions + provenance counters | rasterize anything |
| `compositor.py` | fixed priority merge (crossing > interior > blank); contrast gate | search glyphs visually |
| `encoder.py` | orchestration: channels → decisions → palette → existing container writer | contain policy |

### 3.2 Data pack (frozen interface between the two repos)

```text
askyvideo/graphscii_data/
├── MANIFEST.json              schema version, graphscii commit ref, sha256 pins
├── straight_pairs.json        canonical pair → codepoint (both directions)
├── boundary_side_style.json   family/ports/side/tone → codepoint
├── tone_interiors.json        level → interior owner codepoint (see §5.4)
└── crossover_states.tsv       multi-segment states (Phase 3; may be absent in P0–P2)
GraphSCII-Regular.ttf          copied into package next to unscii ttf
```

### 3.3 Geometry contract

- All structure geometry runs on the standard decoded grayscale buffer
  (`cols*8 × rows*16`). Aspect correctness is a grid-dimension responsibility:
  aspect-matched dims (existing `--auto-cols`) keep shapes true; forced
  non-matched dims distort — documented CLI behavior, not corrected here.
- Port snapping reuses the demo's canonical rules: nearest legal port on the
  crossed edge, `Rk ↔ Lk` / `Bk ↔ Tk` mate identity, perpendicular corner
  ports stay distinct.
- Segment canonicalization mirrors the crossover system exactly: six family
  directions, dedupe, sort, `+`-joined state keys.

## 4. Source-of-truth boundaries

1. **Glyph/vocabulary truth lives only in the GraphSCII repository**
   (`artifacts/manifest/vocabulary-v1/`). ASkyVideo never re-derives codepoints,
   never edits pack contents, never regenerates them locally.
2. The data pack is produced exclusively by a new exporter script in
   `geometric-glyph-lab/scripts/`, committed to both repos, and pinned by
   SHA-256 in `MANIFEST.json`. A mismatch fails fast.
3. Any needed index/pack change is a GraphSCII-repo milestone (its own plan +
   verification); ASkyVideo then bumps the pack reference.
4. `askyvideo_plan.md` remains the host project's overall `_Plan` source of
   truth; this document owns only the GraphSCII mode feature.
5. Tunable values live in `settings.py` defaults; CLI flags override them;
   nothing else may introduce numerics.

## 5. Invariants (all phases, mechanically enforced)

1. **One codepoint per cell, always.** No layered overstrike anywhere.
2. **Closed vocabulary:** every emitted codepoint exists in the pinned pack;
   property-tested against `by-bitmap.json` membership.
3. **Never-empty tone floor:** a cell with no edge decision still receives its
   quantized tone (or blank); structure failure degrades to tone, never to a
   hole.
4. **Determinism:** same frames + settings + code version ⇒ byte-identical
   `.asky`. Integer/fixed-point arithmetic for all geometry snapping; sorted
   iteration everywhere; stable lexicographic tie-breaks; `PYTHONHASHSEED`
   independence verified.
5. **Regression equivalence:** with the structure channel disabled, output must
   be bit-identical to the Phase 1 tone-only encoder.
6. **Container compatibility:** every output parses with the current reader,
   `container-info`, and web player (given the font).
7. **Upstream purity:** frozen GraphSCII artifacts are immutable downstream;
   regeneration happens only in the lab, only through its own verify chains.

## 6. Tone model (decisions)

1. Levels are exactly: `blank`, `light(25)`, `half(50)`, `medium(75)`,
   `solid(100)` — five total. Dense/sparse are out of scope (see §2.2).
2. Band mapping operates on normalized luma (existing black/white point +
   gamma applied first). Default fixed cut-points between adjacent levels:
   `0.125, 0.375, 0.625, 0.875` (named constants; CLI-tunable later).
3. Optional spatial error diffusion of the *level choice* is a declared
   strategy interface (default off in Phase 1).
4. **Interior owner selection (decision-complete rule):** for each tone, the
   interior glyph is the published owner whose bitmap equals the full-cell
   dither mask for that tone (solid = all-set bitmap; medium/light/half from
   the frozen 8×8 masks tiled over the cell). Phase 0 asserts existence for
   all four; if any were absent, fallback = the lexicographically smallest
   `bitmapKey` owner of that canonical class, recorded explicitly in the pack.
5. Phase-locking is automatic: choosing levels per cell keeps every dither
   mask globally aligned across the whole image.

## 7. Structure model (decisions)

1. **Edge backends are pluggable** behind `EdgeBackend`; Phase 2 ships
   `sobel_thin` only. Backend output is a float strength map + boolean edge
   set; nothing downstream sees algorithm details.
2. **Minimum contrast gate:** a crossing earns a boundary-fill glyph only if
   `abs(meanLuma(sideA) − meanLuma(sideB)) >= min_contrast` (default `48`,
   scale 0..255). Below the gate the cell falls back to interior tone.
   This is how noise is prevented from claiming structure.
3. **Side semantics:** which side is "darker" derives from comparing the two
   half-cell means split by the segment's oriented cross product — the same
   orientation convention as the fill vocabulary. Reversed traversal
   directions canonicalize before lookup; both directions of a pair resolve
   identically.
4. **Multi-segment states:** two distinct segments → crossover-style lookup
   (pair table regenerated against *image-derived* demand in Phase 3).
   Three-plus distinct segments → explicit unresolved policy in Phases 2–3:
   fall back to interior tone, increment a provenance counter, surface the
   count in encode reports. Never approximate silently.
5. **Provenance:** every non-trivial decision (boundary-fill chosen, contrast
   gate rejected a crossing, unresolved fallback) increments counters exposed
   in the encode report — same philosophy as the crossover debug export.

## 8. Phases, boundaries, and gates

Each phase has hard entry conditions, deliverables, and exit gates with named
evidence. No phase begins before the previous phase's gates are green.

### Phase 0 — Lookup pack export + loader

**Entry:** both repos green on their full verify chains.
**Deliverables:** `generate-graphscii-lookup-pack.mjs` (lab scripts) emitting
the §3.2 pack; `verify-graphscii-lookup-pack.mjs`; `lookup_pack.py` loader
with strict validation; font copy staged; §5.4 interior-existence assertion.
**Exit gates:**
- G0.1 pack generation is byte-identical across two runs (sha256 logged).
- G0.2 loader rejects: bad manifest hash, unknown schema version, missing key
  file (unit tests enumerate each rejection).
- G0.3 sample lookups (≥20 pairs, all four tones, both fill sides of three
  families) agree with lab-side verifier outputs (golden fixture committed
  in both repos).
- G0.4 full lab verify chain green.

### Phase 1 — Tone-only encode path

**Entry:** Phase 0 gates green; host quality gate green
(black/ruff/mypy/unittest/build).
**Deliverables:** `graphscii_mode` package skeleton; tone quantizer; encoder
path wired as `--library graphscii` (structure off); palette emission; encode
report counters; minimal workbench preview support (font swap).
**Exit gates:**
- G1.1 unit tests: band mapping incl. black/white point + gamma interplay;
  blank handling; palette minimization interaction.
- G1.2 golden-file test: tiny synthetic PNG → expected `.asky` bytes hash.
- G1.3 determinism test: same image encoded twice → identical bytes; run under
  two `PYTHONHASHSEED` values.
- G1.4 regression-equivalence scaffold in place (structure flag exists, OFF).
- G1.5 visual evidence: side-by-side PNGs (unscii ramp vs graphscii-tone)
  committed under `tests/evidence/phase1/`.
- G1.6 performance baseline recorded (cells/sec, wall-clock, peak RSS) in
  `tests/evidence/perf-phase1.md`.

### Phase 2 — Structure overlay (edges)

**Entry:** Phase 1 green; benchmark image set curated (≥10 images: faces,
architecture, high/low contrast, flat regions).
**Deliverables:** `edges/` backend interface + `sobel_thin`; `trace.py`;
`nodesnap.py`; `cell_resolver.py` (pair-table + boundary-fill lookups);
contrast gate; compositor priority merge; unresolved-fallback policy;
`--structure` CLI flag (default off).
**Exit gates:**
- G2.1 synthetic fixtures: programmatically drawn line / diagonal / corner /
  circle decode to the expected port sequences (exact assertions, not vibes).
- G2.2 regression equivalence: `--structure` off reproduces Phase 1 bytes
  exactly on the full benchmark set.
- G2.3 property test: emitted codepoints ⊆ pack for every benchmark image.
- G2.4 contrast-gate unit tests: noisy flat region produces zero crossings.
- G2.5 visual evidence: structure-on vs tone-only comparisons committed;
  encode reports include structure counters.
- G2.6 determinism: two runs byte-identical on the full benchmark set.

### Phase 3 — Image-demand junction resolution

**Entry:** Phase 2 green; unresolved-rate statistics collected from Phase 2
benchmark corpus justify the work (documented threshold: proceed only if
multi-segment occurrences exceed 1% of crossing cells).
**Deliverables:** lab-side demand sweep script over traced corpora;
generalized `crossover_states.tsv` (pairs + triples if data demands);
resolver upgrade; verifier wiring into lab aggregate chain.
**Exit gates:**
- G3.1 regenerated table passes lab byte-regeneration + audit gates (reuse of
  Milestone 10A verifier pattern).
- G3.2 unresolved rate on benchmark corpus below declared budget (target <0.5%
  of crossing cells).
- G3.3 runtime lookup complexity remains O(1) per cell (no search introduced).

### Phase 4 — Video end-to-end, temporal, polish

**Entry:** Phase 3 green.
**Deliverables:** temporal hysteresis over final codepoints (reuse
`change_epsilon`/`temporal_weight` semantics); clip-level golden tests;
web player font toggle (`@font-face` GraphSCII option); workbench
side-by-side compare mode; perf pass (vectorized hot loops where profiled);
docs (README section, this plan's completion notes).
**Exit gates:**
- G4.1 flicker metric: mean per-frame cell-change count reduced vs Phase 3
  baseline on test clip (record actual %; gate = improvement, not a number
  picked in advance).
- G4.2 performance budgets recorded and met: encode wall-clock and peak RSS
  within ±10% of Phase 1 baseline per-cell cost (structure adds measured
  overhead, reported honestly).
- G4.3 full host quality gate green (black/ruff/mypy/unittest/build).
- G4.4 end-to-end: `encode-clip ba.mp4 out.asky.gz --library graphscii
  --structure` plays correctly in the web player with GraphSCII font.

### Phase 5 — Declared seams (NOT scheduled; interfaces only)

See §12.

## 9. Tests and evidence conventions

- Golden files live under `tests/evidence/` and are committed; regeneration
  is always byte-identical or the test fails loudly.
- Every gate above names its evidence artifact; "green" always means
  machine-checked, never eyeballed (visual evidence is committed *alongside*
  mechanical checks, never instead of them).
- Determinism tests run twice under different `PYTHONHASHSEED` values.
- Benchmark corpora are frozen files in-repo (small crops of existing media),
  never URLs.

## 10. Performance and correctness measurement protocols

| Metric | Tool | Cadence | Gate |
|---|---|---|---|
| Byte determinism | double-encode diff | every phase | required |
| Palette legality | property test vs pack | every phase | zero violations |
| Cells/sec + wall-clock + peak RSS | perf harness script | P1, P2, P4 | record; P4 budget ±10% |
| Compression | `.asky.gz` size vs baseline clip | every phase | record trend; no gate |
| Unresolved rate | encode-report counter | P2 onward | P3 threshold §G3.2 |
| Flicker | mean cell-change count/frame | P4 | improvement required |
| Visual quality | committed side-by-side evidence | P1 onward | reviewed at each gate |

Correctness protocol: every phase re-runs all prior gates (cumulative), so a
late change cannot silently break an earlier guarantee.

## 11. Known risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Edge tracer quality dominates final look | High | pluggable backend; sobel_thin is a starting point, not a commitment; XDoG/Canny are drop-ins |
| Noise creates fake structure | High | contrast gate (§7.2); gate value is data-driven, tuned in P2 |
| Palette bloat hurts RLE/delta compression | Medium | measure from P1; palette-min flags already exist; accept growth if player cost fine |
| Interior tone glyphs missing from vocabulary | Low (assert in P0) | §5.4 fallback rule, decided now |
| Busy scenes exceed pair coverage | Medium | explicit unresolved policy; P3 gated on measured demand (§G3 entry) |
| Temporal shimmer of structure channel | Medium | P4 hysteresis; contour-tracking seam if insufficient |
| Aspect distortion on forced grid dims | Certain if ignored | documented CLI contract; auto-cols recommended |
| Rust divergence | Deferred | Python is the oracle; parity phase compares bytes, not vibes |
| GraphSCII licensing for commercial use of outputs | Legal | noted: dual-license scheme requires compliance for commercial distribution; flagged for the project owner, not solved in code |

## 12. Future extension seams (interfaces reserved now)

1. `EdgeBackend` protocol: XDoG, Canny, learned edges arrive as new modules.
2. `DiffusionStrategy` protocol behind error diffusion (off by default).
3. Renderer-only tones (`dense`/`sparse`): pack schema reserves a section;
   usable only when a future graphics publication allocates codepoints.
4. Rust engine port: pure-function core (no I/O inside channels) keeps the
   port mechanical; Python output is the byte oracle.
5. Temporal contour tracking: `nodesnap` emits stable polyline IDs to make
   cross-frame correspondence possible without redesign.
6. Live capture: encoder consumes frame iterators already; no file assumptions
   inside channels.

## 13. Rules for adapting the two upstream codebases

**GraphSCII repo (vocabulary upstream):**
- Additive only: new exporter/verifier scripts; frozen artifacts never mutated.
- Any vocabulary/index need discovered during a phase becomes a small
  upstream milestone with its own verification — never patched downstream.
- Pack references move forward only; no rolling-your-own index variants.

**ASkyVideo (host):**
- `AGENTS.md` honored fully: backups before editing existing files, git
  read-only unless instructed, planning docs updated every turn.
- New code confined to `askyvideo/graphscii_mode/` + `graphscii_data/` +
  tests; existing modules gain only thin, reviewed integration points
  (CLI flag, workbench menu item, player font option).
- No network access at encode time; no global mutable state; `pathlib`
  everywhere; logging over print.

**Sequence discipline:** implementation order is exactly §8's phase order.
CHECKLIST tasks may parallelize *within* a phase, never across gates.

---

## 14. Execution summary

```text
P0  lookup pack export + validated loader            gates G0.*
P1  tone-only encode path (--library graphscii)      gates G1.*
P2  structure overlay (--structure)                  gates G2.*
P3  image-demand junction table                      gates G3.* (demand-gated)
P4  video E2E + temporal + polish                    gates G4.*
P5  seams only                                       unscheduled
```

Approval of this plan is the entry condition for writing
`graphscii_CHECKLIST.md`.
