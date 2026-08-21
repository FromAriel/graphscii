(() => {
  'use strict';

  const COLS = 24;
  const ROWS = 12;
  const CELL_W = 24;
  const CELL_H = 48;
  const PORT_COUNTS = { L: 16, R: 16, T: 8, B: 8 };
  const EDGES = ['L', 'R', 'T', 'B'];
  const EPS = 1e-6;
  const RESAMPLE_SPACING = 1.5;
  const JITTER_DEADBAND = 0.55;

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
  let hoverNode = null;
  let activeGesture = null;
  let bezierNodes = [];

  function setStatus(message) { statusEl.textContent = message; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function portCount(edge) { return edge === 'L' || edge === 'R' ? 16 : 8; }
  function portPixel(edge, index) {
    if (edge === 'L') return [0, index];
    if (edge === 'R') return [7, index];
    if (edge === 'T') return [index, 0];
    return [index, 15];
  }

  function bitmapKey(startEdge, startIndex, endEdge, endIndex) {
    let [x0, y0] = portPixel(startEdge, startIndex);
    const [x1, y1] = portPixel(endEdge, endIndex);
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
      if (doubled >= dy) { error += dy; x0 += sx; }
      if (doubled <= dx) { error += dx; y0 += sy; }
    }
    return [...rows].map((row) => row.toString(16).padStart(2, '0')).join('');
  }

  function buildStraightLookup() {
    const families = [['L','R'],['T','B'],['L','T'],['L','B'],['R','T'],['R','B']];
    const ownerByBitmap = new Map();
    const byPair = Object.create(null);
    let nextOwner = 0;
    for (const [startEdge, endEdge] of families) {
      for (let startIndex = 0; startIndex < portCount(startEdge); startIndex += 1) {
        for (let endIndex = 0; endIndex < portCount(endEdge); endIndex += 1) {
          const bitmap = bitmapKey(startEdge, startIndex, endEdge, endIndex);
          let owner = ownerByBitmap.get(bitmap);
          if (owner === undefined) { owner = nextOwner; ownerByBitmap.set(bitmap, owner); nextOwner += 1; }
          const codepoint = 0xE000 + owner;
          byPair[`${startEdge}${startIndex}>${endEdge}${endIndex}`] = codepoint;
          byPair[`${endEdge}${endIndex}>${startEdge}${startIndex}`] = codepoint;
        }
      }
    }
    if (Object.keys(byPair).length !== 1664 || nextOwner !== 746) throw new Error('GraphSCII straight lookup invariant failed.');
    return byPair;
  }

  const STRAIGHT_CODEPOINT_BY_PAIR = buildStraightLookup();

  function makeNode(axis, boundary, band, index) {
    return { axis, boundary, band, index, key: `${axis}:${boundary}:${band}:${index}` };
  }
  function nodePosition(node) {
    if (node.axis === 'V') return { x: node.boundary * CELL_W, y: node.band * CELL_H + ((node.index + 0.5) / 16) * CELL_H };
    return { x: node.band * CELL_W + ((node.index + 0.5) / 8) * CELL_W, y: node.boundary * CELL_H };
  }
  function portToNode(cellX, cellY, port) {
    const edge = port[0]; const index = Number(port.slice(1));
    if (edge === 'L') return makeNode('V', cellX, cellY, index);
    if (edge === 'R') return makeNode('V', cellX + 1, cellY, index);
    if (edge === 'T') return makeNode('H', cellY, cellX, index);
    return makeNode('H', cellY + 1, cellX, index);
  }
  function nearestNode(x, y) {
    const verticalBoundary = clamp(Math.round(x / CELL_W), 0, COLS);
    const verticalBand = clamp(Math.floor(y / CELL_H), 0, ROWS - 1);
    const verticalIndex = clamp(Math.round(((y - verticalBand * CELL_H) / CELL_H) * 16 - 0.5), 0, 15);
    const horizontalBoundary = clamp(Math.round(y / CELL_H), 0, ROWS);
    const horizontalBand = clamp(Math.floor(x / CELL_W), 0, COLS - 1);
    const horizontalIndex = clamp(Math.round(((x - horizontalBand * CELL_W) / CELL_W) * 8 - 0.5), 0, 7);
    const candidates = [makeNode('V', verticalBoundary, verticalBand, verticalIndex), makeNode('H', horizontalBoundary, horizontalBand, horizontalIndex)];
    let best = candidates[0], bestDistance = Infinity;
    for (const candidate of candidates) {
      const point = nodePosition(candidate), distance = Math.hypot(point.x - x, point.y - y);
      if (distance < bestDistance) { best = candidate; bestDistance = distance; }
    }
    return best;
  }
  function cellContainsPoint(cell, point, margin = EPS) {
    return point.x >= cell.x * CELL_W - margin && point.x <= (cell.x + 1) * CELL_W + margin && point.y >= cell.y * CELL_H - margin && point.y <= (cell.y + 1) * CELL_H + margin;
  }
  function adjacentCellsForNode(node) {
    const cells = [];
    if (node.axis === 'V') {
      if (node.boundary > 0) cells.push({ x: node.boundary - 1, y: node.band });
      if (node.boundary < COLS) cells.push({ x: node.boundary, y: node.band });
    } else {
      if (node.boundary > 0) cells.push({ x: node.band, y: node.boundary - 1 });
      if (node.boundary < ROWS) cells.push({ x: node.band, y: node.boundary });
    }
    return cells;
  }
  function portForNodeInCell(node, cell) {
    if (node.axis === 'V' && node.band === cell.y) {
      if (node.boundary === cell.x) return `L${node.index}`;
      if (node.boundary === cell.x + 1) return `R${node.index}`;
    }
    if (node.axis === 'H' && node.band === cell.x) {
      if (node.boundary === cell.y) return `T${node.index}`;
      if (node.boundary === cell.y + 1) return `B${node.index}`;
    }
    return null;
  }
  function chooseInitialCell(startNode, nextPoint) {
    const origin = nodePosition(startNode), dx = nextPoint.x - origin.x, dy = nextPoint.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;
    const probe = { x: origin.x + (dx / length) * 0.25, y: origin.y + (dy / length) * 0.25 };
    const adjacent = adjacentCellsForNode(startNode);
    for (const cell of adjacent) if (cellContainsPoint(cell, probe, 0)) return cell;
    return adjacent[0] ?? null;
  }
  function oppositeEdge(edge) { if (edge === 'L') return 'R'; if (edge === 'R') return 'L'; if (edge === 'T') return 'B'; return 'T'; }
  function neighborCell(cell, edge) { if (edge === 'L') return { x: cell.x - 1, y: cell.y }; if (edge === 'R') return { x: cell.x + 1, y: cell.y }; if (edge === 'T') return { x: cell.x, y: cell.y - 1 }; return { x: cell.x, y: cell.y + 1 }; }
  function cellInBounds(cell) { return cell.x >= 0 && cell.x < COLS && cell.y >= 0 && cell.y < ROWS; }
  function quantizedPort(cell, edge, point) {
    if (edge === 'L' || edge === 'R') return `${edge}${clamp(Math.round(((point.y - cell.y * CELL_H) / CELL_H) * 16 - 0.5), 0, 15)}`;
    return `${edge}${clamp(Math.round(((point.x - cell.x * CELL_W) / CELL_W) * 8 - 0.5), 0, 7)}`;
  }
  function firstCellExit(cell, start, end) {
    const dx = end.x - start.x, dy = end.y - start.y;
    const left = cell.x * CELL_W, right = (cell.x + 1) * CELL_W, top = cell.y * CELL_H, bottom = (cell.y + 1) * CELL_H;
    const hits = [];
    if (dx < -EPS) hits.push({ edge: 'L', t: (left - start.x) / dx });
    if (dx > EPS) hits.push({ edge: 'R', t: (right - start.x) / dx });
    if (dy < -EPS) hits.push({ edge: 'T', t: (top - start.y) / dy });
    if (dy > EPS) hits.push({ edge: 'B', t: (bottom - start.y) / dy });
    let best = null;
    for (const hit of hits) {
      if (hit.t <= EPS || hit.t > 1 + EPS) continue;
      const point = { x: start.x + dx * hit.t, y: start.y + dy * hit.t };
      if (point.x < left - 0.001 || point.x > right + 0.001 || point.y < top - 0.001 || point.y > bottom + 0.001) continue;
      if (!best || hit.t < best.t - EPS) best = { edge: hit.edge, t: hit.t, point };
      else if (Math.abs(hit.t - best.t) <= EPS) {
        const preferHorizontalEdge = Math.abs(dx) >= Math.abs(dy);
        const candidateHorizontal = hit.edge === 'L' || hit.edge === 'R';
        const bestHorizontal = best.edge === 'L' || best.edge === 'R';
        if (candidateHorizontal === preferHorizontalEdge && bestHorizontal !== preferHorizontalEdge) best = { edge: hit.edge, t: hit.t, point };
      }
    }
    return best;
  }

  function pushRawPoint(points, point) {
    const previous = points[points.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.15) points.push(point);
  }
  function resamplePolyline(points, spacing = RESAMPLE_SPACING) {
    if (points.length < 2) return points.map((point) => ({ ...point }));
    const output = [{ ...points[0] }]; let carry = 0; let previous = { ...points[0] };
    for (let index = 1; index < points.length; index += 1) {
      const target = points[index]; let dx = target.x - previous.x, dy = target.y - previous.y, length = Math.hypot(dx, dy);
      if (length < EPS) continue;
      while (carry + length >= spacing) {
        const needed = spacing - carry, t = needed / length;
        previous = { x: previous.x + dx * t, y: previous.y + dy * t };
        output.push({ ...previous });
        dx = target.x - previous.x; dy = target.y - previous.y; length = Math.hypot(dx, dy); carry = 0;
        if (length < EPS) break;
      }
      carry += length; previous = { ...target };
    }
    const last = points[points.length - 1], tail = output[output.length - 1];
    if (Math.hypot(last.x - tail.x, last.y - tail.y) > 0.1) output.push({ ...last });
    return output;
  }
  function smoothPolyline(points) {
    if (points.length < 5) return points.map((point) => ({ ...point }));
    const output = [{ ...points[0] }];
    for (let i = 1; i < points.length - 1; i += 1) {
      const a = points[Math.max(0, i - 1)], b = points[i], c = points[Math.min(points.length - 1, i + 1)];
      output.push({ x: a.x * 0.2 + b.x * 0.6 + c.x * 0.2, y: a.y * 0.2 + b.y * 0.6 + c.y * 0.2 });
    }
    output.push({ ...points[points.length - 1] }); return output;
  }
  function applyDeadband(points) {
    if (points.length < 2) return points;
    const output = [points[0]];
    for (let i = 1; i < points.length; i += 1) {
      const previous = output[output.length - 1], point = points[i];
      if (i === points.length - 1 || Math.hypot(point.x - previous.x, point.y - previous.y) >= JITTER_DEADBAND) output.push(point);
    }
    return output;
  }
  function normalizePointerPath(rawPoints, startNode) {
    if (!startNode) return [];
    const start = nodePosition(startNode), raw = [{ ...start }, ...rawPoints.slice(1)];
    return applyDeadband(smoothPolyline(resamplePolyline(raw)));
  }
  function pushSegment(segments, segment) {
    const previous = segments[segments.length - 1];
    if (previous && previous.cellX === segment.cellX && previous.cellY === segment.cellY && previous.from === segment.to && previous.to === segment.from) { segments.pop(); return; }
    if (previous && previous.cellX === segment.cellX && previous.cellY === segment.cellY && previous.from === segment.from && previous.to === segment.to) return;
    segments.push(segment);
  }
  function nearestTailPort(cell, entryPort, point) {
    const entryNode = portToNode(cell.x, cell.y, entryPort), entryPoint = nodePosition(entryNode);
    let best = { port: entryPort, node: entryNode, distance: Math.hypot(entryPoint.x - point.x, entryPoint.y - point.y) };
    for (const edge of EDGES) {
      if (edge === entryPort[0]) continue;
      for (let index = 0; index < PORT_COUNTS[edge]; index += 1) {
        const port = `${edge}${index}`, node = portToNode(cell.x, cell.y, port), p = nodePosition(node), distance = Math.hypot(p.x - point.x, p.y - point.y);
        if (distance < best.distance) best = { port, node, distance };
      }
    }
    return best;
  }
  function compilePolyline(points, startNode, explicitEndNode = null, closeTail = true) {
    if (!startNode || points.length < 2) return [];
    const segments = []; let currentPoint = nodePosition(startNode), pointIndex = 1;
    let currentCell = chooseInitialCell(startNode, points[pointIndex]);
    if (!currentCell || !cellInBounds(currentCell)) return [];
    let entryPort = portForNodeInCell(startNode, currentCell);
    if (!entryPort) return [];
    while (pointIndex < points.length) {
      const target = points[pointIndex];
      if (cellContainsPoint(currentCell, target, -0.0001)) { currentPoint = target; pointIndex += 1; continue; }
      const exit = firstCellExit(currentCell, currentPoint, target);
      if (!exit) { currentPoint = target; pointIndex += 1; continue; }
      const exitPort = quantizedPort(currentCell, exit.edge, exit.point);
      if (exit.edge !== entryPort[0]) pushSegment(segments, { cellX: currentCell.x, cellY: currentCell.y, from: entryPort, to: exitPort });
      const nextCell = neighborCell(currentCell, exit.edge);
      if (!cellInBounds(nextCell)) { currentPoint = exit.point; break; }
      currentCell = nextCell;
      entryPort = `${oppositeEdge(exit.edge)}${Number(exitPort.slice(1))}`;
      const remainingX = target.x - exit.point.x, remainingY = target.y - exit.point.y, remainingLength = Math.hypot(remainingX, remainingY);
      if (remainingLength > EPS) currentPoint = { x: exit.point.x + (remainingX / remainingLength) * 0.001, y: exit.point.y + (remainingY / remainingLength) * 0.001 };
      else { currentPoint = exit.point; pointIndex += 1; }
    }
    if (explicitEndNode) {
      const endPort = portForNodeInCell(explicitEndNode, currentCell);
      if (endPort && endPort[0] !== entryPort[0]) pushSegment(segments, { cellX: currentCell.x, cellY: currentCell.y, from: entryPort, to: endPort });
    } else if (closeTail && pointIndex >= points.length) {
      const tailPoint = points[points.length - 1], tail = nearestTailPort(currentCell, entryPort, tailPoint);
      if (tail.port !== entryPort && tail.port[0] !== entryPort[0]) pushSegment(segments, { cellX: currentCell.x, cellY: currentCell.y, from: entryPort, to: tail.port });
    }
    return segments;
  }
  function lineSegments(startNode, endNode) {
    if (!startNode || !endNode || startNode.key === endNode.key) return [];
    return compilePolyline([nodePosition(startNode), nodePosition(endNode)], startNode, endNode, false);
  }
  function cubicPoint(p0,p1,p2,p3,t) {
    const mt=1-t;
    return { x: mt*mt*mt*p0.x+3*mt*mt*t*p1.x+3*mt*t*t*p2.x+t*t*t*p3.x, y: mt*mt*mt*p0.y+3*mt*mt*t*p1.y+3*mt*t*t*p2.y+t*t*t*p3.y };
  }
  function bezierSegments(nodes) {
    const p=nodes.map(nodePosition), points=[p[0]];
    for(let index=1;index<=160;index+=1) points.push(cubicPoint(p[0],p[1],p[2],p[3],index/160));
    return compilePolyline(points,nodes[0],nodes[3],false);
  }
  function ellipseSegments(aNode,bNode) {
    const a=nodePosition(aNode), b=nodePosition(bNode), center={x:(a.x+b.x)/2,y:(a.y+b.y)/2}, rx=Math.abs(b.x-a.x)/2, ry=Math.abs(b.y-a.y)/2;
    if(rx<CELL_W*.75||ry<CELL_H*.75)return[];
    const startNode=nearestNode(center.x+rx,center.y), start=nodePosition(startNode), points=[start];
    const steps=clamp(Math.ceil((2*Math.PI*Math.sqrt((rx*rx+ry*ry)/2))/1.5),128,512);
    for(let index=1;index<=steps;index+=1){const angle=(index/steps)*Math.PI*2;points.push({x:center.x+Math.cos(angle)*rx,y:center.y+Math.sin(angle)*ry});}
    points.push(start); return compilePolyline(points,startNode,startNode,false);
  }
  function semanticCodepoint(segment){return STRAIGHT_CODEPOINT_BY_PAIR[`${segment.from}>${segment.to}`]??null;}
  function buildCellMap(paths){const cells=new Map();for(const path of paths)for(const segment of path.segments){const codepoint=semanticCodepoint(segment);if(codepoint===null)throw new Error(`No GraphSCII semantic for ${segment.from}>${segment.to}`);const key=`${segment.cellX},${segment.cellY}`;const entry=cells.get(key)??{cellX:segment.cellX,cellY:segment.cellY,codepoints:[]};entry.codepoints.push(codepoint);cells.set(key,entry);}return cells;}
  function resolvedCanvasBackground(){const color=getComputedStyle(glyphCanvas).backgroundColor;return color&&color!=='rgba(0, 0, 0, 0)'?color:'#ffffff';}
  function drawGrid(){glyphCtx.strokeStyle='rgba(127,127,127,0.16)';glyphCtx.lineWidth=1;glyphCtx.beginPath();for(let x=0;x<=COLS;x+=1){glyphCtx.moveTo(x*CELL_W+.5,0);glyphCtx.lineTo(x*CELL_W+.5,ROWS*CELL_H);}for(let y=0;y<=ROWS;y+=1){glyphCtx.moveTo(0,y*CELL_H+.5);glyphCtx.lineTo(COLS*CELL_W,y*CELL_H+.5);}glyphCtx.stroke();}
  function drawAllNodes(){if(!showNodesInput.checked)return;overlayCtx.fillStyle='rgba(80,100,120,0.35)';for(let boundaryX=0;boundaryX<=COLS;boundaryX+=1)for(let cellY=0;cellY<ROWS;cellY+=1)for(let index=0;index<16;index+=1){const p=nodePosition(makeNode('V',boundaryX,cellY,index));overlayCtx.fillRect(p.x-1,p.y-1,2,2);}for(let boundaryY=0;boundaryY<=ROWS;boundaryY+=1)for(let cellX=0;cellX<COLS;cellX+=1)for(let index=0;index<8;index+=1){const p=nodePosition(makeNode('H',boundaryY,cellX,index));overlayCtx.fillRect(p.x-1,p.y-1,2,2);}}
  function drawBezierControls(){if(bezierNodes.length===0)return;overlayCtx.strokeStyle='rgba(220,70,45,0.55)';overlayCtx.lineWidth=1.5;overlayCtx.setLineDash([5,4]);overlayCtx.beginPath();bezierNodes.forEach((node,index)=>{const p=nodePosition(node);if(index===0)overlayCtx.moveTo(p.x,p.y);else overlayCtx.lineTo(p.x,p.y);});overlayCtx.stroke();overlayCtx.setLineDash([]);}
  function render(){glyphCtx.clearRect(0,0,glyphCanvas.width,glyphCanvas.height);glyphCtx.fillStyle=resolvedCanvasBackground();glyphCtx.fillRect(0,0,glyphCanvas.width,glyphCanvas.height);drawGrid();const allPaths=[...committedPaths];if(previewSegments.length>0)allPaths.push({tool:'preview',segments:previewSegments});const cellMap=buildCellMap(allPaths);glyphCtx.font=`${CELL_H}px GraphSCII`;glyphCtx.textBaseline='top';glyphCtx.textAlign='left';glyphCtx.fillStyle='#111111';let overlaps=0;for(const cell of cellMap.values()){const unique=[...new Set(cell.codepoints)];if(unique.length>1)overlaps+=1;glyphCtx.fillText(String.fromCodePoint(unique[0]),cell.cellX*CELL_W,cell.cellY*CELL_H);}overlayCtx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);drawAllNodes();overlayCtx.strokeStyle='rgba(210,50,35,0.85)';overlayCtx.lineWidth=1.5;for(const cell of cellMap.values()){if(new Set(cell.codepoints).size<=1)continue;overlayCtx.strokeRect(cell.cellX*CELL_W+2,cell.cellY*CELL_H+2,CELL_W-4,CELL_H-4);}if(hoverNode){const p=nodePosition(hoverNode);overlayCtx.fillStyle='#d43b2f';overlayCtx.beginPath();overlayCtx.arc(p.x,p.y,3.5,0,Math.PI*2);overlayCtx.fill();}drawBezierControls();overlapEl.textContent=overlaps?`${overlaps} overlap cell${overlaps===1?'':'s'} awaiting connector composition`:'Exact node semantics only';undoButton.disabled=clearButton.disabled=committedPaths.length===0;}
  function canvasPoint(event){const rect=overlayCanvas.getBoundingClientRect();return{x:clamp(((event.clientX-rect.left)/rect.width)*overlayCanvas.width,0,overlayCanvas.width),y:clamp(((event.clientY-rect.top)/rect.height)*overlayCanvas.height,0,overlayCanvas.height)};}
  function commitSegments(tool,segments,closed=false){if(!segments||segments.length===0)return false;committedPaths.push({tool,closed,segments:segments.map((segment)=>({...segment}))});previewSegments=[];render();return true;}
  function toolInstruction(tool){if(tool==='freehand')return'Freehand: draw naturally; input is bridged, resampled, smoothed, then compiled to exact nodes.';if(tool==='line')return'Line: drag from one node to another.';if(tool==='bezier')return'Bezier: click four nodes — start, control 1, control 2, end.';return'Ellipse: drag between two nodes to define its bounds.';}
  function chooseTool(tool){currentTool=tool;activeGesture=null;previewSegments=[];bezierNodes=[];for(const button of toolButtons){const active=button.dataset.tool===tool;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}setStatus(toolInstruction(tool));render();}
  for(const button of toolButtons)button.addEventListener('click',()=>chooseTool(button.dataset.tool));
  overlayCanvas.addEventListener('pointerdown',(event)=>{event.preventDefault();overlayCanvas.focus();const point=canvasPoint(event),node=nearestNode(point.x,point.y);hoverNode=node;if(currentTool==='bezier'){bezierNodes.push(node);if(bezierNodes.length===4){const segments=bezierSegments(bezierNodes);setStatus(commitSegments('bezier',segments)?`Bezier committed: ${segments.length} exact node-to-node segments.`:'Bezier could not form a legal node path.');bezierNodes=[];}else setStatus(`Bezier point ${bezierNodes.length}/4 selected.`);render();return;}overlayCanvas.setPointerCapture(event.pointerId);activeGesture=currentTool==='freehand'?{pointerId:event.pointerId,startNode:node,rawPoints:[nodePosition(node)]}:{pointerId:event.pointerId,startNode:node};previewSegments=[];render();});
  overlayCanvas.addEventListener('pointermove',(event)=>{const point=canvasPoint(event);hoverNode=nearestNode(point.x,point.y);if(!activeGesture||activeGesture.pointerId!==event.pointerId){render();return;}if(currentTool==='freehand'){const coalesced=typeof event.getCoalescedEvents==='function'?event.getCoalescedEvents():[event];for(const sampleEvent of coalesced)pushRawPoint(activeGesture.rawPoints,canvasPoint(sampleEvent));pushRawPoint(activeGesture.rawPoints,point);const normalized=normalizePointerPath(activeGesture.rawPoints,activeGesture.startNode);previewSegments=compilePolyline(normalized,activeGesture.startNode,null,true);}else if(currentTool==='line')previewSegments=lineSegments(activeGesture.startNode,hoverNode);else if(currentTool==='ellipse')previewSegments=ellipseSegments(activeGesture.startNode,hoverNode);render();});
  function finishPointerGesture(event){if(!activeGesture||activeGesture.pointerId!==event.pointerId)return;let segments=previewSegments;if(currentTool==='freehand'){const point=canvasPoint(event);pushRawPoint(activeGesture.rawPoints,point);const normalized=normalizePointerPath(activeGesture.rawPoints,activeGesture.startNode);segments=compilePolyline(normalized,activeGesture.startNode,null,true);}const ok=commitSegments(currentTool,segments,currentTool==='ellipse');setStatus(ok?`${currentTool} committed: ${segments.length} exact node-to-node segments.`:`${currentTool} ended without a legal node path.`);previewSegments=[];activeGesture=null;render();}
  overlayCanvas.addEventListener('pointerup',finishPointerGesture);
  overlayCanvas.addEventListener('pointercancel',(event)=>{if(activeGesture?.pointerId!==event.pointerId)return;activeGesture=null;previewSegments=[];setStatus(`${toolInstruction(currentTool)} Gesture cancelled.`);render();});
  overlayCanvas.addEventListener('pointerleave',()=>{if(!activeGesture){hoverNode=null;render();}});
  undoButton.addEventListener('click',()=>{committedPaths.pop();setStatus('Undid last node path.');render();});
  clearButton.addEventListener('click',()=>{committedPaths=[];previewSegments=[];bezierNodes=[];activeGesture=null;setStatus('Canvas cleared.');render();});
  showNodesInput.addEventListener('change',render);
  overlayCanvas.addEventListener('keydown',(event)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(committedPaths.length>0){committedPaths.pop();setStatus('Undid last node path.');render();}}if(event.key==='Escape'){activeGesture=null;previewSegments=[];bezierNodes=[];setStatus(`${toolInstruction(currentTool)} Current gesture cancelled.`);render();}});
  async function boot(){try{await document.fonts.load(`${CELL_H}px GraphSCII`);setStatus(toolInstruction(currentTool));}catch{setStatus('GraphSCII font did not load. Serve the repository root so artifacts/fonts is reachable.');}chooseTool(currentTool);}
  boot();
})();
