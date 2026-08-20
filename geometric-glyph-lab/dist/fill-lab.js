import { ALL_FAMILIES, CELL_HEIGHT, CELL_WIDTH, STRAIGHT_FILL_STYLE_DEFINITIONS, STRAIGHT_FILL_STYLE_ORDER, bitmapAscii, formatCodepoint, formatPort, generate, generateStraightDitherSweep, hasPixel, rasterizeStraightStyledFill, } from "./core/index.js";
const STYLE_ID = "straight-fill-research-styles";
const straightBaseline = generate(ALL_FAMILIES);
const fillResearch = generateStraightDitherSweep(straightBaseline);
const straightByBitmap = new Map(straightBaseline.glyphs.map((glyph) => [glyph.bitmapKey, glyph]));
const SIDE_SEMANTIC_COUNT = straightBaseline.candidates.length * 2;
function ensureStyles() {
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
    .fill-control-row { display: grid; grid-template-columns: minmax(260px, 2fr) minmax(160px, 1fr) minmax(130px, .7fr); gap: 12px; align-items: end; }
    .fill-field { display: grid; gap: 5px; }
    .fill-field span { color: #718695; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; }
    .fill-field select { width: 100%; padding: 8px 9px; border: 1px solid #2b4251; border-radius: 7px; background: #08131a; color: #d9edf8; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.72rem; }
    .fill-rule { margin: 0; color: #718695; font-size: 0.72rem; line-height: 1.5; }
    .fill-style-result { color: #9fcce6; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.7rem; }
    .fill-preview-grid { display: grid; grid-template-columns: repeat(3, minmax(190px, 1fr)); gap: 14px; }
    .fill-preview-card, .fill-atlas-card { padding: 14px; border: 1px solid #1d303e; border-radius: 10px; background: #09151d; }
    .fill-preview-card h3, .fill-atlas-card h3 { margin: 0 0 3px; color: #dfeaf1; font-size: 0.78rem; text-transform: uppercase; }
    .fill-owner { min-height: 18px; margin-bottom: 10px; color: #79bde7; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.67rem; }
    .fill-owner.reuse { color: #b9e8ad; }
    .fill-canvas-wrap { display: flex; gap: 12px; align-items: flex-start; }
    .fill-preview-card canvas { width: 96px; height: 192px; image-rendering: pixelated; border: 1px solid #243947; border-radius: 6px; background: #060d12; }
    .fill-preview-card pre { margin: 0; color: #dff4ff; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.64rem; line-height: 1.02; }
    .fill-atlas-card { overflow-x: auto; }
    .fill-atlas-card canvas { display: block; width: min(100%, 768px); height: auto; image-rendering: pixelated; border: 1px solid #243947; border-radius: 6px; background: #fff; }
    .fill-atlas-note { margin: 8px 0 0; color: #718695; font-size: 0.68rem; line-height: 1.45; }
    @media (max-width: 1100px) { .fill-summary-grid { grid-template-columns: repeat(3, 1fr); } .fill-preview-grid { grid-template-columns: 1fr; } .fill-control-row { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 720px) { .fill-summary-grid { grid-template-columns: 1fr 1fr; } .fill-control-row { grid-template-columns: 1fr; } }
  `;
    document.head.append(style);
}
function candidateLabel(candidate) {
    return `${candidate.candidateId.toString().padStart(3, "0")} · ${candidate.family} · ${formatPort(candidate.start)} → ${formatPort(candidate.end)}`;
}
function drawBitmap(canvas, bitmap) {
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
function drawResearchAtlas(canvas, style, side) {
    const candidates = fillResearch.candidates.filter((candidate) => candidate.style === style && candidate.side === side);
    const columns = 32;
    const rows = Math.ceil(candidates.length / columns);
    canvas.width = columns * CELL_WIDTH;
    canvas.height = rows * CELL_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Dither research atlas canvas is unavailable.");
    }
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#000000";
    for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const cellX = index % columns;
        const cellY = Math.floor(index / columns);
        for (let y = 0; y < CELL_HEIGHT; y += 1) {
            for (let x = 0; x < CELL_WIDTH; x += 1) {
                if (hasPixel(candidate.bitmap, x, y)) {
                    context.fillRect(cellX * CELL_WIDTH + x, cellY * CELL_HEIGHT + y, 1, 1);
                }
            }
        }
    }
}
function ownerText(fill) {
    switch (fill.visualDisposition) {
        case "reuse-existing-straight":
            return {
                text: `reuses ${fill.canonicalCodepoint} · glyph 0x${fill.canonicalGlyphId?.toString(16).toUpperCase().padStart(3, "0")}`,
                reuse: true,
            };
        case "reuse-existing-fill":
            return { text: `reuses solid fill visual F${fill.canonicalFillVisualId}`, reuse: true };
        case "new-fill-unallocated":
            return { text: `new solid fill visual F${fill.canonicalFillVisualId} · unallocated`, reuse: false };
        case "reuse-existing-dither":
            return {
                text: `reuses ${fill.canonicalDitherStyle} dither D${fill.canonicalDitherVisualId}`,
                reuse: true,
            };
        case "new-dither-unallocated":
            return {
                text: `new ${fill.style} dither D${fill.canonicalDitherVisualId} · unallocated`,
                reuse: false,
            };
    }
}
function styledCandidate(straightCandidateId, side, style) {
    const styleIndex = STRAIGHT_FILL_STYLE_ORDER.indexOf(style);
    if (styleIndex < 0) {
        throw new Error(`Unknown style ${style}.`);
    }
    const sourceFillCandidateId = straightCandidateId * 2 + (side === "A" ? 0 : 1);
    const candidate = fillResearch.candidates[styleIndex * SIDE_SEMANTIC_COUNT + sourceFillCandidateId];
    if (!candidate) {
        throw new Error(`Missing ${style} candidate for straight ${straightCandidateId} side ${side}.`);
    }
    return candidate;
}
function mountStraightFillExplorer() {
    const atlasPanel = document.querySelector(".atlas-panel");
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
        <p class="section-kicker">Milestone 4B · phase-locked dithers</p>
        <h2>Straight fill + dither explorer</h2>
      </div>
      <div class="codepoint-chip">Research only · no fill/dither codepoints allocated</div>
    </div>
    <div class="fill-lab-body">
      <div class="fill-summary-grid">
        <div class="fill-stat"><span>Styled semantics</span><strong>${fillResearch.stats.styledSemanticCandidates.toLocaleString()}</strong></div>
        <div class="fill-stat"><span>Unique styled rasters</span><strong>${fillResearch.stats.uniqueStyledRasters.toLocaleString()}</strong></div>
        <div class="fill-stat"><span>Novel dither visuals</span><strong>${fillResearch.stats.novelDitherVisuals.toLocaleString()}</strong></div>
        <div class="fill-stat"><span>Combined visuals</span><strong>${fillResearch.stats.combinedStraightSolidAndDitherVisuals.toLocaleString()}</strong></div>
        <div class="fill-stat"><span>Over 4K window</span><strong>+${(fillResearch.stats.combinedStraightSolidAndDitherVisuals - 4096).toLocaleString()}</strong></div>
      </div>
      <div class="fill-control-row">
        <label class="fill-field">
          <span>Mathematical straight definition</span>
          <select id="fill-straight-select">
            ${straightBaseline.candidates.map((candidate) => `<option value="${candidate.candidateId}">${candidateLabel(candidate)}</option>`).join("")}
          </select>
        </label>
        <label class="fill-field">
          <span>Fill style</span>
          <select id="fill-style-select">
            ${STRAIGHT_FILL_STYLE_DEFINITIONS.map((definition) => `<option value="${definition.id}">${definition.label} · ${definition.onCells}/64 (${(definition.density * 100).toFixed(1)}%)</option>`).join("")}
          </select>
        </label>
        <label class="fill-field">
          <span>Atlas side</span>
          <select id="fill-atlas-side-select">
            <option value="A">Side A</option>
            <option value="B">Side B</option>
          </select>
        </label>
      </div>
      <p class="fill-rule">Every style starts from the original mathematical boundary + oriented side region. The 8×8 mask is phase-locked to cell coordinates and repeats vertically; the Bresenham boundary stroke is always forced ON.</p>
      <div id="fill-style-result" class="fill-style-result">—</div>
      <div class="fill-preview-grid">
        <article class="fill-preview-card">
          <h3>Stroke</h3>
          <div id="fill-stroke-owner" class="fill-owner">—</div>
          <div class="fill-canvas-wrap"><canvas id="fill-stroke-canvas"></canvas><pre id="fill-stroke-ascii"></pre></div>
        </article>
        <article class="fill-preview-card">
          <h3>Styled side A</h3>
          <div id="fill-a-owner" class="fill-owner">—</div>
          <div class="fill-canvas-wrap"><canvas id="fill-a-canvas"></canvas><pre id="fill-a-ascii"></pre></div>
        </article>
        <article class="fill-preview-card">
          <h3>Styled side B</h3>
          <div id="fill-b-owner" class="fill-owner">—</div>
          <div class="fill-canvas-wrap"><canvas id="fill-b-canvas"></canvas><pre id="fill-b-ascii"></pre></div>
        </article>
      </div>
      <article class="fill-atlas-card">
        <h3>832-definition research atlas</h3>
        <div id="fill-atlas-owner" class="fill-owner">—</div>
        <canvas id="fill-dither-atlas-canvas"></canvas>
        <p class="fill-atlas-note">Candidate order is the frozen LR → TB → LT → LB → RT → RB mathematical generation order. Change Fill style and Atlas side above to compare the phase-locked vocabularies.</p>
      </article>
    </div>
  `;
    parent.insertBefore(panel, atlasPanel);
    const select = panel.querySelector("#fill-straight-select");
    const styleSelect = panel.querySelector("#fill-style-select");
    const atlasSideSelect = panel.querySelector("#fill-atlas-side-select");
    const strokeCanvas = panel.querySelector("#fill-stroke-canvas");
    const aCanvas = panel.querySelector("#fill-a-canvas");
    const bCanvas = panel.querySelector("#fill-b-canvas");
    const atlasCanvas = panel.querySelector("#fill-dither-atlas-canvas");
    const strokeAscii = panel.querySelector("#fill-stroke-ascii");
    const aAscii = panel.querySelector("#fill-a-ascii");
    const bAscii = panel.querySelector("#fill-b-ascii");
    const strokeOwner = panel.querySelector("#fill-stroke-owner");
    const aOwner = panel.querySelector("#fill-a-owner");
    const bOwner = panel.querySelector("#fill-b-owner");
    const atlasOwner = panel.querySelector("#fill-atlas-owner");
    const styleResult = panel.querySelector("#fill-style-result");
    if (!select || !styleSelect || !atlasSideSelect || !strokeCanvas || !aCanvas || !bCanvas || !atlasCanvas || !strokeAscii || !aAscii || !bAscii || !strokeOwner || !aOwner || !bOwner || !atlasOwner || !styleResult) {
        throw new Error("Straight fill+dither explorer failed to mount required controls.");
    }
    const render = () => {
        const candidateId = Number.parseInt(select.value, 10);
        const style = styleSelect.value;
        const atlasSide = atlasSideSelect.value;
        const straight = straightBaseline.candidates[candidateId];
        if (!straight) {
            throw new Error(`Unknown straight candidate ${candidateId}.`);
        }
        const strokeGlyph = straightByBitmap.get(straight.bitmapKey);
        const fillA = styledCandidate(candidateId, "A", style);
        const fillB = styledCandidate(candidateId, "B", style);
        const bitmapA = rasterizeStraightStyledFill(straight, "A", style);
        const bitmapB = rasterizeStraightStyledFill(straight, "B", style);
        const styleStats = fillResearch.stats.styles.find((entry) => entry.style === style);
        drawBitmap(strokeCanvas, straight.bitmap);
        drawBitmap(aCanvas, bitmapA);
        drawBitmap(bCanvas, bitmapB);
        drawResearchAtlas(atlasCanvas, style, atlasSide);
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
        if (styleStats) {
            styleResult.textContent = `${style}: ${styleStats.uniqueRasters.toLocaleString()} unique rasters · ${styleStats.newVisuals.toLocaleString()} new visual owners · ${styleStats.straightReuseCandidates.toLocaleString()} straight reuses · ${styleStats.solidReuseCandidates.toLocaleString()} solid reuses`;
            atlasOwner.textContent = `${style} · side ${atlasSide} · 832 mathematical boundaries · phase locked`;
        }
    };
    select.addEventListener("change", render);
    styleSelect.addEventListener("change", render);
    atlasSideSelect.addEventListener("change", render);
    render();
}
mountStraightFillExplorer();
