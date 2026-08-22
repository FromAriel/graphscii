# Milestone 10A.1/10A.2 — Crossover Resolution Table

Status: **MANIFEST AUTHORITY — WIRED AND VERIFIED**

Every two-segment cell state resolves to exactly one published glyph under
the never-empty invariant. Tier 0 is an exact single-glyph match; Tier 1 is
a typed best-fit over straight and connector owners only. Fill-class owners
(glyph IDs 746..5795) are excluded by construction. No codepoints are
allocated.

## Selection rule

```text
cost(C) = W_MISS*|D\P(C)| + W_EXTRA*|P(C)\D| + (1/128)*hamming(bitmap(C), union)
weights  W_MISS=100, W_EXTRA=10
ties     lexicographic attachment-slot list, then lower glyph ID
mates    runtime provenance only; not part of offline selection
```

## Headline result

```text
measured pair states                345696
tier 0 exact                          2177
tier 1 approximate                  343519
typed candidate owners                1347   (746 straight + 601 connector)
full-leg-retention tier 1            41521
average tier-1 scaled cost      20177.857426
```

## Winner classes

```text
tier 0 via straight owners            1700
tier 0 via connector owners            477
tier 1 won by straight owners       201321
tier 1 won by connector owners      142198
```

## Missed-leg histogram (tier 1)

```text
missed 0: 41521
missed 1: 174349
missed 2: 127649
missed 3: 0
missed 4: 0
```

## Interpretation rules

- Missed legs mark cells where a stroke will visually lose one connection;
  at runtime these are exactly the mate-loss cases reported as provenance.
- Extra legs are visible stubs; the small W_EXTRA keeps them cheaper than
  losing a leg but more expensive than clean fits.
- The table is the sole authority at runtime; no per-frame search exists.

Next slice: 10A.4 — compositor v3 runtime swap over this manifest table.
