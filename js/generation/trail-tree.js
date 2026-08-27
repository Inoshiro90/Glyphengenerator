/* =====================================================
   AST-GENERIERUNG
   Statt einer durchgehenden Linie wird ein Baum erzeugt:
   jeder neue Punkt wird an einen BELIEBIGEN bereits im
   Baum enthaltenen Punkt angehängt (nicht zwingend an das
   zuletzt hinzugefügte Ende). Da jeder Punkt höchstens
   einmal vorkommt, entstehen durch Konstruktion garantiert
   keine Zyklen bzw. Rückverbindungen — echte, frei
   verzweigende Äste.
   ===================================================== */
import { GENERATION_RETRIES, GENERATION_NODE_BUDGET } from '../config.js';
import { shuffle } from '../graph.js';
import { passesConstraints } from '../constraints.js';

export function generateTree(target, graph, grid, constraints, nodeBudget) {
  let budget = nodeBudget;
  const usedEdges = new Array(graph.edges.length).fill(false);

  function tryGrow(remaining, usedVertices, usedSegments, edges) {
    budget--;
    if (budget <= 0) return false;
    if (remaining === 0) return true;
    const frontier = shuffle(Array.from(usedVertices));
    for (const u of frontier) {
      const rawOptions = graph.byVertex[u].filter(o => !usedEdges[o.edgeId] && !usedVertices.has(o.to));
      const options = shuffle(rawOptions).filter(opt => passesConstraints(u, opt, grid, constraints, usedVertices, usedSegments));
      for (const opt of options) {
        usedEdges[opt.edgeId] = true;
        usedVertices.add(opt.to);
        usedSegments.push([grid.points[u], grid.points[opt.to]]);
        edges.push({ from: u, to: opt.to });
        if (tryGrow(remaining - 1, usedVertices, usedSegments, edges)) return true;
        edges.pop();
        usedSegments.pop();
        usedVertices.delete(opt.to);
        usedEdges[opt.edgeId] = false;
        if (budget <= 0) return false;
      }
    }
    return false;
  }

  const starts = shuffle(graph.vertices.slice());
  for (const start of starts) {
    usedEdges.fill(false);
    const usedVertices = new Set([start]);
    const edges = [];
    if (tryGrow(target, usedVertices, [], edges)) return { root: start, edges };
    if (budget <= 0) break;
  }
  return null;
}

export function generateTreeWithRetries(target, graph, grid, constraints) {
  for (let i = 0; i < GENERATION_RETRIES; i++) {
    const tree = generateTree(target, graph, grid, constraints, GENERATION_NODE_BUDGET);
    if (tree) return tree;
  }
  return null;
}
