# GraphSCII — Living Project Plan

> **Status:** Active project memory and roadmap.
>
> **Repository:** `FromAriel/graphscii`
>
> **Implementation:** `geometric-glyph-lab/`
>
> **Canonical cell:** **8 columns × 16 rows**
>
> **Current published bitmap vocabulary:** `graphscii-graphics-v1`

The original long-form plan is preserved at [`docs/PLAN-v0.md`](docs/PLAN-v0.md). Detailed milestone plans, research reports, and completion notes remain under `docs/` and `artifacts/`.

---

## 1. Core contract

GraphSCII is a fixed-cell graphics language encoded as Unicode glyphs and machine-readable tile data.

Every canonical visual is one deterministic **8×16 binary bitmap**.

```text
width  = 8 pixels
height = 16 pixels
x = 0..7   left → right
y = 0..15  top → bottom
```

Boundary ports:

```text
T0..T7
B0..B7
L0..L15
R0..R15
```

Bitmap identity is 16 row bytes, top-to-bottom, with `x=0` as bit 0, serialized as 32 lowercase hexadecimal characters.

Global ownership rule:

> **One bitmap key gets at most one canonical glyph/codepoint.**

Different mathematical or semantic definitions may alias the same owner when they rasterize identically. Exact bitmap reuse is global across every encoded family.

Normative format details: [`docs/format.md`](docs/format.md).

---

## 2. Straight vocabulary — COMPLETE AND PUBLISHED

Frozen straight language:

```text
mathematical straight definitions    832
unique straight visual owners        746
duplicate definitions                 86
maximum aliases                        4
```

Published allocation:

```text
glyph IDs    0..745
Unicode      U+E000..U+E2E9
```

The 832 mathematical definitions remain authoritative input for derived geometry even when multiple definitions share one raster owner.

---

## 3. Curve research — PRESERVED, EXPANSION PAUSED

Milestone 3A produced the deterministic cubic Bézier curve engine and explorer. The broad curve sweep demonstrated severe address-space pressure, so curves are preserved as research rather than included in the current encoded vocabulary.

References:

- [`docs/milestone-3-curve-plan.md`](docs/milestone-3-curve-plan.md)
- [`docs/milestone-3a-curve-engine.md`](docs/milestone-3a-curve-engine.md)

Future curve work must be curated rather than exhaustive.

---

## 4. Fill and tonal vocabulary — COMPLETE

The selected encoded tonal palette is:

```text
solid      100%
medium      75%
half        50%
light       25%
```

Dense 87.5% and sparse 12.5% remain renderer-only semantic styles.

The selected graphics-v0 population was:

```text
straight                              746
solid                               1,259
75% medium                          1,269
25% light                           1,315
50% half retained                  1,207
                                    -----
encoded graphics-v0                5,796
```

Renderer-only layer:

```text
semantic aliases                    3,392
exact encoded reuses                  414
derived aliases                     2,978
unique derived bitmaps              2,555
encoded codepoints consumed             0
```

Completion/publication references:

- [`docs/milestone-4-straight-fill-dither-plan.md`](docs/milestone-4-straight-fill-dither-plan.md)
- [`docs/milestone-4c-palette-decision.md`](docs/milestone-4c-palette-decision.md)
- [`docs/milestone-4d-publication-plan.md`](docs/milestone-4d-publication-plan.md)
- [`docs/milestone-4d6-graphics-publication.md`](docs/milestone-4d6-graphics-publication.md)

Published base snapshot:

```text
graphscii-graphics-v0
U+E000..U+F6A3
5,796 encoded owners
```

---

## 5. Milestone 5 — generic connector vocabulary — COMPLETE

Milestone 5 began with broad empirical junction research, then deliberately replaced exhaustive enumeration with a small, deterministic, easily reasoned-about connector language.

Detailed research history: [`docs/milestone-5-junction-coverage-plan.md`](docs/milestone-5-junction-coverage-plan.md)

Execution result:

```text
5A.1  straight-composition demand map + taxonomy              COMPLETE
5A.2  boundary-safe geometry + generic lattice research       COMPLETE
5A.3  exhaustive candidate generation + exact dedup           COMPLETE / SUPERSEDED
5B.1  orthogonal generic connector basis                      COMPLETE
5B.2  deterministic diagonal generic connector basis          COMPLETE
5C    connector registry + provisional allocation             COMPLETE
5D    canonical connector artifacts + atlas integration       COMPLETE
5E    graphscii-graphics-v1 publication + reserve accounting  COMPLETE
```

### 5.1 Research retained

The broad search remains available as evidence:

```text
theoretical one-port-per-edge semantics      22,528
demanded by straight composition             22,428
weighted demand events                       928,242
exhaustive semantic/model candidates          90,112
exact visual owners in exhaustive sweep       82,377
```

Those numbers no longer define the encoded vocabulary. They established that exhaustive allocation was the wrong abstraction for the practical connector layer.

### 5.2 Final orthogonal connector rule

At every one of the 128 `(x,y)` positions in the 8×16 cell, GraphSCII supports five semantic arm masks:

```text
NESW   full four-arm cross
ESW    missing north
NSW    missing east
NEW    missing south
NSE    missing west
```

Raw semantic language:

```text
128 positions × 5 masks = 640 semantics
```

Exact global dedup result:

```text
640 semantics
548 exact raster owners
4 graphics-v0 exact reuses
544 novel orthogonal owners
```

Completion note: [`docs/milestone-5b1-orthogonal-generic-connectors.md`](docs/milestone-5b1-orthogonal-generic-connectors.md)

### 5.3 Final diagonal connector rule

The diagonal language is generated from the 8×16 geometry itself rather than sampled randomly.

Full-X rules:

```text
16 vertical-squash rules    DV00..DV15
 8 horizontal-squash rules  DH00..DH07
                           --------------
24 deterministic full X rules
```

Nine evenly distributed squash rules also receive all four missing-leg variants:

```text
DV00 DV03 DV06 DV08 DV11 DV14
DH02 DH04 DH06
```

Final diagonal semantics:

```text
24 full-X semantics
36 three-leg semantics
----------------------
60 diagonal semantics
```

Exact global dedup result:

```text
60 selected diagonal semantics
59 exact raster owners
2 graphics-v0 exact reuses
57 novel diagonal owners
```

Completion note: [`docs/milestone-5b2-diagonal-generic-connectors.md`](docs/milestone-5b2-diagonal-generic-connectors.md)

### 5.4 Final connector population

```text
orthogonal semantic aliases              640
diagonal semantic aliases                 60
connector semantic aliases total         700

novel orthogonal owners                   544
novel diagonal owners                      57
novel connector owners total              601
```

Milestone 5C allocated those 601 owners deterministically and generated canonical connector ASCII/PNG artifacts and three paged connector atlases.

Completion note: [`docs/milestone-5c-connector-allocation.md`](docs/milestone-5c-connector-allocation.md)

---

## 6. Published GraphSCII graphics-v1 vocabulary

Formal publication:

```text
graphscii-graphics-v1
```

Publication manifest:

```text
artifacts/publications/graphscii-graphics-v1.json
```

Final encoded population:

```text
straight                              746
solid 100%                          1,259
medium 75%                         1,269
light 25%                          1,315
half 50%                           1,207
orthogonal connectors                544
diagonal connectors                   57
                                    -----
encoded PUA graphics               6,397
```

With printable ASCII:

```text
6,397 PUA graphics + 95 printable ASCII = 6,492 minimum physical glyphs
```

Final BMP PUA address map:

```text
U+E000..U+E2E9      746   straight
U+E2EA..U+E7D4    1,259   solid 100%
U+E7D5..U+ECC9    1,269   medium 75%
U+ECCA..U+F1EC    1,315   light 25%
U+F1ED..U+F6A3    1,207   half 50%
U+F6A4..U+F8FC      601   generic connectors
U+F8FD..U+F8FF        3   protected reserve
```

Hard publication fixtures:

```text
encoded owners                     6,397
connector semantic aliases           700
combined addressable aliases       11,516
last allocated codepoint          U+F8FC
reserve slots                            3
straight codepoints unchanged          YES
```

Completion note: [`docs/milestone-5e-graphics-v1-publication.md`](docs/milestone-5e-graphics-v1-publication.md)

Milestone summary: [`docs/milestone-5-complete.md`](docs/milestone-5-complete.md)

---

## 7. Current canonical artifacts

Primary machine-readable sources:

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
```

Connector glyph artifacts:

```text
artifacts/vocabulary/connectors/glyphs/
├── ascii/    601 files
└── png/      601 files
```

Connector atlases:

```text
artifacts/vocabulary/atlases/connectors/
├── index.json
├── page-00.png / page-00.md   256 owners
├── page-01.png / page-01.md   256 owners
└── page-02.png / page-02.md    89 owners
```

The graphics-v1 publication freezes SHA-256 digests for the registry, allocation stats, connector semantics, connector alias index, connector atlas index, layout map, allocation spec, inherited renderer-only index, and graphics-v0 base publication.

---

## 8. Current generation and verification commands

From `geometric-glyph-lab/`:

```powershell
npm run check
npm run generate
npm run verify

npm run generate:vocabulary
npm run verify:vocabulary
npm run generate:connector-allocation
npm run verify:connector-allocation
npm run generate:graphics-publication-v1
npm run verify:graphics-publication-v1
```

The aggregate `generate` and `verify` commands include the earlier straight/fill/dither research, the connector research and basis generators, the v1 connector allocation, and the formal graphics-v1 publication gate.

---

## 9. Address-space policy from here

The BMP PUA is effectively full:

```text
capacity       6,400
allocated      6,397
reserve            3
```

Therefore:

1. No new broad enumerated glyph family should be added to the BMP PUA.
2. The final three slots remain protected unless a tiny exceptional semantic is explicitly justified.
3. Future appearance or geometry expansions should prefer renderer-derived output, semantic composition, exact reuse, or a separately versioned address-space strategy.
4. Curves remain research-only unless a very small curated basis justifies consuming the final reserve or another encoding strategy is selected.

---

## 10. Milestone 9 — reference font compiler — ACTIVE

GraphSCII now has a deterministic reference TrueType compiler that consumes the frozen `graphscii-graphics-v1` registry directly.

### 9A — GraphSCII Regular reference TTF + public standard — COMPLETE

```text
formal standard name       Graphical Standard for Computer Information Interchange
designer                   Ariel Williams
font family                GraphSCII
font                       GraphSCII-Regular.ttf
printable ASCII            95
PUA graphics               6,397
encoded characters         6,492
sfnt glyphs incl .notdef   6,493
units per em               1,024
advance width              512
font SHA-256               b8d49672468f33b4159fcb45433c8102d604039a66d5409ae51f816f97c2f83a
```

Milestone 9A also freezes the public documentation/licensing layer:

```text
GRAPHSCII-STANDARD.md
FONT-LICENSE.txt
COMMERCIAL-LICENSE.md
INDIE-LICENSE.md
THIRD-PARTY-NOTICES.md
README.md
```

The font verifier decodes every generated TrueType glyph back to the canonical 8×16 grid and requires exact bitmap equality. The compiler preserves every v1 PUA assignment and produces deterministic bytes.

Completion note: [`docs/milestone-9a-font-compiler.md`](docs/milestone-9a-font-compiler.md)

### 9B — external compatibility + distribution package — NEXT

Next, validate the reference TTF with independent font tooling and representative Windows/Linux/browser renderers, produce install/distribution packages, add human-visible specimen sheets, and freeze a release-facing font manifest without changing canonical glyph geometry.

---

## 11. Later milestones

```text
6   curated curve/arc extension if independently justified    PAUSED
7   terminals / specials                                      DEFERRED
8   vocabulary optimization                                   SATISFIED BY v1 freeze
9A  reference TTF + graphical standard                        COMPLETE
9B  compatibility/distribution validation                     NEXT
10  drawing API / solver
11  interactive editor
12  GraphSCII v1 font/release freeze
```

Milestone 10 sub-plan: [`docs/milestone-10a-crossover-resolution-plan.md`](docs/milestone-10a-crossover-resolution-plan.md) — single-glyph crossover resolution for GraphSCII Draw (proposed).

---

## 12. Guiding rule

Prefer **geometry reuse + derived appearance** over independent hand-authored glyph families.

```text
mathematical or semantic definition
        ↓
deterministic raster
        ↓
global exact dedup
        ↓
canonical visual owner + preserved semantic aliases
```

Do not spend a new codepoint when an existing bitmap already renders the requested definition exactly.

The published bitmap registry is now the source of truth for downstream font, drawing, and editor work.
