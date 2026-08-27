/* =====================================================
   ALLE KOMBINATIONEN (ohne Duplikate) — Lazy Generation
   Statt vorab ein Array mit einer harten Obergrenze zu
   füllen, liefert ein JS-Generator (`function*`) jede
   gültige Punktfolge erst dann, wenn sie tatsächlich
   angefordert wird ("Pull statt Push"). So wird nie mehr
   berechnet als die Oberfläche gerade anzeigen will.

   createEnumerationSession(...) baut den Generator auf.
   session.pullBatch(count, timeSliceMs, onBatch) holt die
   nächsten `count` Treffer, rechnet dabei aber nie länger
   als `timeSliceMs` am Stück — reicht die Zeit nicht,
   wird die Arbeit über setTimeout(...,0) auf den nächsten
   Tick verteilt, sodass der Main-Thread nie blockiert.

   Eine sehr hohe Knoten-Sicherheitsgrenze (nicht die
   Ergebnisanzahl!) fängt nur pathologische Fälle ab, in
   denen gültige Treffer extrem selten sind.
   ===================================================== */
import { ENUM_NODE_SAFETY_CEILING } from '../config.js';
import { passesConstraints, vcAdd, vcRemove } from '../constraints.js';

export function createEnumerationSession(graph, grid, constraints, target) {
  let nodeCount = 0;
  let stoppedBySafety = false;
  const usedEdges = new Array(graph.edges.length).fill(false);

  function* dfs(vertex, path, usedVertexCount, usedSegments) {
    nodeCount++;
    if (nodeCount > ENUM_NODE_SAFETY_CEILING) { stoppedBySafety = true; return; }
    if (path.length - 1 === target) {
      yield path.slice();
      return;
    }
    for (const opt of graph.byVertex[vertex]) {
      if (stoppedBySafety) return;
      if (!usedEdges[opt.edgeId] && passesConstraints(vertex, opt, grid, constraints, usedVertexCount, usedSegments)) {
        usedEdges[opt.edgeId] = true;
        vcAdd(usedVertexCount, opt.to);
        usedSegments.push([grid.points[vertex], grid.points[opt.to]]);
        path.push(opt.to);
        yield* dfs(opt.to, path, usedVertexCount, usedSegments);
        path.pop();
        usedSegments.pop();
        vcRemove(usedVertexCount, opt.to);
        usedEdges[opt.edgeId] = false;
        if (stoppedBySafety) return;
      }
    }
  }

  function* fullGenerator() {
    for (const start of graph.vertices) {
      if (stoppedBySafety) return;
      const usedVertexCount = new Map();
      vcAdd(usedVertexCount, start);
      yield* dfs(start, [start], usedVertexCount, []);
    }
  }

  const iterator = fullGenerator();

  return {
    pullBatch(count, timeSliceMs, onBatch) {
      const results = [];
      let done = false;

      function step() {
        const deadline = Date.now() + timeSliceMs;
        while (results.length < count) {
          const { value, done: genDone } = iterator.next();
          if (genDone) { done = true; break; }
          results.push(value);
          if (Date.now() > deadline) break;
        }
        if (results.length >= count || done || stoppedBySafety) {
          // WICHTIG: onBatch immer asynchron aufrufen (auch wenn der Batch
          // sofort fertig ist). Riefe ein Aufrufer von hier aus direkt
          // synchron den nächsten Batch ab, würde der native Call-Stack
          // bei sehr vielen schnellen Batches unbegrenzt anwachsen — durch
          // setTimeout(...,0) wird die Kette nach jedem Batch garantiert
          // zurückgesetzt.
          setTimeout(() => onBatch(results, { done: done || stoppedBySafety, stoppedBySafety }), 0);
        } else {
          setTimeout(step, 0);
        }
      }
      step();
    }
  };
}
