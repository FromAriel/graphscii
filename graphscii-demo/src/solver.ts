import {
  CELL_HEIGHT,
  CELL_WIDTH,
  buildGeometryGrid,
  sampleEllipseCellFill,
  validateSharedPorts,
  type PortName,
} from "./geometry-engine";
import { junctionTopology } from "./connector-topology";
import { GlyphRegistry } from "./semantic-registry";
import type { CellRect, DrawingObject, EllipseObject } from "./types";

const BLANK_CODEPOINT = 0x20;

export interface ConversionIssue {
  column: number;
  row: number;
  reason: string;
  objectIds: string[];
}

interface FillContribution {
  object: EllipseObject;
  insideCount: number;
  insideLocalPixelCenters: Array<{ x: number; y: number }>;
}

function sortedPorts(ports: ReadonlySet<PortName>): PortName[] {
  const edgeRank: Record<string, number> = { T: 0, R: 1, B: 2, L: 3 };
  return [...ports].sort((a, b) => {
    const edgeDifference = (edgeRank[a[0]!] ?? 99) - (edgeRank[b[0]!] ?? 99);
    if (edgeDifference !== 0) return edgeDifference;
    return Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10);
  });
}

function ellipseBounds(object: EllipseObject): { minX: number; maxX: number; minY: number; maxY: number } {
  const c = Math.abs(Math.cos(object.rotation));
  const s = Math.abs(Math.sin(object.rotation));
  const halfWidth = object.radiusX * c + object.radiusY * s;
  const halfHeight = object.radiusX * s + object.radiusY * c;
  return {
    minX: object.center.x - halfWidth,
    maxX: object.center.x + halfWidth,
    minY: object.center.y - halfHeight,
    maxY: object.center.y + halfHeight,
  };
}

function collectFillContributions(
  objects: readonly DrawingObject[],
  columns: number,
  rows: number,
): Map<number, FillContribution[]> {
  const result = new Map<number, FillContribution[]>();
  for (const object of objects) {
    if (object.type !== "ellipse" || !object.fillEnabled) continue;
    const bounds = ellipseBounds(object);
    const minColumn = Math.max(0, Math.floor(bounds.minX / CELL_WIDTH));
    const maxColumn = Math.min(columns - 1, Math.floor(bounds.maxX / CELL_WIDTH));
    const minRow = Math.max(0, Math.floor(bounds.minY / CELL_HEIGHT));
    const maxRow = Math.min(rows - 1, Math.floor(bounds.maxY / CELL_HEIGHT));
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        const sample = sampleEllipseCellFill(object, column, row);
        if (sample.insideCount === 0) continue;
        const key = row * columns + column;
        const contributions = result.get(key) ?? [];
        contributions.push({
          object,
          insideCount: sample.insideCount,
          insideLocalPixelCenters: sample.insideLocalPixelCenters,
        });
        result.set(key, contributions);
      }
    }
  }
  return result;
}

export class GraphSolver {
  readonly grid: Uint32Array;
  private issues: ConversionIssue[] = [];
  private issueByCell = new Map<number, ConversionIssue>();

  constructor(
    private readonly registry: GlyphRegistry,
    readonly columns: number,
    readonly rows: number,
  ) {
    this.grid = new Uint32Array(columns * rows);
    this.grid.fill(BLANK_CODEPOINT);
  }

  get issueCount(): number {
    return this.issues.length;
  }

  get conversionIssues(): readonly ConversionIssue[] {
    return this.issues;
  }

  clear(): void {
    this.grid.fill(BLANK_CODEPOINT);
    this.issues = [];
    this.issueByCell.clear();
  }

  solve(objects: DrawingObject[], _cellRect: CellRect): void {
    // Semantic correctness is authoritative. Rebuild from the complete editable
    // geometry so stale dirty-region glyphs cannot survive a geometry change.
    this.clear();
    if (objects.length === 0) return;

    const geometry = buildGeometryGrid(objects, this.columns, this.rows);
    const seamErrors = validateSharedPorts(geometry, this.columns, this.rows);
    if (seamErrors.length > 0) {
      throw new Error(`GraphSCII internal seam invariant failed: ${seamErrors[0]}`);
    }
    const fills = collectFillContributions(objects, this.columns, this.rows);

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const key = row * this.columns + column;
        const cell = geometry.cells.get(key);
        const fillContributions = fills.get(key) ?? [];

        if (fillContributions.length > 1) {
          this.markIssue(
            column,
            row,
            "overlapping filled regions are not one exact GraphSCII v1 semantic",
            fillContributions.map((item) => item.object.id),
          );
          continue;
        }

        if (fillContributions.length === 1) {
          const fill = fillContributions[0]!;
          if (cell) {
            const foreign = [...cell.byObject.entries()]
              .filter(([objectId, objectGeometry]) => objectId !== fill.object.id
                && (objectGeometry.ports.size > 0 || objectGeometry.segments.length > 0))
              .map(([objectId]) => objectId)
              .sort();
            if (foreign.length > 0) {
              this.markIssue(
                column,
                row,
                "filled region overlaps independent stroke geometry in the same cell",
                [fill.object.id, ...foreign],
              );
              continue;
            }
          }

          const objectCell = cell?.byObject.get(fill.object.id);
          const ports = objectCell ? sortedPorts(objectCell.ports) : [];
          if (ports.length === 0) {
            if (fill.insideCount === CELL_WIDTH * CELL_HEIGHT) {
              this.grid[key] = this.registry.resolveFullFill(fill.object.fillTone).codepointValue;
            } else {
              this.markIssue(
                column,
                row,
                "filled shape is partial inside a cell without a published straight boundary semantic",
                [fill.object.id],
              );
            }
            continue;
          }

          if (ports.length !== 2) {
            this.markIssue(
              column,
              row,
              `filled boundary has ${ports.length} ports; GraphSCII straight-fill semantics require exactly two`,
              [fill.object.id],
            );
            continue;
          }

          const resolution = this.registry.resolveFillForInterior(
            ports[0]!,
            ports[1]!,
            fill.object.fillTone,
            fill.insideLocalPixelCenters,
          );
          if (!resolution.glyph || !resolution.exact) {
            this.markIssue(
              column,
              row,
              `fill semantic ${resolution.semanticKey} is not exactly encodable${resolution.reason ? `: ${resolution.reason}` : ""}`,
              [fill.object.id],
            );
            continue;
          }
          this.grid[key] = resolution.glyph.codepointValue;
          continue;
        }

        if (!cell) continue;
        const ports = sortedPorts(cell.ports);
        const objectIds = [...cell.byObject.keys()].sort();
        const junction = junctionTopology(cell.segments);

        if (junction && junction.arms >= 3) {
          if (ports.length < 3 || ports.length > 4) {
            this.markIssue(column, row, `junction has ${junction.arms} arms but ${ports.length} boundary ports`, objectIds);
            continue;
          }
          if (!junction.family) {
            this.markIssue(
              column,
              row,
              `junction has ${junction.arms} authored arms but does not match the published orthogonal or diagonal connector topology`,
              objectIds,
            );
            continue;
          }
          const connector = this.registry.resolveConnector(ports, junction.family);
          if (!connector) {
            this.markIssue(
              column,
              row,
              `no unambiguous published GraphSCII v1 ${junction.family} connector semantic matches ${ports.join(", ")}`,
              objectIds,
            );
            continue;
          }
          this.grid[key] = connector.codepointValue;
          continue;
        }

        if (ports.length === 2) {
          const straight = this.registry.resolveStraight(ports[0]!, ports[1]!);
          if (!straight) {
            this.markIssue(
              column,
              row,
              `no published straight semantic matches ${ports[0]} ↔ ${ports[1]}`,
              objectIds,
            );
            continue;
          }
          this.grid[key] = straight.glyph.codepointValue;
          continue;
        }

        if (cell.segments.length > 0 || ports.length > 0) {
          const description = ports.length === 0
            ? "geometry is contained inside the cell without two boundary ports"
            : `non-junction stroke has ${ports.length} boundary ports instead of exactly two`;
          this.markIssue(column, row, description, objectIds);
        }
      }
    }
  }

  codepointAt(column: number, row: number): number {
    if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) return BLANK_CODEPOINT;
    return this.grid[row * this.columns + column]!;
  }

  issueAt(column: number, row: number): ConversionIssue | undefined {
    if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) return undefined;
    return this.issueByCell.get(row * this.columns + column);
  }

  assertExact(): void {
    if (this.issues.length === 0) return;
    const first = this.issues[0]!;
    throw new Error(
      `Drawing contains ${this.issues.length} cell${this.issues.length === 1 ? "" : "s"} that are not exactly representable in GraphSCII v1. `
      + `First: cell ${first.column},${first.row}: ${first.reason}.`,
    );
  }

  toText(): string {
    this.assertExact();
    const lines: string[] = [];
    for (let row = 0; row < this.rows; row += 1) {
      let line = "";
      for (let column = 0; column < this.columns; column += 1) {
        line += String.fromCodePoint(this.codepointAt(column, row));
      }
      lines.push(line.replace(/ +$/u, ""));
    }
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return `${lines.join("\n")}\n`;
  }

  private markIssue(column: number, row: number, reason: string, objectIds: string[]): void {
    const issue: ConversionIssue = {
      column,
      row,
      reason,
      objectIds: [...new Set(objectIds)].sort(),
    };
    this.issues.push(issue);
    this.issueByCell.set(row * this.columns + column, issue);
  }
}
