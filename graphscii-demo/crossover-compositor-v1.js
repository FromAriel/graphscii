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
    console.error('GraphSCII crossover compositor could not attach to the authoritative draw/debug state.');
    return;
  }

  const STRAIGHT_OWNER_MAX = 745;
  const CONNECTOR_OWNER_MIN = 5796;
  const CONNECTOR_OWNER_MAX = 6396;
  const BITMAP_INDEX_URL = '../artifacts/manifest/vocabulary-v1/indexes/by-bitmap.json?v=20260821-crossovers-v2';

  const glyphCtx = glyphCanvas.getContext('2d');
  const overlayCtx = overlayCanvas.getContext('2d');
  const state = {
    bitmapIndex: null,
    ready: false,
    scheduled: false,
    lastSummary: null,
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
    return { edge: match[1], index: Number(match[2]) };
  }

  function straightBitmapKey(fromText, toText) {
    const from = parsePort(fromText);
    const to = parsePort(toText);
    let [x0, y0] = portPixel(from.edge, from.index);
    const [x1, y1] = portPixel(to.edge, to.index);
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

    const connectorOwners = Object.values(entries)
      .filter((glyphId) => glyphId >= CONNECTOR_OWNER_MIN && glyphId <= CONNECTOR_OWNER_MAX)
      .length;
    if (connectorOwners !== 601) {
      throw new Error(`Expected 601 published connector owners; found ${connectorOwners}.`);
    }

    state.bitmapIndex = Object.freeze({ ...entries });
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
    if (!state.bitmapIndex) return { resolved: false, reason: 'bitmap-index-not-loaded', bitmapKey };

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

    // The published connector basis is intentionally compact, not exhaustive.
    // When an arbitrary multi-pass union has no single connector codepoint, the
    // exact representation is the original already-solved straight glyphs
    // overstruck at the same 8x16 cell origin. No ports or pixels are changed.
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
    // draw-v6 paints the diagnostic box on the overlay canvas. Clear only the
    // four thin border bands after its render; the glyph canvas is untouched.
    const x = cell.x * G.CELL_W + 1;
    const y = cell.y * G.CELL_H + 1;
    const w = G.CELL_W - 2;
    const h = G.CELL_H - 2;
    const band = 4;
    overlayCtx.clearRect(x, y, w, band);
    overlayCtx.clearRect(x, y + h - band, w, band);
    overlayCtx.clearRect(x, y, band, h);
    overlayCtx.clearRect(x + w - band, y, band, h);
  }

  function drawResolution(cell, resolution) {
    if (!resolution?.resolved) return false;
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
    return true;
  }

  function composite() {
    state.scheduled = false;
    if (!state.ready || !state.bitmapIndex) return;

    const cells = authoritativeCells();
    let multiPass = 0;
    let publishedConnectors = 0;
    let publishedStraightCollapses = 0;
    let layered = 0;
    let unresolved = 0;

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
      if (!resolution?.resolved) {
        unresolved += 1;
        continue;
      }
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
      unresolved,
    };

    if (!multiPass) {
      overlapEl.textContent = 'Continuous shared-port path';
    } else if (!unresolved) {
      overlapEl.textContent = `${multiPass} exact multi-pass cells: ${publishedConnectors} connector glyph${publishedConnectors === 1 ? '' : 's'}, ${layered} layered`;
    } else {
      overlapEl.textContent = `${multiPass} multi-pass: ${publishedConnectors} connectors, ${layered} layered, ${unresolved} unresolved`;
    }
  }

  function scheduleComposite() {
    if (!state.ready || state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(composite);
  }

  function selfTest() {
    if (!state.bitmapIndex) throw new Error('Crossover self-test requires the published bitmap index.');

    const horizontal = {
      from: 'L0',
      to: 'R0',
      codepoint: G.STRAIGHT_CODEPOINT_BY_PAIR['L0>R0'],
    };
    const vertical = {
      from: 'T0',
      to: 'B0',
      codepoint: G.STRAIGHT_CODEPOINT_BY_PAIR['T0>B0'],
    };
    const cross = resolveCellSegments([horizontal, vertical]);
    if (!cross?.resolved || cross.mode !== 'single' || cross.family !== 'connector' || cross.codepoint !== 0xF6A4) {
      throw new Error(`Exact L0>R0 + T0>B0 connector regression failed: ${JSON.stringify(cross)}`);
    }

    const uploaded = resolveCellSegments([
      { from: 'R6', to: 'L15', codepoint: G.STRAIGHT_CODEPOINT_BY_PAIR['R6>L15'] },
      { from: 'T1', to: 'R13', codepoint: G.STRAIGHT_CODEPOINT_BY_PAIR['T1>R13'] },
    ]);
    if (!uploaded?.resolved || uploaded.mode !== 'layered' || uploaded.bitmapKey !== '02020404080890502020504884840201') {
      throw new Error(`Uploaded arbitrary crossover regression failed: ${JSON.stringify(uploaded)}`);
    }

    const duplicate = resolveCellSegments([horizontal, horizontal]);
    if (!duplicate?.resolved || duplicate.mode !== 'single' || duplicate.family !== 'straight' || duplicate.codepoint !== horizontal.codepoint) {
      throw new Error('Duplicate identical pass did not collapse to the exact straight glyph.');
    }

    return true;
  }

  // draw-v6 owns all pointer/tool state and renders first. The debug recorder is
  // already registered before this script and mirrors committed finalSegments.
  // These listeners do not compile or mutate geometry; they only schedule the
  // compositor for the next animation frame, after draw-v6 has finished repainting.
  for (const eventName of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave']) {
    overlayCanvas.addEventListener(eventName, scheduleComposite);
  }
  for (const button of toolButtons) button.addEventListener('click', scheduleComposite);
  undoButton?.addEventListener('click', scheduleComposite);
  clearButton?.addEventListener('click', scheduleComposite);
  showNodesInput?.addEventListener('change', scheduleComposite);

  async function boot() {
    try {
      const response = await fetch(BITMAP_INDEX_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load GraphSCII bitmap index: HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.index !== 'by-bitmap' || payload?.entryCount !== 6397) {
        throw new Error('Unexpected GraphSCII by-bitmap index format.');
      }
      installBitmapIndex(payload.entries);
      await document.fonts.load(`${G.CELL_H}px GraphSCII`);
      selfTest();
      state.ready = true;
      scheduleComposite();
    } catch (error) {
      console.error('GraphSCII crossover compositor failed startup validation:', error);
      overlapEl.textContent = `Crossover resolver failed: ${error.message}`;
    }
  }

  globalThis.GraphSCIICrossovers = {
    state,
    straightBitmapKey,
    unionBitmapKey,
    installBitmapIndex,
    resolveCellSegments,
    authoritativeCells,
    selfTest,
    composite,
    scheduleComposite,
  };

  boot();
})();
