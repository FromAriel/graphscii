import { formatCodepoint } from "./format.js";
import { formatPort, portToPixel } from "./ports.js";
import { bitmapKey, emptyBitmap, hasPixel, rasterizeLineBetweenPixels, } from "./raster.js";
import { CELL_HEIGHT, CELL_WIDTH, } from "./types.js";
export const CURVE_FIXED_SCALE = 256;
export const CURVE_SAMPLE_STEPS = 256;
export const CURVE_TANGENTS = [
    "hard-left",
    "soft-left",
    "normal",
    "soft-right",
    "hard-right",
];
export const CURVE_STRENGTHS = [
    "tight",
    "normal",
    "gentle",
];
const DIRECTION_SCALE = 1024;
const TANGENT_COMPONENTS = {
    "hard-left": [724, 724],
    "soft-left": [916, 458],
    normal: [1024, 0],
    "soft-right": [916, -458],
    "hard-right": [724, -724],
};
const STRENGTH_FRACTIONS = {
    tight: [3, 8],
    normal: [1, 2],
    gentle: [5, 8],
};
function inwardVector(edge) {
    switch (edge) {
        case "L":
            return { x: 1, y: 0 };
        case "R":
            return { x: -1, y: 0 };
        case "T":
            return { x: 0, y: 1 };
        case "B":
            return { x: 0, y: -1 };
    }
}
function tangentDirection(edge, tangent) {
    const inward = inwardVector(edge);
    const left = { x: -inward.y, y: inward.x };
    const [forwardComponent, lateralComponent] = TANGENT_COMPONENTS[tangent];
    return {
        x: inward.x * forwardComponent + left.x * lateralComponent,
        y: inward.y * forwardComponent + left.y * lateralComponent,
    };
}
function toFixed(point) {
    return {
        x: point.x * CURVE_FIXED_SCALE,
        y: point.y * CURVE_FIXED_SCALE,
    };
}
function roundedDivide(numerator, denominator) {
    if (denominator <= 0) {
        throw new Error("roundedDivide requires a positive denominator.");
    }
    return Math.round(numerator / denominator);
}
export function deriveCurveControlPoints(spec) {
    const p0 = toFixed(portToPixel(spec.start));
    const p3 = toFixed(portToPixel(spec.end));
    const dx = p3.x - p0.x;
    const dy = p3.y - p0.y;
    const chordLength = Math.round(Math.hypot(dx, dy));
    const [strengthNumerator, strengthDenominator] = STRENGTH_FRACTIONS[spec.strength];
    const handleLength = Math.max(CURVE_FIXED_SCALE / 2, roundedDivide(chordLength * strengthNumerator, strengthDenominator));
    const startDirection = tangentDirection(spec.start.edge, spec.startTangent);
    const endDirection = tangentDirection(spec.end.edge, spec.endTangent);
    const p1 = {
        x: p0.x + roundedDivide(startDirection.x * handleLength, DIRECTION_SCALE),
        y: p0.y + roundedDivide(startDirection.y * handleLength, DIRECTION_SCALE),
    };
    // The end control point lies inward from P3. As t approaches 1, the cubic
    // derivative points from P2 to P3 and therefore exits through the end port.
    const p2 = {
        x: p3.x + roundedDivide(endDirection.x * handleLength, DIRECTION_SCALE),
        y: p3.y + roundedDivide(endDirection.y * handleLength, DIRECTION_SCALE),
    };
    return { p0, p1, p2, p3 };
}
function evaluateCubicFixed(control, step) {
    const t = step;
    const u = CURVE_SAMPLE_STEPS - step;
    const denominator = CURVE_SAMPLE_STEPS ** 3;
    const weight0 = u ** 3;
    const weight1 = 3 * u * u * t;
    const weight2 = 3 * u * t * t;
    const weight3 = t ** 3;
    return {
        x: roundedDivide(control.p0.x * weight0 +
            control.p1.x * weight1 +
            control.p2.x * weight2 +
            control.p3.x * weight3, denominator),
        y: roundedDivide(control.p0.y * weight0 +
            control.p1.y * weight1 +
            control.p2.y * weight2 +
            control.p3.y * weight3, denominator),
    };
}
function fixedToPixel(point) {
    return {
        x: Math.round(point.x / CURVE_FIXED_SCALE),
        y: Math.round(point.y / CURVE_FIXED_SCALE),
    };
}
function mergeBitmap(target, source) {
    for (let y = 0; y < target.length; y += 1) {
        target[y] |= source[y];
    }
}
function sampleCurve(control) {
    const points = [];
    for (let step = 0; step <= CURVE_SAMPLE_STEPS; step += 1) {
        points.push(evaluateCubicFixed(control, step));
    }
    return points;
}
function rasterizeSamples(samples) {
    const bitmap = emptyBitmap();
    let previous = fixedToPixel(samples[0]);
    for (let index = 1; index < samples.length; index += 1) {
        const current = fixedToPixel(samples[index]);
        mergeBitmap(bitmap, rasterizeLineBetweenPixels(previous, current));
        previous = current;
    }
    return bitmap;
}
function pointKey(point) {
    return `${point.x},${point.y}`;
}
function validateBoundaryPixels(bitmap, spec) {
    const allowed = new Set([
        pointKey(portToPixel(spec.start)),
        pointKey(portToPixel(spec.end)),
    ]);
    const unexpected = [];
    for (let y = 0; y < CELL_HEIGHT; y += 1) {
        for (let x = 0; x < CELL_WIDTH; x += 1) {
            if (!hasPixel(bitmap, x, y)) {
                continue;
            }
            const onBoundary = x === 0 || y === 0 || x === CELL_WIDTH - 1 || y === CELL_HEIGHT - 1;
            if (onBoundary && !allowed.has(pointKey({ x, y }))) {
                unexpected.push(`${x},${y}`);
            }
        }
    }
    return unexpected;
}
function isBitmapConnected(bitmap) {
    const pixels = [];
    for (let y = 0; y < CELL_HEIGHT; y += 1) {
        for (let x = 0; x < CELL_WIDTH; x += 1) {
            if (hasPixel(bitmap, x, y)) {
                pixels.push({ x, y });
            }
        }
    }
    if (pixels.length === 0) {
        return false;
    }
    const visited = new Set();
    const queue = [pixels[0]];
    visited.add(pointKey(pixels[0]));
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            break;
        }
        for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
                if (dx === 0 && dy === 0) {
                    continue;
                }
                const next = { x: current.x + dx, y: current.y + dy };
                if (next.x < 0 ||
                    next.x >= CELL_WIDTH ||
                    next.y < 0 ||
                    next.y >= CELL_HEIGHT ||
                    !hasPixel(bitmap, next.x, next.y)) {
                    continue;
                }
                const key = pointKey(next);
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push(next);
                }
            }
        }
    }
    return visited.size === pixels.length;
}
function orientation(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function rangesOverlap(a0, a1, b0, b1) {
    const aMin = Math.min(a0, a1);
    const aMax = Math.max(a0, a1);
    const bMin = Math.min(b0, b1);
    const bMax = Math.max(b0, b1);
    return aMax >= bMin && bMax >= aMin;
}
function segmentsIntersect(a, b, c, d) {
    if (!rangesOverlap(a.x, b.x, c.x, d.x) || !rangesOverlap(a.y, b.y, c.y, d.y)) {
        return false;
    }
    const abC = orientation(a, b, c);
    const abD = orientation(a, b, d);
    const cdA = orientation(c, d, a);
    const cdB = orientation(c, d, b);
    return (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
        ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0)));
}
function polylineSelfIntersects(samples) {
    for (let first = 0; first < samples.length - 1; first += 1) {
        const a = samples[first];
        const b = samples[first + 1];
        if (a.x === b.x && a.y === b.y) {
            continue;
        }
        for (let second = first + 2; second < samples.length - 1; second += 1) {
            // Neighboring segments share a vertex by construction.
            if (second === first + 1) {
                continue;
            }
            const c = samples[second];
            const d = samples[second + 1];
            if (c.x === d.x && c.y === d.y) {
                continue;
            }
            if (segmentsIntersect(a, b, c, d)) {
                return true;
            }
        }
    }
    return false;
}
function validateCurve(spec, control, samples, bitmap) {
    const reasons = [];
    const startPixel = portToPixel(spec.start);
    const endPixel = portToPixel(spec.end);
    if (startPixel.x === endPixel.x && startPixel.y === endPixel.y) {
        reasons.push("zero-length endpoint geometry");
    }
    const maxX = (CELL_WIDTH - 1) * CURVE_FIXED_SCALE;
    const maxY = (CELL_HEIGHT - 1) * CURVE_FIXED_SCALE;
    if (samples.some((point) => point.x < 0 || point.x > maxX || point.y < 0 || point.y > maxY)) {
        reasons.push("curve escapes the canonical cell");
    }
    if (!hasPixel(bitmap, startPixel.x, startPixel.y)) {
        reasons.push(`raster misses start port ${formatPort(spec.start)}`);
    }
    if (!hasPixel(bitmap, endPixel.x, endPixel.y)) {
        reasons.push(`raster misses end port ${formatPort(spec.end)}`);
    }
    const unexpectedBoundaryPixels = validateBoundaryPixels(bitmap, spec);
    if (unexpectedBoundaryPixels.length > 0) {
        reasons.push(`raster touches unintended boundary pixel${unexpectedBoundaryPixels.length === 1 ? "" : "s"}: ${unexpectedBoundaryPixels.join(" ")}`);
    }
    if (!isBitmapConnected(bitmap)) {
        reasons.push("raster is disconnected");
    }
    if (polylineSelfIntersects(samples)) {
        reasons.push("sampled curve self-intersects");
    }
    // Control points may lie outside the cell while the curve itself remains inside;
    // that is allowed. The sampled curve is the validity authority.
    void control;
    return { valid: reasons.length === 0, reasons };
}
export function makeCurveAliasKey(spec) {
    return `curve:${formatPort(spec.start)}>${formatPort(spec.end)}:${spec.startTangent}:${spec.endTangent}:${spec.strength}`;
}
export function rasterizeCurve(spec) {
    const controlPoints = deriveCurveControlPoints(spec);
    const samples = sampleCurve(controlPoints);
    const bitmap = rasterizeSamples(samples);
    return {
        spec,
        aliasKey: makeCurveAliasKey(spec),
        controlPoints,
        bitmap,
        bitmapKey: bitmapKey(bitmap),
        validation: validateCurve(spec, controlPoints, samples, bitmap),
    };
}
export function resolveCurveAgainstStraights(curve, straightGlyphs) {
    const match = straightGlyphs.find((glyph) => glyph.bitmapKey === curve.bitmapKey);
    if (!match) {
        return {
            visualDisposition: "novel-curve",
            canonicalGlyphId: null,
            canonicalCodepoint: null,
            canonicalClass: null,
            exactBitmapMatch: false,
        };
    }
    return {
        visualDisposition: "reuse-existing-straight",
        canonicalGlyphId: match.glyphId,
        canonicalCodepoint: formatCodepoint(match.codepoint),
        canonicalClass: "straight-lines",
        exactBitmapMatch: true,
    };
}
