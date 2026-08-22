import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

function replaceOnce(source, label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch target ambiguous: ${label}`);
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

const drawV6Path = path.join(repoRoot, "graphscii-demo", "draw-v6.js");
let draw = await readFile(drawV6Path, "utf8");
draw = draw.replaceAll("GraphSCIIDrawV6", "GraphSCIIDrawV7");

draw = replaceOnce(
  draw,
  "owner ranges",
  "  const EPS = 1e-9;\n",
  "  const EPS = 1e-9;\n  const STRAIGHT_OWNER_MAX = 745;\n  const CONNECTOR_OWNER_MIN = 5796;\n  const CONNECTOR_OWNER_MAX = 6396;\n  const BITMAP_INDEX_URL = '../artifacts/manifest/vocabulary-v1/indexes/by-bitmap.json?v=20260821-crossovers-v1';\n  let GLYPH_ID_BY_BITMAP = null;\n",
);

draw = replaceOnce(
  draw,
  "exact multi-pass resolver",
  "  const STRAIGHT_CODEPOINT_BY_PAIR = buildStraightLookup();\n",
  `  const STRAIGHT_CODEPOINT_BY_PAIR = buildStraightLookup();\n\n  function parsePortText(text) {\n    const match = /^([LRTB])(\\d+)$/.exec(text);\n    if (!match) throw new Error(\`Invalid port text \\${text}\`);\n    return { side: match[1], index: Number(match[2]) };\n  }\n\n  function segmentBitmapKey(segment) {\n    const from = parsePortText(segment.from);\n    const to = parsePortText(segment.to);\n    return bitmapKey(from.side, from.index, to.side, to.index);\n  }\n\n  function unionBitmapKey(segments) {\n    const rows = new Uint8Array(16);\n    for (const segment of segments) {\n      const key = segmentBitmapKey(segment);\n      for (let y = 0; y < 16; y += 1) rows[y] |= Number.parseInt(key.slice(y * 2, y * 2 + 2), 16);\n    }\n    return [...rows].map((row) => row.toString(16).padStart(2, '0')).join('');\n  }\n\n  function installBitmapIndex(entries) {\n    if (!entries || typeof entries !== 'object') throw new Error('GraphSCII bitmap index entries missing');\n    for (const [pair, codepoint] of Object.entries(STRAIGHT_CODEPOINT_BY_PAIR)) {\n      const [a, b] = pair.split('>');\n      const pa = parsePortText(a);\n      const pb = parsePortText(b);\n      const key = bitmapKey(pa.side, pa.index, pb.side, pb.index);\n      const glyphId = entries[key];\n      if (glyphId == null || 0xE000 + glyphId !== codepoint) {\n        throw new Error(\`Bitmap index disagrees with straight semantic \\${pair}\`);\n      }\n    }\n    const connectorOwners = Object.values(entries).filter((glyphId) => glyphId >= CONNECTOR_OWNER_MIN && glyphId <= CONNECTOR_OWNER_MAX).length;\n    if (connectorOwners !== 601) throw new Error(\`Expected 601 connector owners, got \\${connectorOwners}\`);\n    GLYPH_ID_BY_BITMAP = Object.freeze({ ...entries });\n    return true;\n  }\n\n  async function loadBitmapIndex() {\n    if (GLYPH_ID_BY_BITMAP) return true;\n    if (typeof fetch !== 'function') throw new Error('fetch unavailable for GraphSCII bitmap index');\n    const response = await fetch(BITMAP_INDEX_URL, { cache: 'no-store' });\n    if (!response.ok) throw new Error(\`Could not load GraphSCII bitmap index: HTTP \\${response.status}\`);\n    const payload = await response.json();\n    if (payload?.index !== 'by-bitmap' || payload?.entryCount !== 6397) throw new Error('Unexpected GraphSCII bitmap index format');\n    return installBitmapIndex(payload.entries);\n  }\n\n  function resolveCellSegments(segments) {\n    if (!segments?.length) return null;\n    if (segments.length === 1) {\n      return {\n        resolved: true,\n        family: 'straight',\n        glyphId: segments[0].codepoint - 0xE000,\n        codepoint: segments[0].codepoint,\n        bitmapKey: segmentBitmapKey(segments[0]),\n      };\n    }\n\n    const bitmap = unionBitmapKey(segments);\n    if (!GLYPH_ID_BY_BITMAP) return { resolved: false, reason: 'bitmap-index-not-loaded', bitmapKey: bitmap };\n    const glyphId = GLYPH_ID_BY_BITMAP[bitmap];\n    if (glyphId == null) return { resolved: false, reason: 'no-exact-published-glyph', bitmapKey: bitmap };\n\n    const isStraight = glyphId <= STRAIGHT_OWNER_MAX;\n    const isConnector = glyphId >= CONNECTOR_OWNER_MIN && glyphId <= CONNECTOR_OWNER_MAX;\n    if (!isStraight && !isConnector) {\n      return {\n        resolved: false,\n        reason: 'exact-bitmap-is-not-a-line-or-connector-glyph',\n        glyphId,\n        codepoint: 0xE000 + glyphId,\n        bitmapKey: bitmap,\n      };\n    }\n\n    return {\n      resolved: true,\n      family: isConnector ? 'connector' : 'straight',\n      glyphId,\n      codepoint: 0xE000 + glyphId,\n      bitmapKey: bitmap,\n    };\n  }\n`,
);

draw = replaceOnce(
  draw,
  "connector self-test",
  "  function selfTest() {\n",
  `  function connectorSelfTest() {\n    if (!GLYPH_ID_BY_BITMAP) throw new Error('Connector self-test requires bitmap index');\n    const cell = { x: 2, y: 2 };\n    const horizontal = makeSegment(cell, makePort(2, 2, 'L', 0), makePort(2, 2, 'R', 0));\n    const vertical = makeSegment(cell, makePort(2, 2, 'T', 0), makePort(2, 2, 'B', 0));\n    const cross = resolveCellSegments([horizontal, vertical]);\n    if (!cross?.resolved || cross.family !== 'connector' || cross.codepoint !== 0xF6A4) {\n      throw new Error(\`Exact crossover resolution failed: \\${JSON.stringify(cross)}\`);\n    }\n    const repeated = resolveCellSegments([horizontal, horizontal]);\n    if (!repeated?.resolved || repeated.family !== 'straight' || repeated.codepoint !== horizontal.codepoint) {\n      throw new Error('Repeated identical pass did not collapse to its exact straight glyph');\n    }\n    return true;\n  }\n\n  function selfTest() {\n`,
);

draw = replaceOnce(
  draw,
  "public resolver API",
  "    segmentCrossings, rawTransitions, compileRawPath, lineGuide, bezierGuide,\n    ellipseGuide, validateSegments, selfTest,\n",
  "    segmentCrossings, rawTransitions, compileRawPath, lineGuide, bezierGuide,\n    ellipseGuide, validateSegments, segmentBitmapKey, unionBitmapKey, resolveCellSegments,\n    installBitmapIndex, loadBitmapIndex, connectorSelfTest, selfTest,\n",
);

draw = replaceOnce(
  draw,
  "render resolved multi-pass glyphs",
  `    let overlaps = 0;\n    for (const cell of cells.values()) {\n      if (cell.segments.length > 1) overlaps += 1;\n      const segment = cell.segments[0];\n      if (fontReady) glyphCtx.fillText(String.fromCodePoint(segment.codepoint), cell.x * CELL_W, cell.y * CELL_H);\n    }`,
  `    let multiPassCells = 0;\n    let resolvedMultiPassCells = 0;\n    let unresolvedMultiPassCells = 0;\n    for (const cell of cells.values()) {\n      const resolution = resolveCellSegments(cell.segments);\n      cell.resolution = resolution;\n      if (cell.segments.length > 1) {\n        multiPassCells += 1;\n        if (resolution?.resolved) resolvedMultiPassCells += 1;\n        else unresolvedMultiPassCells += 1;\n      }\n      const codepoint = resolution?.resolved ? resolution.codepoint : cell.segments[0].codepoint;\n      if (fontReady) glyphCtx.fillText(String.fromCodePoint(codepoint), cell.x * CELL_W, cell.y * CELL_H);\n    }`,
);

draw = replaceOnce(
  draw,
  "only unresolved multipass cells are red",
  `    for (const cell of cells.values()) {\n      if (cell.segments.length <= 1) continue;\n      overlayCtx.strokeRect(cell.x * CELL_W + 2, cell.y * CELL_H + 2, CELL_W - 4, CELL_H - 4);\n    }`,
  `    for (const cell of cells.values()) {\n      if (cell.segments.length <= 1 || cell.resolution?.resolved) continue;\n      overlayCtx.strokeRect(cell.x * CELL_W + 2, cell.y * CELL_H + 2, CELL_W - 4, CELL_H - 4);\n    }`,
);

draw = replaceOnce(
  draw,
  "multi-pass status",
  `    overlapEl.textContent = overlaps\n      ? \`\${overlaps} true multi-pass cell\${overlaps === 1 ? '' : 's'}\`\n      : 'Continuous shared-port path';`,
  `    overlapEl.textContent = unresolvedMultiPassCells\n      ? \`\${resolvedMultiPassCells} exact multi-pass glyph\${resolvedMultiPassCells === 1 ? '' : 's'}; \\${unresolvedMultiPassCells} unresolved\`\n      : resolvedMultiPassCells\n        ? \`\${resolvedMultiPassCells} exact connector/multi-pass glyph\${resolvedMultiPassCells === 1 ? '' : 's'}\`\n        : 'Continuous shared-port path';`,
);

draw = replaceOnce(
  draw,
  "load exact bitmap index before UI",
  `      selfTest();\n      await document.fonts.load(\`\${CELL_H}px GraphSCII\`);\n      fontReady = true;\n      chooseTool(currentTool);`,
  `      selfTest();\n      await Promise.all([\n        document.fonts.load(\`\${CELL_H}px GraphSCII\`),\n        loadBitmapIndex(),\n      ]);\n      connectorSelfTest();\n      fontReady = true;\n      chooseTool(currentTool);`,
);

const drawV7Path = path.join(repoRoot, "graphscii-demo", "draw-v7.js");
await writeFile(drawV7Path, draw);

const debugV2Path = path.join(repoRoot, "graphscii-demo", "debug-export-v2.js");
let debug = await readFile(debugV2Path, "utf8");
debug = debug.replaceAll("GraphSCIIDrawV6", "GraphSCIIDrawV7");
debug = debug.replaceAll("graphscii-debug-v2", "graphscii-debug-v3");
debug = debug.replaceAll("draw-v6.js", "draw-v7.js");

debug = replaceOnce(
  debug,
  "debug panel exact resolver",
  `    for (const entry of cells.values()) {\n      const displayed = entry.passes[0];\n      const glyph = displayed.glyph ?? String.fromCodePoint(displayed.codepoint);\n      const codepointHex = displayed.codepointHex ?? \`U+\${displayed.codepoint.toString(16).toUpperCase().padStart(4, '0')}\`;\n      glyphRows[entry.y][entry.x] = glyph;\n      codepointRows[entry.y][entry.x] = codepointHex;\n      semanticRows[entry.y][entry.x] = \`\${displayed.from}>\${displayed.to}\`;\n      const record = {\n        x: entry.x,\n        y: entry.y,\n        displayedGlyph: glyph,\n        displayedCodepoint: codepointHex,\n        displayedSemantic: \`\${displayed.from}>\${displayed.to}\`,\n        passCount: entry.passes.length,\n        passes: entry.passes,\n      };`,
  `    for (const entry of cells.values()) {\n      const resolution = G.resolveCellSegments(entry.passes);\n      const fallback = entry.passes[0];\n      const codepoint = resolution?.resolved ? resolution.codepoint : fallback.codepoint;\n      const glyph = String.fromCodePoint(codepoint);\n      const codepointHex = \`U+\${codepoint.toString(16).toUpperCase().padStart(4, '0')}\`;\n      const combinedSemantic = entry.passes.map((pass) => \`\${pass.from}>\${pass.to}\`).join(' + ');\n      glyphRows[entry.y][entry.x] = glyph;\n      codepointRows[entry.y][entry.x] = codepointHex;\n      semanticRows[entry.y][entry.x] = combinedSemantic;\n      const record = {\n        x: entry.x,\n        y: entry.y,\n        displayedGlyph: glyph,\n        displayedCodepoint: codepointHex,\n        displayedSemantic: combinedSemantic,\n        resolution,\n        passCount: entry.passes.length,\n        passes: entry.passes,\n      };`,
);

const debugV3Path = path.join(repoRoot, "graphscii-demo", "debug-export-v3.js");
await writeFile(debugV3Path, debug);

const indexPath = path.join(repoRoot, "graphscii-demo", "index.html");
let index = await readFile(indexPath, "utf8");
index = index.replace('./draw-v6.js?v=20260821-1618', './draw-v7.js?v=20260821-1755');
index = index.replace('./debug-export-v2.js?v=20260821-1618', './debug-export-v3.js?v=20260821-1755');
index = replaceOnce(
  index,
  "connector contract note",
  "        Perpendicular corner ports are not collapsed. A corner traversal such as L15→B0 is a real GraphSCII semantic and emits its required one-pixel corner glyph.\n        Freehand, line, Bezier, and ellipse all use the same crossing compiler.\n",
  "        Perpendicular corner ports are not collapsed. A corner traversal such as L15→B0 is a real GraphSCII semantic and emits its required one-pixel corner glyph.\n        Multi-pass cells union those exact straight bitmaps and use a published connector glyph only when the union is an exact vocabulary match; otherwise the cell stays visibly unresolved.\n        Freehand, line, Bezier, and ellipse all use the same crossing compiler.\n",
);
await writeFile(indexPath, index);

const workflowPath = path.join(repoRoot, ".github", "workflows", "verify-graphscii-draw.yml");
let workflow = await readFile(workflowPath, "utf8");
workflow = workflow.replaceAll('draw-v6.js', 'draw-v7.js');
workflow = workflow.replaceAll('debug-export-v2.js', 'debug-export-v3.js');
workflow = workflow.replaceAll('GraphSCIIDrawV6', 'GraphSCIIDrawV7');
workflow = replaceOnce(
  workflow,
  "exact connector verification",
  `      - name: Verify exact font-port topology\n        run: |\n          node -e \"require('./graphscii-demo/draw-v7.js'); GraphSCIIDrawV7.selfTest(); console.log('GraphSCII v6 font-port topology self-test passed.')\"\n`,
  `      - name: Verify exact font-port topology\n        run: |\n          node -e \"require('./graphscii-demo/draw-v7.js'); GraphSCIIDrawV7.selfTest(); console.log('GraphSCII v7 font-port topology self-test passed.')\"\n\n      - name: Verify exact crossover resolution\n        shell: bash\n        run: |\n          node <<'NODE'\n          const fs = require('node:fs');\n          require('./graphscii-demo/draw-v7.js');\n          const index = JSON.parse(fs.readFileSync('artifacts/manifest/vocabulary-v1/indexes/by-bitmap.json', 'utf8'));\n          GraphSCIIDrawV7.installBitmapIndex(index.entries);\n          GraphSCIIDrawV7.connectorSelfTest();\n          console.log('Exact published connector lookup passed.');\n          NODE\n          grep -q 'resolveCellSegments' graphscii-demo/draw-v7.js\n          grep -q 'CONNECTOR_OWNER_MIN = 5796' graphscii-demo/draw-v7.js\n          grep -q 'CONNECTOR_OWNER_MAX = 6396' graphscii-demo/draw-v7.js\n          grep -q 'exact-bitmap-is-not-a-line-or-connector-glyph' graphscii-demo/draw-v7.js\n`,
);
workflow = workflow.replace(
  `draw-v5\\.js|debug-export-v1\\.js|draw-core-v3\\.js|draw-ui-v4\\.js|app\\.mjs|src=\"\\./app\\.js\"`,
  `draw-v5\\.js|draw-v6\\.js|debug-export-v1\\.js|debug-export-v2\\.js|draw-core-v3\\.js|draw-ui-v4\\.js|app\\.mjs|src=\"\\./app\\.js\"`,
);
await writeFile(workflowPath, workflow);

await rm(drawV6Path);
await rm(debugV2Path);

console.log('Created draw-v7 exact crossover resolver and debug-export-v3 from current main runtime.');
