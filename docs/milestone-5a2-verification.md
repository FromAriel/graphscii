# Milestone 5A.2 Verification Gate

Milestone 5A.2 is gated by the permanent `npm run generate` / `npm run verify` pipeline plus frozen measured fixtures in `verify-junction-geometry-sweep.mjs`.

The verified boundary-safe fixture requires:

```text
demanded semantics             22,428
theoretical semantics          22,528
working lattice budget            600
protected reserve                 604
actual junction allocations         0
```

All four geometry models must accept all 22,428 demanded semantics with zero invalid rasters. The four frozen 600-entry strategy measurements include their exact topology mixes, exact weighted-demand coverage, unique centroid-raster counts, theoretical nearest-port breadth, and demand-weighted nearest-port breadth.

The verification gate deliberately freezes both sides of the Milestone 5 hypothesis: empirical demand and generic evenly spaced coverage. A later optimization change that moves these fixtures must therefore be deliberate and documented rather than silently changing the junction basis.

A successful branch verification also promotes the living roadmap to `5A.1 COMPLETE / 5A.2 COMPLETE / 5A.3 NEXT`, so implementation state and project memory cannot drift apart.
