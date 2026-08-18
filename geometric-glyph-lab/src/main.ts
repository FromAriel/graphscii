import {
  ALL_FAMILIES,
  CELL_HEIGHT,
  CELL_WIDTH,
  FAMILY_DEFINITIONS,
  bitmapAscii,
  exportAtlasPng,
  exportJson,
  formatPort,
  generate,
  hasPixel,
  type FamilyId,
  type GenerationResult,
  type UniqueGlyph,
} from "./core/index.js";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app root element.");
}

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">8×16 geometric graphics research tool</p>
        <h1>Geometric Glyph Lab</h1>
        <p class="subtitle">Generate every straight edge-to-edge primitive, collapse raster-equivalent results, and inspect the surviving graphical vocabulary.</p>
      </div>
      <div class="hero-badge">
        <span class="badge-label">Target space</span>
        <strong>4,096 glyphs</strong>
        <span>U+E000 → U+EFFF</span>
      </div>
    </header>

    <section class="workspace">
      <aside class="panel controls-panel">
        <div class="panel-heading">
          <div>
            <p class="section-kicker">Generator</p>
            <h2>Straight families</h2>
          </div>
          <button id="select-all" class="text-button" type="button">Select all</button>
        </div>

        <div id="family-list" class="family-list"></div>

        <button id="generate" class="primary-button" type="button">Generate glyph set</button>

        <div class="stats-grid" aria-label="Generation statistics">
          <div class="stat-card">
            <span>Candidates</span>
            <strong id="candidate-count">—</strong>
          </div>
          <div class="stat-card">
            <span>Unique</span>
            <strong id="unique-count">—</strong>
          </div>
          <div class="stat-card">
            <span>Duplicates</span>
            <strong id="duplicate-count">—</strong>
          </div>
          <div class="stat-card">
            <span>Compression</span>
            <strong id="compression-count">—</strong>
          </div>
        </div>

        <div class="export-block">
          <p class="section-kicker">Exports</p>
          <button id="export-json" class="secondary-button" type="button" disabled>Export metadata JSON</button>
          <button id="export-png" class="secondary-button" type="button" disabled>Export PNG atlas</button>
        </div>

        <div class="note-card">
          <strong>Canonical rule</strong>
          <p>The 8×16 bitmap is ground truth. Geometry is rasterized first; future font outlines will be derived from these exact pixels.</p>
        </div>
      </aside>

      <section class="main-column">
        <section class="panel inspector-panel">
          <div class="panel-heading">
            <div>
              <p class="section-kicker">Inspector</p>
              <h2 id="glyph-title">No glyph selected</h2>
            </div>
            <div id="codepoint-chip" class="codepoint-chip">U+——</div>
          </div>

          <div class="inspector-grid">
            <div class="preview-stack">
              <div class="preview-frame large-preview-frame">
                <canvas id="glyph-preview" width="128" height="256" aria-label="Enlarged 8 by 16 glyph preview"></canvas>
              </div>
              <div class="actual-size-block">
                <span>1×</span>
                <canvas id="actual-preview" width="8" height="16" aria-label="Actual size glyph preview"></canvas>
              </div>
            </div>

            <div class="glyph-data">
              <dl class="property-list">
                <div><dt>Glyph ID</dt><dd id="glyph-id">—</dd></div>
                <div><dt>Bitmap key</dt><dd id="bitmap-key" class="mono breakable">—</dd></div>
                <div><dt>Aliases</dt><dd id="alias-count">—</dd></div>
                <div><dt>Families</dt><dd id="family-count">—</dd></div>
              </dl>

              <div class="alias-section">
                <div class="subheading-row">
                  <h3>Geometric aliases</h3>
                  <span id="alias-summary">—</span>
                </div>
                <div id="alias-list" class="alias-list">
                  <p class="empty-copy">Generate a set and click a tile in the atlas.</p>
                </div>
              </div>
            </div>

            <div class="ascii-section">
              <div class="subheading-row">
                <h3>Canonical bitmap</h3>
                <span>8 columns × 16 rows</span>
              </div>
              <pre id="ascii-preview">........\n........\n........\n........\n........\n........\n........\n........\n........\n........\n........\n........\n........\n........\n........\n........</pre>
            </div>
          </div>
        </section>

        <section class="panel atlas-panel">
          <div class="panel-heading atlas-heading">
            <div>
              <p class="section-kicker">Atlas</p>
              <h2>Unique raster glyphs</h2>
            </div>
            <div class="atlas-tools">
              <label class="search-field">
                <span>Find ID</span>
                <input id="glyph-search" type="text" inputmode="text" placeholder="e.g. 12A" autocomplete="off" />
              </label>
              <div id="atlas-status" class="atlas-status">Generate to populate</div>
            </div>
          </div>

          <div id="atlas-scroll" class="atlas-scroll">
            <canvas id="atlas-canvas" width="1" height="1" aria-label="Generated glyph atlas"></canvas>
            <div id="atlas-empty" class="atlas-empty">
              <div class="empty-icon">╱</div>
              <strong>No generated atlas yet</strong>
              <span>Select the line families you want to test, then generate.</span>
            </div>
          </div>
        </section>
      </section>
    </section>

    <footer>
      Deterministic binary rasterizer · one byte per row · 128-bit visual identity
    </footer>
  </main>
`;

const elements = {
  familyList: requireElement<HTMLDivElement>("family-list"),
  selectAll: requireElement<HTMLButtonElement>("select-all"),
  generate: requireElement<HTMLButtonElement>("generate"),
  candidateCount: requireElement<HTMLElement>("candidate-count"),
  uniqueCount: requireElement<HTMLElement>("unique-count"),
  duplicateCount: requireElement<HTMLElement>("duplicate-count"),
  compressionCount: requireElement<HTMLElement>("compression-count"),
  exportJson: requireElement<HTMLButtonElement>("export-json"),
  exportPng: requireElement<HTMLButtonElement>("export-png"),
  glyphTitle: requireElement<HTMLElement>("glyph-title"),
  codepointChip: requireElement<HTMLElement>("codepoint-chip"),
  glyphPreview: requireElement<HTMLCanvasElement>("glyph-preview"),
  actualPreview: requireElement<HTMLCanvasElement>("actual-preview"),
  glyphId: requireElement<HTMLElement>("glyph-id"),
  bitmapKey: requireElement<HTMLElement>("bitmap-key"),
  aliasCount: requireElement<HTMLElement>("alias-count"),
  familyCount: requireElement<HTMLElement>("family-count"),
  aliasSummary: requireElement<HTMLElement>("alias-summary"),
  aliasList: requireElement<HTMLDivElement>("alias-list"),
  asciiPreview: requireElement<HTMLElement>("ascii-preview"),
  glyphSearch: requireElement<HTMLInputElement>("glyph-search"),
  atlasStatus: requireElement<HTMLElement>("atlas-status"),
  atlasScroll: requireElement<HTMLDivElement>("atlas-scroll"),
  atlasCanvas: requireElement<HTMLCanvasElement>("atlas-canvas"),
  atlasEmpty: requireElement<HTMLDivElement>("atlas-empty"),
};

const selectedFamilies = new Set<FamilyId>(ALL_FAMILIES);
let result: GenerationResult | null = null;
let selectedGlyphIndex = -1;

const ATLAS_COLUMNS = 16;
const ATLAS_SCALE = 3;
const ATLAS_GAP = 4;
const TILE_WIDTH = CELL_WIDTH * ATLAS_SCALE;
const TILE_HEIGHT = CELL_HEIGHT * ATLAS_SCALE;
const SLOT_WIDTH = TILE_WIDTH + ATLAS_GAP;
const SLOT_HEIGHT = TILE_HEIGHT + ATLAS_GAP;

renderFamilyControls();
clearPreviewCanvas(elements.glyphPreview);
clearPreviewCanvas(elements.actualPreview);

// The first launch should immediately answer the baseline experiment.
runGeneration();

elements.selectAll.addEventListener("click", () => {
  const allSelected = selectedFamilies.size === FAMILY_DEFINITIONS.length;
  selectedFamilies.clear();
  if (!allSelected) {
    FAMILY_DEFINITIONS.forEach((family) => selectedFamilies.add(family.id));
  }
  syncFamilyControls();
});

elements.generate.addEventListener("click", runGeneration);

elements.exportJson.addEventListener("click", () => {
  if (result) {
    exportJson(result);
  }
});

elements.exportPng.addEventListener("click", () => {
  if (result) {
    exportAtlasPng(result);
  }
});

elements.atlasCanvas.addEventListener("click", (event) => {
  if (!result) {
    return;
  }

  const rect = elements.atlasCanvas.getBoundingClientRect();
  const scaleX = elements.atlasCanvas.width / rect.width;
  const scaleY = elements.atlasCanvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const column = Math.floor(x / SLOT_WIDTH);
  const row = Math.floor(y / SLOT_HEIGHT);

  if (column < 0 || column >= ATLAS_COLUMNS) {
    return;
  }

  const localX = x - column * SLOT_WIDTH;
  const localY = y - row * SLOT_HEIGHT;
  if (localX > TILE_WIDTH || localY > TILE_HEIGHT) {
    return;
  }

  const index = row * ATLAS_COLUMNS + column;
  if (index >= 0 && index < result.glyphs.length) {
    selectGlyph(index, false);
  }
});

elements.glyphSearch.addEventListener("input", () => {
  if (!result) {
    return;
  }

  const raw = elements.glyphSearch.value.trim().replace(/^0x/i, "").replace(/^U\+E/i, "");
  if (!raw) {
    return;
  }

  const glyphId = Number.parseInt(raw, 16);
  if (!Number.isFinite(glyphId) || glyphId < 0 || glyphId >= result.glyphs.length) {
    elements.glyphSearch.classList.add("invalid");
    return;
  }

  elements.glyphSearch.classList.remove("invalid");
  selectGlyph(glyphId, true);
});

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  return element as T;
}

function renderFamilyControls(): void {
  elements.familyList.innerHTML = "";

  for (const family of FAMILY_DEFINITIONS) {
    const label = document.createElement("label");
    label.className = "family-option";
    label.innerHTML = `
      <span class="check-wrap">
        <input type="checkbox" data-family="${family.id}" />
        <span class="custom-check" aria-hidden="true"></span>
      </span>
      <span class="family-copy">
        <strong>${family.label}</strong>
        <span>${family.candidateCount} candidates</span>
      </span>
      <code>${family.id}</code>
    `;

    const checkbox = label.querySelector<HTMLInputElement>("input");
    if (!checkbox) {
      throw new Error("Family checkbox failed to render.");
    }
    checkbox.checked = selectedFamilies.has(family.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedFamilies.add(family.id);
      } else {
        selectedFamilies.delete(family.id);
      }
      syncFamilyControls();
    });

    elements.familyList.append(label);
  }

  syncFamilyControls();
}

function syncFamilyControls(): void {
  const checkboxes = elements.familyList.querySelectorAll<HTMLInputElement>("input[data-family]");
  checkboxes.forEach((checkbox) => {
    const familyId = checkbox.dataset.family as FamilyId;
    checkbox.checked = selectedFamilies.has(familyId);
  });

  const allSelected = selectedFamilies.size === FAMILY_DEFINITIONS.length;
  elements.selectAll.textContent = allSelected ? "Clear all" : "Select all";
  elements.generate.disabled = selectedFamilies.size === 0;
}

function runGeneration(): void {
  result = generate(selectedFamilies);
  selectedGlyphIndex = result.glyphs.length > 0 ? 0 : -1;

  elements.candidateCount.textContent = result.candidates.length.toLocaleString();
  elements.uniqueCount.textContent = result.glyphs.length.toLocaleString();
  elements.duplicateCount.textContent = result.duplicateCandidates.toLocaleString();

  const compression = result.candidates.length === 0
    ? 0
    : (result.duplicateCandidates / result.candidates.length) * 100;
  elements.compressionCount.textContent = `${compression.toFixed(1)}%`;

  elements.exportJson.disabled = result.glyphs.length === 0;
  elements.exportPng.disabled = result.glyphs.length === 0;
  elements.atlasEmpty.hidden = result.glyphs.length > 0;
  elements.atlasCanvas.hidden = result.glyphs.length === 0;
  elements.atlasStatus.textContent = `${result.glyphs.length.toLocaleString()} unique / ${result.candidates.length.toLocaleString()} candidates`;
  elements.glyphSearch.value = "";
  elements.glyphSearch.classList.remove("invalid");

  drawAtlas();
  if (selectedGlyphIndex >= 0) {
    selectGlyph(selectedGlyphIndex, false);
  } else {
    clearInspector();
  }
}

function drawAtlas(): void {
  if (!result || result.glyphs.length === 0) {
    elements.atlasCanvas.width = 1;
    elements.atlasCanvas.height = 1;
    return;
  }

  const rows = Math.ceil(result.glyphs.length / ATLAS_COLUMNS);
  elements.atlasCanvas.width = ATLAS_COLUMNS * SLOT_WIDTH - ATLAS_GAP;
  elements.atlasCanvas.height = rows * SLOT_HEIGHT - ATLAS_GAP;

  const context = elements.atlasCanvas.getContext("2d");
  if (!context) {
    throw new Error("Atlas canvas 2D context is unavailable.");
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, elements.atlasCanvas.width, elements.atlasCanvas.height);

  result.glyphs.forEach((glyph, index) => {
    drawAtlasGlyph(context, glyph, index, index === selectedGlyphIndex);
  });
}

function drawAtlasGlyph(
  context: CanvasRenderingContext2D,
  glyph: UniqueGlyph,
  index: number,
  selected: boolean,
): void {
  const column = index % ATLAS_COLUMNS;
  const row = Math.floor(index / ATLAS_COLUMNS);
  const originX = column * SLOT_WIDTH;
  const originY = row * SLOT_HEIGHT;

  context.fillStyle = selected ? "#2b3b4f" : "#101821";
  context.fillRect(originX, originY, TILE_WIDTH, TILE_HEIGHT);

  context.fillStyle = "#eef7ff";
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      if (hasPixel(glyph.bitmap, x, y)) {
        context.fillRect(
          originX + x * ATLAS_SCALE,
          originY + y * ATLAS_SCALE,
          ATLAS_SCALE,
          ATLAS_SCALE,
        );
      }
    }
  }

  if (selected) {
    context.strokeStyle = "#8ed0ff";
    context.lineWidth = 2;
    context.strokeRect(originX + 1, originY + 1, TILE_WIDTH - 2, TILE_HEIGHT - 2);
  }
}

function selectGlyph(index: number, scrollIntoView: boolean): void {
  if (!result || index < 0 || index >= result.glyphs.length) {
    return;
  }

  selectedGlyphIndex = index;
  const glyph = result.glyphs[index];
  drawAtlas();
  renderInspector(glyph);

  if (scrollIntoView) {
    scrollAtlasToIndex(index);
  }
}

function scrollAtlasToIndex(index: number): void {
  const row = Math.floor(index / ATLAS_COLUMNS);
  const top = row * SLOT_HEIGHT;
  const bottom = top + TILE_HEIGHT;
  const visibleTop = elements.atlasScroll.scrollTop;
  const visibleBottom = visibleTop + elements.atlasScroll.clientHeight;

  if (top < visibleTop || bottom > visibleBottom) {
    elements.atlasScroll.scrollTo({
      top: Math.max(0, top - elements.atlasScroll.clientHeight / 2 + TILE_HEIGHT / 2),
      behavior: "smooth",
    });
  }
}

function renderInspector(glyph: UniqueGlyph): void {
  const glyphHex = glyph.glyphId.toString(16).toUpperCase().padStart(3, "0");
  const codepoint = `U+${glyph.codepoint.toString(16).toUpperCase()}`;
  const families = Array.from(new Set(glyph.aliases.map((alias) => alias.family)));

  elements.glyphTitle.textContent = `Glyph ${glyphHex}`;
  elements.codepointChip.textContent = codepoint;
  elements.glyphId.textContent = `0x${glyphHex}`;
  elements.bitmapKey.textContent = glyph.bitmapKey;
  elements.aliasCount.textContent = glyph.aliases.length.toLocaleString();
  elements.familyCount.textContent = families.join(", ");
  elements.aliasSummary.textContent = `${glyph.aliases.length} representation${glyph.aliases.length === 1 ? "" : "s"}`;
  elements.asciiPreview.textContent = bitmapAscii(glyph.bitmap);

  drawBitmap(elements.glyphPreview, glyph, 16, true);
  drawBitmap(elements.actualPreview, glyph, 1, false);

  elements.aliasList.innerHTML = "";
  for (const alias of glyph.aliases) {
    const row = document.createElement("div");
    row.className = "alias-row";
    row.innerHTML = `
      <span class="family-pill">${alias.family}</span>
      <strong>${formatPort(alias.start)}</strong>
      <span class="arrow">→</span>
      <strong>${formatPort(alias.end)}</strong>
    `;
    elements.aliasList.append(row);
  }
}

function drawBitmap(canvas: HTMLCanvasElement, glyph: UniqueGlyph, scale: number, drawGrid: boolean): void {
  canvas.width = CELL_WIDTH * scale;
  canvas.height = CELL_HEIGHT * scale;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Preview canvas 2D context is unavailable.");
  }

  context.imageSmoothingEnabled = false;
  context.fillStyle = "#0a1016";
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (drawGrid) {
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
  }

  context.fillStyle = "#f4fbff";
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      if (hasPixel(glyph.bitmap, x, y)) {
        const inset = drawGrid ? 1 : 0;
        context.fillRect(
          x * scale + inset,
          y * scale + inset,
          Math.max(1, scale - inset),
          Math.max(1, scale - inset),
        );
      }
    }
  }
}

function clearPreviewCanvas(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.fillStyle = "#0a1016";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function clearInspector(): void {
  elements.glyphTitle.textContent = "No glyph selected";
  elements.codepointChip.textContent = "U+——";
  elements.glyphId.textContent = "—";
  elements.bitmapKey.textContent = "—";
  elements.aliasCount.textContent = "—";
  elements.familyCount.textContent = "—";
  elements.aliasSummary.textContent = "—";
  elements.aliasList.innerHTML = '<p class="empty-copy">No unique glyphs were generated.</p>';
  elements.asciiPreview.textContent = Array.from({ length: CELL_HEIGHT }, () => ".".repeat(CELL_WIDTH)).join("\n");
  clearPreviewCanvas(elements.glyphPreview);
  clearPreviewCanvas(elements.actualPreview);
}
