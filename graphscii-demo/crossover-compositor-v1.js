(() => {
  'use strict';

  const G = globalThis.GraphSCIIDrawV6;
  const overlayCanvas = document.querySelector('#overlay-canvas');
  const glyphCanvas = document.querySelector('#glyph-canvas');
  const overlapEl = document.querySelector('#overlap-status');
  const undoButton = document.querySelector('#undo');
  const clearButton = document.querySelector('#clear');
  const showNodesInput = document.querySelector('#show-nodes');
  const toolButtons = [...document.querySelectorAll('[data-tool]')];

  if (!G || !overlayCanvas || !glyphCanvas || !overlapEl) {
    console.error('GraphSCII exact crossover compositor could not attach.');
    return;
  }

  const STRAIGHT_OWNER_MAX = 745;
  const CONNECTOR_OWNER_MIN = 5796;
  const CONNECTOR_OWNER_MAX = 6396;
  const BITMAP_INDEX_URL = '../artifacts/manifest/vocabulary-v1/indexes/by-bitmap.json?v=20260821-crossovers-v1';

  const glyphCtx = glyphCanvas.getContext('2d');
  const overlayCtx = overlayCanvas.getContext('2d');
  const state = {
    strokes: [],
    active: null,
    bezierClicks: [],
    bitmapIndex: null,
    ready: false,
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const currentTool = () => document.querySelector('[data-tool].active')?.dataset.tool ?? 'freehand';

  function canvasPoint(event) {
    const rect = overlayCanvas.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * overlayCanvas.width, 0, overlayCanvas.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * overlayCanvas.height, 0, overlayCanvas.height),
    };
  }

  function appendPoint(points, point) {
    const previous = points[points.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.05) points.push(point);
  }

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
        family: 'straight',
        codepoint: segments[0].codepoint,
        glyphId: segments[0].codepoint - 0xE000,
        bitmapKey: straightBitmapKey(segments[0].from, segments[0].to),
      };
    }

    const bitmapKey = unionBitmapKey(segments);
    if (!state.bitmapIndex) return { resolved: false, reason: 'bitmap-index-not-loaded', bitmapKey };

    const glyphId = state.bitmapIndex[bitmapKey];
    if (glyphId == null) return { resolved: false, reason: 'no-exact-published-glyph', bitmapKey };

    const isStraight = glyphId <= STRAIGHT_OWNER_MAX;
    const isConnector = glyphId >= CONNECTOR_OWNER_MIN && glyphId <= CONNECTOR_OWNER_MAX;
    if (!isStraight && !isConnector) {
      return {
        resolved: false,
        reason: 'exact-bitmap-is-not-a-line-or-connector-glyph',
        bitmapKey,
        glyphId,
        codepoint: 0xE000 + glyphId,
      };
    }

    return {
      resolved: true,
      family: isConnector ? 'connector' : 'straight',
      bitmapKey,
      glyphId,
      codepoint: 0xE000 + glyphId,
    };
  }

  function groupCells() {
    const cells = new Map();
    for (const stroke of state.strokes) {
      G.validateSegments(stroke.segments);
      for (const segment of stroke.segments) {
        const key = `${segment.cellX},${segment.cellY}`;
        const entry = cells.get(key) ?? { x: segment.cellX, y: segment.cellY, segments: [] };
        entry.segments.push(segment);
        cells.set(key, entry);
      }
    }
    return cells;
  }

  function eraseResolvedRedBox(cell) {
    overlayCtx.save();
    overlayCtx.globalCompositeOperation = 'destination-out';
    overlayCtx.lineWidth = 5;
    overlayCtx.strokeRect(
      cell.x * G.CELL_W + 2,
      cell.y * G.CELL_H + 2,
      G.CELL_W - 4,
      G.CELL_H - 4,
    );
    overlayCtx.restore();
  }

  function composite() {
    if (!state.ready || !state.bitmapIndex) return;

    const cells = groupCells();
    let multiPass = 0;
    let exact = 0;
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
      cell.resolution = resolution;
      if (!resolution?.resolved) {
        unresolved += 1;
        continue;
      }

      exact += 1;
      glyphCtx.fillText(
        String.fromCodePoint(resolution.codepoint),
        cell.x * G.CELL_W,
        cell.y * G.CELL_H,
      );
      eraseResolvedRedBox(cell);
    }
    glyphCtx.restore();

    if (!multiPass) overlapEl.textContent = 'Continuous shared-port path';
    else if (!unresolved) {
      overlapEl.textContent = `${exact} exact connector/multi-pass glyph${exact === 1 ? '' : 's'}`;
    } else {
      overlapEl.textContent = `${exact} exact multi-pass glyph${exact === 1 ? '' : 's'}; ${unresolved} unresolved`;
    }
  }

  let scheduled = false;
  function scheduleComposite() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      composite();
    });
  }

  function commitSegments(tool, guide) {
    if (!guide?.length) return;
    const segments = G.compileRawPath(guide);
    if (!segments.length) return;
    G.validateSegments(segments);
    state.strokes.push({ tool, segments: segments.map((segment) => ({ ...segment })) });
  }

  function finishGesture(event) {
    if (!state.active || state.active.pointerId !== event.pointerId) return;
    const active = state.active;
    const end = canvasPoint(event);
    let guide = null;

    if (active.tool === 'freehand') {
      appendPoint(active.points, end);
      guide = active.points;
    } else if (active.tool === 'line') {
      guide = G.lineGuide(active.start, end);
    } else if (active.tool === 'ellipse') {
      guide = G.ellipseGuide(active.start, end);
    }

    commitSegments(active.tool, guide);
    state.active = null;
    scheduleComposite();
  }

  overlayCanvas.addEventListener('pointerdown', (event) => {
    const tool = currentTool();
    const point = canvasPoint(event);

    if (tool === 'bezier') {
      state.bezierClicks.push(point);
      if (state.bezierClicks.length === 4) {
        const controlPoints = state.bezierClicks.slice();
        commitSegments('bezier', G.bezierGuide(controlPoints));
        state.bezierClicks = [];
      }
      scheduleComposite();
      return;
    }

    state.active = {
      tool,
      pointerId: event.pointerId,
      start: point,
      points: [point],
    };
    scheduleComposite();
  });

  overlayCanvas.addEventListener('pointermove', (event) => {
    if (state.active?.pointerId === event.pointerId && state.active.tool === 'freehand') {
      const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
      for (const sample of events) appendPoint(state.active.points, canvasPoint(sample));
      appendPoint(state.active.points, canvasPoint(event));
    }
    scheduleComposite();
  });

  overlayCanvas.addEventListener('pointerup', finishGesture);
  overlayCanvas.addEventListener('pointercancel', (event) => {
    if (state.active?.pointerId === event.pointerId) state.active = null;
    scheduleComposite();
  });
  overlayCanvas.addEventListener('pointerleave', scheduleComposite);

  for (const button of toolButtons) {
    button.addEventListener('click', () => {
      state.active = null;
      state.bezierClicks = [];
      scheduleComposite();
    });
  }

  undoButton?.addEventListener('click', () => {
    state.strokes.pop();
    state.active = null;
    state.bezierClicks = [];
    scheduleComposite();
  });

  clearButton?.addEventListener('click', () => {
    state.strokes = [];
    state.active = null;
    state.bezierClicks = [];
    scheduleComposite();
  });

  showNodesInput?.addEventListener('change', scheduleComposite);

  overlayCanvas.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      state.strokes.pop();
      state.active = null;
      state.bezierClicks = [];
      scheduleComposite();
    } else if (event.key === 'Escape') {
      state.active = null;
      state.bezierClicks = [];
      scheduleComposite();
    }
  });

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
    if (!cross?.resolved || cross.family !== 'connector' || cross.codepoint !== 0xF6A4) {
      throw new Error(`Exact L0>R0 + T0>B0 connector regression failed: ${JSON.stringify(cross)}`);
    }

    const duplicate = resolveCellSegments([horizontal, horizontal]);
    if (!duplicate?.resolved || duplicate.family !== 'straight' || duplicate.codepoint !== horizontal.codepoint) {
      throw new Error('Duplicate identical pass did not collapse to the exact straight glyph.');
    }

    return true;
  }

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
      composite();
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
    selfTest,
    composite,
  };

  boot();
})();
