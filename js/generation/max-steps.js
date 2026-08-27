/* =====================================================
   MAXIMALE SCHRITTZAHL
   Längster "Trail" (Kantenzug ohne Kantenwiederholung,
   Punkte dürfen mehrfach besucht werden).

   - Kleine Raster (3×3, ≤26 Kanten): exakte Lösung per
     Memoisation über (Knoten, Kanten-Bitmaske).
   - Größere Raster (4×4, 5×5): eine erschöpfende exakte
     Suche ist praktisch nicht mehr berechenbar (>2^40
     Zustände). Stattdessen wird per zeitlich begrenzter,
     wiederholt neu gestarteter Tiefensuche der längste
     tatsächlich gefundene Trail ermittelt — ein sehr
     nah am echten Optimum liegender, klar gekennzeichneter
     Näherungswert.
   ===================================================== */
import { EXACT_EDGE_LIMIT, MAX_STEPS_TIME_BUDGET } from '../config.js';
import { shuffle } from '../graph.js';
import { passesConstraints, vcAdd, vcRemove } from '../constraints.js';

export function exactLongestTrail(graph) {
  const memo = new Map();
  const MULT = 1 << 27;

  function rec(vertex, mask) {
    const key = vertex * MULT + mask;
    if (memo.has(key)) return memo.get(key);
    let best = 0;
    for (const { edgeId, to } of graph.byVertex[vertex]) {
      const bit = 1 << edgeId;
      if (!(mask & bit)) {
        const val = 1 + rec(to, mask | bit);
        if (val > best) best = val;
      }
    }
    memo.set(key, best);
    return best;
  }

  let max = 0;
  graph.vertices.forEach(v => {
    const val = rec(v, 0);
    if (val > max) max = val;
  });
  return max;
}

export function approxLongestTrail(graph, grid, constraints, timeBudgetMs) {
  const deadline = Date.now() + timeBudgetMs;
  const usedEdges = new Array(graph.edges.length).fill(false);
  let bestLen = 0, calls = 0, stop = false;

  function dfs(vertex, depth, usedVertexCount, usedSegments) {
    calls++;
    if ((calls & 511) === 0 && Date.now() > deadline) { stop = true; return; }
    if (depth > bestLen) bestLen = depth;
    const rawOptions = graph.byVertex[vertex].filter(o => !usedEdges[o.edgeId]);
    const options = shuffle(rawOptions).filter(opt => passesConstraints(vertex, opt, grid, constraints, usedVertexCount, usedSegments));
    for (const opt of options) {
      if (stop) return;
      usedEdges[opt.edgeId] = true;
      vcAdd(usedVertexCount, opt.to);
      usedSegments.push([grid.points[vertex], grid.points[opt.to]]);
      dfs(opt.to, depth + 1, usedVertexCount, usedSegments);
      usedSegments.pop();
      vcRemove(usedVertexCount, opt.to);
      usedEdges[opt.edgeId] = false;
      if (stop) return;
    }
  }

  while (!stop && Date.now() < deadline) {
    usedEdges.fill(false);
    const start = graph.vertices[Math.floor(Math.random() * graph.vertices.length)];
    const usedVertexCount = new Map();
    vcAdd(usedVertexCount, start);
    dfs(start, 0, usedVertexCount, []);
  }
  return bestLen;
}

// Wie approxLongestTrail, aber für den Ast-Modus: statt einer
// durchgehenden Linie wächst hier ein Baum (jeder neue Punkt hängt
// sich an einen beliebigen bereits benutzten Punkt an).
export function approxLongestTree(graph, grid, constraints, timeBudgetMs) {
  const deadline = Date.now() + timeBudgetMs;
  const usedEdges = new Array(graph.edges.length).fill(false);
  let bestLen = 0, calls = 0, stop = false;

  function grow(usedVertices, usedSegments, size) {
    calls++;
    if ((calls & 511) === 0 && Date.now() > deadline) { stop = true; return; }
    if (size > bestLen) bestLen = size;
    const frontier = shuffle(Array.from(usedVertices));
    for (const u of frontier) {
      if (stop) return;
      const rawOptions = graph.byVertex[u].filter(o => !usedEdges[o.edgeId] && !usedVertices.has(o.to));
      const options = shuffle(rawOptions).filter(opt => passesConstraints(u, opt, grid, constraints, usedVertices, usedSegments));
      for (const opt of options) {
        if (stop) return;
        usedEdges[opt.edgeId] = true;
        usedVertices.add(opt.to);
        usedSegments.push([grid.points[u], grid.points[opt.to]]);
        grow(usedVertices, usedSegments, size + 1);
        usedSegments.pop();
        usedVertices.delete(opt.to);
        usedEdges[opt.edgeId] = false;
        if (stop) return;
      }
    }
  }

  while (!stop && Date.now() < deadline) {
    usedEdges.fill(false);
    const start = graph.vertices[Math.floor(Math.random() * graph.vertices.length)];
    grow(new Set([start]), [], 0);
  }
  return bestLen;
}

export function computeMaxSteps(graph, grid, constraints) {
  if (constraints.treeMode) {
    return { value: approxLongestTree(graph, grid, constraints, MAX_STEPS_TIME_BUDGET), exact: false };
  }
  const advanced = constraints.avoidCrossing || constraints.avoidPointReuse || constraints.avoidConcentration;
  if (!advanced && graph.edges.length <= EXACT_EDGE_LIMIT) {
    return { value: exactLongestTrail(graph), exact: true };
  }
  return { value: approxLongestTrail(graph, grid, constraints, MAX_STEPS_TIME_BUDGET), exact: false };
}
