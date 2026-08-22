(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Pure crossover-resolution core. Everything above the document guard is
  // Node-testable: CI requires this file and runs selfTest() without a DOM.
  // ---------------------------------------------------------------------------

  const CANONICAL_FAMILIES = new Set(['LR', 'TB', 'LT', 'LB', 'RT', 'RB']);
  const TABLE_HEADER_PREFIX = '# graphscii-crossover-resolution-v0\t';
  const EXPECTED_TABLE_STATES = 345696;
  const PUA_BASE = 0xE000;

  function parsePort(text) {
    const match = /^([LRTB])(\d{1,2})$/.exec(text);
    if (!match) throw new Error(`Invalid GraphSCII port ${text}`);
    return { edge: match[1], index: Number(match[2]) };
  }

  // The straight vocabulary is generated only in six canonical family
  // directions. Reverse semantic aliases map to the SAME owner/codepoint and
  // therefore MUST reuse the canonical segment key rather than re-rasterizing
  // in reverse (Bresenham tie-breaking can differ by direction).
  function canonicalizeSegmentKey(key) {
    const [fromText, toText] = String(key).split('>');
    const from = parsePort(fromText);
    const to = parsePort(toText);
    if (from.edge === to.edge) throw new Error(`Illegal same-edge segment ${key}`);
    if (CANONICAL_FAMILIES.has(`${from.edge}${to.edge}`)) return `${fromText}>${toText}`;
    if (CANONICAL_FAMILIES.has(`${to.edge}${from.edge}`)) return `${toText}>${fromText}`;
    throw new Error(`Illegal straight family ${key}`);
  }

  // Plan §4: state key = sorted, deduplicated canonical segment list so any
  // runtime can rebuild identical keys from an unordered cell state.
  function buildStateKey(segmentKeys) {
    const keys = [...new Set(segmentKeys.map(canonicalizeSegmentKey))].sort();
    return keys.join('+');
  }

  function parseResolutionTable(text) {
    const table = new Map();
    const lines = String(text).split('\n');
    if (!lines[0] || !lines[0].startsWith(TABLE_HEADER_PREFIX)) {
      throw new Error('Unexpected crossover resolution table header.');
    }
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line) continue;
      const parts = line.split('\t');
      if (parts.length !== 6) throw new Error(`Malformed resolution row ${i}: ${line}`);
      const [stateKey, tierText, glyphIdText, missedText, extraText, costText] = parts;
      const tier = Number(tierText);
      const glyphId = Number(glyphIdText);
      const missedPorts = Number(missedText);
      const extraPorts = Number(extraText);
      const costScaled = Number(costText);
      if (
        (tier !== 0 && tier !== 1) ||
        !Number.isInteger(glyphId) || glyphId < 0 ||
        !Number.isInteger(missedPorts) || missedPorts < 0 ||
        !Number.isInteger(extraPorts) || extraPorts < 0 ||
        !Number.isInteger(costScaled) || costScaled < 0
      ) {
        throw new Error(`Malformed resolution values at row ${i}.`);
      }
      table.set(stateKey, { tier, glyphId, missedPorts, extraPorts, costScaled });
    }
    if (table.size !== EXPECTED_TABLE_STATES) {
      throw new Error(`Resolution table must contain ${EXPECTED_TABLE_STATES} states; got ${table.size}.`);
    }
    return table;
  }

  function resolveState(table, stateKey) {
    return table ? table.get(stateKey) ?? null : null;
  }

  // Boundary attachment labels of a published bitmap: L{i} iff row i bit0,
  // R{i} iff row i bit7, T{i} iff row 0 bit i, B{i} iff row 15 bit i.
  function occupiedPortLabels(bitmapKey) {
    if (!/^[0-9a-f]{32}$/.test(bitmapKey)) throw new Error(`Invalid bitmap key ${bitmapKey}`);
    const rows = [];
    for (let y = 0; y < 16; y += 1) rows.push(Number.parseInt(bitmapKey.slice(y * 2, y * 2 + 2), 16));
    const labels = new Set();
    for (let y = 0; y < 16; y += 1) {
      if ((rows[y] & 0x01) !== 0) labels.add(`L${y}`);
      if ((rows[y] & 0x80) !== 0) labels.add(`R${y}`);
    }
    for (let x = 0; x < 8; x += 1) {
      if ((rows[0] & (1 << x)) !== 0) labels.add(`T${x}`);
      if ((rows[15] & (1 << x)) !== 0) labels.add(`B${x}`);
    }
    return labels;
  }

  // A desired port of a cell is MATED when some other cell also uses its
  // canonical node. Segments inside the same cell do not mate each other.
  function computeMatedPortsByCell(segments) {
    const nodeUsage = new Map();
    for (const segment of segments) {
      const cellKey = `${segment.cellX},${segment.cellY}`;
      for (const [node, label] of [[segment.fromNode, segment.from], [segment.toNode, segment.to]]) {
        let usage = nodeUsage.get(node);
        if (!usage) {
          usage = new Map();
          nodeUsage.set(node, usage);
        }
        usage.set(cellKey, label);
      }
    }

    const matedByCell = new Map();
    for (const segment of segments) {
      const cellKey = `${segment.cellX},${segment.cellY}`;
      let mated = matedByCell.get(cellKey);
      if (!mated) {
        mated = new Set();
        matedByCell.set(cellKey, mated);
      }
      for (const [node, label] of [[segment.fromNode, segment.from], [segment.toNode, segment.to]]) {
        for (const otherCell of nodeUsage.get(node).keys()) {
          if (otherCell !== cellKey) {
            mated.add(label);
            break;
          }
        }
      }
    }
    return matedByCell;
  }

  // Pure per-cell decision. Never layers: unsupported states resolve to an
  // explicit unresolved kind that callers must surface honestly.
  function resolveCellSegments(segmentKeys, table, straightLookup) {
    const uniqueKeys = [...new Set(segmentKeys.map(canonicalizeSegmentKey))];
    if (uniqueKeys.length === 1) {
      const segmentKey = uniqueKeys[0];
      const codepoint = straightLookup ? straightLookup[segmentKey] : null;
      if (codepoint == null) return { kind: 'unresolved', reason: `unknown single semantic ${segmentKey}` };
      return { kind: 'single', segmentKey, codepoint };
    }
    if (uniqueKeys.length > 2) {
      return { kind: 'unsupported', reason: `${uniqueKeys.length} distinct segments exceed pair scope` };
    }
    const stateKey = buildStateKey(uniqueKeys);
    const entry = resolveState(table, stateKey);
    if (!entry) return { kind: 'unresolved', stateKey, reason: 'state absent from resolution table' };
    return { kind: 'resolved', stateKey, entry };
  }

  function selfTest() {
    // Canonicalization and reverse-alias identity.
    if (canonicalizeSegmentKey('R8>L0') !== 'L0>R8') throw new Error('Reverse straight alias not canonicalized');
    if (canonicalizeSegmentKey('L0>R8') !== 'L0>R8') throw new Error('Canonical segment mutated');
    if (canonicalizeSegmentKey('B6>T2') !== 'T2>B6') throw new Error('TB reverse alias not canonicalized');
    let threw = false;
    try { canonicalizeSegmentKey('L0>L1'); } catch { threw = true; }
    if (!threw) throw new Error('Same-edge segment accepted');

    // State keys are sorted and deduplicated.
    if (buildStateKey(['T3>B3', 'L5>R5']) !== 'L5>R5+T3>B3') throw new Error('State key not sorted');
    if (buildStateKey(['L5>R5', 'R5>L5']) !== 'L5>R5') throw new Error('Duplicate segment not collapsed');

    // Boundary attachment model.
    const horizontal = occupiedPortLabels('ff000000000000000000000000000000');
    if (!(horizontal.has('L0') && horizontal.has('R0'))) throw new Error('Horizontal attachment labels wrong');
    if (horizontal.size !== 10) throw new Error(`Row-0 runner should attach L0,R0,T0..T7; got ${horizontal.size}`);
    const verticalColumn = occupiedPortLabels('01010101010101010101010101010101');
    if (verticalColumn.size !== 18) throw new Error('Edge-running column should attach L0..L15 plus T0,B0');
    if (!verticalColumn.has('L15') || !verticalColumn.has('B0') || !verticalColumn.has('T0')) {
      throw new Error('Edge-runner endpoint labels missing');
    }
    const bottomRight = occupiedPortLabels(`${'00'.repeat(15)}80`);
    if (!(bottomRight.has('B7') && bottomRight.has('R15')) || bottomRight.size !== 2) {
      throw new Error('Bottom-right attachment labels wrong');
    }
    const topMid = occupiedPortLabels(`04${'00'.repeat(15)}`);
    if (!(topMid.has('T2') && topMid.size === 1)) throw new Error('Top attachment label wrong');

    // Mate computation across cells.
    const segments = [
      { cellX: 0, cellY: 0, from: 'L5', to: 'R5', fromNode: 'V:0:0:5', toNode: 'V:1:0:5' },
      { cellX: 1, cellY: 0, from: 'L5', to: 'R9', fromNode: 'V:1:0:5', toNode: 'V:2:0:9' },
    ];
    const mates = computeMatedPortsByCell(segments);
    const cellAMates = [...(mates.get('0,0') ?? [])].sort();
    const cellBMates = [...(mates.get('1,0') ?? [])].sort();
    if (cellAMates.join(',') !== 'R5') throw new Error(`Cell A mates wrong: ${cellAMates}`);
    if (cellBMates.join(',') !== 'L5') throw new Error(`Cell B mates wrong: ${cellBMates}`);

    // Cell resolution kinds against an embedded mini-table.
    const miniTable = new Map([
      ['L5>R5+T3>B3', { tier: 0, glyphId: 5796, missedPorts: 0, extraPorts: 0, costScaled: 0 }],
      ['L0>R8+T3>B3', { tier: 1, glyphId: 5818, missedPorts: 1, extraPorts: 2, costScaled: 13000 }],
    ]);
    const lookup = { 'L5>R5': 0xE000 + 12 };

    const single = resolveCellSegments(['L5>R5'], miniTable, lookup);
    if (single.kind !== 'single' || single.codepoint !== 0xE000 + 12) throw new Error('Single-segment resolution failed');

    const overlap = resolveCellSegments(['L5>R5', 'R5>L5'], miniTable, lookup);
    if (overlap.kind !== 'single') throw new Error('Overlapping strokes did not collapse to one segment');

    const exact = resolveCellSegments(['R5>L5', 'B3>T3'], miniTable, lookup);
    if (exact.kind !== 'resolved' || exact.stateKey !== 'L5>R5+T3>B3' || exact.entry.tier !== 0) {
      throw new Error('Exact pair resolution failed');
    }

    const bestFit = resolveCellSegments(['L0>R8', 'T3>B3'], miniTable, lookup);
    if (bestFit.kind !== 'resolved' || bestFit.entry.tier !== 1 || bestFit.entry.missedPorts !== 1) {
      throw new Error('Best-fit pair resolution failed');
    }

    const missing = resolveCellSegments(['L0>R1', 'T3>B3'], miniTable, lookup);
    if (missing.kind !== 'unresolved') throw new Error('Missing table entry must be unresolved, never layered');

    const triple = resolveCellSegments(['L0>R1', 'T3>B3', 'L2>B2'], miniTable, lookup);
    if (triple.kind !== 'unsupported') throw new Error('Triple states must be explicitly unsupported');

    return true;
  }

  const API = {
    version: 3,
    CANONICAL_FAMILIES,
    canonicalizeSegmentKey,
    buildStateKey,
    parseResolutionTable,
    resolveState,
    occupiedPortLabels,
    computeMatedPortsByCell,
    resolveCellSegments,
    selfTest,
  };

  globalThis.GraphSCIICrossoversV3 = API;
  if (typeof document === 'undefined') return;

  // ---------------------------------------------------------------------------
  // Browser wiring below this line.
  // ---------------------------------------------------------------------------

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
    console.error('GraphSCII crossover compositor v3 could not attach.');
    return;
  }

  const RESOLUTION_TABLE_URL = '../artifacts/manifest/vocabulary-v1.1/crossover-resolution.tsv?v=20260822-specials-v1';
  const BITMAP_INDEX_URL = '../artifacts/manifest/vocabulary-v1.1/indexes/by-bitmap.json?v=20260822-specials-v1';

  const glyphCtx = glyphCanvas.getContext('2d');
  const overlayCtx = overlayCanvas.getContext('2d');

  const state = {
    table: null,
    tableReady: false,
    bitmapByGlyphId: null,
    indexReady: false,
    scheduled: false,
    compositing: false,
    lastSummary: null,
    lastProvenanceByCell: new Map(),
    lastError: null,
  };

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

  function drawCodepoint(cell, codepoint) {
    glyphCtx.fillText(String.fromCodePoint(codepoint), cell.x * G.CELL_W, cell.y * G.CELL_H);
  }

  function provenanceFor(cell, decision) {
    const record = {
      cellX: cell.x,
      cellY: cell.y,
      stateKey: decision.stateKey,
      tier: decision.entry.tier,
      glyphId: decision.entry.glyphId,
      codepointHex: `U+${(PUA_BASE + decision.entry.glyphId).toString(16).toUpperCase().padStart(4, '0')}`,
      missedPorts: decision.entry.missedPorts,
      extraPorts: decision.entry.extraPorts,
      costScaled: decision.entry.costScaled,
    };
    if (state.bitmapByGlyphId) {
      const winnerBitmapKey = state.bitmapByGlyphId.get(decision.entry.glyphId);
      if (winnerBitmapKey) {
        const desiredPorts = [...new Set(cell.segments.flatMap((s) => [s.from, s.to]))].sort();
        const matedLabels = new Set();
        for (const segment of cell.segments) {
          for (const label of computeMatedPortsByCell(cell.segments).get(`${cell.x},${cell.y}`) ?? []) {
            matedLabels.add(label);
          }
        }
        const occupied = occupiedPortLabels(winnerBitmapKey);
        record.desiredPorts = desiredPorts;
        record.matedPorts = [...matedLabels].sort();
        record.lostMates = [...matedLabels].filter((label) => !occupied.has(label)).sort();
      }
    }
    return record;
  }

  function composite() {
    state.scheduled = false;
    if (state.compositing) return;
    state.compositing = true;

    try {
      const cells = authoritativeCells();
      const flatSegments = [];
      for (const cell of cells.values()) flatSegments.push(...cell.segments);
      const matedByCell = computeMatedPortsByCell(flatSegments);

      let multiPass = 0;
      let exactTier0 = 0;
      let bestFitTier1 = 0;
      let legLossCells = 0;
      let unresolvedCells = 0;
      const provenance = [];

      glyphCtx.save();
      glyphCtx.fillStyle = '#111111';
      glyphCtx.textBaseline = 'top';
      glyphCtx.textAlign = 'left';
      glyphCtx.fontKerning = 'none';
      glyphCtx.font = `${G.CELL_H}px GraphSCII`;

      for (const cell of cells.values()) {
        if (cell.segments.length <= 1) continue;
        multiPass += 1;

        const segKeys = cell.segments.map((s) => `${s.from}>${s.to}`);
        const decision = resolveCellSegments(segKeys, state.table, G.STRAIGHT_CODEPOINT_BY_PAIR);

        if (decision.kind === 'single') {
          drawCodepoint(cell, decision.codepoint);
          eraseRedBox(cell);
          continue;
        }
        if (decision.kind !== 'resolved') {
          unresolvedCells += 1;
          continue;
        }

        drawCodepoint(cell, PUA_BASE + decision.entry.glyphId);
        eraseRedBox(cell);

        if (decision.entry.tier === 0) exactTier0 += 1;
        else {
          bestFitTier1 += 1;
          if (decision.entry.missedPorts > 0) legLossCells += 1;
        }

        const record = provenanceFor(cell, decision);
        record.matedPorts = [...(matedByCell.get(`${cell.x},${cell.y}`) ?? [])].sort();
        if (record.matedPorts.length && state.bitmapByGlyphId) {
          const winnerBitmapKey = state.bitmapByGlyphId.get(decision.entry.glyphId);
          if (winnerBitmapKey) {
            const occupied = occupiedPortLabels(winnerBitmapKey);
            record.lostMates = record.matedPorts.filter((label) => !occupied.has(label)).sort();
          }
        }
        provenance.push(record);
      }
      glyphCtx.restore();

      state.lastSummary = {
        multiPass,
        resolved: exactTier0 + bestFitTier1,
        exactTier0,
        bestFitTier1,
        legLossCells,
        unresolvedCells,
        tableReady: state.tableReady,
        indexReady: state.indexReady,
      };
      state.lastProvenanceByCell = new Map(provenance.map((record) => [`${record.cellX},${record.cellY}`, record]));
      state.lastError = null;

      if (!multiPass) {
        overlapEl.textContent = 'Continuous shared-port path';
      } else if (!state.tableReady) {
        overlapEl.textContent = `Resolution table unavailable: ${multiPass} crossover cell${multiPass === 1 ? '' : 's'} unresolved`;
      } else {
        overlapEl.textContent =
          `${state.lastSummary.resolved} crossover cell${state.lastSummary.resolved === 1 ? '' : 's'}: ` +
          `${exactTier0} exact, ${bestFitTier1} best-fit (${legLossCells} leg-loss), ` +
          `${unresolvedCells} unresolved`;
      }
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      console.error('GraphSCII crossover compositor v3 failed:', error);
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
  // Observe that write and immediately schedule the single-glyph compositor.
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

  async function loadResolutionTable() {
    try {
      const response = await fetch(RESOLUTION_TABLE_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.table = parseResolutionTable(await response.text());
      state.tableReady = true;
      scheduleComposite();
    } catch (error) {
      state.table = null;
      state.tableReady = false;
      console.warn('GraphSCII resolution table unavailable; crossover cells stay marked unresolved.', error);
      scheduleComposite();
    }
  }

  async function loadBitmapIndex() {
    try {
      const response = await fetch(BITMAP_INDEX_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.index !== 'by-bitmap' || payload?.entryCount !== 6398) {
        throw new Error('unexpected by-bitmap index format');
      }
      const reverse = new Map();
      for (const [bitmapKey, glyphId] of Object.entries(payload.entries)) {
        reverse.set(glyphId, bitmapKey);
      }
      state.bitmapByGlyphId = reverse;
      state.indexReady = true;
      scheduleComposite();
    } catch (error) {
      state.bitmapByGlyphId = null;
      state.indexReady = false;
      console.warn('GraphSCII by-bitmap index unavailable; lost-mate provenance degraded.', error);
      scheduleComposite();
    }
  }

  loadResolutionTable();
  loadBitmapIndex();
})();

