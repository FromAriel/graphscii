import { maxJunctionArms, type GeometryGrid, type PortEdge, type PortName } from "./geometry-engine";
import type { DrawingObject } from "./types";

function portEdge(port: PortName): PortEdge {
  return port[0] as PortEdge;
}

function portIndex(port: PortName): number {
  return Number.parseInt(port.slice(1), 10);
}

function oppositePort(port: PortName): PortName {
  const edge = portEdge(port);
  const index = portIndex(port);
  switch (edge) {
    case "T": return `B${index}` as PortName;
    case "B": return `T${index}` as PortName;
    case "L": return `R${index}` as PortName;
    case "R": return `L${index}` as PortName;
  }
}

function neighborForEdge(column: number, row: number, edge: PortEdge): { column: number; row: number } {
  switch (edge) {
    case "T": return { column, row: row - 1 };
    case "B": return { column, row: row + 1 };
    case "L": return { column: column - 1, row };
    case "R": return { column: column + 1, row };
  }
}

function rebuildCellPorts(grid: GeometryGrid): void {
  for (const [key, cell] of [...grid.cells.entries()]) {
    cell.ports.clear();
    for (const objectCell of cell.byObject.values()) {
      for (const port of objectCell.ports) cell.ports.add(port);
    }
    if (cell.byObject.size === 0) grid.cells.delete(key);
  }
}

/**
 * Collapse one-cell U-turns that the published straight vocabulary cannot encode.
 *
 * A path that enters a cell and immediately leaves through the same edge creates a
 * same-edge pair such as R5/R8. GraphSCII has no straight semantic for that pair.
 * The representable line therefore stays in the neighboring cell instead of
 * fabricating a glyph. Both sides of the shared seam are removed together.
 */
export function normalizeStraightBacktracks(
  grid: GeometryGrid,
  objects: readonly DrawingObject[],
  columns: number,
  rows: number,
): void {
  const objectsById = new Map(objects.map((object) => [object.id, object]));
  const maximumPasses = Math.max(1, columns * rows * 2);

  for (let pass = 0; pass < maximumPasses; pass += 1) {
    let changed = false;

    for (const [key, cell] of [...grid.cells.entries()]) {
      const column = key % columns;
      const row = Math.floor(key / columns);

      for (const [objectId, objectCell] of [...cell.byObject.entries()]) {
        const object = objectsById.get(objectId);
        if (!object) continue;
        if (object.type === "ellipse" && object.fillEnabled) continue;
        if (objectCell.ports.size !== 2 || maxJunctionArms(objectCell.segments) >= 3) continue;

        const ports = [...objectCell.ports];
        const edge = portEdge(ports[0]!);
        if (portEdge(ports[1]!) !== edge) continue;

        const neighbor = neighborForEdge(column, row, edge);
        if (neighbor.column < 0 || neighbor.row < 0 || neighbor.column >= columns || neighbor.row >= rows) continue;
        const neighborKey = neighbor.row * columns + neighbor.column;
        const neighborCell = grid.cells.get(neighborKey);
        const neighborObject = neighborCell?.byObject.get(objectId);
        if (!neighborCell || !neighborObject) continue;

        const oppositeA = oppositePort(ports[0]!);
        const oppositeB = oppositePort(ports[1]!);
        if (!neighborObject.ports.has(oppositeA) || !neighborObject.ports.has(oppositeB)) continue;

        neighborObject.ports.delete(oppositeA);
        neighborObject.ports.delete(oppositeB);
        cell.byObject.delete(objectId);
        cell.segments = cell.segments.filter((segment) => segment.objectId !== objectId);
        changed = true;
      }
    }

    if (!changed) break;
    rebuildCellPorts(grid);
  }

  rebuildCellPorts(grid);
}
