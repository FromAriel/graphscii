import {
  ALL_FAMILIES,
  CELL_HEIGHT,
  CELL_WIDTH,
  bitmapAscii,
  formatCodepoint,
  formatPort,
  generate,
  generateStraightSolidFills,
  hasPixel,
  rasterizeStraightSideFill,
  type CandidateGlyph,
  type StraightFillCandidate,
} from "./core/index.js";

const STYLE_ID = "straight-fill-research-styles";
const straightBaseline = generate(ALL_FAMILIES);
const fillResearch = generateStraightSolidFills(straightBaseline);
const straightByBitmap = new Map(straightBaseline.glyphs.map((glyph) => [glyph.bitmapKey, glyph]));

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .fill-research-panel .panel-heading { align-items: flex-end; }
    .fill-lab-body { padding: 22px; display: grid; gap: 18px; }
    .fill-summary-grid { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 8px; }
    .fill-stat { padding: 10px 12px; border: 1px solid #1a2c38; border-radius: 9px; background: #08131b; }
    .fill-stat span, .fill-stat strong { display: block; }
    .fill-stat span { color: #718695; font-size: 0.66rem; font-weight: 700; }
    .fill-stat strong { margin-top: 3px; color: #ecf8ff; font-family: "Cascadia Code", Consolas, monospace; font-size: 1rem; }
    .fill-control-row { display: grid; grid-template-columns: minmax(260px, 1fr) auto; gap: 16px; align-items: end; }
    .fill-field { display: grid; gap: 5px; }
    .fill-field span { color: #718695; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; }
    .fill-field select { width: 100%; padding: 8px 9px; border: 1px solid #2b4251; border-radius: 7px; background: #08131a; color: #d9edf8; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.72rem; }
    .fill-rule { margin: 0; max-width: 540px; color: #718695; font-size: 0.72rem; line-height: 1.5; }
    .fill-preview-grid { display: grid; grid-template-columns: repeat(3, minmax(190px, 1fr)); gap: 14px; }
    .fill-preview-card { padding: 14px; border: 1px solid #1d303e; border-radius: 10px; background: #09151d; }
    .fill-preview-card h3 { margin: 0 0 3px; color: #dfeaf1; font-size: 0.78rem; text-transform: uppercase; }
    .fill-owner { min-height: 18px; margin-bottom: 10px; color: #79bde7; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.67rem; }
    .fill-owner.reuse { color: #b9e8ad; }
    .fill-canvas-wrap { display: flex; gap: 12px; align-items: flex-start; }
    .fill-preview-card canvas { width: 96px; height: 192px; image-rendering: pixelated; border: 1px solid #243947; border-radius: 6px; background: #060d12; }
    .fill-preview-card pre { margin: 0; color: #dff4ff; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.64rem; line-height: 1.02; }
    @media (max-width: 1100px) { .fill-summary-grid { grid-template-columns: repeat(3, 1fr); } .fill-preview-grid { grid-template-columns: 1fr; } }
    @media (max-width: 720px) { .fill-summary-grid { grid-template-columns: 1fr 1fr; } .fill-control-row { grid-template-columns: 1fr; } }
  `;
  document.head.append(style);
}

function candidateLabel(candidate: CandidateGlyph): string {
  return `${candidate.candidateId.toString().padStart(3, "0")} · ${candidate.family} · ${formatPort(candidate.start)} → ${formatPort(candidate.end)}`;
}

function drawBitmap(canvas: HTMLCanvasElement, bitmap: Uint8Array): void {
  const scale = 12;
  canvas.width = CELL_WIDTH * scale;
  canvas.height = CELL_HEIGHT * scale;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Straight fill preview canvas is unavailable.");
  }

  context.imageSmoothingEnabled = false;
  context.fillStyle = "#0a1016";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f4fbff";
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      if (hasPixel(bitmap, x, y)) {
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
}

function ownerText(fill: StraightFillCandidate): { text: string; reuse: boolean } {
  if (fill.visualDisposition === "reuse-existing-straight") {
    return {
      text: `reuses ${fill.canonicalCodepoint} · glyph 0x${fill.canonicalGlyphId?.toString(16).toUpperCase().padStart(3, "0")}`,
      reuse: true,
    };
  }
  if (fill.visualDisposition === "reuse-existing-fill") {
    return { text: `reuses fill visual F${fill.canonicalFillVisualId}`, reuse: true };
  }
  return { text: `new fill visual F${fill.canonicalFillVisualId} · unallocated`, reuse: false };
}

function mountStraightFillExplorer(): void {
  const atlasPanel = document.querySelector<HTMLElement>(".atlas-panel");
  const parent = atlasPanel?.parentElement;
  if (!atlasPanel || !parent || document.getElementById("straight-fill-research-panel")) {
    return;
  }

  ensureStyles();
  const panel = document.createElement("section");
  panel.id = "straight-fill-research-panel";
  panel.className = "panel fill-research-panel";
  panel.innerHTML = `
    <div class="panel-heading">
      <div>
        <p class="section-kicker">Milestone 4A · solid half fills</p>
        <h2>Straight fill explorer</h2>
      </div>
      <div class="codepoint-chip">Research only · no fill codepoints allocated</div>
    </div>
    <div class="fill-lab-body">
      <div class="fill-summary-grid">
        <div class="fill-stat"><span>Semantic fills</span><strong>${fillResearch.stats.semanticFillCandidates.toLocaleString()}</strong></div>
        <div class="fill-stat"><span>Unique fill rasters</span><strong>${fillResearch.stats.uniqueFillRasters.toLocaleString()}</strong></div>
        <div class="fill-stat"><span>Reuse straight visuals</span><strong>${fillResearch.stats.straightReuseVisuals.toLocaleString()}</strong></div>
        <div class="fill-stat"><span>New fill visuals</span><strong>${fillResearch.stats.newFillVisuals.toLocaleString()}</strong></div>
        <div class="fill-stat"><span>Combined visuals</span><strong>${fillResearch.stats.combinedStraightAndFillVisuals.toLocaleString()}</strong></div>
      </div>
      <div class="fill-control-row">
        <label class="fill-field">
          <span>Mathematical straight definition</span>
          <select id="fill-straight-select">
            ${straightBaseline.candidates.map((candidate) => `<option value="${candidate.candidateId}">${candidateLabel(candidate)}</option>`).join("")}
          </select>
        </label>
        <p class="fill-rule">The mathematical line classifies each pixel center by oriented side. Boundary stroke pixels are then forced ON in both filled versions.</p>
      </div>
      <div class="fill-preview-grid">
        <article class="fill-preview-card">
          <h3>Stroke</h3>
          <div id="fill-stroke-owner" class="fill-owner">—</div>
          <div class="fill-canvas-wrap"><canvas id="fill-stroke-canvas"></canvas><pre id="fill-stroke-ascii"></pre></div>
        </article>
        <article class="fill-preview-card">
          <h3>Fill side A</h3>
          <div id="fill-a-owner" class="fill-owner">—</div>
          <div class="fill-canvas-wrap"><canvas id="fill-a-canvas"></canvas><pre id="fill-a-ascii"></pre></div>
        </article>
        <article class="fill-preview-card">
          <h3>Fill side B</h3>
          <div id="fill-b-owner" class="fill-owner">—</div>
          <div class="fill-canvas-wrap"><canvas id="fill-b-canvas"></canvas><pre id="fill-b-ascii"></pre></div>
        </article>
      </div>
    </div>
  `;

  parent.insertBefore(panel, atlasPanel);

  const select = panel.querySelector<HTMLSelectElement>("#fill-straight-select");
  const strokeCanvas = panel.querySelector<HTMLCanvasElement>("#fill-stroke-canvas");
  const aCanvas = panel.querySelector<HTMLCanvasElement>("#fill-a-canvas");
  const bCanvas = panel.querySelector<HTMLCanvasElement>("#fill-b-canvas");
  const strokeAscii = panel.querySelector<HTMLElement>("#fill-stroke-ascii");
  const aAscii = panel.querySelector<HTMLElement>("#fill-a-ascii");
  const bAscii = panel.querySelector<HTMLElement>("#fill-b-ascii");
  const strokeOwner = panel.querySelector<HTMLElement>("#fill-stroke-owner");
  const aOwner = panel.querySelector<HTMLElement>("#fill-a-owner");
  const bOwner = panel.querySelector<HTMLElement>("#fill-b-owner");

  if (!select || !strokeCanvas || !aCanvas || !bCanvas || !strokeAscii || !aAscii || !bAscii || !strokeOwner || !aOwner || !bOwner) {
    throw new Error("Straight fill explorer failed to mount required controls.");
  }

  const render = (): void => {
    const candidateId = Number.parseInt(select.value, 10);
    const straight = straightBaseline.candidates[candidateId];
    if (!straight) {
      throw new Error(`Unknown straight candidate ${candidateId}.`);
    }

    const strokeGlyph = straightByBitmap.get(straight.bitmapKey);
    const fillA = fillResearch.candidates[candidateId * 2];
    const fillB = fillResearch.candidates[candidateId * 2 + 1];
    const bitmapA = rasterizeStraightSideFill(straight, "A");
    const bitmapB = rasterizeStraightSideFill(straight, "B");

    drawBitmap(strokeCanvas, straight.bitmap);
    drawBitmap(aCanvas, bitmapA);
    drawBitmap(bCanvas, bitmapB);
    strokeAscii.textContent = bitmapAscii(straight.bitmap);
    aAscii.textContent = bitmapAscii(bitmapA);
    bAscii.textContent = bitmapAscii(bitmapB);
    strokeOwner.textContent = strokeGlyph
      ? `published ${formatCodepoint(strokeGlyph.codepoint)} · glyph 0x${strokeGlyph.glyphId.toString(16).toUpperCase().padStart(3, "0")}`
      : "published straight visual";

    const aResolution = ownerText(fillA);
    const bResolution = ownerText(fillB);
    aOwner.textContent = aResolution.text;
    bOwner.textContent = bResolution.text;
    aOwner.classList.toggle("reuse", aResolution.reuse);
    bOwner.classList.toggle("reuse", bResolution.reuse);
  };

  select.addEventListener("change", render);
  render();
}

mountStraightFillExplorer();
