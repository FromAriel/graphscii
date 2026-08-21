import { boundsForObject } from "./geometry";
import { GlyphRegistry } from "./registry";
import { GraphSolver } from "./solver";
import type { BezierObject, DrawingObject, Point } from "./types";

export type ViewMode = "art" | "cells";

function rowText(solver: GraphSolver, row: number): string {
  let text = "";
  for (let column = 0; column < solver.columns; column += 1) text += String.fromCodePoint(solver.codepointAt(column, row));
  return text;
}

export class CanvasRenderer {
  private zoom = 2;
  private viewMode: ViewMode = "art";

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly overlay: HTMLCanvasElement,
    private readonly registry: GlyphRegistry,
  ) {}

  setZoom(zoom: number): void {
    this.zoom = Math.max(0.5, Math.min(8, zoom));
  }

  getZoom(): number {
    return this.zoom;
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  resize(columns: number, rows: number): void {
    const cssWidth = columns * 8 * this.zoom;
    const cssHeight = rows * 16 * this.zoom;
    const dpr = window.devicePixelRatio || 1;
    for (const canvas of [this.canvas, this.overlay]) {
      canvas.width = Math.max(1, Math.round(cssWidth * dpr));
      canvas.height = Math.max(1, Math.round(cssHeight * dpr));
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }
  }

  render(solver: GraphSolver): void {
    this.resize(solver.columns, solver.rows);
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable.");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cssWidth = solver.columns * 8 * this.zoom;
    const cssHeight = solver.rows * 16 * this.zoom;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "#111111";
    ctx.font = `${16 * this.zoom}px GraphSCII`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fontKerning = "none";
    for (let row = 0; row < solver.rows; row += 1) {
      ctx.fillText(rowText(solver, row), 0, (row + 1) * 16 * this.zoom);
    }

    if (this.viewMode === "cells" && this.zoom >= 1) {
      ctx.save();
      ctx.strokeStyle = "rgba(30, 75, 120, 0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let column = 0; column <= solver.columns; column += 1) {
        const x = Math.round(column * 8 * this.zoom) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssHeight);
      }
      for (let row = 0; row <= solver.rows; row += 1) {
        const y = Math.round(row * 16 * this.zoom) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(cssWidth, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  renderOverlay(selected: DrawingObject | null, draft: DrawingObject | null, bezierGuide: BezierObject | null): void {
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.overlay.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    ctx.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, 0, 0);

    if (draft) this.drawVectorGuide(ctx, draft, "rgba(0, 100, 220, .75)");
    if (selected) {
      const bounds = boundsForObject(selected);
      ctx.save();
      ctx.strokeStyle = "rgba(0, 100, 220, .9)";
      ctx.lineWidth = 1 / this.zoom;
      ctx.setLineDash([4 / this.zoom, 3 / this.zoom]);
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.restore();
      this.drawVectorGuide(ctx, selected, "rgba(0, 100, 220, .45)");
    }
    if (bezierGuide) this.drawBezierHandles(ctx, bezierGuide);
  }

  logicalPoint(event: PointerEvent | WheelEvent): Point {
    const rect = this.overlay.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / this.zoom,
      y: (event.clientY - rect.top) / this.zoom,
    };
  }

  exportExactPng(solver: GraphSolver): Promise<Blob> {
    solver.assertExact();
    const canvas = document.createElement("canvas");
    canvas.width = solver.columns * 8;
    canvas.height = solver.rows * 16;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.reject(new Error("Canvas 2D unavailable."));
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111";
    for (let row = 0; row < solver.rows; row += 1) {
      for (let column = 0; column < solver.columns; column += 1) {
        const glyph = this.registry.byCodepoint.get(solver.codepointAt(column, row));
        if (!glyph) continue;
        const originX = column * 8;
        const originY = row * 16;
        for (let y = 0; y < 16; y += 1) {
          const rowByte = glyph.rows[y]!;
          for (let x = 0; x < 8; x += 1) {
            if ((rowByte & (1 << x)) !== 0) ctx.fillRect(originX + x, originY + y, 1, 1);
          }
        }
      }
    }
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed.")), "image/png");
    });
  }

  private drawVectorGuide(ctx: CanvasRenderingContext2D, object: DrawingObject, color: string): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(0.75, object.type === "ellipse" ? object.strokeWidth : object.width) / 3;
    ctx.setLineDash([3, 3]);
    switch (object.type) {
      case "line":
        ctx.beginPath();
        ctx.moveTo(object.start.x, object.start.y);
        ctx.lineTo(object.end.x, object.end.y);
        ctx.stroke();
        break;
      case "freehand":
        if (object.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(object.points[0]!.x, object.points[0]!.y);
          for (const point of object.points.slice(1)) ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
        break;
      case "bezier":
        ctx.beginPath();
        ctx.moveTo(object.p0.x, object.p0.y);
        ctx.bezierCurveTo(object.p1.x, object.p1.y, object.p2.x, object.p2.y, object.p3.x, object.p3.y);
        ctx.stroke();
        break;
      case "ellipse":
        ctx.beginPath();
        ctx.ellipse(object.center.x, object.center.y, object.radiusX, object.radiusY, object.rotation, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  private drawBezierHandles(ctx: CanvasRenderingContext2D, object: BezierObject): void {
    ctx.save();
    ctx.strokeStyle = "rgba(205, 70, 40, .9)";
    ctx.fillStyle = "rgba(205, 70, 40, .95)";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(object.p0.x, object.p0.y);
    ctx.lineTo(object.p1.x, object.p1.y);
    ctx.moveTo(object.p3.x, object.p3.y);
    ctx.lineTo(object.p2.x, object.p2.y);
    ctx.stroke();
    for (const point of [object.p0, object.p1, object.p2, object.p3]) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
