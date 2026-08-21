# Final Deterministic Diagonal Connector Selection

Status: **SELECTED — UNALLOCATED**

The final diagonal semantic basis is a rule system, not a random sample. It keeps every one of the 24 axis-squashed full-X rules, then adds all four one-leg-removed orientations for nine evenly spaced angle rules.

The 8×16 cell has a 2:1 vertical:horizontal axis ratio, so the three-leg sample uses six vertical-squash rules and three horizontal-squash rules.

Selected three-leg rule IDs:

```text
DV00
DV03
DV06
DV08
DV11
DV14
DH02
DH04
DH06
```

Counts:

```text
full-X semantic rules             24
three-leg semantic rules          36
selected diagonal semantics       60
selected exact raster owners      59
new diagonal glyphs required      57
orthogonal new glyphs required    544
final new connector glyphs        601
BMP PUA reserve                   604
reserve remaining                 3
```

All four missing-leg orientations are retained for every selected angle rule, so the selection never favors one quadrant. Exact bitmap identity still controls storage: existing graphics-v0 or orthogonal owners are reused for free, and duplicate diagonal semantics share one owner.
