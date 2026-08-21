import { STRAIGHT_CODEPOINT_BY_PAIR } from "./straight-lookup.mjs";

const COLS = 24;
const ROWS = 12;
const CELL_W = 24;
const CELL_H = 48;
const PORTS = { L: 16, R: 16, T: 8, B: 8 };
const EDGES = ["L", "R", "T", "B"];
const MAX_ROUTE_VISITS = 20000;

const glyphCanvas = document.querySelector("#glyph-canvas");
const overlayCanvas = document.querySelector("#overlay-canvas");
const glyphCtx = glyphCanvas.getContext("2d");
const overlayCtx = overlayCanvas.getContext("2d");
const statusEl = document.querySelector("#status");
const overlapEl = document.querySelector("#overlap-status");
const undoButton = document.querySelector("#undo");
const clearButton = document.querySelector("#clear");
const showNodesInput = document.querySelector("#show-nodes");
const toolButtons = [...document.querySelectorAll("[data-tool]")];

glyphCanvas.width = overlayCanvas.width = COLS * CELL_W;
glyphCanvas.height = overlayCanvas.height = ROWS * CELL_H;

let currentTool = "freehand";
let committedPaths = [];
let previewSegments = [];
let hoverNode = null;
let activeGesture = null;
let bezierNodes = [];

function setStatus(message) {
  statusEl.textContent = message;
}

function nodeKey(node) {
  return `${node.axis}:${node.boundary}:${node.band}:${node.index}`;
}

function makeNode(axis, boundary, band, index) {
  const node = { axis, boundary, band, index };
  node.key = nodeKey(node);
  return node;
}

function nodePosition(node) {
  if (node.axis === "V") {
    return {
      x: node.boundary * CELL_W,
      y: node.band * CELL_H + ((node.index + 0.5) / 16) * CELL_H,
    };
  }
  return {
    x: node.band * CELL_W + ((node.index + 0.5) / 8) * CELL_W,
    y: node.boundary * CELL_H,
  };
}

function portToNode(cellX, cellY, edge, index) {
  switch (edge) {
    case "L":
      return makeNode("V", cellX, cellY, index);
    case "R":
      return makeNode("V", cellX + 1, cellY, index);
    case "T":
      return makeNode("H", cellY, cellX, index);
    case "B":
      return makeNode("H", cellY + 1, cellX, index);
    default:
      throw new Error(`Unknown edge ${edge}`);
  }
}

function incidentPorts(node) {
  const result = [];
  if (node.axis === "V") {
    const boundaryX = node.boundary;
    const cellY = node.band;
    if (boundaryX > 0) {
      result.push({ cellX: boundaryX - 1, cellY, port: `R${node.index}` });
    }
    if (boundaryX < COLS) {
      result.push({ cellX: boundaryX, cellY, port: `L${node.index}` });
    }
  } else {
    const boundaryY = node.boundary;
    const cellX = node.band;
    if (boundaryY > 0) {
      result.push({ cellX, cellY: boundaryY - 1, port: `B${node.index}` });
    }
    if (boundaryY < ROWS) {
      result.push({ cellX, cellY: boundaryY, port: `T${node.index}` });
    }
  }
  return result;
}

const neighborCache = new Map();

function neighbors(node) {
  const cached = neighborCache.get(node.key);
  if (cached) return cached;

  const result = [];
  for (const incident of incidentPorts(node)) {
    const fromEdge = incident.port[0];
    for (const edge of EDGES) {
      if (edge === fromEdge) continue;
      for (let index = 0; index < PORTS[edge]; index += 1) {
        const next = portToNode(incident.cellX, incident.cellY, edge, index);
        result.push({
          node: next,
          segment: {
            cellX: incident.cellX,
            cellY: incident.cellY,
            from: incident.port,
            to: `${edge}${index}`,
          },
        });
      }
    }
  }

  neighborCache.set(node.key, result);
  return result;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nearestNode(x, y) {
  const candidates = [];

  const boundaryX = clamp(Math.round(x / CELL_W), 0, COLS);
  const verticalBand = clamp(Math.floor(y / CELL_H), 0, ROWS - 1);
  const verticalLocal = y - verticalBand * CELL_H;
  const verticalIndex = clamp(
    Math.round((verticalLocal / CELL_H) * 16 - 0.5),
    0,
    15,
  );
  candidates.push(makeNode("V", boundaryX, verticalBand, verticalIndex));

  const boundaryY = clamp(Math.round(y / CELL_H), 0, ROWS);
  const horizontalBand = clamp(Math.floor(x / CELL_W), 0, COLS - 1);
  const horizontalLocal = x - horizontalBand * CELL_W;
  const horizontalIndex = clamp(
    Math.round((horizontalLocal / CELL_W) * 8 - 0.5),
    0,
    7,
  );
  candidates.push(makeNode("H", boundaryY, horizontalBand, horizontalIndex));

  let best = candidates[0];
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const point = nodePosition(candidate);
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

function distance(a, b) {
  const pa = nodePosition(a);
  const pb = nodePosition(b);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

function pointSegmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  const t = clamp(
    ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy),
    0,
    1,
  );
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}

class MinHeap {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].priority <= item.priority) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }

  pop() {
    if (this.items.length === 0) return null;
    const root = this.items[0];
    const last = this.items.pop();
    if (this.items.length === 0) return root;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.items.length) break;
      let child = left;
      if (
        right < this.items.length &&
        this.items[right].priority < this.items[left].priority
      ) {
        child = right;
      }
      if (this.items[child].priority >= last.priority) break;
      this.items[index] = this.items[child];
      index = child;
    }
    this.items[index] = last;
    return root;
  }

  get size() {
    return this.items.length;
  }
}

function routeNodes(start, target, guideStart = nodePosition(start), guideEnd = nodePosition(target)) {
  if (!start || !target || start.key === target.key) return [];

  const open = new MinHeap();
  const gScore = new Map([[start.key, 0]]);
  const cameFrom = new Map();
  const closed = new Set();
  open.push({ node: start, priority: distance(start, target) });

  let visits = 0;
  while (open.size > 0 && visits < MAX_ROUTE_VISITS) {
    const currentItem = open.pop();
    const current = currentItem.node;
    if (closed.has(current.key)) continue;
    closed.add(current.key);
    visits += 1;

    if (current.key === target.key) {
      const segments = [];
      let key = target.key;
      while (key !== start.key) {
        const record = cameFrom.get(key);
        if (!record) return [];
        segments.push(record.segment);
        key = record.previousKey;
      }
      segments.reverse();
      return segments;
    }

    const currentScore = gScore.get(current.key) ?? Infinity;
    for (const next of neighbors(current)) {
      if (closed.has(next.node.key)) continue;

      const a = nodePosition(current);
      const b = nodePosition(next.node);
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const deviation = pointSegmentDistance(midpoint, guideStart, guideEnd);
      const stepCost = Math.hypot(b.x - a.x, b.y - a.y) + deviation * 0.45;
      const tentative = currentScore + stepCost;

      if (tentative >= (gScore.get(next.node.key) ?? Infinity)) continue;

      gScore.set(next.node.key, tentative);
      cameFrom.set(next.node.key, {
        previousKey: current.key,
        segment: next.segment,
      });
      open.push({
        node: next.node,
        priority: tentative + distance(next.node, target),
      });
    }
  }

  return [];
}

function uniqueConsecutiveNodes(samples) {
  const result = [];
  for (const sample of samples) {
    const node = nearestNode(sample.x, sample.y);
    if (result.length === 0 || result[result.length - 1].node.key !== node.key) {
      result.push({ node, sample });
    } else {
      result[result.length - 1].sample = sample;
    }
  }
  return result;
}

function pathFromGuidePoints(points, closed = false) {
  const anchors = uniqueConsecutiveNodes(points);
  if (anchors.length < 2) return [];

  const segments = [];
  const pairCount = closed ? anchors.length : anchors.length - 1;

  for (let index = 0; index < pairCount; index += 1) {
    const a = anchors[index];
    const b = anchors[(index + 1) % anchors.length];
    if (a.node.key === b.node.key) continue;
    const routed = routeNodes(a.node, b.node, a.sample, b.sample);
    if (routed.length === 0) return [];
    segments.push(...routed);
  }

  return segments;
}

function semanticCodepoint(segment) {
  return (
    STRAIGHT_CODEPOINT_BY_PAIR[`${segment.from}>${segment.to}`] ??
    STRAIGHT_CODEPOINT_BY_PAIR[`${segment.to}>${segment.from}`] ??
    null
  );
}

function buildCellMap(paths) {
  const cells = new Map();

  for (const path of paths) {
    for (const segment of path.segments) {
      const codepoint = semanticCodepoint(segment);
      if (codepoint === null) {
        throw new Error(`No GraphSCII semantic for ${segment.from}>${segment.to}`);
      }
      const key = `${segment.cellX},${segment.cellY}`;
      const entry = cells.get(key) ?? {
        cellX: segment.cellX,
        cellY: segment.cellY,
        codepoints: [],
      };
      entry.codepoints.push(codepoint);
      cells.set(key, entry);
    }
  }

  return cells;
}

function drawCellGrid(ctx) {
  ctx.save();
  ctx.strokeStyle = "rgba(127,127,127,0.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x += 1) {
    ctx.moveTo(x * CELL_W + 0.5, 0);
    ctx.lineTo(x * CELL_W + 0.5, ROWS * CELL_H);
  }
  for (let y = 0; y <= ROWS; y += 1) {
    ctx.moveTo(0, y * CELL_H + 0.5);
    ctx.lineTo(COLS * CELL_W, y * CELL_H + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function drawGlyphLayer() {
  glyphCtx.save();
  glyphCtx.clearRect(0, 0, glyphCanvas.width, glyphCanvas.height);
  glyphCtx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue("--canvas-bg")
    .trim() || "#ffffff";
  glyphCtx.fillRect(0, 0, glyphCanvas.width, glyphCanvas.height);
  drawCellGrid(glyphCtx);

  const paths = [...committedPaths];
  if (previewSegments.length > 0) {
    paths.push({ tool: "preview", segments: previewSegments });
  }

  const cellMap = buildCellMap(paths);
  let overlaps = 0;

  glyphCtx.font = `${CELL_H}px GraphSCII`;
  glyphCtx.textBaseline = "top";
  glyphCtx.textAlign = "left";
  glyphCtx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue("--ink")
    .trim() || "#111111";

  for (const cell of cellMap.values()) {
    const unique = [...new Set(cell.codepoints)];
    if (unique.length > 1) overlaps += 1;

    // Slice 1 is deliberately fail-visible for multi-segment cells.
    // Render the first exact semantic and mark the cell on the overlay.
    const character = String.fromCodePoint(unique[0]);
    glyphCtx.fillText(
      character,
      cell.cellX * CELL_W,
      cell.cellY * CELL_H,
    );
  }

  glyphCtx.restore();
  overlapEl.textContent =
    overlaps === 0
      ? "Exact node semantics only"
      : `${overlaps} overlap cell${overlaps === 1 ? "" : "s"} awaiting connector composition`;
}

function drawAllNodes() {
  if (!showNodesInput.checked) return;

  overlayCtx.save();
  overlayCtx.fillStyle = "rgba(90, 110, 130, 0.24)";

  for (let boundaryX = 0; boundaryX <= COLS; boundaryX += 1) {
    for (let cellY = 0; cellY < ROWS; cellY += 1) {
      for (let index = 0; index < 16; index += 1) {
        const p = nodePosition(makeNode("V", boundaryX, cellY, index));
        overlayCtx.fillRect(Math.round(p.x) - 0.7, Math.round(p.y) - 0.7, 1.4, 1.4);
      }
    }
  }

  for (let boundaryY = 0; boundaryY <= ROWS; boundaryY += 1) {
    for (let cellX = 0; cellX < COLS; cellX += 1) {
      for (let index = 0; index < 8; index += 1) {
        const p = nodePosition(makeNode("H", boundaryY, cellX, index));
        overlayCtx.fillRect(Math.round(p.x) - 0.7, Math.round(p.y) - 0.7, 1.4, 1.4);
      }
    }
  }

  overlayCtx.restore();
}

function drawNodeHighlight(node, radius = 4, fill = true) {
  if (!node) return;
  const p = nodePosition(node);
  overlayCtx.save();
  overlayCtx.beginPath();
  overlayCtx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  if (fill) {
    overlayCtx.fillStyle = "rgba(220, 70, 45, 0.9)";
    overlayCtx.fill();
  } else {
    overlayCtx.strokeStyle = "rgba(220, 70, 45, 0.9)";
    overlayCtx.lineWidth = 2;
    overlayCtx.stroke();
  }
  overlayCtx.restore();
}

function drawBezierControls() {
  if (bezierNodes.length === 0) return;

  overlayCtx.save();
  overlayCtx.strokeStyle = "rgba(220, 70, 45, 0.55)";
  overlayCtx.lineWidth = 1.5;
  overlayCtx.setLineDash([5, 4]);
  overlayCtx.beginPath();
  bezierNodes.forEach((node, index) => {
    const p = nodePosition(node);
    if (index === 0) overlayCtx.moveTo(p.x, p.y);
    else overlayCtx.lineTo(p.x, p.y);
  });
  overlayCtx.stroke();
  overlayCtx.restore();

  for (const node of bezierNodes) drawNodeHighlight(node, 4, false);
}

function drawOverlapMarkers() {
  const paths = [...committedPaths];
  if (previewSegments.length > 0) {
    paths.push({ tool: "preview", segments: previewSegments });
  }
  const cellMap = buildCellMap(paths);

  overlayCtx.save();
  overlayCtx.strokeStyle = "rgba(210, 50, 35, 0.8)";
  overlayCtx.lineWidth = 1.5;
  for (const cell of cellMap.values()) {
    if (new Set(cell.codepoints).size <= 1) continue;
    overlayCtx.strokeRect(
      cell.cellX * CELL_W + 2,
      cell.cellY * CELL_H + 2,
      CELL_W - 4,
      CELL_H - 4,
    );
  }
  overlayCtx.restore();
}

function render() {
  drawGlyphLayer();
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  drawAllNodes();
  drawOverlapMarkers();
  drawBezierControls();
  drawNodeHighlight(hoverNode, 3.5, true);
  undoButton.disabled = committedPaths.length === 0;
  clearButton.disabled = committedPaths.length === 0;
}

function canvasPoint(event) {
  const rect = overlayCanvas.getBoundingClientRect();
  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * overlayCanvas.width, 0, overlayCanvas.width),
    y: clamp(((event.clientY - rect.top) / rect.height) * overlayCanvas.height, 0, overlayCanvas.height),
  };
}

function commitSegments(tool, segments, closed = false) {
  if (!segments || segments.length === 0) return false;
  committedPaths.push({ tool, closed, segments: segments.map((segment) => ({ ...segment })) });
  previewSegments = [];
  render();
  return true;
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x,
    y:
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y,
  };
}

function bezierSegments(nodes) {
  const [n0, n1, n2, n3] = nodes;
  const p0 = nodePosition(n0);
  const p1 = nodePosition(n1);
  const p2 = nodePosition(n2);
  const p3 = nodePosition(n3);
  const samples = [];
  const steps = 72;
  for (let index = 0; index <= steps; index += 1) {
    samples.push(cubicPoint(p0, p1, p2, p3, index / steps));
  }
  return pathFromGuidePoints(samples, false);
}

function ellipseSegments(aNode, bNode) {
  const a = nodePosition(aNode);
  const b = nodePosition(bNode);
  const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  if (rx < CELL_W * 0.75 || ry < CELL_H * 0.75) return [];

  const circumferenceEstimate = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
  const steps = clamp(Math.ceil(circumferenceEstimate / 3), 64, 192);
  const samples = [];

  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    samples.push({
      x: center.x + Math.cos(angle) * rx,
      y: center.y + Math.sin(angle) * ry,
    });
  }

  return pathFromGuidePoints(samples, true);
}

function updateToolButtons() {
  for (const button of toolButtons) {
    const active = button.dataset.tool === currentTool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function toolInstruction(tool) {
  switch (tool) {
    case "freehand":
      return "Freehand: drag across the node lattice.";
    case "line":
      return "Line: drag from one node to another.";
    case "bezier":
      return "Bezier: click four nodes — start, control 1, control 2, end.";
    case "ellipse":
      return "Ellipse: drag between two node points to define its bounds.";
    default:
      return "";
  }
}

function chooseTool(tool) {
  currentTool = tool;
  activeGesture = null;
  previewSegments = [];
  bezierNodes = [];
  updateToolButtons();
  setStatus(toolInstruction(tool));
  render();
}

for (const button of toolButtons) {
  button.addEventListener("click", () => chooseTool(button.dataset.tool));
}

overlayCanvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  overlayCanvas.focus();
  const point = canvasPoint(event);
  const node = nearestNode(point.x, point.y);
  hoverNode = node;

  if (currentTool === "bezier") {
    bezierNodes.push(node);
    if (bezierNodes.length === 4) {
      const segments = bezierSegments(bezierNodes);
      if (commitSegments("bezier", segments)) {
        setStatus(`Bezier committed: ${segments.length} exact node-to-node segments.`);
      } else {
        setStatus("Bezier could not form a legal node path.");
      }
      bezierNodes = [];
    } else {
      const labels = ["start", "control 1", "control 2", "end"];
      setStatus(`Bezier ${labels[bezierNodes.length - 1]} selected. Click ${labels[bezierNodes.length]}.`);
      render();
    }
    return;
  }

  overlayCanvas.setPointerCapture(event.pointerId);

  if (currentTool === "freehand") {
    activeGesture = {
      pointerId: event.pointerId,
      currentNode: node,
      segments: [],
      lastPoint: point,
    };
    previewSegments = [];
    setStatus("Freehand: walking the node graph.");
  } else if (currentTool === "line") {
    activeGesture = { pointerId: event.pointerId, startNode: node, startPoint: point };
    previewSegments = [];
  } else if (currentTool === "ellipse") {
    activeGesture = { pointerId: event.pointerId, startNode: node };
    previewSegments = [];
  }

  render();
});

overlayCanvas.addEventListener("pointermove", (event) => {
  const point = canvasPoint(event);
  hoverNode = nearestNode(point.x, point.y);

  if (!activeGesture || activeGesture.pointerId !== event.pointerId) {
    render();
    return;
  }

  if (currentTool === "freehand") {
    const target = hoverNode;
    if (target.key !== activeGesture.currentNode.key) {
      const routed = routeNodes(
        activeGesture.currentNode,
        target,
        activeGesture.lastPoint,
        point,
      );
      if (routed.length > 0) {
        activeGesture.segments.push(...routed);
        activeGesture.currentNode = target;
        activeGesture.lastPoint = point;
        previewSegments = activeGesture.segments;
      }
    }
  } else if (currentTool === "line") {
    previewSegments = routeNodes(
      activeGesture.startNode,
      hoverNode,
      nodePosition(activeGesture.startNode),
      nodePosition(hoverNode),
    );
  } else if (currentTool === "ellipse") {
    previewSegments = ellipseSegments(activeGesture.startNode, hoverNode);
  }

  render();
});

function finishPointerGesture(event) {
  if (!activeGesture || activeGesture.pointerId !== event.pointerId) return;

  if (currentTool === "freehand") {
    const segments = activeGesture.segments;
    if (commitSegments("freehand", segments)) {
      setStatus(`Freehand committed: ${segments.length} exact node-to-node segments.`);
    } else {
      setStatus("Freehand ended without a segment.");
    }
  } else if (currentTool === "line") {
    const segments = previewSegments;
    if (commitSegments("line", segments)) {
      setStatus(`Line committed: ${segments.length} exact node-to-node segments.`);
    } else {
      setStatus("Line ended on its starting node.");
    }
  } else if (currentTool === "ellipse") {
    const segments = previewSegments;
    if (commitSegments("ellipse", segments, true)) {
      setStatus(`Ellipse committed: ${segments.length} exact node-to-node segments.`);
    } else {
      setStatus("Ellipse is too small to form a legal closed node path.");
    }
  }

  previewSegments = [];
  activeGesture = null;
  render();
}

overlayCanvas.addEventListener("pointerup", finishPointerGesture);
overlayCanvas.addEventListener("pointercancel", (event) => {
  if (activeGesture?.pointerId === event.pointerId) {
    activeGesture = null;
    previewSegments = [];
    setStatus(`${toolInstruction(currentTool)} Gesture cancelled.`);
    render();
  }
});

overlayCanvas.addEventListener("pointerleave", () => {
  if (!activeGesture) {
    hoverNode = null;
    render();
  }
});

undoButton.addEventListener("click", () => {
  committedPaths.pop();
  setStatus("Undid last node path.");
  render();
});

clearButton.addEventListener("click", () => {
  committedPaths = [];
  previewSegments = [];
  bezierNodes = [];
  activeGesture = null;
  setStatus("Canvas cleared.");
  render();
});

showNodesInput.addEventListener("change", render);

overlayCanvas.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (committedPaths.length > 0) {
      committedPaths.pop();
      setStatus("Undid last node path.");
      render();
    }
  }
  if (event.key === "Escape") {
    activeGesture = null;
    previewSegments = [];
    bezierNodes = [];
    setStatus(`${toolInstruction(currentTool)} Current gesture cancelled.`);
    render();
  }
});

async function boot() {
  try {
    await document.fonts.load(`${CELL_H}px GraphSCII`);
    setStatus(toolInstruction(currentTool));
  } catch {
    setStatus("GraphSCII font did not load; serve the repository root so ../artifacts/fonts is reachable.");
  }
  updateToolButtons();
  render();
}

boot();
