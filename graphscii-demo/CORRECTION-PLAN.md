# GraphSCII Draw Correction Plan

This plan replaces the current geometry-to-glyph logic with direct use of the existing GraphSCII rules. It is intentionally simple: the repository specification and rule tables are the authority.

## Rule

**Geometry determines GraphSCII semantics. The existing GraphSCII rule tables determine the glyph.**

The drawing app must not choose glyphs by visual similarity, pixel count, nearest bitmap, continuity score, or post-hoc repair.

## 1. Remove the heuristic glyph path

Delete the current authoritative use of:

- nearest-looking glyph selection;
- pixel-count fallback;
- arbitrary straight fallback;
- soft edge/continuity penalties;
- raster-derived port guessing;
- bridge/repair passes that try to fix invalid output afterward.

There must be no fallback that emits a glyph whose GraphSCII semantic rule was not actually requested.

## 2. Convert drawn geometry to GraphSCII semantics

For freehand, straight lines, Béziers, and ellipse outlines:

1. Use the authored mathematical/centerline geometry.
2. Split the path where it crosses the 8×16 GraphSCII cell grid.
3. Compute each shared cell-boundary crossing once.
4. Convert that crossing to the matching GraphSCII port.
5. Give both adjacent cells the same shared crossing by construction:
   - `Rn` on the left cell is the same event as `Ln` on the right cell;
   - `Bn` on the upper cell is the same event as `Tn` on the lower cell.

Adjacent cells must never independently guess the same crossing.

## 3. Use the existing rule tables directly

### Straight geometry

A normal line segment through a cell has exactly two ports.

Use the published `by-connection-pair` lookup directly:

```text
port A + port B -> published straight semantic -> canonical owner
```

No other straight glyph is legal for that cell.

### Filled geometry

Use the published straight-fill semantics:

```text
mathematical boundary + side A/B + tone -> published fill semantic -> canonical owner
```

The encoded tones are exactly:

- 100% solid
- 75% medium
- 50% half
- 25% light

Dither phase remains the published phase-locked GraphSCII phase. The boundary remains fully ON as specified.

### Connectors

A connector is legal only when the authored geometry contains a real simultaneous multi-arm junction matching the published connector language.

- Orthogonal connectors use the published 640 `NESW` / one-arm-missing semantics.
- Diagonal connectors use the published selected 60 diagonal semantics.

A two-port path is never a connector.

## 4. Unsupported means unsupported

If the authored geometry produces a cell topology that GraphSCII v1 does not define exactly, the converter must report that cell as unsupported/internal conversion failure.

It must **not** substitute a visually similar glyph.

## 5. Validate; never repair

After conversion, run assertions only.

For every internal vertical seam:

```text
Rn on the left == Ln on the right
```

For every internal horizontal seam:

```text
Bn above == Tn below
```

Every emitted codepoint must also resolve from the exact semantic rule that produced it.

If any invariant fails, conversion fails. The validator does not modify the output.

## 6. Verification required before completion

The corrected implementation is complete only when:

- all 1,664 directed straight connection-pair entries resolve correctly;
- all published fill semantics used by the app resolve correctly for 100/75/50/25;
- all 640 orthogonal connector semantics resolve correctly;
- all 60 selected diagonal connector semantics resolve correctly;
- shared cell crossings always produce identical port indices on both sides;
- reversing the same geometry produces equivalent GraphSCII semantics;
- a two-port path can never emit a connector;
- a stroke can never emit a fill glyph;
- an unsupported topology can never silently emit an arbitrary glyph;
- the supplied failing `.graphscii` / text drawings are retained as regression fixtures and render with no invalid seams or semantics;
- text export and exact bitmap/PNG export reproduce the resolved canonical GraphSCII owners exactly;
- the clean TypeScript/build/CI verification passes.

## Definition of done

The corrected drawing path is:

```text
authored geometry
    -> exact cell crossings
    -> GraphSCII ports/topology
    -> existing published rule table
    -> canonical owner/codepoint
    -> validation
    -> rendering/export
```

No nearest-glyph solver. No semantic guessing. No post-hoc patching. No exceptions.
