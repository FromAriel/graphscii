import { bitmapKey, rasterizePortLine } from "./raster.js";
import { makePorts } from "./ports.js";
import { PRIVATE_USE_START, } from "./types.js";
export const FAMILY_DEFINITIONS = [
    { id: "LR", label: "Left → Right", startEdge: "L", endEdge: "R", candidateCount: 256 },
    { id: "TB", label: "Top → Bottom", startEdge: "T", endEdge: "B", candidateCount: 64 },
    { id: "LT", label: "Left → Top", startEdge: "L", endEdge: "T", candidateCount: 128 },
    { id: "LB", label: "Left → Bottom", startEdge: "L", endEdge: "B", candidateCount: 128 },
    { id: "RT", label: "Right → Top", startEdge: "R", endEdge: "T", candidateCount: 128 },
    { id: "RB", label: "Right → Bottom", startEdge: "R", endEdge: "B", candidateCount: 128 },
];
export const ALL_FAMILIES = new Set(FAMILY_DEFINITIONS.map((family) => family.id));
export function generate(selectedFamilies) {
    const candidates = [];
    let nextCandidateId = 0;
    for (const family of FAMILY_DEFINITIONS) {
        if (!selectedFamilies.has(family.id)) {
            continue;
        }
        const startPorts = makePorts(family.startEdge);
        const endPorts = makePorts(family.endEdge);
        for (const start of startPorts) {
            for (const end of endPorts) {
                const bitmap = rasterizePortLine(start, end);
                candidates.push({
                    candidateId: nextCandidateId,
                    family: family.id,
                    start,
                    end,
                    bitmap,
                    bitmapKey: bitmapKey(bitmap),
                });
                nextCandidateId += 1;
            }
        }
    }
    const byBitmap = new Map();
    const glyphs = [];
    for (const candidate of candidates) {
        const existing = byBitmap.get(candidate.bitmapKey);
        if (existing) {
            existing.aliases.push(candidate);
            continue;
        }
        const glyphId = glyphs.length;
        const glyph = {
            glyphId,
            codepoint: PRIVATE_USE_START + glyphId,
            bitmap: candidate.bitmap,
            bitmapKey: candidate.bitmapKey,
            aliases: [candidate],
        };
        byBitmap.set(candidate.bitmapKey, glyph);
        glyphs.push(glyph);
    }
    return {
        candidates,
        glyphs,
        duplicateCandidates: candidates.length - glyphs.length,
    };
}
