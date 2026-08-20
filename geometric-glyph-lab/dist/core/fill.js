import { formatCodepoint } from "./format.js";
import { portToPixel } from "./ports.js";
import { bitmapKey, cloneBitmap, setPixel } from "./raster.js";
import { ALL_FAMILIES, generate } from "./generator.js";
import { CELL_HEIGHT, CELL_WIDTH, } from "./types.js";
function orientedCross(start, end, point) {
    return (end.x - start.x) * (point.y - start.y)
        - (end.y - start.y) * (point.x - start.x);
}
export function rasterizeStraightSideFill(straight, side) {
    const start = portToPixel(straight.start);
    const end = portToPixel(straight.end);
    const bitmap = cloneBitmap(straight.bitmap);
    for (let y = 0; y < CELL_HEIGHT; y += 1) {
        for (let x = 0; x < CELL_WIDTH; x += 1) {
            const cross = orientedCross(start, end, { x, y });
            const selected = side === "A" ? cross > 0 : cross < 0;
            if (selected) {
                setPixel(bitmap, x, y);
            }
        }
    }
    return bitmap;
}
export function makeStraightFillAliasKey(straight, side) {
    return `straight-fill:${straight.family}:${straight.start.edge}${straight.start.index}>${straight.end.edge}${straight.end.index}:side${side}:solid`;
}
export function generateStraightSolidFills(straightResult = generate(ALL_FAMILIES)) {
    const straightGlyphs = straightResult.glyphs;
    const straightCandidates = straightResult.candidates;
    const straightByBitmap = new Map(straightGlyphs.map((glyph) => [glyph.bitmapKey, glyph]));
    const fillByBitmap = new Map();
    const straightReuseBitmapKeys = new Set();
    const candidates = [];
    const visuals = [];
    let straightReuseCandidates = 0;
    let fillDuplicateCandidates = 0;
    for (const straight of straightCandidates) {
        for (const side of ["A", "B"]) {
            const bitmap = rasterizeStraightSideFill(straight, side);
            const key = bitmapKey(bitmap);
            const fillCandidateId = candidates.length;
            const straightOwner = straightByBitmap.get(key);
            if (straightOwner) {
                straightReuseCandidates += 1;
                straightReuseBitmapKeys.add(key);
                candidates.push({
                    fillCandidateId,
                    straightCandidateId: straight.candidateId,
                    family: straight.family,
                    start: straight.start,
                    end: straight.end,
                    side,
                    aliasKey: makeStraightFillAliasKey(straight, side),
                    bitmap,
                    bitmapKey: key,
                    visualDisposition: "reuse-existing-straight",
                    canonicalGlyphId: straightOwner.glyphId,
                    canonicalCodepoint: formatCodepoint(straightOwner.codepoint),
                    canonicalFillVisualId: null,
                });
                continue;
            }
            const existingFill = fillByBitmap.get(key);
            if (existingFill) {
                fillDuplicateCandidates += 1;
                existingFill.aliasCount += 1;
                candidates.push({
                    fillCandidateId,
                    straightCandidateId: straight.candidateId,
                    family: straight.family,
                    start: straight.start,
                    end: straight.end,
                    side,
                    aliasKey: makeStraightFillAliasKey(straight, side),
                    bitmap,
                    bitmapKey: key,
                    visualDisposition: "reuse-existing-fill",
                    canonicalGlyphId: null,
                    canonicalCodepoint: null,
                    canonicalFillVisualId: existingFill.visualId,
                });
                continue;
            }
            const visual = {
                visualId: visuals.length,
                bitmap,
                bitmapKey: key,
                aliasCount: 1,
                firstFillCandidateId: fillCandidateId,
            };
            visuals.push(visual);
            fillByBitmap.set(key, visual);
            candidates.push({
                fillCandidateId,
                straightCandidateId: straight.candidateId,
                family: straight.family,
                start: straight.start,
                end: straight.end,
                side,
                aliasKey: makeStraightFillAliasKey(straight, side),
                bitmap,
                bitmapKey: key,
                visualDisposition: "new-fill-unallocated",
                canonicalGlyphId: null,
                canonicalCodepoint: null,
                canonicalFillVisualId: visual.visualId,
            });
        }
    }
    const uniqueFillRasters = visuals.length + straightReuseBitmapKeys.size;
    return {
        candidates,
        visuals,
        stats: {
            straightMathematicalDefinitions: straightCandidates.length,
            semanticFillCandidates: candidates.length,
            uniqueFillRasters,
            straightReuseCandidates,
            straightReuseVisuals: straightReuseBitmapKeys.size,
            fillDuplicateCandidates,
            newFillVisuals: visuals.length,
            combinedStraightAndFillVisuals: straightGlyphs.length + visuals.length,
        },
    };
}
