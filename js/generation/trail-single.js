/* =====================================================
   ZUFÄLLIGE GLYPHEN-ERZEUGUNG
   Echtes Backtracking: An jedem Punkt wird zufällig unter
   den noch unbenutzten Nachbarstrecken gewählt; führt eine
   Wahl in eine Sackgasse, wird zurückgesprungen (Backtrack)
   und die nächste Option probiert. Ein Kanten-Budget
   verhindert ein Hängenbleiben bei sehr großen Rastern.
   ===================================================== */
import { GENERATION_RETRIES, GENERATION_NODE_BUDGET } from '../config.js';
import { shuffle } from '../graph.js';
import { passesConstraints, vcAdd, vcRemove } from '../constraints.js';

export function generateSingleTrail(target, graph, grid, constraints, nodeBudget) {
  const usedEdges = new Array(graph.edges.length).fill(false);
  let budget = nodeBudget;

  function dfs(vertex, path, usedVertexCount, usedSegments) {
    budget--;
    if (budget <= 0) return false;
    if (path.length - 1 === target) return true;
    const rawOptions = graph.byVertex[vertex].filter(o => !usedEdges[o.edgeId]);
    const options = shuffle(rawOptions).filter(opt => passesConstraints(vertex, opt, grid, constraints, usedVertexCount, usedSegments));
    for (const opt of options) {
      usedEdges[opt.edgeId] = true;
      path.push(opt.to);
      vcAdd(usedVertexCount, opt.to);
      usedSegments.push([grid.points[vertex], grid.points[opt.to]]);
      if (dfs(opt.to, path, usedVertexCount, usedSegments)) return true;
      usedSegments.pop();
      vcRemove(usedVertexCount, opt.to);
      path.pop();
      usedEdges[opt.edgeId] = false;
      if (budget <= 0) return false;
    }
    return false;
  }

  const starts = shuffle(graph.vertices.slice());
  for (const start of starts) {
    usedEdges.fill(false);
    const path = [start];
    const usedVertexCount = new Map();
    vcAdd(usedVertexCount, start);
    if (dfs(start, path, usedVertexCount, [])) return path;
    if (budget <= 0) break;
  }
  return null;
}

export function generateWithRetries(target, graph, grid, constraints) {
  for (let i = 0; i < GENERATION_RETRIES; i++) {
    const path = generateSingleTrail(target, graph, grid, constraints, GENERATION_NODE_BUDGET);
    if (path) return path;
  }
  return null;
}
