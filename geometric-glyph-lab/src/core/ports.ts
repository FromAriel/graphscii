import {
  CELL_HEIGHT,
  CELL_WIDTH,
  type Edge,
  type PixelPoint,
  type Port,
} from "./types.js";

export function portCount(edge: Edge): number {
  return edge === "L" || edge === "R" ? CELL_HEIGHT : CELL_WIDTH;
}

export function makePorts(edge: Edge): Port[] {
  return Array.from({ length: portCount(edge) }, (_, index) => ({ edge, index }));
}

export function portToPixel(port: Port): PixelPoint {
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

export function formatPort(port: Port): string {
  return `${port.edge}${port.index}`;
}
