(() => {
  'use strict';

  const COLS = 24;
  const ROWS = 12;
  const CELL_W = 24;
  const CELL_H = 48;
  const TOP_BOTTOM_NODES = 8;
  const SIDE_NODES = 16;
  const SLOT_W = CELL_W / TOP_BOTTOM_NODES;
  const SLOT_H = CELL_H / SIDE_NODES;
  const EPS = 1e-9;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const sameCell = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;
  const cellKey = (c) => `${c.x},${c.y}`;

  function portPixel(edge, index) {
    if (edge === 'L') return [0, index];
    if (edge === 'R') return [7, index];
    if (edge === 'T') return [index, 0];
    if (edge === 'B') return [index, 15];
    throw new Error(`Unknown edge ${edge}`);
  }

  function portCount(edge) {
    return edge === 'L' || edge === 'R' ? SIDE_NODES : TOP_BOTTOM_NODES;
  }

  function bitmapKey(a, ai, b, bi) {
    let [x0, y0] = portPixel(a, ai);
    const [x1, y1] = portPixel(b, bi);
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

  function buildStraightLookup() {
    const families = [
      ['L', 'R'], ['T', 'B'], ['L', 'T'],
      ['L', 'B'], ['R', 'T'], ['R', 'B'],
    ];
    const ownerByBitmap = new Map();
    const map = Object.create(null);
    let nextOwner = 0;

    for (const [a, b] of families) {
      for (let ai = 0; ai < portCount(a); ai += 1) {
        for (let bi = 0; bi < portCount(b); bi += 1) {
          const bitmap = bitmapKey(a, ai, b, bi);
          let owner = ownerByBitmap.get(bitmap);
          if (owner === undefined) {
            owner = nextOwner;
            ownerByBitmap.set(bitmap, owner);
            nextOwner += 1;
          }
          const codepoint = 0xE000 + owner;
          map[`${a}${ai}>${b}${bi}`] = codepoint;
          map[`${b}${bi}>${a}${ai}`] = codepoint;
        }
      }
    }

    if (Object.keys(map).length !== 1664 || nextOwner !== 746) {
      throw new Error(`Straight lookup invariant failed: ${Object.keys(map).length}/${nextOwner}`);
    }
    return Object.freeze(map);
  }

  const STRAIGHT_CODEPOINT_BY_PAIR = buildStraightLookup();

  function makePort(cellX, cellY, side, index) {
    if (cellX < 0 || cellX >= COLS || cellY < 0 || cellY >= ROWS) {
      throw new Error(`Port outside canvas cell ${cellX},${cellY}`);
    }
    if (!['L', 'R', 'T', 'B'].includes(side)) throw new Error(`Invalid side ${side}`);
    const count = portCount(side);
    if (!Number.isInteger(index) || index < 0 || index >= count) {
      throw new Error(`Invalid port ${side}${index}`);
    }
    return { cellX, cellY, side, index };
  }

  const portText = (port) => `${port.side}${port.index}`;

  // Port indexes are GraphSCII bitmap rows/columns. At this display scale each
  // one owns a 3px strip. They are NOT endpoints spread over N-1 intervals.
  function portPoint(port) {
    if (port.side === 'L' || port.side === 'R') {
      return {
        x: (port.cellX + (port.side === 'R' ? 1 : 0)) * CELL_W,
        y: port.cellY * CELL_H + (port.index + 0.5) * SLOT_H,
      };
    }
    return {
      x: port.cellX * CELL_W + (port.index + 0.5) * SLOT_W,
      y: (port.cellY + (port.side === 'B' ? 1 : 0)) * CELL_H,
    };
  }

  // Canonical identity exists only across the same shared boundary incidence:
  // Rk <-> adjacent Lk and Bk <-> adjacent Tk. Perpendicular corner ports are
  // distinct semantics even when their glyph pixels occupy the same corner pixel.
  function canonicalNodeKey(port) {
    if (port.side === 'L' || port.side === 'R') {
      const boundaryX = port.cellX + (port.side === 'R' ? 1 : 0);
      return `V:${boundaryX}:${port.cellY}:${port.index}`;
    }
    const boundaryY = port.cellY + (port.side === 'B' ? 1 : 0);
    return `H:${boundaryY}:${port.cellX}:${port.index}`;
  }

  function mate(port) {
    if (port.side === 'L') {
      if (port.cellX === 0) return null;
      return makePort(port.cellX - 1, port.cellY, 'R', port.index);
    }
    if (port.side === 'R') {
      if (port.cellX === COLS - 1) return null;
      return makePort(port.cellX + 1, port.cellY, 'L', port.index);
    }
    if (port.side === 'T') {
      if (port.cellY === 0) return null;
      return makePort(port.cellX, port.cellY - 1, 'B', port.index);
    }
    if (port.cellY === ROWS - 1) return null;
    return makePort(port.cellX, port.cellY + 1, 'T', port.index);
  }

  function cellForPoint(point) {
    let x = clamp(Math.floor(point.x / CELL_W), 0, COLS - 1);
    let y = clamp(Math.floor(point.y / CELL_H), 0, ROWS - 1);
    if (Math.abs(point.x - COLS * CELL_W) < EPS) x = COLS - 1;
    if (Math.abs(point.y - ROWS * CELL_H) < EPS) y = ROWS - 1;
    return { x, y };
  }

  // Quantize to the GraphSCII bitmap slot containing the crossing.
  function snapVerticalIndex(cellY, y) {
    const localY = clamp(y - cellY * CELL_H, 0, CELL_H);
    return clamp(Math.floor(localY / SLOT_H), 0, SIDE_NODES - 1);
  }

  function snapHorizontalIndex(cellX, x) {
    const localX = clamp(x - cellX * CELL_W, 0, CELL_W);
    return clamp(Math.floor(localX / SLOT_W), 0, TOP_BOTTOM_NODES - 1);
  }

  function snapPointToCellPerimeter(cell, point) {
    const left = cell.x * CELL_W;
    const right = (cell.x + 1) * CELL_W;
    const top = cell.y * CELL_H;
    const bottom = (cell.y + 1) * CELL_H;
    const choices = [
      { side: 'L', d: Math.abs(point.x - left) },
      { side: 'R', d: Math.abs(point.x - right) },
      { side: 'T', d: Math.abs(point.y - top) },
      { side: 'B', d: Math.abs(point.y - bottom) },
    ];
    choices.sort((a, b) => a.d - b.d);
    const side = choices[0].side;
    const index = side === 'L' || side === 'R'
      ? snapVerticalIndex(cell.y, point.y)
      : snapHorizontalIndex(cell.x, point.x);
    return makePort(cell.x, cell.y, side, index);
  }

  function segmentCrossings(a, b) {
    const out = [];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) return out;

    if (Math.abs(dx) > 1e-12) {
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const k0 = Math.ceil(minX / CELL_W);
      const k1 = Math.floor(maxX / CELL_W);
      for (let k = k0; k <= k1; k += 1) {
        if (k <= 0 || k >= COLS) continue;
        const x = k * CELL_W;
        const t = (x - a.x) / dx;
        if (t <= EPS || t > 1 + EPS) continue;
        const y = a.y + t * dy;
        if (y >= -EPS && y <= ROWS * CELL_H + EPS) {
          out.push({ t, kind: 'vertical', x, y: clamp(y, 0, ROWS * CELL_H) });
        }
      }
    }

    if (Math.abs(dy) > 1e-12) {
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      const k0 = Math.ceil(minY / CELL_H);
      const k1 = Math.floor(maxY / CELL_H);
      for (let k = k0; k <= k1; k += 1) {
        if (k <= 0 || k >= ROWS) continue;
        const y = k * CELL_H;
        const t = (y - a.y) / dy;
        if (t <= EPS || t > 1 + EPS) continue;
        const x = a.x + t * dx;
        if (x >= -EPS && x <= COLS * CELL_W + EPS) {
          out.push({ t, kind: 'horizontal', x: clamp(x, 0, COLS * CELL_W), y });
        }
      }
    }

    out.sort((u, v) => {
      if (Math.abs(u.t - v.t) > EPS) return u.t - v.t;
      if (u.kind === v.kind) return 0;
      const preferVertical = Math.abs(dx) >= Math.abs(dy);
      return (u.kind === 'vertical') === preferVertical ? -1 : 1;
    });
    return out;
  }

  function transitionForCrossing(rawCell, crossing, dx, dy, inputPair = null) {
    let exit;
    let toCell;

    if (crossing.kind === 'vertical') {
      const side = dx > 0 ? 'R' : 'L';
      exit = makePort(rawCell.x, rawCell.y, side, snapVerticalIndex(rawCell.y, crossing.y));
      toCell = { x: rawCell.x + (dx > 0 ? 1 : -1), y: rawCell.y };
    } else {
      const side = dy > 0 ? 'B' : 'T';
      exit = makePort(rawCell.x, rawCell.y, side, snapHorizontalIndex(rawCell.x, crossing.x));
      toCell = { x: rawCell.x, y: rawCell.y + (dy > 0 ? 1 : -1) };
    }

    if (toCell.x < 0 || toCell.x >= COLS || toCell.y < 0 || toCell.y >= ROWS) return null;

    const entry = mate(exit);
    if (!entry || entry.cellX !== toCell.x || entry.cellY !== toCell.y) throw new Error('Mate transition failed');
    if (canonicalNodeKey(exit) !== canonicalNodeKey(entry)) throw new Error('Mate does not share canonical node');

    return {
      inputPair,
      kind: crossing.kind,
      t: crossing.t,
      fromCell: { ...rawCell },
      toCell,
      exit,
      entry,
      nodeKey: canonicalNodeKey(exit),
      point: { x: crossing.x, y: crossing.y },
    };
  }

  function rawTransitions(points) {
    if (points.length < 2) return [];
    const transitions = [];
    let rawCell = cellForPoint(points[0]);

    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      for (const crossing of segmentCrossings(a, b)) {
        const transition = transitionForCrossing(rawCell, crossing, dx, dy, [i - 1, i]);
        if (!transition) continue;
        transitions.push(transition);
        rawCell = { ...transition.toCell };
      }
    }
    return transitions;
  }

  function makeSegment(cell, from, to) {
    if (from.cellX !== cell.x || from.cellY !== cell.y || to.cellX !== cell.x || to.cellY !== cell.y) {
      throw new Error('Segment endpoint belongs to wrong cell');
    }
    if (from.side === to.side) {
      throw new Error(`Illegal same-edge segment ${portText(from)}>${portText(to)} in ${cellKey(cell)}`);
    }
    const key = `${portText(from)}>${portText(to)}`;
    const codepoint = STRAIGHT_CODEPOINT_BY_PAIR[key];
    if (codepoint == null) throw new Error(`Missing GraphSCII semantic ${key}`);
    return {
      cellX: cell.x,
      cellY: cell.y,
      from: portText(from),
      to: portText(to),
      fromNode: canonicalNodeKey(from),
      toNode: canonicalNodeKey(to),
      codepoint,
    };
  }

  function validateSegments(segments) {
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      if (segment.from[0] === segment.to[0]) throw new Error(`Same-edge segment survived: ${segment.from}>${segment.to}`);
      if (STRAIGHT_CODEPOINT_BY_PAIR[`${segment.from}>${segment.to}`] !== segment.codepoint) throw new Error('Segment/codepoint mismatch');
      if (i > 0 && segments[i - 1].toNode !== segment.fromNode) {
        throw new Error(`Broken continuity: ${segments[i - 1].toNode} != ${segment.fromNode}`);
      }
    }
    return true;
  }

  function compileRawPath(points) {
    if (!points || points.length < 2) return [];

    const startCell = cellForPoint(points[0]);
    const startPort = snapPointToCellPerimeter(startCell, points[0]);
    const transitions = rawTransitions(points);
    const segments = [];
    const states = [{ cell: { ...startCell }, entry: startPort, segmentCountBeforeEnter: 0 }];

    for (const transition of transitions) {
      const current = states[states.length - 1];
      if (!sameCell(transition.fromCell, current.cell)) {
        throw new Error(`Raw/normalized cell mismatch: raw ${cellKey(transition.fromCell)} vs state ${cellKey(current.cell)}`);
      }

      const previousState = states.length > 1 ? states[states.length - 2] : null;
      if (previousState && sameCell(transition.toCell, previousState.cell)) {
        segments.length = current.segmentCountBeforeEnter;
        states.pop();
        continue;
      }

      const segmentCountBeforeCrossing = segments.length;
      if (current.entry.side === transition.exit.side) {
        if (states.length !== 1) throw new Error('Non-backtracking same-edge traversal');
      } else {
        segments.push(makeSegment(current.cell, current.entry, transition.exit));
      }

      states.push({
        cell: { ...transition.toCell },
        entry: transition.entry,
        segmentCountBeforeEnter: segmentCountBeforeCrossing,
      });
    }

    const current = states[states.length - 1];
    const endPort = snapPointToCellPerimeter(current.cell, points[points.length - 1]);
    if (current.entry.side !== endPort.side) {
      segments.push(makeSegment(current.cell, current.entry, endPort));
    }

    validateSegments(segments);
    return segments;
  }

  const lineGuide = (a, b) => [a, b];

  function cubicPoint(p0, p1, p2, p3, t) {
    const q = 1 - t;
    return {
      x: q*q*q*p0.x + 3*q*q*t*p1.x + 3*q*t*t*p2.x + t*t*t*p3.x,
      y: q*q*q*p0.y + 3*q*q*t*p1.y + 3*q*t*t*p2.y + t*t*t*p3.y,
    };
  }

  function bezierGuide(points) {
    const out = [points[0]];
    for (let i = 1; i <= 192; i += 1) out.push(cubicPoint(points[0], points[1], points[2], points[3], i / 192));
    return out;
  }

  function ellipseGuide(a, b) {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    if (rx < 2 || ry < 2) return [];
    const steps = clamp(Math.ceil(2 * Math.PI * Math.sqrt((rx*rx + ry*ry) / 2) / 2), 128, 512);
    const out = [];
    for (let i = 0; i <= steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      out.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
    }
    return out;
  }

  function signature(segments) {
    return segments.map((s) => `${s.cellX},${s.cellY}:${s.from}>${s.to}`).join('|');
  }

  function testMateIdentity() {
    for (let x = 0; x < COLS - 1; x += 1) {
      for (let y = 0; y < ROWS; y += 1) {
        for (let i = 0; i < SIDE_NODES; i += 1) {
          const a = makePort(x, y, 'R', i);
          const b = mate(a);
          if (!b || b.side !== 'L' || b.index !== i || canonicalNodeKey(a) !== canonicalNodeKey(b)) {
            throw new Error('R/L mate invariant failed');
          }
        }
      }
    }
    for (let y = 0; y < ROWS - 1; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        for (let i = 0; i < TOP_BOTTOM_NODES; i += 1) {
          const a = makePort(x, y, 'B', i);
          const b = mate(a);
          if (!b || b.side !== 'T' || b.index !== i || canonicalNodeKey(a) !== canonicalNodeKey(b)) {
            throw new Error('B/T mate invariant failed');
          }
        }
      }
    }
  }

  function selfTest() {
    testMateIdentity();

    const cL0 = makePort(4, 4, 'L', 0);
    const cT0 = makePort(4, 4, 'T', 0);
    if (canonicalNodeKey(cL0) === canonicalNodeKey(cT0)) throw new Error('Corner ports were incorrectly collapsed');
    if (STRAIGHT_CODEPOINT_BY_PAIR['L0>T0'] == null) throw new Error('L0>T0 corner semantic missing');

    // Exact regressions from the 2026-08-21 debug export.
    if (snapVerticalIndex(3, 145.703125) !== 0) throw new Error('Vertical pixel-slot quantization regression');
    if (snapHorizontalIndex(8, 194.90625) !== 0) throw new Error('Horizontal pixel-slot quantization regression');
    if (snapVerticalIndex(3, 147.203125) !== 1) throw new Error('Vertical slot boundary regression');

    const a = { x: 2 * CELL_W + 7, y: 3 * CELL_H + 21 };
    const b = { x: 12 * CELL_W + 9, y: 3 * CELL_H + 23 };
    const sparse = compileRawPath([a, b]);
    validateSegments(sparse);
    if (sparse.length < 8) throw new Error('Sparse bridge test too short');

    const densePoints = [];
    for (let i = 0; i <= 100; i += 1) {
      const t = i / 100;
      densePoints.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    const dense = compileRawPath(densePoints);
    if (signature(sparse) !== signature(dense)) throw new Error('Sparse/dense event equivalence failed');

    const j0 = { x: 5 * CELL_W + 8, y: 5 * CELL_H + 20 };
    const boundary = 6 * CELL_W;
    const jitter = compileRawPath([
      j0,
      { x: boundary + 3, y: j0.y + 0.4 },
      { x: boundary - 2, y: j0.y + 0.7 },
      { x: boundary + 12, y: j0.y + 1.0 },
      { x: 8 * CELL_W + 5, y: j0.y + 2.0 },
    ]);
    validateSegments(jitter);
    const seen = new Set();
    for (const s of jitter) {
      const key = `${s.cellX},${s.cellY}`;
      if (seen.has(key)) throw new Error(`Jitter created duplicate cell ${key}`);
      seen.add(key);
    }

    const corner = compileRawPath([
      { x: 2.5 * CELL_W, y: 2.5 * CELL_H },
      { x: 4.5 * CELL_W, y: 4.5 * CELL_H },
    ]);
    validateSegments(corner);
    const cornerBridge = corner.find((s) =>
      (s.from === 'L0' && s.to === 'T0') ||
      (s.from === 'T0' && s.to === 'L0') ||
      (s.from === 'L15' && s.to === 'B0') ||
      (s.from === 'B0' && s.to === 'L15') ||
      (s.from === 'R0' && s.to === 'T7') ||
      (s.from === 'T7' && s.to === 'R0') ||
      (s.from === 'R15' && s.to === 'B7') ||
      (s.from === 'B7' && s.to === 'R15')
    );
    if (!cornerBridge) throw new Error('Exact-corner bridge glyph was omitted');

    return true;
  }

  const API = {
    COLS, ROWS, CELL_W, CELL_H, TOP_BOTTOM_NODES, SIDE_NODES, SLOT_W, SLOT_H,
    STRAIGHT_CODEPOINT_BY_PAIR, makePort, portText, portPoint, canonicalNodeKey,
    mate, cellForPoint, snapVerticalIndex, snapHorizontalIndex, snapPointToCellPerimeter,
    segmentCrossings, rawTransitions, compileRawPath, lineGuide, bezierGuide,
    ellipseGuide, validateSegments, selfTest,
  };

  globalThis.GraphSCIIDrawV6 = API;
  if (typeof document === 'undefined') return;

  const glyphCanvas = document.querySelector('#glyph-canvas');
  const overlayCanvas = document.querySelector('#overlay-canvas');
  const glyphCtx = glyphCanvas.getContext('2d');
  const overlayCtx = overlayCanvas.getContext('2d');
  const statusEl = document.querySelector('#status');
  const overlapEl = document.querySelector('#overlap-status');
  const undoButton = document.querySelector('#undo');
  const clearButton = document.querySelector('#clear');
  const showNodesInput = document.querySelector('#show-nodes');
  const toolButtons = [...document.querySelectorAll('[data-tool]')];

  glyphCanvas.width = overlayCanvas.width = COLS * CELL_W;
  glyphCanvas.height = overlayCanvas.height = ROWS * CELL_H;

  let currentTool = 'freehand';
  let committedPaths = [];
  let previewSegments = [];
  let activeGesture = null;
  let bezierPoints = [];
  let hoverPoint = null;
  let fontReady = false;

  function setStatus(message) { statusEl.textContent = message; }

  function canvasPoint(event) {
    const rect = overlayCanvas.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * overlayCanvas.width, 0, overlayCanvas.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * overlayCanvas.height, 0, overlayCanvas.height),
    };
  }

  function appendRaw(points, point) {
    const previous = points[points.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.05) points.push(point);
  }

  function nearestVisibleNode(point) {
    const cell = cellForPoint(point);
    let best = null;
    for (const side of ['L', 'R', 'T', 'B']) {
      const count = portCount(side);
      for (let i = 0; i < count; i += 1) {
        const port = makePort(cell.x, cell.y, side, i);
        const p = portPoint(port);
        const d = Math.hypot(p.x - point.x, p.y - point.y);
        if (!best || d < best.d) best = { point: p, d };
      }
    }
    return best;
  }

  function buildCellMap(paths) {
    const cells = new Map();
    for (const path of paths) {
      validateSegments(path.segments);
      for (const segment of path.segments) {
        const key = `${segment.cellX},${segment.cellY}`;
        const entry = cells.get(key) ?? { x: segment.cellX, y: segment.cellY, segments: [] };
        entry.segments.push(segment);
        cells.set(key, entry);
      }
    }
    return cells;
  }

  function resolvedCanvasBackground() {
    const color = getComputedStyle(glyphCanvas).backgroundColor;
    return color && color !== 'rgba(0, 0, 0, 0)' ? color : '#ffffff';
  }

  function drawGrid() {
    glyphCtx.strokeStyle = 'rgba(127,127,127,0.16)';
    glyphCtx.lineWidth = 1;
    glyphCtx.beginPath();
    for (let x = 0; x <= COLS; x += 1) {
      glyphCtx.moveTo(x * CELL_W + 0.5, 0);
      glyphCtx.lineTo(x * CELL_W + 0.5, ROWS * CELL_H);
    }
    for (let y = 0; y <= ROWS; y += 1) {
      glyphCtx.moveTo(0, y * CELL_H + 0.5);
      glyphCtx.lineTo(COLS * CELL_W, y * CELL_H + 0.5);
    }
    glyphCtx.stroke();
  }

  function drawNodes() {
    if (!showNodesInput.checked) return;
    overlayCtx.fillStyle = 'rgba(80,100,120,0.42)';

    for (let boundaryX = 0; boundaryX <= COLS; boundaryX += 1) {
      const x = boundaryX * CELL_W;
      for (let cellY = 0; cellY < ROWS; cellY += 1) {
        for (let i = 0; i < SIDE_NODES; i += 1) {
          const y = cellY * CELL_H + (i + 0.5) * SLOT_H;
          overlayCtx.fillRect(x - 1, y - 1, 2, 2);
        }
      }
    }

    for (let boundaryY = 0; boundaryY <= ROWS; boundaryY += 1) {
      const y = boundaryY * CELL_H;
      for (let cellX = 0; cellX < COLS; cellX += 1) {
        for (let i = 0; i < TOP_BOTTOM_NODES; i += 1) {
          const x = cellX * CELL_W + (i + 0.5) * SLOT_W;
          overlayCtx.fillRect(x - 1, y - 1, 2, 2);
        }
      }
    }
  }

  function render() {
    glyphCtx.clearRect(0, 0, glyphCanvas.width, glyphCanvas.height);
    glyphCtx.fillStyle = resolvedCanvasBackground();
    glyphCtx.fillRect(0, 0, glyphCanvas.width, glyphCanvas.height);
    drawGrid();

    const paths = [...committedPaths];
    if (previewSegments.length) paths.push({ segments: previewSegments });
    const cells = buildCellMap(paths);

    glyphCtx.fillStyle = '#111111';
    glyphCtx.textBaseline = 'top';
    glyphCtx.textAlign = 'left';
    glyphCtx.fontKerning = 'none';
    glyphCtx.font = `${CELL_H}px GraphSCII`;

    let overlaps = 0;
    for (const cell of cells.values()) {
      if (cell.segments.length > 1) overlaps += 1;
      const segment = cell.segments[0];
      if (fontReady) glyphCtx.fillText(String.fromCodePoint(segment.codepoint), cell.x * CELL_W, cell.y * CELL_H);
    }

    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    drawNodes();

    if (hoverPoint) {
      const nearest = nearestVisibleNode(hoverPoint);
      if (nearest) {
        overlayCtx.fillStyle = '#d43b2f';
        overlayCtx.beginPath();
        overlayCtx.arc(nearest.point.x, nearest.point.y, 3.5, 0, Math.PI * 2);
        overlayCtx.fill();
      }
    }

    overlayCtx.strokeStyle = 'rgba(210,50,35,0.85)';
    overlayCtx.lineWidth = 1.5;
    for (const cell of cells.values()) {
      if (cell.segments.length <= 1) continue;
      overlayCtx.strokeRect(cell.x * CELL_W + 2, cell.y * CELL_H + 2, CELL_W - 4, CELL_H - 4);
    }

    if (bezierPoints.length) {
      overlayCtx.strokeStyle = 'rgba(220,70,45,0.55)';
      overlayCtx.setLineDash([5, 4]);
      overlayCtx.beginPath();
      bezierPoints.forEach((p, i) => i === 0 ? overlayCtx.moveTo(p.x, p.y) : overlayCtx.lineTo(p.x, p.y));
      overlayCtx.stroke();
      overlayCtx.setLineDash([]);
    }

    overlapEl.textContent = overlaps
      ? `${overlaps} true multi-pass cell${overlaps === 1 ? '' : 's'}`
      : 'Continuous shared-port path';
    undoButton.disabled = clearButton.disabled = committedPaths.length === 0;
  }

  function commit(tool, segments, closed = false) {
    if (!segments.length) return false;
    validateSegments(segments);
    committedPaths.push({ tool, closed, segments: segments.map((s) => ({ ...s })) });
    previewSegments = [];
    render();
    return true;
  }

  function instruction(tool) {
    if (tool === 'freehand') return 'Freehand: mouse crossings snap to exact GraphSCII pixel-row/column ports.';
    if (tool === 'line') return 'Line: one straight guide compiled by the same exact crossing rules.';
    if (tool === 'bezier') return 'Bezier: click four points; the curve uses the same crossing compiler.';
    return 'Ellipse: drag bounds; the ellipse uses the same crossing compiler.';
  }

  function chooseTool(tool) {
    currentTool = tool;
    activeGesture = null;
    previewSegments = [];
    bezierPoints = [];
    toolButtons.forEach((button) => {
      const active = button.dataset.tool === tool;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    setStatus(instruction(tool));
    render();
  }

  toolButtons.forEach((button) => button.addEventListener('click', () => chooseTool(button.dataset.tool)));

  overlayCanvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    overlayCanvas.focus();
    const point = canvasPoint(event);
    hoverPoint = point;

    if (currentTool === 'bezier') {
      bezierPoints.push(point);
      if (bezierPoints.length === 4) {
        const segments = compileRawPath(bezierGuide(bezierPoints));
        const ok = commit('bezier', segments);
        setStatus(ok ? `Bezier committed: ${segments.length} continuous cells.` : 'Bezier produced no drawable cells.');
        bezierPoints = [];
      } else setStatus(`Bezier point ${bezierPoints.length}/4 selected.`);
      render();
      return;
    }

    overlayCanvas.setPointerCapture(event.pointerId);
    activeGesture = { pointerId: event.pointerId, start: point, raw: [point] };
    previewSegments = [];
    render();
  });

  overlayCanvas.addEventListener('pointermove', (event) => {
    const point = canvasPoint(event);
    hoverPoint = point;
    if (!activeGesture || activeGesture.pointerId !== event.pointerId) {
      render();
      return;
    }

    if (currentTool === 'freehand') {
      const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
      for (const sample of events) appendRaw(activeGesture.raw, canvasPoint(sample));
      appendRaw(activeGesture.raw, point);
      previewSegments = compileRawPath(activeGesture.raw);
    } else if (currentTool === 'line') {
      previewSegments = compileRawPath(lineGuide(activeGesture.start, point));
    } else if (currentTool === 'ellipse') {
      const guide = ellipseGuide(activeGesture.start, point);
      previewSegments = guide.length ? compileRawPath(guide) : [];
    }
    render();
  });

  function finishGesture(event) {
    if (!activeGesture || activeGesture.pointerId !== event.pointerId) return;
    const point = canvasPoint(event);
    let segments = previewSegments;
    if (currentTool === 'freehand') {
      appendRaw(activeGesture.raw, point);
      segments = compileRawPath(activeGesture.raw);
    } else if (currentTool === 'line') {
      segments = compileRawPath(lineGuide(activeGesture.start, point));
    } else if (currentTool === 'ellipse') {
      const guide = ellipseGuide(activeGesture.start, point);
      segments = guide.length ? compileRawPath(guide) : [];
    }

    const ok = commit(currentTool, segments, currentTool === 'ellipse');
    setStatus(ok ? `${currentTool} committed: ${segments.length} continuous cells.` : `${currentTool} produced no drawable cells.`);
    previewSegments = [];
    activeGesture = null;
    render();
  }

  overlayCanvas.addEventListener('pointerup', finishGesture);
  overlayCanvas.addEventListener('pointercancel', (event) => {
    if (activeGesture?.pointerId !== event.pointerId) return;
    activeGesture = null;
    previewSegments = [];
    setStatus(`${instruction(currentTool)} Gesture cancelled.`);
    render();
  });
  overlayCanvas.addEventListener('pointerleave', () => {
    if (!activeGesture) {
      hoverPoint = null;
      render();
    }
  });

  undoButton.addEventListener('click', () => {
    committedPaths.pop();
    setStatus('Undid last path.');
    render();
  });

  clearButton.addEventListener('click', () => {
    committedPaths = [];
    previewSegments = [];
    activeGesture = null;
    bezierPoints = [];
    setStatus('Canvas cleared.');
    render();
  });

  showNodesInput.addEventListener('change', render);
  overlayCanvas.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (committedPaths.length) {
        committedPaths.pop();
        setStatus('Undid last path.');
        render();
      }
    }
    if (event.key === 'Escape') {
      activeGesture = null;
      previewSegments = [];
      bezierPoints = [];
      setStatus(`${instruction(currentTool)} Current gesture cancelled.`);
      render();
    }
  });

  async function boot() {
    try {
      selfTest();
      await document.fonts.load(`${CELL_H}px GraphSCII`);
      fontReady = true;
      chooseTool(currentTool);
    } catch (error) {
      console.error(error);
      setStatus(`GraphSCII Draw failed startup validation: ${error.message}`);
    }
  }

  boot();
})();
