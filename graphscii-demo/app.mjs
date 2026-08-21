import { STRAIGHT_CODEPOINT_BY_PAIR } from "./straight-lookup.mjs";

const COLS = 24;
const ROWS = 12;
const CELL_W = 24;
const CELL_H = 48;
const PORTS = { L: 16, R: 16, T: 8, B: 8 };
const EDGES = ["L", "R", "T", "B"];
const GUIDE_STEP = 2;

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeNode(axis, boundary, band, index) {
  return {
    axis,
    boundary,
    band,
    index,
    key: `${axis}:${boundary}:${band}:${index}`,
  };
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
    case "L": return makeNode("V", cellX, cellY, index);
    case "R": return makeNode("V", cellX + 1, cellY, index);
    case "T": return makeNode("H", cellY, cellX, index);
    case "B": return makeNode("H", cellY + 1, cellX, index);
    default: throw new Error(`Unknown GraphSCII edge ${edge}`);
  }
}

function incidentPorts(node) {
  const result = [];

  if (node.axis === "V") {
    if (node.boundary > 0) {
      result.push({
        cellX: node.boundary - 1,
        cellY: node.band,
        port: `R${node.index}`,
      });
    }
    if (node.boundary < COLS) {
      result.push({
        cellX: node.boundary,
        cellY: node.band,
        port: `L${node.index}`,
      });
    }
  } else {
    if (node.boundary > 0) {
      result.push({
        cellX: node.band,
        cellY: node.boundary - 1,
        port: `B${node.index}`,
      });
    }
    if (node.boundary < ROWS) {
      result.push({
        cellX: node.band,
        cellY: node.boundary,
        port: `T${node.index}`,
      });
    }
  }

  return result;
}

const neighborCache = new Map();

function legalStepsFrom(node) {
  const cached = neighborCache.get(node.key);
  if (cached) return cached;

  const result = [];

  for (const incident of incidentPorts(node)) {
    const fromEdge = incident.port[0];

    for (const edge of EDGES) {
      if (edge === fromEdge) continue;

      for (let index = 0; index < PORTS[edge]; index += 1) {
        result.push({
          node: portToNode(incident.cellX, incident.cellY, edge, index),
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

function nearestNode(x, y) {
  const candidates = [];

  const verticalBoundary = clamp(Math.round(x / CELL_W), 0, COLS);
  const verticalBand = clamp(Math.floor(y / CELL_H), 0, ROWS - 1);
  const verticalLocal = y - verticalBand * CELL_H;
  const verticalIndex = clamp(
    Math.round((verticalLocal / CELL_H) * 16 - 0.5),
    0,
    15,
  );
  candidates.push(
    makeNode("V", verticalBoundary, verticalBand, verticalIndex),
  );

  const horizontalBoundary = clamp(Math.round(y / CELL_H), 0, ROWS);
  const horizontalBand = clamp(Math.floor(x / CELL_W), 0, COLS - 1);
  const horizontalLocal = x - horizontalBand * CELL_W;
  const horizontalIndex = clamp(
    Math.round((horizontalLocal / CELL_W) * 8 - 0.5),
    0,
    7,
  );
  candidates.push(
    makeNode("H", horizontalBoundary, horizontalBand, horizontalIndex),
  );

  let best = candidates[0];
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const p = nodePosition(candidate);
    const distance = Math.hypot(p.x - x, p.y - y);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function bestLegalStepToward(node, targetPoint) {
  const current = nodePosition(node);
  const currentDistance = Math.hypot(
    current.x - targetPoint.x,
    current.y - targetPoint.y,
  );

  let best = null;
  let bestDistance = currentDistance;

  for (const candidate of legalStepsFrom(node)) {
    const p = nodePosition(candidate.node);
    const distance = Math.hypot(
      p.x - targetPoint.x,
      p.y - targetPoint.y,
    );

    if (distance + 0.001 < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function advanceToward(node, targetPoint, segments, maxSteps = 64) {
  let current = node;

  for (let step = 0; step < maxSteps; step += 1) {
    const next = bestLegalStepToward(current, targetPoint);
    if (!next) break;

    segments.push(next.segment);
    current = next.node;

    const p = nodePosition(current);
    if (Math.hypot(p.x - targetPoint.x, p.y - targetPoint.y) < 0.001) {
      break;
    }
  }

  return current;
}

function interpolatePoints(a, b, spacing = GUIDE_STEP) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(length / spacing));
  const result = [];

  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    result.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    });
  }

  return result;
}

function walkGuide(startNode, points, closeToStart = false) {
  const segments = [];
  let current = startNode;

  for (const point of points) {
    current = advanceToward(current, point, segments, 8);
  }

  if (closeToStart && current.key !== startNode.key) {
    current = advanceToward(
      current,
      nodePosition(startNode),
      segments,
      COLS + ROWS + 8,
    );
  }

  return {
    segments,
    endNode: current,
    closed: current.key === startNode.key,
  };
}

function lineSegments(startNode, endNode) {
  if (startNode.key === endNode.key) return [];

  const start = nodePosition(startNode);
  const end = nodePosition(endNode);
  const guide = interpolatePoints(start, end);
  const walked = walkGuide(startNode, guide);

  if (walked.endNode.key !== endNode.key) {
    advanceToward(
      walked.endNode,
      nodePosition(endNode),
      walked.segments,
      COLS + ROWS + 8,
    );
  }

  return walked.segments;
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
        throw new Error(
          `No GraphSCII semantic for ${segment.from}>${segment.to}`,
        );
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

  glyphCtx.fillStyle =
    getComputedStyle(document.documentElement)
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
  glyphCtx.fillStyle =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--ink")
      .trim() || "#111111";

  for (const cell of cellMap.values()) {
    const unique = [...new Set(cell.codepoints)];
    if (unique.length > 1) overlaps += 1;

    // Slice 1 never approximates a multi-segment cell.
    // The first exact semantic remains visible and the cell is marked.
    glyphCtx.fillText(
      String.fromCodePoint(unique[0]),
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
        const p = nodePosition(
          makeNode("V", boundaryX, cellY, index),
        );
        overlayCtx.fillRect(
          Math.round(p.x) - 0.7,
          Math.round(p.y) - 0.7,
          1.4,
          1.4,
        );
      }
    }
  }

  for (let boundaryY = 0; boundaryY <= ROWS; boundaryY += 1) {
    for (let cellX = 0; cellX < COLS; cellX += 1) {
      for (let index = 0; index < 8; index += 1) {
        const p = nodePosition(
          makeNode("H", boundaryY, cellX, index),
        );
        overlayCtx.fillRect(
          Math.round(p.x) - 0.7,
          Math.round(p.y) - 0.7,
          1.4,
          1.4,
        );
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

  for (const node of bezierNodes) {
    drawNodeHighlight(node, 4, false);
  }
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

  overlayCtx.clearRect(
    0,
    0,
    overlayCanvas.width,
    overlayCanvas.height,
  );

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
    x: clamp(
      ((event.clientX - rect.left) / rect.width) * overlayCanvas.width,
      0,
      overlayCanvas.width,
    ),
    y: clamp(
      ((event.clientY - rect.top) / rect.height) * overlayCanvas.height,
      0,
      overlayCanvas.height,
    ),
  };
}

function commitSegments(tool, segments, closed = false) {
  if (!segments || segments.length === 0) return false;

  committedPaths.push({
    tool,
    closed,
    segments: segments.map((segment) => ({ ...segment })),
  });

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

  const points = [];
  const steps = 96;

  for (let index = 1; index <= steps; index += 1) {
    points.push(
      cubicPoint(p0, p1, p2, p3, index / steps),
    );
  }

  return walkGuide(n0, points).segments;
}

function ellipseSegments(aNode, bNode) {
  const a = nodePosition(aNode);
  const b = nodePosition(bNode);

  const center = {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };

  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;

  if (rx < CELL_W * 0.75 || ry < CELL_H * 0.75) {
    return [];
  }

  const circumference =
    2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
  const steps = clamp(
    Math.ceil(circumference / GUIDE_STEP),
    96,
    384,
  );

  const startPoint = {
    x: center.x + rx,
    y: center.y,
  };
  const startNode = nearestNode(startPoint.x, startPoint.y);
  const points = [];

  for (let index = 1; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    points.push({
      x: center.x + Math.cos(angle) * rx,
      y: center.y + Math.sin(angle) * ry,
    });
  }

  const walked = walkGuide(startNode, points, true);
  return walked.closed ? walked.segments : [];
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
  button.addEventListener(
    "click",
    () => chooseTool(button.dataset.tool),
  );
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
        setStatus(
          `Bezier committed: ${segments.length} exact node-to-node segments.`,
        );
      } else {
        setStatus("Bezier could not form a legal node path.");
      }

      bezierNodes = [];
    } else {
      const labels = ["start", "control 1", "control 2", "end"];
      setStatus(
        `Bezier ${labels[bezierNodes.length - 1]} selected. Click ${labels[bezierNodes.length]}.`,
      );
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
      lastPoint: nodePosition(node),
    };
    previewSegments = [];
    setStatus("Freehand: walking legal node-to-node steps.");
  } else if (currentTool === "line") {
    activeGesture = {
      pointerId: event.pointerId,
      startNode: node,
    };
    previewSegments = [];
  } else if (currentTool === "ellipse") {
    activeGesture = {
      pointerId: event.pointerId,
      startNode: node,
    };
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
    const samples = interpolatePoints(
      activeGesture.lastPoint,
      point,
    );

    for (const sample of samples) {
      activeGesture.currentNode = advanceToward(
        activeGesture.currentNode,
        sample,
        activeGesture.segments,
        4,
      );
    }

    activeGesture.lastPoint = point;
    previewSegments = activeGesture.segments;
  } else if (currentTool === "line") {
    previewSegments = lineSegments(
      activeGesture.startNode,
      hoverNode,
    );
  } else if (currentTool === "ellipse") {
    previewSegments = ellipseSegments(
      activeGesture.startNode,
      hoverNode,
    );
  }

  render();
});

function finishPointerGesture(event) {
  if (
    !activeGesture ||
    activeGesture.pointerId !== event.pointerId
  ) {
    return;
  }

  if (currentTool === "freehand") {
    const segments = activeGesture.segments;

    if (commitSegments("freehand", segments)) {
      setStatus(
        `Freehand committed: ${segments.length} exact node-to-node segments.`,
      );
    } else {
      setStatus("Freehand ended without a segment.");
    }
  } else if (currentTool === "line") {
    const segments = previewSegments;

    if (commitSegments("line", segments)) {
      setStatus(
        `Line committed: ${segments.length} exact node-to-node segments.`,
      );
    } else {
      setStatus("Line ended on its starting node.");
    }
  } else if (currentTool === "ellipse") {
    const segments = previewSegments;

    if (commitSegments("ellipse", segments, true)) {
      setStatus(
        `Ellipse committed: ${segments.length} exact node-to-node segments.`,
      );
    } else {
      setStatus(
        "Ellipse is too small or did not close on the node lattice.",
      );
    }
  }

  previewSegments = [];
  activeGesture = null;
  render();
}

overlayCanvas.addEventListener(
  "pointerup",
  finishPointerGesture,
);

overlayCanvas.addEventListener("pointercancel", (event) => {
  if (activeGesture?.pointerId === event.pointerId) {
    activeGesture = null;
    previewSegments = [];
    setStatus(
      `${toolInstruction(currentTool)} Gesture cancelled.`,
    );
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
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "z"
  ) {
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
    setStatus(
      `${toolInstruction(currentTool)} Current gesture cancelled.`,
    );
    render();
  }
});

async function boot() {
  try {
    await document.fonts.load(`${CELL_H}px GraphSCII`);
    setStatus(toolInstruction(currentTool));
  } catch {
    setStatus(
      "GraphSCII font did not load; serve the repository root so ../artifacts/fonts is reachable.",
    );
  }

  updateToolButtons();
  render();
}

boot();
