import { ALL_FAMILIES, CELL_HEIGHT, CELL_WIDTH, CURVE_FIXED_SCALE, CURVE_STRENGTHS, CURVE_TANGENTS, bitmapAscii, formatPort, generate, hasPixel, makePorts, rasterizeCurve, resolveCurveAgainstStraights, } from "./core/index.js";
const STYLE_ID = "curve-research-styles";
const PORT_EDGES = ["L", "R", "T", "B"];
const straightBaseline = generate(ALL_FAMILIES);
function allPorts() {
    return PORT_EDGES.flatMap((edge) => makePorts(edge));
}
function optionMarkup(values, selected) {
    return values
        .map((value) => `<option value="${value}"${value === selected ? " selected" : ""}>${value}</option>`)
        .join("");
}
function portOptionMarkup(selected) {
    return allPorts()
        .map((port) => {
        const value = formatPort(port);
        const selectedAttribute = port.edge === selected.edge && port.index === selected.index ? " selected" : "";
        return `<option value="${value}"${selectedAttribute}>${value}</option>`;
    })
        .join("");
}
function parsePort(value) {
    const edge = value.slice(0, 1);
    const index = Number.parseInt(value.slice(1), 10);
    if (!PORT_EDGES.includes(edge) || !Number.isInteger(index)) {
        throw new Error(`Invalid curve-lab port value: ${value}`);
    }
    return { edge, index };
}
function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
        return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    .curve-research-panel .panel-heading { align-items: flex-end; }
    .curve-lab-body { display: grid; grid-template-columns: minmax(260px, 0.9fr) 170px minmax(260px, 1fr) 250px; gap: 22px; padding: 22px; }
    .curve-control-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .curve-field { display: grid; gap: 5px; }
    .curve-field span { color: #718695; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    .curve-field select { width: 100%; padding: 8px 9px; border: 1px solid #2b4251; border-radius: 7px; outline: none; background: #08131a; color: #d9edf8; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.72rem; }
    .curve-field select:focus { border-color: #74bde9; }
    .curve-help { margin: 14px 0 0; color: #718695; font-size: 0.72rem; line-height: 1.55; }
    .curve-preview-frame { width: 130px; height: 258px; margin: 0 auto; border: 1px solid #243947; border-radius: 10px; background: #060d12; overflow: hidden; }
    #curve-preview { display: block; width: 128px; height: 256px; image-rendering: pixelated; }
    .curve-status { display: inline-flex; align-items: center; min-height: 30px; padding: 6px 9px; margin-bottom: 10px; border: 1px solid #2d4658; border-radius: 7px; background: #0a151d; color: #9ad6f7; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.7rem; }
    .curve-status.invalid { border-color: #75444c; color: #ef9ca7; background: #1b0e12; }
    .curve-status.reuse { border-color: #486744; color: #b9e8ad; background: #0e190d; }
    .curve-mini-data { display: grid; gap: 0; margin: 0; }
    .curve-mini-data div { display: grid; grid-template-columns: 105px minmax(0, 1fr); gap: 10px; padding: 7px 0; border-bottom: 1px solid #162630; }
    .curve-mini-data dt { color: #718695; font-size: 0.69rem; font-weight: 700; }
    .curve-mini-data dd { margin: 0; color: #d6e4ed; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.69rem; word-break: break-word; }
    .curve-errors { margin-top: 10px; padding: 9px 11px; border-left: 2px solid #8a535c; background: #150d11; color: #d89ba4; font-size: 0.69rem; line-height: 1.45; }
    #curve-ascii { margin: 0; padding: 12px 14px; border: 1px solid #1d313d; border-radius: 8px; background: #061017; color: #dff4ff; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.76rem; line-height: 1.08; letter-spacing: 0.08em; overflow: auto; }
    .curve-ascii-wrap .subheading-row { margin-bottom: 8px; }
    @media (max-width: 1180px) { .curve-lab-body { grid-template-columns: minmax(260px, 1fr) 170px minmax(250px, 1fr); } .curve-ascii-wrap { grid-column: 1 / -1; } }
    @media (max-width: 820px) { .curve-lab-body { grid-template-columns: 1fr; } .curve-preview-frame { margin: 0; } .curve-ascii-wrap { grid-column: auto; } }
  `;
    document.head.append(style);
}
function fixedPointText(point) {
    return `${(point.x / CURVE_FIXED_SCALE).toFixed(2)}, ${(point.y / CURVE_FIXED_SCALE).toFixed(2)}`;
}
function drawCurveBitmap(canvas, result) {
    const scale = 16;
    canvas.width = CELL_WIDTH * scale;
    canvas.height = CELL_HEIGHT * scale;
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Curve preview canvas 2D context is unavailable.");
    }
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#0a1016";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(142, 208, 255, 0.09)";
    context.lineWidth = 1;
    for (let x = 0; x <= CELL_WIDTH; x += 1) {
        context.beginPath();
        context.moveTo(x * scale + 0.5, 0);
        context.lineTo(x * scale + 0.5, canvas.height);
        context.stroke();
    }
    for (let y = 0; y <= CELL_HEIGHT; y += 1) {
        context.beginPath();
        context.moveTo(0, y * scale + 0.5);
        context.lineTo(canvas.width, y * scale + 0.5);
        context.stroke();
    }
    context.fillStyle = result.validation.valid ? "#f4fbff" : "#e5a2aa";
    for (let y = 0; y < CELL_HEIGHT; y += 1) {
        for (let x = 0; x < CELL_WIDTH; x += 1) {
            if (hasPixel(result.bitmap, x, y)) {
                context.fillRect(x * scale + 1, y * scale + 1, scale - 1, scale - 1);
            }
        }
    }
}
function mountCurveExplorer() {
    const atlasPanel = document.querySelector(".atlas-panel");
    const parent = atlasPanel?.parentElement;
    if (!atlasPanel || !parent || document.getElementById("curve-research-panel")) {
        return;
    }
    ensureStyles();
    const defaults = {
        start: { edge: "L", index: 8 },
        end: { edge: "R", index: 8 },
        startTangent: "hard-left",
        endTangent: "hard-left",
        strength: "normal",
    };
    const panel = document.createElement("section");
    panel.id = "curve-research-panel";
    panel.className = "panel curve-research-panel";
    panel.innerHTML = `
    <div class="panel-heading">
      <div>
        <p class="section-kicker">Milestone 3A · research only</p>
        <h2>Single-curve explorer</h2>
      </div>
      <div class="codepoint-chip">No curve codepoints allocated</div>
    </div>
    <div class="curve-lab-body">
      <div>
        <div class="curve-control-grid">
          <label class="curve-field"><span>Start port</span><select id="curve-start">${portOptionMarkup(defaults.start)}</select></label>
          <label class="curve-field"><span>End port</span><select id="curve-end">${portOptionMarkup(defaults.end)}</select></label>
          <label class="curve-field"><span>Start tangent</span><select id="curve-start-tangent">${optionMarkup(CURVE_TANGENTS, defaults.startTangent)}</select></label>
          <label class="curve-field"><span>End tangent</span><select id="curve-end-tangent">${optionMarkup(CURVE_TANGENTS, defaults.endTangent)}</select></label>
          <label class="curve-field"><span>Strength</span><select id="curve-strength">${optionMarkup(CURVE_STRENGTHS, defaults.strength)}</select></label>
        </div>
        <p class="curve-help">The curve is a fixed-point cubic Bézier sampled at 256 deterministic intervals, then rasterized through the same binary line engine used by the straight vocabulary.</p>
      </div>
      <div>
        <div class="curve-preview-frame"><canvas id="curve-preview" width="128" height="256" aria-label="Curve raster preview"></canvas></div>
      </div>
      <div>
        <div id="curve-status" class="curve-status">—</div>
        <dl class="curve-mini-data">
          <div><dt>Alias</dt><dd id="curve-alias">—</dd></div>
          <div><dt>Bitmap key</dt><dd id="curve-key">—</dd></div>
          <div><dt>Visual owner</dt><dd id="curve-owner">—</dd></div>
          <div><dt>P0</dt><dd id="curve-p0">—</dd></div>
          <div><dt>P1</dt><dd id="curve-p1">—</dd></div>
          <div><dt>P2</dt><dd id="curve-p2">—</dd></div>
          <div><dt>P3</dt><dd id="curve-p3">—</dd></div>
        </dl>
        <div id="curve-errors" class="curve-errors" hidden></div>
      </div>
      <div class="curve-ascii-wrap">
        <div class="subheading-row"><h3>Curve raster</h3><span>8 × 16 canonical pixels</span></div>
        <pre id="curve-ascii">--------</pre>
      </div>
    </div>
  `;
    parent.insertBefore(panel, atlasPanel);
    const start = panel.querySelector("#curve-start");
    const end = panel.querySelector("#curve-end");
    const startTangent = panel.querySelector("#curve-start-tangent");
    const endTangent = panel.querySelector("#curve-end-tangent");
    const strength = panel.querySelector("#curve-strength");
    const preview = panel.querySelector("#curve-preview");
    const status = panel.querySelector("#curve-status");
    const alias = panel.querySelector("#curve-alias");
    const key = panel.querySelector("#curve-key");
    const owner = panel.querySelector("#curve-owner");
    const p0 = panel.querySelector("#curve-p0");
    const p1 = panel.querySelector("#curve-p1");
    const p2 = panel.querySelector("#curve-p2");
    const p3 = panel.querySelector("#curve-p3");
    const errors = panel.querySelector("#curve-errors");
    const ascii = panel.querySelector("#curve-ascii");
    if (!start || !end || !startTangent || !endTangent || !strength || !preview || !status || !alias || !key || !owner || !p0 || !p1 || !p2 || !p3 || !errors || !ascii) {
        throw new Error("Curve explorer failed to mount required controls.");
    }
    const render = () => {
        const spec = {
            start: parsePort(start.value),
            end: parsePort(end.value),
            startTangent: startTangent.value,
            endTangent: endTangent.value,
            strength: strength.value,
        };
        const curve = rasterizeCurve(spec);
        const resolution = resolveCurveAgainstStraights(curve, straightBaseline.glyphs);
        drawCurveBitmap(preview, curve);
        alias.textContent = curve.aliasKey;
        key.textContent = curve.bitmapKey;
        p0.textContent = fixedPointText(curve.controlPoints.p0);
        p1.textContent = fixedPointText(curve.controlPoints.p1);
        p2.textContent = fixedPointText(curve.controlPoints.p2);
        p3.textContent = fixedPointText(curve.controlPoints.p3);
        ascii.textContent = bitmapAscii(curve.bitmap);
        status.className = "curve-status";
        errors.hidden = curve.validation.valid;
        errors.textContent = curve.validation.reasons.join(" · ");
        if (!curve.validation.valid) {
            status.classList.add("invalid");
            status.textContent = "INVALID CURVE";
            owner.textContent = "not eligible for allocation";
            return;
        }
        if (resolution.exactBitmapMatch) {
            status.classList.add("reuse");
            status.textContent = `EXACT MATCH · REUSE ${resolution.canonicalCodepoint}`;
            owner.textContent = `${resolution.canonicalCodepoint} · glyph 0x${resolution.canonicalGlyphId?.toString(16).toUpperCase().padStart(3, "0")}`;
            return;
        }
        status.textContent = "NOVEL CURVE RASTER · UNALLOCATED";
        owner.textContent = "new visual candidate (research only)";
    };
    [start, end, startTangent, endTangent, strength].forEach((control) => {
        control.addEventListener("change", render);
    });
    render();
}
mountCurveExplorer();
