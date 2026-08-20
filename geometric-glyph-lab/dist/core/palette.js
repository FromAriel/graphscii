import { formatCodepoint } from "./format.js";
import { portToPixel } from "./ports.js";
import { bitmapKey, cloneBitmap, setPixel } from "./raster.js";
import { ALL_FAMILIES, generate } from "./generator.js";
import { generateStraightSolidFills } from "./fill.js";
import { rasterizeStraightStyledFill } from "./dither.js";
export const BMP_PRIVATE_USE_START = 0xe000;
export const BMP_PRIVATE_USE_END = 0xf8ff;
export const BMP_PRIVATE_USE_CAPACITY = BMP_PRIVATE_USE_END - BMP_PRIVATE_USE_START + 1;
export const GRAPHSCII_GRAPHICS_TARGET = 5800;
export const GRAPHSCII_RESERVE_TARGET = 600;
export const PRINTABLE_ASCII_START = 0x20;
export const PRINTABLE_ASCII_END = 0x7e;
export const PRINTABLE_ASCII_COUNT = PRINTABLE_ASCII_END - PRINTABLE_ASCII_START + 1;
export const HALF_DITHER_ROWS = [
    "#-#-#-#-",
    "-#-#-#-#",
    "#-#-#-#-",
    "-#-#-#-#",
    "#-#-#-#-",
    "-#-#-#-#",
    "#-#-#-#-",
    "-#-#-#-#",
];
export const PALETTE_RESEARCH_STYLE_ORDER = [
    "solid",
    "dense",
    "medium",
    "half",
    "light",
    "sparse",
];
export const PALETTE_STYLE_DENSITIES = {
    solid: 1,
    dense: 0.875,
    medium: 0.75,
    half: 0.5,
    light: 0.25,
    sparse: 0.125,
};
export const SELECTED_ENCODED_STYLES = ["solid", "medium", "half", "light"];
export const RENDERER_ONLY_STYLES = ["dense", "sparse"];
export const SELECTED_ALLOCATION_ORDER = ["solid", "medium", "light", "half"];
export const HALF_RENDERER_ONLY_HAMMING_DISTANCE = 1;
function orientedCross(start, end, point) {
    return (end.x - start.x) * (point.y - start.y)
        - (end.y - start.y) * (point.x - start.x);
}
export function halfDitherMaskHasPixel(x, y) {
    const wrappedX = ((x % 8) + 8) % 8;
    const wrappedY = ((y % 8) + 8) % 8;
    return HALF_DITHER_ROWS[wrappedY]?.[wrappedX] === "#";
}
export function rasterizeHalfStraightFill(straight, side) {
    const start = portToPixel(straight.start);
    const end = portToPixel(straight.end);
    const bitmap = cloneBitmap(straight.bitmap);
    for (let y = 0; y < 16; y += 1) {
        for (let x = 0; x < 8; x += 1) {
            const cross = orientedCross(start, end, { x, y });
            const selected = side === "A" ? cross > 0 : cross < 0;
            if (selected && halfDitherMaskHasPixel(x, y)) {
                setPixel(bitmap, x, y);
            }
        }
    }
    return bitmap;
}
export function rasterizePaletteStyle(straight, side, style) {
    if (style === "half") {
        return rasterizeHalfStraightFill(straight, side);
    }
    return rasterizeStraightStyledFill(straight, side, style);
}
function collectStyleBitmaps(straightResult, style) {
    const byKey = new Map();
    for (const straight of straightResult.candidates) {
        for (const side of ["A", "B"]) {
            const bitmap = rasterizePaletteStyle(straight, side, style);
            const key = bitmapKey(bitmap);
            const existing = byKey.get(key);
            if (existing) {
                existing.semanticAliasCount += 1;
            }
            else {
                byKey.set(key, { bitmap, semanticAliasCount: 1 });
            }
        }
    }
    return byKey;
}
function combinations(items, count) {
    const result = [];
    const visit = (start, chosen) => {
        if (chosen.length === count) {
            result.push([...chosen]);
            return;
        }
        for (let index = start; index < items.length; index += 1) {
            const item = items[index];
            if (item !== undefined) {
                chosen.push(item);
                visit(index + 1, chosen);
                chosen.pop();
            }
        }
    };
    visit(0, []);
    return result;
}
function evaluatePalette(styles, straightKeys, styleMaps) {
    const keys = new Set(straightKeys);
    for (const style of styles) {
        for (const key of styleMaps.get(style)?.keys() ?? []) {
            keys.add(key);
        }
    }
    const densities = styles.map((style) => PALETTE_STYLE_DENSITIES[style]).sort((a, b) => b - a);
    const densityGaps = densities.slice(0, -1).map((density, index) => density - (densities[index + 1] ?? 0));
    const maxDensityGap = Math.max(...densityGaps);
    const minDensityGap = Math.min(...densityGaps);
    return {
        styles: [...styles],
        styleCount: styles.length,
        densities,
        densityGaps,
        maxDensityGap,
        densityGapSpread: Number((maxDensityGap - minDensityGap).toFixed(6)),
        exactVisuals: keys.size,
        puaReserve: BMP_PRIVATE_USE_CAPACITY - keys.size,
        meetsGraphicsTarget: keys.size <= GRAPHSCII_GRAPHICS_TARGET,
    };
}
function findOnePixelNeighbor(bitmap, allocatedKeys) {
    for (let y = 0; y < bitmap.length; y += 1) {
        for (let x = 0; x < 8; x += 1) {
            const neighbor = cloneBitmap(bitmap);
            neighbor[y] = (neighbor[y] ?? 0) ^ (1 << x);
            const key = bitmapKey(neighbor);
            if (allocatedKeys.has(key)) {
                return key;
            }
        }
    }
    return null;
}
function makeRange(family, count, start) {
    return {
        family,
        count,
        startCodepoint: formatCodepoint(start),
        endCodepoint: formatCodepoint(start + count - 1),
    };
}
export function buildPaletteDecision(straightResult = generate(ALL_FAMILIES)) {
    generateStraightSolidFills(straightResult);
    const straightKeys = new Set(straightResult.glyphs.map((glyph) => glyph.bitmapKey));
    const styleMaps = new Map();
    for (const style of PALETTE_RESEARCH_STYLE_ORDER) {
        styleMaps.set(style, collectStyleBitmaps(straightResult, style));
    }
    const optionalStyles = PALETTE_RESEARCH_STYLE_ORDER.filter((style) => style !== "solid");
    const candidatePalettes = [3, 4]
        .flatMap((styleCount) => combinations(optionalStyles, styleCount - 1)
        .map((rest) => evaluatePalette(["solid", ...rest], straightKeys, styleMaps)))
        .sort((a, b) => a.styleCount - b.styleCount || a.exactVisuals - b.exactVisuals || a.styles.join(",").localeCompare(b.styles.join(",")));
    const baseAllocatedKeys = new Set(straightKeys);
    const incrementalAllocatedVisuals = {
        straight: straightKeys.size,
    };
    for (const style of ["solid", "medium", "light"]) {
        let added = 0;
        for (const key of styleMaps.get(style)?.keys() ?? []) {
            if (!baseAllocatedKeys.has(key)) {
                baseAllocatedKeys.add(key);
                added += 1;
            }
        }
        incrementalAllocatedVisuals[style] = added;
    }
    const halfMap = styleMaps.get("half");
    if (!halfMap) {
        throw new Error("Missing 50% half-tone research map.");
    }
    const halfOnlyEntries = [...halfMap.entries()].filter(([key]) => !baseAllocatedKeys.has(key));
    const halfDemotions = [];
    let allocatedHalfVisuals = 0;
    for (const [key, entry] of halfOnlyEntries) {
        const neighbor = findOnePixelNeighbor(entry.bitmap, baseAllocatedKeys);
        if (neighbor) {
            halfDemotions.push({
                bitmapKey: key,
                nearestAllocatedBitmapKey: neighbor,
                hammingDistance: HALF_RENDERER_ONLY_HAMMING_DISTANCE,
                semanticAliasCount: entry.semanticAliasCount,
            });
        }
        else {
            allocatedHalfVisuals += 1;
        }
    }
    halfDemotions.sort((a, b) => a.bitmapKey.localeCompare(b.bitmapKey));
    incrementalAllocatedVisuals.half = allocatedHalfVisuals;
    const exactSelected = evaluatePalette(SELECTED_ENCODED_STYLES, straightKeys, styleMaps);
    const allocatedVisuals = baseAllocatedKeys.size + allocatedHalfVisuals;
    const puaReserve = BMP_PRIVATE_USE_CAPACITY - allocatedVisuals;
    const halfDemotedSemantics = halfDemotions.reduce((sum, entry) => sum + entry.semanticAliasCount, 0);
    if (allocatedVisuals > GRAPHSCII_GRAPHICS_TARGET) {
        throw new Error(`Selected palette exceeds ${GRAPHSCII_GRAPHICS_TARGET} graphics target: ${allocatedVisuals}.`);
    }
    if (puaReserve < GRAPHSCII_RESERVE_TARGET) {
        throw new Error(`Selected palette leaves only ${puaReserve} PUA slots; expected at least ${GRAPHSCII_RESERVE_TARGET}.`);
    }
    const plannedAllocation = [];
    let nextCodepoint = BMP_PRIVATE_USE_START;
    for (const family of ["straight", "solid", "medium", "light", "half"]) {
        const count = incrementalAllocatedVisuals[family] ?? 0;
        plannedAllocation.push(makeRange(family, count, nextCodepoint));
        nextCodepoint += count;
    }
    plannedAllocation.push(makeRange("reserve", BMP_PRIVATE_USE_END - nextCodepoint + 1, nextCodepoint));
    return {
        status: "decision-complete-unallocated",
        capacity: {
            puaStart: formatCodepoint(BMP_PRIVATE_USE_START),
            puaEnd: formatCodepoint(BMP_PRIVATE_USE_END),
            puaSlots: BMP_PRIVATE_USE_CAPACITY,
            graphicsTarget: GRAPHSCII_GRAPHICS_TARGET,
            reserveTarget: GRAPHSCII_RESERVE_TARGET,
            printableAsciiStart: formatCodepoint(PRINTABLE_ASCII_START),
            printableAsciiEnd: formatCodepoint(PRINTABLE_ASCII_END),
            printableAsciiCount: PRINTABLE_ASCII_COUNT,
            printableAsciiConsumesPua: false,
        },
        researchStyles: PALETTE_RESEARCH_STYLE_ORDER.map((style) => ({
            style,
            density: PALETTE_STYLE_DENSITIES[style],
        })),
        candidatePalettes,
        selected: {
            encodedStyles: [...SELECTED_ENCODED_STYLES],
            rendererOnlyStyles: [...RENDERER_ONLY_STYLES],
            exactUncompressedVisuals: exactSelected.exactVisuals,
            halfOnlyVisualsBeforeCompression: halfOnlyEntries.length,
            halfOnePixelDemotedVisuals: halfDemotions.length,
            halfOnePixelDemotedSemantics: halfDemotedSemantics,
            allocatedVisuals,
            puaReserve,
            physicalGlyphsIncludingPrintableAscii: allocatedVisuals + PRINTABLE_ASCII_COUNT,
            compressionRule: "50% visuals that are globally novel but exactly one pixel from an already encoded straight/solid/75%/25% visual remain renderer-only; every other selected-style visual is encoded",
            rationale: "100%, 75%, 50%, and 25% give evenly spaced quarter-step tone levels. Exact materialization costs 5,858 visuals; demoting the 62 one-pixel-near 50% owners reduces the encoded graphics vocabulary to 5,796 and leaves 604 BMP PUA slots reserved. Dense 87.5% and sparse 12.5% remain semantic renderer-only styles with exact reuse whenever their raster already has an encoded owner.",
        },
        incrementalAllocatedVisuals,
        plannedAllocation,
        halfDemotions,
    };
}
