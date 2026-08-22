(() => {
  'use strict';

  const G = globalThis.GraphSCIIDrawV6;
  const D = globalThis.GraphSCIIDebug;
  const overlayCanvas = document.querySelector('#overlay-canvas');
  const glyphCanvas = document.querySelector('#glyph-canvas');
  const overlapEl = document.querySelector('#overlap-status');
  const undoButton = document.querySelector('#undo');
  const clearButton = document.querySelector('#clear');
  const showNodesInput = document.querySelector('#show-nodes');
  const toolButtons = [...document.querySelectorAll('[data-tool]')];

  if (!G || !D || !overlayCanvas || !glyphCanvas || !overlapEl) {
    console.error('GraphSCII crossover compositor v2 could not attach.');
    return;
  }

  const STRAIGHT_OWNER_MAX = 745;
  const CONNECTOR_OWNER_MIN = 5796;
  const CONNECTOR_OWNER_MAX = 6396;
  const BITMAP_INDEX_URL = '../artifacts/manifest/vocabulary-v1/indexes/by-bitmap.json?v=20260821-crossovers-v4';
  const CANONICAL_FAMILIES = new Set(['LR', 'TB', 'LT', 'LB', 'RT', 'RB']);

  const glyphCtx = glyphCanvas.getContext('2d');
  const overlayCtx = overlayCanvas.getContext('2d');

  const state = {
    bitmapIndex: null,
    indexReady: false,
    scheduled: false,
    compositing: false,
    lastSummary: null,
    lastError: null,
  };

  function portPixel(edge, index) {
    if (edge === 'L') return [0, index];
    if (edge === 'R') return [7, index];
    if (edge === 'T') return [index, 0];
    if (edge === 'B') return [index, 15];
    throw new Error(`Unknown GraphSCII edge ${edge}`);
  }

  function parsePort(text) {
    const match = /^([LRTB])(\d+)$/.exec(text);
    if (!match) throw new Error(`Invalid GraphSCII port ${text}`);
    return { edge: match[1], index: Number(match[2]), text };
  }

  // The straight vocabulary is generated only in these six canonical family
  // directions. Reverse semantic aliases map to the SAME owner/codepoint and
  // therefore MUST reuse the canonical bitmap rather than re-rasterizing in
  // reverse (Bresenham tie-breaking can differ by direction).
  function canonicalizeStraightPair(fromText, toText) {
    const from = parsePort(fromText);
    const to = parsePort(toText);
    if (CANONICAL_FAMILIES.has(`${from.edge}${to.edge}`)) return { from, to };
    if (CANONICAL_FAMILIES.has(`${to.edge}${from.edge}`)) return { from: to, to: from };
    throw new Error(`Illegal straight family ${fromText}>${toText}`);
  }

  function straightBitmapKey(fromText, toText) {
    const pair = canonicalizeStraightPair(fromText, toText);
    let [x0, y0] = portPixel(pair.from.edge, pair.from.index);
    const [x1, y1] = portPixel(pair.to.edge, pair.to.index);
    const rows = new Uint8Array(16);
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;

    while (true) {
      rows[y0] |= 1 << x0;
      if (x0 === x1 && y0 === y1) break;
      const doubled = error * 2;
      if (doubled >= dy) {
        error += dy;
        x0 += sx;
      }
      if (doubled <= dx) {
        error += dx;
        y0 += sy;
      }
    }

    return [...rows].map((row) => row.toString(16).padStart(2, '0')).join('');
  }

  function unionBitmapKey(segments) {
    const rows = new Uint8Array(16);
    for (const segment of segments) {
      const key = straightBitmapKey(segment.from, segment.to);
      for (let y = 0; y < 16; y += 1) {
        rows[y] |= Number.parseInt(key.slice(y * 2, y * 2 + 2), 16);
      }
    }
    return [...rows].map((row) => row.toString(16).padStart(2, '0')).join('');
  }

  function installBitmapIndex(entries) {
    if (!entries || typeof entries !== 'object') throw new Error('GraphSCII by-bitmap index is missing.');

    for (const [semantic, codepoint] of Object.entries(G.STRAIGHT_CODEPOINT_BY_PAIR)) {
      const [from, to] = semantic.split('>');
      const bitmap = straightBitmapKey(from, to);
      const glyphId = entries[bitmap];
      if (glyphId == null || 0xE000 + glyphId !== codepoint) {
        throw new Error(`Published bitmap index disagrees with straight semantic ${semantic}.`);
      }
    }

    // Explicitly guard the reverse-alias bug that broke compositor v1.
    if (straightBitmapKey('R8', 'L0') !== straightBitmapKey('L0', 'R8')) {
      throw new Error('Reverse straight aliases do not share canonical bitmap identity.');
    }

    state.bitmapIndex = Object.freeze({ ...entries });
    state.indexReady = true;
    return true;
  }

  function resolveCellSegments(segments) {
    if (!segments?.length) return null;
    if (segments.length === 1) {
      return {
        resolved: true,
        mode: 'single',
        family: 'straight',
        codepoint: segments[0].codepoint,
        bitmapKey: straightBitmapKey(segments[0].from, segments[0].to),
      };
    }

    const bitmapKey = unionBitmapKey(segments);

    // A published single glyph is only an optimization. It is NEVER required
    // for correctness. The exact fallback is to overstrike the already-solved
    // straight glyphs at the same cell origin.
    if (state.bitmapIndex) {
      const glyphId = state.bitmapIndex[bitmapKey];
      if (glyphId != null) {
        const isStraight = glyphId <= STRAIGHT_OWNER_MAX;
        const isConnector = glyphId >= CONNECTOR_OWNER_MIN && glyphId <= CONNECTOR_OWNER_MAX;
        if (isStraight || isConnector) {
          return {
            resolved: true,
            mode: 'single',
            family: isConnector ? 'connector' : 'straight',
            bitmapKey,
            glyphId,
            codepoint: 0xE000 + glyphId,
          };
        }
      }
    }

    return {
      resolved: true,
      mode: 'layered',
      family: 'exact-layered-straights',
      bitmapKey,
      codepoints: segments.map((segment) => segment.codepoint),
    };
  }

  function authoritativeCells() {
    const cells = new Map();
    for (const stroke of D.state.strokes) {
      for (const segment of stroke.finalSegments) {
        const key = `${segment.cellX},${segment.cellY}`;
        const entry = cells.get(key) ?? { x: segment.cellX, y: segment.cellY, segments: [] };
        entry.segments.push(segment);
        cells.set(key, entry);
      }
    }
    return cells;
  }

  function eraseRedBox(cell) {
    const x = cell.x * G.CELL_W;
    const y = cell.y * G.CELL_H;
    const band = 5;
    overlayCtx.clearRect(x, y, G.CELL_W, band);
    overlayCtx.clearRect(x, y + G.CELL_H - band, G.CELL_W, band);
    overlayCtx.clearRect(x, y, band, G.CELL_H);
    overlayCtx.clearRect(x + G.CELL_W - band, y, band, G.CELL_H);
  }

  function drawResolution(cell, resolution) {
    const x = cell.x * G.CELL_W;
    const y = cell.y * G.CELL_H;

    if (resolution.mode === 'single') {
      glyphCtx.fillText(String.fromCodePoint(resolution.codepoint), x, y);
    } else if (resolution.mode === 'layered') {
      for (const codepoint of resolution.codepoints) {
        glyphCtx.fillText(String.fromCodePoint(codepoint), x, y);
      }
    } else {
      throw new Error(`Unknown crossover render mode ${resolution.mode}`);
    }
    eraseRedBox(cell);
  }

  function composite() {
    state.scheduled = false;
    if (state.compositing) return;
    state.compositing = true;

    try {
      const cells = authoritativeCells();
      let multiPass = 0;
      let publishedConnectors = 0;
      let publishedStraightCollapses = 0;
      let layered = 0;

      glyphCtx.save();
      glyphCtx.fillStyle = '#111111';
      glyphCtx.textBaseline = 'top';
      glyphCtx.textAlign = 'left';
      glyphCtx.fontKerning = 'none';
      glyphCtx.font = `${G.CELL_H}px GraphSCII`;

      for (const cell of cells.values()) {
        if (cell.segments.length <= 1) continue;
        multiPass += 1;
        const resolution = resolveCellSegments(cell.segments);
        drawResolution(cell, resolution);
        if (resolution.mode === 'layered') layered += 1;
        else if (resolution.family === 'connector') publishedConnectors += 1;
        else publishedStraightCollapses += 1;
      }
      glyphCtx.restore();

      state.lastSummary = {
        multiPass,
        publishedConnectors,
        publishedStraightCollapses,
        layered,
        indexReady: state.indexReady,
      };
      state.lastError = null;

      if (!multiPass) {
        overlapEl.textContent = 'Continuous shared-port path';
      } else {
        overlapEl.textContent = `${multiPass} exact multi-pass cells: ${publishedConnectors} connector glyph${publishedConnectors === 1 ? '' : 's'}, ${layered} layered`;
      }
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      console.error('GraphSCII crossover compositor v2 failed:', error);
      overlapEl.textContent = `Crossover render error: ${state.lastError}`;
    } finally {
      state.compositing = false;
    }
  }

  function scheduleComposite() {
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(composite);
  }

  // draw-v6 writes "N true multi-pass cells" whenever its base frame paints.
  // Observe that write and immediately schedule the exact final-cell compositor.
  const statusObserver = new MutationObserver(() => {
    if (state.compositing) return;
    if (/true multi-pass cell/.test(overlapEl.textContent || '')) scheduleComposite();
  });
  statusObserver.observe(overlapEl, { childList: true, characterData: true, subtree: true });

  for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
    overlayCanvas.addEventListener(eventName, scheduleComposite);
  }
  for (const button of toolButtons) button.addEventListener('click', scheduleComposite);
  undoButton?.addEventListener('click', scheduleComposite);
  clearButton?.addEventListener('click', scheduleComposite);
  showNodesInput?.addEventListener('change', scheduleComposite);

  async function loadPublishedIndex() {
    try {
      const response = await fetch(BITMAP_INDEX_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.index !== 'by-bitmap' || payload?.entryCount !== 6397) {
        throw new Error('unexpected by-bitmap index format');
      }
      installBitmapIndex(payload.entries);
      scheduleComposite();
    } catch (error) {
      // Exact layered rendering remains fully functional without the index.
      // Dedicated connector glyph collapse is only an optional optimization.
      state.indexReady = false;
      state.bitmapIndex = null;
      console.warn('GraphSCII connector index unavailable; exact layered crossovers remain active.', error);
      scheduleComposite();
    }
  }

  globalThis.GraphSCIICrossovers = {
    version: 2,
    state,
    canonicalizeStraightPair,
    straightBitmapKey,
    unionBitmapKey,
    installBitmapIndex,
    resolveCellSegments,
    authoritativeCells,
    composite,
    scheduleComposite,
  };

  scheduleComposite();
  loadPublishedIndex();
})();
