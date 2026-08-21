(() => {
  'use strict';

  const G = window.GraphSCIICore;
  if (!G) throw new Error('GraphSCII core missing');

  const { C, R, W, H, node, pos, nearestNode, normalize, compile, line, bezier, ellipse, validate } = G;
  const PIXEL_W = W / 8;
  const PIXEL_H = H / 16;

  if (PIXEL_W !== 3 || PIXEL_H !== 3) {
    throw new Error(`Unexpected GraphSCII display scale ${PIXEL_W}x${PIXEL_H}`);
  }

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

  glyphCanvas.width = overlayCanvas.width = C * W;
  glyphCanvas.height = overlayCanvas.height = R * H;

  let currentTool = 'freehand';
  let committedPaths = [];
  let previewSegments = [];
  let hoverNode = null;
  let activeGesture = null;
  let bezierNodes = [];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function canvasPoint(event) {
    const rect = overlayCanvas.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * overlayCanvas.width, 0, overlayCanvas.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * overlayCanvas.height, 0, overlayCanvas.height),
    };
  }

  function pushRaw(points, point) {
    const previous = points.at(-1);
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.15) {
      points.push(point);
    }
  }

  function portPixel(port) {
    const edge = port[0];
    const index = Number(port.slice(1));
    if (edge === 'L') return { x: 0, y: index };
    if (edge === 'R') return { x: 7, y: index };
    if (edge === 'T') return { x: index, y: 0 };
    if (edge === 'B') return { x: index, y: 15 };
    throw new Error(`Bad port ${port}`);
  }

  // This is the canonical GraphSCII straight raster rule: exactly the same
  // integer Bresenham walk used to build the font vocabulary. It is NOT a
  // matcher or approximation; the stored from/to ports completely determine it.
  function rasterRows(from, to) {
    let { x: x0, y: y0 } = portPixel(from);
    const { x: x1, y: y1 } = portPixel(to);
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
    return rows;
  }

  function semanticKey(segment) {
    const a = segment.from;
    const b = segment.to;
    return a < b ? `${a}>${b}` : `${b}>${a}`;
  }

  function buildCellMap(paths) {
    const cells = new Map();
    for (const path of paths) {
      validate(path.segments);
      for (const segment of path.segments) {
        const key = `${segment.cellX},${segment.cellY}`;
        const entry = cells.get(key) ?? {
          x: segment.cellX,
          y: segment.cellY,
          segments: new Map(),
        };
        entry.segments.set(semanticKey(segment), segment);
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
    for (let x = 0; x <= C; x += 1) {
      glyphCtx.moveTo(x * W + 0.5, 0);
      glyphCtx.lineTo(x * W + 0.5, R * H);
    }
    for (let y = 0; y <= R; y += 1) {
      glyphCtx.moveTo(0, y * H + 0.5);
      glyphCtx.lineTo(C * W, y * H + 0.5);
    }
    glyphCtx.stroke();
  }

  function drawExactSegment(segment) {
    const rows = rasterRows(segment.from, segment.to);
    const originX = segment.cellX * W;
    const originY = segment.cellY * H;

    for (let y = 0; y < 16; y += 1) {
      const row = rows[y];
      for (let x = 0; x < 8; x += 1) {
        if ((row & (1 << x)) === 0) continue;
        glyphCtx.fillRect(
          originX + x * PIXEL_W,
          originY + y * PIXEL_H,
          PIXEL_W,
          PIXEL_H,
        );
      }
    }
  }

  function drawAllNodes() {
    if (!showNodesInput.checked) return;
    overlayCtx.fillStyle = 'rgba(80,100,120,0.35)';
    for (let boundaryX = 0; boundaryX <= C; boundaryX += 1) {
      for (let cellY = 0; cellY < R; cellY += 1) {
        for (let index = 0; index < 16; index += 1) {
          const point = pos(node('V', boundaryX, cellY, index));
          overlayCtx.fillRect(point.x - 1, point.y - 1, 2, 2);
        }
      }
    }
    for (let boundaryY = 0; boundaryY <= R; boundaryY += 1) {
      for (let cellX = 0; cellX < C; cellX += 1) {
        for (let index = 0; index < 8; index += 1) {
          const point = pos(node('H', boundaryY, cellX, index));
          overlayCtx.fillRect(point.x - 1, point.y - 1, 2, 2);
        }
      }
    }
  }

  function drawBezierControls() {
    if (!bezierNodes.length) return;
    overlayCtx.strokeStyle = 'rgba(220,70,45,0.55)';
    overlayCtx.lineWidth = 1.5;
    overlayCtx.setLineDash([5, 4]);
    overlayCtx.beginPath();
    bezierNodes.forEach((n, index) => {
      const point = pos(n);
      if (index === 0) overlayCtx.moveTo(point.x, point.y);
      else overlayCtx.lineTo(point.x, point.y);
    });
    overlayCtx.stroke();
    overlayCtx.setLineDash([]);
  }

  function render() {
    glyphCtx.clearRect(0, 0, glyphCanvas.width, glyphCanvas.height);
    glyphCtx.fillStyle = resolvedCanvasBackground();
    glyphCtx.fillRect(0, 0, glyphCanvas.width, glyphCanvas.height);
    drawGrid();

    const allPaths = [...committedPaths];
    if (previewSegments.length) allPaths.push({ segments: previewSegments });
    const cells = buildCellMap(allPaths);

    glyphCtx.fillStyle = '#111111';
    let overlaps = 0;
    for (const cell of cells.values()) {
      const segments = [...cell.segments.values()];
      if (segments.length > 1) overlaps += 1;
      drawExactSegment(segments[0]);
    }

    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    drawAllNodes();

    overlayCtx.strokeStyle = 'rgba(210,50,35,0.85)';
    overlayCtx.lineWidth = 1.5;
    for (const cell of cells.values()) {
      if (cell.segments.size <= 1) continue;
      overlayCtx.strokeRect(cell.x * W + 2, cell.y * H + 2, W - 4, H - 4);
    }

    if (hoverNode) {
      const point = pos(hoverNode);
      overlayCtx.fillStyle = '#d43b2f';
      overlayCtx.beginPath();
      overlayCtx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      overlayCtx.fill();
    }

    drawBezierControls();
    overlapEl.textContent = overlaps
      ? `${overlaps} overlap cell${overlaps === 1 ? '' : 's'} awaiting connector composition`
      : 'Exact node semantics only';
    undoButton.disabled = clearButton.disabled = committedPaths.length === 0;
  }

  function commit(tool, segments, closed = false) {
    if (!segments.length) return false;
    try {
      validate(segments);
    } catch (error) {
      console.error('Refusing broken path', error);
      return false;
    }
    committedPaths.push({
      tool,
      closed,
      segments: segments.map((segment) => ({ ...segment })),
    });
    previewSegments = [];
    render();
    return true;
  }

  function instruction(tool) {
    if (tool === 'freehand') return 'Freehand: mouse input is normalized, then compiled through exact shared boundary nodes.';
    if (tool === 'line') return 'Line: drag from one GraphSCII node to another.';
    if (tool === 'bezier') return 'Bezier: click four GraphSCII nodes — start, control 1, control 2, end.';
    return 'Ellipse: drag between two GraphSCII nodes.';
  }

  function chooseTool(tool) {
    currentTool = tool;
    activeGesture = null;
    previewSegments = [];
    bezierNodes = [];
    for (const button of toolButtons) {
      const active = button.dataset.tool === tool;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    setStatus(instruction(tool));
    render();
  }

  for (const button of toolButtons) {
    button.addEventListener('click', () => chooseTool(button.dataset.tool));
  }

  overlayCanvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    overlayCanvas.focus();
    const point = canvasPoint(event);
    const n = nearestNode(point.x, point.y);
    hoverNode = n;

    if (currentTool === 'bezier') {
      bezierNodes.push(n);
      if (bezierNodes.length === 4) {
        const segments = bezier(bezierNodes);
        setStatus(
          commit('bezier', segments)
            ? `Bezier committed: ${segments.length} continuous exact segments.`
            : 'Bezier rejected rather than committing a broken path.',
        );
        bezierNodes = [];
      } else {
        setStatus(`Bezier point ${bezierNodes.length}/4 selected.`);
      }
      render();
      return;
    }

    overlayCanvas.setPointerCapture(event.pointerId);
    activeGesture = currentTool === 'freehand'
      ? { pointerId: event.pointerId, start: n, raw: [pos(n)] }
      : { pointerId: event.pointerId, start: n };
    previewSegments = [];
    render();
  });

  overlayCanvas.addEventListener('pointermove', (event) => {
    const point = canvasPoint(event);
    hoverNode = nearestNode(point.x, point.y);

    if (!activeGesture || activeGesture.pointerId !== event.pointerId) {
      render();
      return;
    }

    if (currentTool === 'freehand') {
      const events = typeof event.getCoalescedEvents === 'function'
        ? event.getCoalescedEvents()
        : [event];
      for (const sample of events) pushRaw(activeGesture.raw, canvasPoint(sample));
      pushRaw(activeGesture.raw, point);
      previewSegments = compile(normalize(activeGesture.raw, activeGesture.start), activeGesture.start, null, true);
    } else if (currentTool === 'line') {
      previewSegments = line(activeGesture.start, hoverNode);
    } else if (currentTool === 'ellipse') {
      previewSegments = ellipse(activeGesture.start, hoverNode);
    }

    render();
  });

  function finishGesture(event) {
    if (!activeGesture || activeGesture.pointerId !== event.pointerId) return;
    let segments = previewSegments;

    if (currentTool === 'freehand') {
      pushRaw(activeGesture.raw, canvasPoint(event));
      segments = compile(normalize(activeGesture.raw, activeGesture.start), activeGesture.start, null, true);
    }

    const ok = commit(currentTool, segments, currentTool === 'ellipse');
    setStatus(
      ok
        ? `${currentTool} committed: ${segments.length} continuous exact segments.`
        : `${currentTool} rejected rather than committing a broken path.`,
    );
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
      hoverNode = null;
      render();
    }
  });

  undoButton.addEventListener('click', () => {
    committedPaths.pop();
    setStatus('Undid last node path.');
    render();
  });

  clearButton.addEventListener('click', () => {
    committedPaths = [];
    previewSegments = [];
    bezierNodes = [];
    activeGesture = null;
    setStatus('Canvas cleared.');
    render();
  });

  showNodesInput.addEventListener('change', render);
  overlayCanvas.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (committedPaths.length) {
        committedPaths.pop();
        setStatus('Undid last node path.');
        render();
      }
    }
    if (event.key === 'Escape') {
      activeGesture = null;
      previewSegments = [];
      bezierNodes = [];
      setStatus(`${instruction(currentTool)} Current gesture cancelled.`);
      render();
    }
  });

  function boot() {
    try {
      G.selfTest();
      chooseTool(currentTool);
    } catch (error) {
      console.error(error);
      setStatus(`GraphSCII Draw failed its topology check: ${error.message}`);
    }
  }

  boot();
})();
