(() => {
  'use strict';

  const G = globalThis.GraphSCIIDrawV6;
  const canvas = document.querySelector('#overlay-canvas');
  const exportButton = document.querySelector('#debug-export');
  const undoButton = document.querySelector('#undo');
  const clearButton = document.querySelector('#clear');
  const toolButtons = [...document.querySelectorAll('[data-tool]')];

  if (!G || !canvas || !exportButton) {
    console.error('GraphSCII debug exporter could not attach.');
    return;
  }

  const state = { strokes: [], active: null, bezierClicks: [], sequence: 0 };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const currentTool = () => document.querySelector('[data-tool].active')?.dataset.tool ?? 'freehand';

  function sampleFromEvent(event, source) {
    const rect = canvas.getBoundingClientRect();
    return {
      sequence: state.sequence++,
      source,
      x: clamp(((event.clientX - rect.left) / rect.width) * canvas.width, 0, canvas.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * canvas.height, 0, canvas.height),
      clientX: event.clientX,
      clientY: event.clientY,
      timeStamp: event.timeStamp,
      pointerId: event.pointerId,
      pointerType: event.pointerType || 'unknown',
      pressure: Number.isFinite(event.pressure) ? event.pressure : null,
      buttons: event.buttons,
      tiltX: Number.isFinite(event.tiltX) ? event.tiltX : null,
      tiltY: Number.isFinite(event.tiltY) ? event.tiltY : null,
      width: Number.isFinite(event.width) ? event.width : null,
      height: Number.isFinite(event.height) ? event.height : null,
    };
  }

  const point = (sample) => ({ x: sample.x, y: sample.y });

  function appendSample(samples, sample) {
    const previous = samples[samples.length - 1];
    if (!previous || Math.hypot(sample.x - previous.x, sample.y - previous.y) > 0.05) samples.push(sample);
  }

  function appendPointerMoveSamples(event, samples) {
    const coalesced = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
    for (const sample of coalesced) appendSample(samples, sampleFromEvent(sample, 'coalesced-pointermove'));
    appendSample(samples, sampleFromEvent(event, 'pointermove'));
  }

  function auditRawCrossings(points) {
    return G.rawTransitions(points).map((transition) => ({
      inputPair: transition.inputPair,
      kind: transition.kind,
      t: transition.t,
      crossingPoint: { ...transition.point },
      fromCell: { ...transition.fromCell },
      exit: G.portText(transition.exit),
      exitIndex: transition.exit.index,
      entry: G.portText(transition.entry),
      entryIndex: transition.entry.index,
      toCell: { ...transition.toCell },
      canonicalNode: transition.nodeKey,
      slotModel: transition.kind === 'vertical'
        ? `16 equal rows; ${G.SLOT_H}px each`
        : `8 equal columns; ${G.SLOT_W}px each`,
    }));
  }

  function segmentAudit(segments) {
    const joins = [];
    let valid = true;
    let error = null;
    try { G.validateSegments(segments); }
    catch (caught) {
      valid = false;
      error = caught instanceof Error ? caught.message : String(caught);
    }
    for (let i = 1; i < segments.length; i += 1) {
      joins.push({
        previousIndex: i - 1,
        nextIndex: i,
        previousToNode: segments[i - 1].toNode,
        nextFromNode: segments[i].fromNode,
        exactMatch: segments[i - 1].toNode === segments[i].fromNode,
      });
    }
    return { valid, error, brokenJoinCount: joins.filter((join) => !join.exactMatch).length, joins };
  }

  function makeRecord(tool, samples, guide, segments, extra = {}) {
    const rawPoints = samples.map(point);
    return {
      id: state.strokes.length,
      tool,
      pointerSampleCount: samples.length,
      rawPointerSamples: samples.map((sample) => ({ ...sample })),
      rawPointerPath: rawPoints,
      rawBoundaryCrossings: auditRawCrossings(rawPoints),
      guidePointCount: guide.length,
      guidePath: guide.map((p) => ({ x: p.x, y: p.y })),
      finalSegments: segments.map((segment) => ({
        ...segment,
        codepointHex: `U+${segment.codepoint.toString(16).toUpperCase().padStart(4, '0')}`,
        glyph: String.fromCodePoint(segment.codepoint),
      })),
      continuity: segmentAudit(segments),
      ...extra,
    };
  }

  function finalizeGesture(active, finalEvent) {
    appendSample(active.samples, sampleFromEvent(finalEvent, 'pointerup'));
    const samples = active.samples;
    const rawPoints = samples.map(point);
    const start = rawPoints[0];
    const end = rawPoints[rawPoints.length - 1];
    let guide;
    if (active.tool === 'freehand') guide = rawPoints;
    else if (active.tool === 'line') guide = G.lineGuide(start, end);
    else if (active.tool === 'ellipse') guide = G.ellipseGuide(start, end);
    else return;
    const segments = guide.length ? G.compileRawPath(guide) : [];
    if (segments.length) state.strokes.push(makeRecord(active.tool, samples, guide, segments));
  }

  function panelSnapshot() {
    const cells = new Map();
    for (const stroke of state.strokes) {
      for (const segment of stroke.finalSegments) {
        const key = `${segment.cellX},${segment.cellY}`;
        const entry = cells.get(key) ?? { x: segment.cellX, y: segment.cellY, passes: [] };
        entry.passes.push({ ...segment });
        cells.set(key, entry);
      }
    }

    const glyphRows = Array.from({ length: G.ROWS }, () => Array(G.COLS).fill(' '));
    const codepointRows = Array.from({ length: G.ROWS }, () => Array(G.COLS).fill(null));
    const semanticRows = Array.from({ length: G.ROWS }, () => Array(G.COLS).fill(null));
    const cellList = [];
    const multiPassCells = [];

    for (const entry of cells.values()) {
      const displayed = entry.passes[0];
      const glyph = displayed.glyph ?? String.fromCodePoint(displayed.codepoint);
      const codepointHex = displayed.codepointHex ?? `U+${displayed.codepoint.toString(16).toUpperCase().padStart(4, '0')}`;
      glyphRows[entry.y][entry.x] = glyph;
      codepointRows[entry.y][entry.x] = codepointHex;
      semanticRows[entry.y][entry.x] = `${displayed.from}>${displayed.to}`;
      const record = {
        x: entry.x,
        y: entry.y,
        displayedGlyph: glyph,
        displayedCodepoint: codepointHex,
        displayedSemantic: `${displayed.from}>${displayed.to}`,
        passCount: entry.passes.length,
        passes: entry.passes,
      };
      cellList.push(record);
      if (entry.passes.length > 1) multiPassCells.push(record);
    }

    cellList.sort((a, b) => a.y - b.y || a.x - b.x);
    multiPassCells.sort((a, b) => a.y - b.y || a.x - b.x);
    return {
      widthCells: G.COLS,
      heightCells: G.ROWS,
      glyphText: glyphRows.map((row) => row.join('')).join('\n'),
      glyphRows: glyphRows.map((row) => row.join('')),
      codepoints: codepointRows,
      semantics: semanticRows,
      nonEmptyCells: cellList,
      multiPassCells,
    };
  }

  function buildExport() {
    return {
      format: 'graphscii-debug-v2',
      generatedAt: new Date().toISOString(),
      runtime: 'draw-v6.js',
      topologyModel: {
        canonicalIdentity: 'Rk<->adjacent Lk and Bk<->adjacent Tk only; perpendicular corner ports remain distinct',
        verticalSnap: `floor(localY/${G.SLOT_H}); 16 equal bitmap-row slots`,
        horizontalSnap: `floor(localX/${G.SLOT_W}); 8 equal bitmap-column slots`,
      },
      browser: {
        userAgent: navigator.userAgent,
        devicePixelRatio: window.devicePixelRatio,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      },
      geometry: {
        columns: G.COLS,
        rows: G.ROWS,
        cellWidth: G.CELL_W,
        cellHeight: G.CELL_H,
        topBottomNodes: G.TOP_BOTTOM_NODES,
        sideNodes: G.SIDE_NODES,
        pixelSlotWidth: G.SLOT_W,
        pixelSlotHeight: G.SLOT_H,
      },
      strokeCount: state.strokes.length,
      strokes: state.strokes,
      pendingBezierClicks: state.bezierClicks.map((sample) => ({ ...sample })),
      panel: panelSnapshot(),
    };
  }

  function downloadDebugExport() {
    const json = JSON.stringify(buildExport(), null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    anchor.href = url;
    anchor.download = `graphscii-debug-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  canvas.addEventListener('pointerdown', (event) => {
    const tool = currentTool();
    const sample = sampleFromEvent(event, 'pointerdown');
    if (tool === 'bezier') {
      state.bezierClicks.push(sample);
      if (state.bezierClicks.length === 4) {
        const clickSamples = state.bezierClicks.slice();
        const points = clickSamples.map(point);
        const guide = G.bezierGuide(points);
        const segments = G.compileRawPath(guide);
        if (segments.length) state.strokes.push(makeRecord('bezier', clickSamples, guide, segments, { controlPoints: points }));
        state.bezierClicks = [];
      }
      return;
    }
    state.active = { tool, pointerId: event.pointerId, samples: [sample] };
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!state.active || state.active.pointerId !== event.pointerId) return;
    appendPointerMoveSamples(event, state.active.samples);
  });

  canvas.addEventListener('pointerup', (event) => {
    if (!state.active || state.active.pointerId !== event.pointerId) return;
    finalizeGesture(state.active, event);
    state.active = null;
  });

  canvas.addEventListener('pointercancel', (event) => {
    if (state.active?.pointerId === event.pointerId) state.active = null;
  });

  for (const button of toolButtons) button.addEventListener('click', () => {
    state.active = null;
    state.bezierClicks = [];
  });

  undoButton?.addEventListener('click', () => {
    state.strokes.pop();
    state.bezierClicks = [];
    state.active = null;
  });

  clearButton?.addEventListener('click', () => {
    state.strokes = [];
    state.bezierClicks = [];
    state.active = null;
  });

  exportButton.addEventListener('click', downloadDebugExport);
  globalThis.GraphSCIIDebug = { snapshot: buildExport, state };
})();
