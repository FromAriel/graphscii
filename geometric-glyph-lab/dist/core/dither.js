import { formatCodepoint } from "./format.js";
import { portToPixel } from "./ports.js";
import { bitmapKey, cloneBitmap, setPixel } from "./raster.js";
import { ALL_FAMILIES, generate } from "./generator.js";
import { generateStraightSolidFills } from "./fill.js";
import { CELL_HEIGHT, CELL_WIDTH } from "./types.js";

export const STRAIGHT_FILL_STYLE_ORDER = [
    "solid",
    "dense",
    "medium",
    "light",
    "sparse",
];

export const STRAIGHT_FILL_STYLE_DEFINITIONS = [
    {
        id: "solid",
        label: "Solid",
        onCells: 64,
        totalCells: 64,
        density: 1,
        rows: [
            "########", "########", "########", "########",
            "########", "########", "########", "########",
        ],
    },
    {
        id: "dense",
        label: "Dense",
        onCells: 56,
        totalCells: 64,
        density: 0.875,
        rows: [
            "###-###-",
            "########",
            "#-###-##",
            "########",
            "###-###-",
            "########",
            "#-###-##",
            "########",
        ],
    },
    {
        id: "medium",
        label: "Medium",
        onCells: 48,
        totalCells: 64,
        density: 0.75,
        rows: [
            "#-#-#-#-",
            "########",
            "#-#-#-#-",
            "########",
            "#-#-#-#-",
            "########",
            "#-#-#-#-",
            "########",
        ],
    },
    {
        id: "light",
        label: "Light",
        onCells: 16,
        totalCells: 64,
        density: 0.25,
        rows: [
            "#-#-#-#-",
            "--------",
            "#-#-#-#-",
            "--------",
            "#-#-#-#-",
            "--------",
            "#-#-#-#-",
            "--------",
        ],
    },
    {
        id: "sparse",
        label: "Sparse",
        onCells: 8,
        totalCells: 64,
        density: 0.125,
        rows: [
            "#---#---",
            "--------",
            "--#---#-",
            "--------",
            "#---#---",
            "--------",
            "--#---#-",
            "--------",
        ],
    },
];

const STYLE_BY_ID = new Map(
    STRAIGHT_FILL_STYLE_DEFINITIONS.map((definition) => [definition.id, definition]),
);

function orientedCross(start, end, point) {
    return (end.x - start.x) * (point.y - start.y)
        - (end.y - start.y) * (point.x - start.x);
}

export function ditherMaskHasPixel(style, x, y) {
    const definition = STYLE_BY_ID.get(style);
    if (!definition) {
        throw new Error(`Unknown straight fill style: ${style}.`);
    }
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        throw new Error("Dither mask coordinates must be integers.");
    }
    const wrappedX = ((x % 8) + 8) % 8;
    const wrappedY = ((y % 8) + 8) % 8;
    return definition.rows[wrappedY]?.[wrappedX] === "#";
}

export function rasterizeStraightStyledFill(straight, side, style) {
    const start = portToPixel(straight.start);
    const end = portToPixel(straight.end);
    const bitmap = cloneBitmap(straight.bitmap);
    for (let y = 0; y < CELL_HEIGHT; y += 1) {
        for (let x = 0; x < CELL_WIDTH; x += 1) {
            const cross = orientedCross(start, end, { x, y });
            const selected = side === "A" ? cross > 0 : cross < 0;
            if (selected && ditherMaskHasPixel(style, x, y)) {
                setPixel(bitmap, x, y);
            }
        }
    }
    return bitmap;
}

export function makeStraightStyledFillAliasKey(straight, side, style) {
    return `straight-fill:${straight.family}:${straight.start.edge}${straight.start.index}>${straight.end.edge}${straight.end.index}:side${side}:${style}`;
}

function validateStyleDefinitions() {
    for (const definition of STRAIGHT_FILL_STYLE_DEFINITIONS) {
        if (definition.rows.length !== 8 || definition.rows.some((row) => row.length !== 8 || /[^#-]/u.test(row))) {
            throw new Error(`Invalid 8×8 dither mask for style ${definition.id}.`);
        }
        const actualOnCells = definition.rows.join("").split("").filter((cell) => cell === "#").length;
        if (actualOnCells !== definition.onCells) {
            throw new Error(`Dither style ${definition.id} expected ${definition.onCells} ON cells, got ${actualOnCells}.`);
        }
    }
}

const POPCOUNT_8 = Array.from({ length: 256 }, (_, value) => {
    let remaining = value;
    let count = 0;
    while (remaining !== 0) {
        count += remaining & 1;
        remaining >>>= 1;
    }
    return count;
});

export function bitmapHammingDistance(a, b) {
    if (a.length !== b.length) {
        throw new Error("Cannot compare bitmaps with different row counts.");
    }
    let distance = 0;
    for (let index = 0; index < a.length; index += 1) {
        distance += POPCOUNT_8[(a[index] ?? 0) ^ (b[index] ?? 0)] ?? 0;
    }
    return distance;
}

function buildHammingComparison(styleA, styleB, candidatesA, candidatesB) {
    if (candidatesA.length !== candidatesB.length) {
        throw new Error(`Cannot compare ${styleA} and ${styleB}: semantic candidate counts differ.`);
    }
    const distances = candidatesA.map((candidate, index) =>
        bitmapHammingDistance(candidate.bitmap, candidatesB[index]?.bitmap ?? new Uint8Array()));
    const histogramCounts = new Map();
    for (const distance of distances) {
        histogramCounts.set(distance, (histogramCounts.get(distance) ?? 0) + 1);
    }
    const histogram = Object.fromEntries(
        [...histogramCounts.entries()].sort(([a], [b]) => a - b).map(([distance, count]) => [String(distance), count]),
    );
    const sum = distances.reduce((total, distance) => total + distance, 0);
    return {
        styleA,
        styleB,
        semanticPairs: distances.length,
        exactMatches: histogramCounts.get(0) ?? 0,
        withinOnePixel: distances.filter((distance) => distance <= 1).length,
        withinTwoPixels: distances.filter((distance) => distance <= 2).length,
        minDistance: Math.min(...distances),
        maxDistance: Math.max(...distances),
        meanDistance: Number((sum / distances.length).toFixed(6)),
        histogram,
    };
}

function solidCandidateToStyled(styledCandidateId, sourceFillCandidateId, straight, solidResult) {
    const solid = solidResult.candidates[sourceFillCandidateId];
    if (!solid) {
        throw new Error(`Missing solid fill candidate ${sourceFillCandidateId}.`);
    }
    return {
        styledCandidateId,
        sourceFillCandidateId,
        straightCandidateId: straight.candidateId,
        family: straight.family,
        start: straight.start,
        end: straight.end,
        side: solid.side,
        style: "solid",
        aliasKey: makeStraightStyledFillAliasKey(straight, solid.side, "solid"),
        bitmap: solid.bitmap,
        bitmapKey: solid.bitmapKey,
        visualDisposition: solid.visualDisposition,
        canonicalGlyphId: solid.canonicalGlyphId,
        canonicalCodepoint: solid.canonicalCodepoint,
        canonicalFillVisualId: solid.canonicalFillVisualId,
        canonicalDitherVisualId: null,
        canonicalDitherStyle: null,
    };
}

export function generateStraightDitherSweep(
    straightResult = generate(ALL_FAMILIES),
    solidResult = generateStraightSolidFills(straightResult),
) {
    validateStyleDefinitions();
    const straightByBitmap = new Map(straightResult.glyphs.map((glyph) => [glyph.bitmapKey, glyph]));
    const solidByBitmap = new Map(solidResult.visuals.map((visual) => [visual.bitmapKey, visual]));
    const ditherByBitmap = new Map();
    const candidates = [];
    const visuals = [];
    const styleCandidates = new Map();
    const styleStats = [];
    const allStyledKeys = new Set();
    const allStraightReuseKeys = new Set();

    for (const [styleIndex, style] of STRAIGHT_FILL_STYLE_ORDER.entries()) {
        const definition = STYLE_BY_ID.get(style);
        if (!definition) {
            throw new Error(`Missing style definition for ${style}.`);
        }
        const currentCandidates = [];
        const uniqueKeys = new Set();
        const straightReuseKeys = new Set();
        const solidReuseVisualIds = new Set();
        const priorDitherStyleReuseByStyle = {};
        let straightReuseCandidates = 0;
        let solidReuseCandidates = 0;
        let sameStyleDuplicateCandidates = 0;
        let priorDitherStyleReuseCandidates = 0;
        let newVisuals = 0;

        for (const straight of straightResult.candidates) {
            for (const [sideIndex, side] of ["A", "B"].entries()) {
                const sourceFillCandidateId = straight.candidateId * 2 + sideIndex;
                const styledCandidateId = styleIndex * solidResult.candidates.length + sourceFillCandidateId;
                if (style === "solid") {
                    const candidate = solidCandidateToStyled(
                        styledCandidateId,
                        sourceFillCandidateId,
                        straight,
                        solidResult,
                    );
                    currentCandidates.push(candidate);
                    candidates.push(candidate);
                    uniqueKeys.add(candidate.bitmapKey);
                    allStyledKeys.add(candidate.bitmapKey);
                    if (candidate.visualDisposition === "reuse-existing-straight") {
                        straightReuseCandidates += 1;
                        straightReuseKeys.add(candidate.bitmapKey);
                        allStraightReuseKeys.add(candidate.bitmapKey);
                    }
                    else if (candidate.visualDisposition === "reuse-existing-fill") {
                        sameStyleDuplicateCandidates += 1;
                    }
                    else if (candidate.visualDisposition === "new-fill-unallocated") {
                        newVisuals += 1;
                    }
                    continue;
                }

                const bitmap = rasterizeStraightStyledFill(straight, side, style);
                const key = bitmapKey(bitmap);
                uniqueKeys.add(key);
                allStyledKeys.add(key);
                const straightOwner = straightByBitmap.get(key);
                let candidate;
                if (straightOwner) {
                    straightReuseCandidates += 1;
                    straightReuseKeys.add(key);
                    allStraightReuseKeys.add(key);
                    candidate = {
                        styledCandidateId,
                        sourceFillCandidateId,
                        straightCandidateId: straight.candidateId,
                        family: straight.family,
                        start: straight.start,
                        end: straight.end,
                        side,
                        style,
                        aliasKey: makeStraightStyledFillAliasKey(straight, side, style),
                        bitmap,
                        bitmapKey: key,
                        visualDisposition: "reuse-existing-straight",
                        canonicalGlyphId: straightOwner.glyphId,
                        canonicalCodepoint: formatCodepoint(straightOwner.codepoint),
                        canonicalFillVisualId: null,
                        canonicalDitherVisualId: null,
                        canonicalDitherStyle: null,
                    };
                }
                else {
                    const solidOwner = solidByBitmap.get(key);
                    if (solidOwner) {
                        solidReuseCandidates += 1;
                        solidReuseVisualIds.add(solidOwner.visualId);
                        candidate = {
                            styledCandidateId,
                            sourceFillCandidateId,
                            straightCandidateId: straight.candidateId,
                            family: straight.family,
                            start: straight.start,
                            end: straight.end,
                            side,
                            style,
                            aliasKey: makeStraightStyledFillAliasKey(straight, side, style),
                            bitmap,
                            bitmapKey: key,
                            visualDisposition: "reuse-existing-fill",
                            canonicalGlyphId: null,
                            canonicalCodepoint: null,
                            canonicalFillVisualId: solidOwner.visualId,
                            canonicalDitherVisualId: null,
                            canonicalDitherStyle: null,
                        };
                    }
                    else {
                        const ditherOwner = ditherByBitmap.get(key);
                        if (ditherOwner) {
                            ditherOwner.aliasCount += 1;
                            if (ditherOwner.style === style) {
                                sameStyleDuplicateCandidates += 1;
                            }
                            else {
                                priorDitherStyleReuseCandidates += 1;
                                priorDitherStyleReuseByStyle[ditherOwner.style] =
                                    (priorDitherStyleReuseByStyle[ditherOwner.style] ?? 0) + 1;
                            }
                            candidate = {
                                styledCandidateId,
                                sourceFillCandidateId,
                                straightCandidateId: straight.candidateId,
                                family: straight.family,
                                start: straight.start,
                                end: straight.end,
                                side,
                                style,
                                aliasKey: makeStraightStyledFillAliasKey(straight, side, style),
                                bitmap,
                                bitmapKey: key,
                                visualDisposition: "reuse-existing-dither",
                                canonicalGlyphId: null,
                                canonicalCodepoint: null,
                                canonicalFillVisualId: null,
                                canonicalDitherVisualId: ditherOwner.visualId,
                                canonicalDitherStyle: ditherOwner.style,
                            };
                        }
                        else {
                            const visual = {
                                visualId: visuals.length,
                                style,
                                bitmap,
                                bitmapKey: key,
                                aliasCount: 1,
                                firstStyledCandidateId: styledCandidateId,
                            };
                            visuals.push(visual);
                            ditherByBitmap.set(key, visual);
                            newVisuals += 1;
                            candidate = {
                                styledCandidateId,
                                sourceFillCandidateId,
                                straightCandidateId: straight.candidateId,
                                family: straight.family,
                                start: straight.start,
                                end: straight.end,
                                side,
                                style,
                                aliasKey: makeStraightStyledFillAliasKey(straight, side, style),
                                bitmap,
                                bitmapKey: key,
                                visualDisposition: "new-dither-unallocated",
                                canonicalGlyphId: null,
                                canonicalCodepoint: null,
                                canonicalFillVisualId: null,
                                canonicalDitherVisualId: visual.visualId,
                                canonicalDitherStyle: style,
                            };
                        }
                    }
                }
                currentCandidates.push(candidate);
                candidates.push(candidate);
            }
        }

        styleCandidates.set(style, currentCandidates);
        styleStats.push({
            style,
            maskOnCells: definition.onCells,
            maskTotalCells: 64,
            semanticCandidates: currentCandidates.length,
            uniqueRasters: uniqueKeys.size,
            straightReuseCandidates,
            straightReuseVisuals: straightReuseKeys.size,
            solidReuseCandidates,
            solidReuseVisuals: solidReuseVisualIds.size,
            sameStyleDuplicateCandidates,
            priorDitherStyleReuseCandidates,
            priorDitherStyleReuseByStyle,
            newVisuals,
        });
    }

    const hammingComparisons = [];
    for (let first = 0; first < STRAIGHT_FILL_STYLE_ORDER.length; first += 1) {
        for (let second = first + 1; second < STRAIGHT_FILL_STYLE_ORDER.length; second += 1) {
            const styleA = STRAIGHT_FILL_STYLE_ORDER[first];
            const styleB = STRAIGHT_FILL_STYLE_ORDER[second];
            const candidatesA = styleCandidates.get(styleA) ?? [];
            const candidatesB = styleCandidates.get(styleB) ?? [];
            hammingComparisons.push(buildHammingComparison(styleA, styleB, candidatesA, candidatesB));
        }
    }

    const ditherStyles = styleStats.filter((style) => style.style !== "solid");
    const stats = {
        straightMathematicalDefinitions: straightResult.candidates.length,
        sideSemantics: solidResult.candidates.length,
        fillStyles: STRAIGHT_FILL_STYLE_ORDER.length,
        styledSemanticCandidates: candidates.length,
        uniqueStyledRasters: allStyledKeys.size,
        publishedStraightVisuals: straightResult.glyphs.length,
        straightVisualsReusedAcrossStyles: allStraightReuseKeys.size,
        novelSolidVisuals: solidResult.visuals.length,
        novelDitherVisuals: visuals.length,
        combinedStraightSolidAndDitherVisuals:
            straightResult.glyphs.length + solidResult.visuals.length + visuals.length,
        ditherSemanticCandidates: ditherStyles.reduce((sum, style) => sum + style.semanticCandidates, 0),
        ditherStraightReuseCandidates: ditherStyles.reduce((sum, style) => sum + style.straightReuseCandidates, 0),
        ditherSolidReuseCandidates: ditherStyles.reduce((sum, style) => sum + style.solidReuseCandidates, 0),
        ditherSameStyleDuplicateCandidates: ditherStyles.reduce((sum, style) => sum + style.sameStyleDuplicateCandidates, 0),
        ditherCrossStyleReuseCandidates: ditherStyles.reduce((sum, style) => sum + style.priorDitherStyleReuseCandidates, 0),
        styles: styleStats,
    };
    return { candidates, visuals, stats, hammingComparisons };
}
