import { CELL_HEIGHT, CELL_WIDTH, } from "./types.js";
export function portCount(edge) {
    return edge === "L" || edge === "R" ? CELL_HEIGHT : CELL_WIDTH;
}
export function makePorts(edge) {
    return Array.from({ length: portCount(edge) }, (_, index) => ({ edge, index }));
}
export function portToPixel(port) {
    const count = portCount(port.edge);
    if (!Number.isInteger(port.index) || port.index < 0 || port.index >= count) {
        throw new Error(`Invalid ${port.edge} port index ${port.index}; expected 0..${count - 1}.`);
    }
    switch (port.edge) {
        case "L":
            return { x: 0, y: port.index };
        case "R":
            return { x: CELL_WIDTH - 1, y: port.index };
        case "T":
            return { x: port.index, y: 0 };
        case "B":
            return { x: port.index, y: CELL_HEIGHT - 1 };
    }
}
export function formatPort(port) {
    return `${port.edge}${port.index}`;
}
