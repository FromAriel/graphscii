# Milestone 10A — Single-Glyph Crossover Resolution

Status: **PROPOSED — SUB-PLAN OF MILESTONE 10 (DRAWING API / SOLVER)**

This plan specifies how a GraphSCII Draw cell occupied by more than one stroke resolves to **exactly one published glyph** — never a layered overstrike, never a runtime visual search, and never a new codepoint.

Once adopted, this plan supersedes:

- [`graphscii-demo/PLAN.md`](../graphscii-demo/PLAN.md) §11 refusal rule ("unsupported multi-segment state → illegal edit");
- the `crossover-compositor-v2.js` exact layered overstrike fallback (which remains correct for canvas rendering but cannot be serialized to a text grid).

---

## 1. The problem

GraphSCII Draw guarantees continuity through shared nodes, and the v1 vocabulary provides a generic connector language:

```text
orthogonal connector semantics            640
diagonal connector semantics               60
connector semantic aliases                700
novel connector owners                    601   glyph IDs 5796..6396
```

But two strokes can still cross a cell in a combined topology for which **no published single glyph exists**. When that happens the current compositor falls back to overstriking multiple glyphs at one cell origin. That preserves pixels but violates the one-glyph-per-cell contract, so the result has no text-serializable form.

The address-space policy forbids solving this with new glyphs:

```text
BMP PUA capacity       6,400
allocated              6,397
protected reserve          3
```

Therefore crossover completion must be achieved by **selection among already-published owners**, decided once, offline, under declared rules.

---

## 2. Goals and non-goals

Goals:

1. Every cell emits exactly one codepoint in all cases, including crossings.
2. Approximation, where unavoidable, is typed (topology-based), bounded, deterministic, and auditable.
3. All selection decisions happen in an offline generated artifact, verified like every other manifest in the chain.
4. Zero new codepoints; zero reserve consumption; no renumbering.

Non-goals:

1. No change to the frozen registry, font, or standard documents.
2. No fill-side/tone compositing (boundary-fill interaction remains a later slice).
3. Stroke re-routing around occupied cells is deferred (see §10).

---

## 3. Decision model

A cell's desired state is derived from its strokes, not from pixels:

```text
stroke segments in cell  →  canonical segment keys  →  desired port set D
```

Each published straight or connector owner also exposes a port set. Resolution per cell:

```text
Tier 0   union bitmap == a published straight or connector owner bitmap
         → emit that owner                                  (exact)

Tier 1   no exact owner
         → emit argmin cost(C) over the typed candidate set (approximate, declared)

Tier 2   Tier 1 winner loses at least one MATED port
         → apply the declared loss policy                   (see §7)
```

### 3.0 Never-empty invariant

> **An approximate published glyph always beats an empty or unresolved cell.**

Every reachable two-segment state resolves to exactly one owner. An off-angle
or leg-dropped connector is an accepted cost of staying inside the frozen
6,397-owner vocabulary; emitting nothing is not an option. This invariant is
normative for the generator (§5), the verifier (§8), and the runtime (§6).

### 3.1 Candidate set (typed, closed)

```text
all published straight owners     glyph IDs    0..745
all published connector owners    glyph IDs 5796..6396
```

Fill-class owners (glyph IDs 746..5795) are **excluded by construction**. A stroke cell can never resolve to a fill tile. This is enforced structurally by the generator, not by scoring penalties.

### 3.2 Cost function (fixed spec constants)

```text
D = desired port set           (union of the cell's segment endpoints)
M ⊆ D                          (ports mated to committed neighbor cells)

cost(C) =  W_MATE  × |M \ P(C)|        mated ports lost
         + W_MISS  × |D \ P(C)|        desired legs absent
         + W_EXTRA × |P(C) \ D|        foreign legs present
         + HAMMING_EPS × hamming(bitmap(C), unionBitmap(D))
```

Weight ordering is normative:

```text
W_MATE > W_MISS > W_EXTRA > HAMMING_EPS ≈ 0
```

Rationale:

- A **mated port** (`R5` here ↔ `L5` next door) is a cross-cell contract. Losing it shears a line across two cells; it is the worst artifact.
- A **missing leg** reads as a break and severs a contour locally.
- An **extra leg** reads as a stub — noise, but connectivity survives.
- Pixel Hamming distance exists **only** to break ties. It must never override topology, and candidates are pre-restricted to the typed set, so resemblance search cannot re-enter.

Ties after the full cost compare resolve lexicographically by the candidate's sorted port list. The result is fully deterministic and portable.

Initial constant proposal (to be validated by 10A.0 measurement before freezing):

```text
W_MATE       1000
W_MISS        100
W_EXTRA        10
HAMMING_EPS     1 / 128
```

Constants ship inside the artifact header so the table is self-describing and reproducible.

---

## 4. Canonical state keys

Cell states are identified canonically so equivalent descriptions collide into one table entry:

```text
1. each segment is canonicalized into the six canonical family directions
   (LR, TB, LT, LB, RT, RB) — reverse queries must not re-rasterize;
2. the segment list is sorted;
3. duplicate segments collapse;
4. the state key is the joined sorted segment list,
   e.g.  "L5>R5+T3>B3".
```

The generator asserts that reversing every segment of a state yields the same state key.

Single-segment states never enter the table; they are always Tier 0 through the existing straight lookup.

---

## 5. Offline resolution artifact

New scripts in `geometric-glyph-lab/scripts/`, wired into the aggregate chains:

```text
npm run generate:crossover-coverage
npm run verify:crossover-coverage
npm run generate:crossover-resolution
npm run verify:crossover-resolution
```

Output (10A.3 promotion decision — compact TSV form, sidecar stats/report):

```text
artifacts/manifest/vocabulary-v1/crossover-resolution.tsv
artifacts/manifest/vocabulary-v1/crossover-resolution-stats.json
artifacts/manifest/vocabulary-v1/crossover-resolution-report.md
```

`resolution.tsv` columns: `stateKey`, `tier` (0|1), `glyphId`,
`missedPorts`, `extraPorts`, `costScaled`; codepoint = `U+E000 + glyphId`.
A pretty-printed per-entry JSON was rejected: 345,696 entries would cost tens
of megabytes versus the 9.6 MB sorted table. The runtime loads the TSV into a
key→entry map; no per-frame search exists in any form.

Shape:

```json
{
  "format": "graphscii",
  "schema": "graphscii-crossover-resolution",
  "schemaVersion": 1,
  "basis": {
    "byBitmapIndexSha256": "…",
    "weights": { "W_MATE": 1000, "W_MISS": 100, "W_EXTRA": 10, "HAMMING_EPS": 0.0078125 }
  },
  "entries": {
    "L5>R5+T3>B3": {
      "desiredPorts": ["B3", "L5", "R5", "T3"],
      "matedPorts":   ["B3", "L5", "R5", "T3"],
      "tier": 0,
      "glyphId": 6000,
      "codepoint": "U+F7xx",
      "bitmapKey": "…"
    },
    "…": {
      "tier": 1,
      "glyphId": …,
      "missedPorts": ["…"],
      "extraPorts":  ["…"],
      "lostMates":   [],
      "costBreakdown": { "mate": 0, "miss": 100, "extra": 10, "hamming": 3 }
    }
  },
  "stats": {
    "totalStates": 0,
    "tier0": 0,
    "tier1": 0,
    "tier2": 0,
    "statesLosingMates": 0
  }
}
```

Enumeration scope for the first cut is **pairs of segments per cell** (≤ 832 canonical definitions choose 2, deduplicated by state key — a few hundred thousand raw, far fewer unique). Triples are out of scope until pair data shows they occur in practice.

---

## 6. Runtime integration

`crossover-compositor` v3:

```text
authoritativeCells()  →  per cell:
  1 segment   → existing straight lookup                 (unchanged)
  n segments  → lookup state key in crossover-resolution.json
                  hit  → emit exactly ONE codepoint + provenance
                  miss → impossible; verifier forbids absent keys
```

- The layered render mode is removed.
- If the resolution table fails to load, cells render with explicit unresolved markers rather than silently layering. Exactness is never faked.
- Provenance (`tier`, `glyphId`, `missedPorts`, `costBreakdown`) flows into the debug export so any approximated cell can be explained after the fact.

---

## 7. Tier 2 policy

When the best candidate loses a mated port, exactly one declared policy applies:

```text
default   ACCEPT_LEAST_DAMAGE   emit the Tier 1 winner, record lostMates
future    REROUTE_LOSER         re-path the lower-priority stroke around
                                the cell (priority = stroke id), restoring
                                full exactness at the cost of extra
                                segments in neighbor cells
```

`ACCEPT_LEAST_DAMAGE` ships first because it preserves the one-glyph invariant globally and requires no cross-cell cascade. `REROUTE_LOSER` is research-deferred (§10).

---

## 8. Verification requirements

The verifier must assert, failing loudly otherwise:

1. regenerated artifact is byte-identical to the committed one;
2. zero entries resolve into glyph IDs 746..5795 (fill class);
3. every Tier 0 entry's `bitmapKey` equals the union bitmap of its state;
4. reverse-segment transformation of any state key maps to the identical entry;
5. weights in the header match the normative ordering;
6. every reachable two-segment state key is present (no runtime misses);
7. stats are internally consistent (`tier0 + tier1 + tier2 === totalStates`);
8. demo self-test: with the table loaded, no composite pass emits more than one codepoint into any cell.

CI runs the verifier alongside the existing draw workflow.

---

## 9. Implementation order

```text
10A.0  coverage measurement: replay real/demo strokes, measure how often
       Tier 0 misses today and which topologies miss        COMPLETE
10A.1  state enumeration + canonical keys + union bitmaps   COMPLETE
10A.2  cost selection + artifact generation script          COMPLETE
10A.3  verifier + npm wiring + CI                           COMPLETE
10A.4  compositor v3 runtime swap + provenance/debug export COMPLETE
10A.5  demo README/PLAN integration + layered-mode doc sweep COMPLETE
10A.6  REROUTE_LOSER policy                                 DEFERRED RESEARCH
```

Completion notes:

- 10A.0: [`docs/milestone-10a0-crossover-coverage.md`](milestone-10a0-crossover-coverage.md)
- 10A.1/10A.2: [`docs/milestone-10a2-crossover-resolution.md`](milestone-10a2-crossover-resolution.md)
- 10A.3: [`docs/milestone-10a3-crossover-wiring.md`](milestone-10a3-crossover-wiring.md)
- 10A.4: [`docs/milestone-10a4-crossover-runtime.md`](milestone-10a4-crossover-runtime.md)
- 10A.5: [`docs/milestone-10a5-demo-docs.md`](milestone-10a5-demo-docs.md)

**Milestone 10A is functionally complete.** Every two-segment crossover cell in
GraphSCII Draw resolves to exactly one published glyph, offline-determined,
byte-verifiable, and serialized as plain text.

Measured correction to the expectation above: exact coverage is nearly zero in
**every** family class (0.32%..1.02%), not only on diagonals — the connector
vocabulary resolves just 477 of 345,696 pair states, straight owners resolve
1,700 more via union-collapse onto other single lines, 642 stroke unions form
policy-forbidden fill-class bitmaps, and 342,877 states (99.18%) require Tier 1.
The §3.2 constants therefore remain provisional pending 10A.2 review, with
`W_MATE` expected to dominate since most misses are four-port states.

Post-10A.2 status: with `W_MISS=100, W_EXTRA=10, ε=1/128`, every state now
resolves to exactly one published owner (never-empty invariant holds); no
state loses more than two of its four legs; connector owners win 41% of Tier 1
selections; and mate evaluation is confirmed as a runtime-provenance concern
only (see completion note decision 4).

---

## 10. Explicitly rejected architecture

```text
runtime nearest-glyph search over all 6,397 owners    untyped; violates direct-lookup doctrine
per-frame similarity scoring                          nondeterministic across ports; slow
layered overstrike as a terminal answer               unpublishable to text grids
Hamming-nearest bitmap without port-set typing        bends read as crossings; structure lies
collapsing crossovers into fill-class owners          category corruption
new codepoints or reserve consumption                 forbidden by address-space policy
demand-driven new connector families                  PUA is full; grammar must be composed, not grown
```

---

## 11. Guiding rule

> **A crossover cell resolves to exactly one published glyph — chosen once, offline, by declared topology costs. Never layered, never searched at runtime, never approximated by visual resemblance.**

Approximation, where information is genuinely lost, must be bounded, prioritized (continuity over completeness over silence), and auditable in the artifact — never emergent.
