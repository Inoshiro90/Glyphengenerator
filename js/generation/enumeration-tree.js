/* =====================================================
   ALLE KOMBINATIONEN — Ast-Modus (kanonische Baum-Enumeration)
   Ein Baum ist nur eine MENGE von Kanten, keine Reihenfolge —
   anders als bei einem Trail gibt es also keine "natürliche"
   Konstruktionsreihenfolge, die Duplikate automatisch ausschließt.
   generateTree() darf an jedem bereits benutzten Punkt weiter-
   wachsen; ohne Gegenmaßnahme würde derselbe Baum über viele
   verschiedene Bau-Reihenfolgen mehrfach gefunden.

   Zwei Regeln erzwingen stattdessen, dass jeder Baum GENAU EINMAL
   entsteht (Standardtechnik aus der Subgraph-Enumeration, siehe
   ESU/Wernicke-Algorithmus):

   1. Startpunkt-Kanonisierung: ein Durchlauf mit Startpunkt `minRoot`
      darf niemals einen Punkt mit kleinerer Nummer als `minRoot`
      aufnehmen. Dadurch kann ein Baum nur von genau EINEM
      Startpunkt aus rekonstruiert werden — seinem punktweise
      kleinsten Mitglied.
   2. Fester Wachstumspunkt + einmalige Entscheidung: es wächst
      immer nur der punktweise KLEINSTE noch offene (unentschiedene)
      Punkt weiter. Für dessen Kandidaten wird in fester Reihenfolge
      je EINMAL "anhängen" oder "überspringen" entschieden (Teilmengen-
      Erzeugung) — sobald alle Kandidaten entschieden sind, gilt der
      Punkt als endgültig geschlossen (`closed`) und wird nie wieder
      aufgegriffen. Ohne dieses "closed"-Gedächtnis würde derselbe
      Punkt beim nächsten Aufruf erneut als offen erkannt, was zu
      einer Endlosschleife führen würde.
   ===================================================== */
import { ENUM_NODE_SAFETY_CEILING } from '../config.js';
import { passesConstraints } from '../constraints.js';

export function createTreeEnumerationSession(graph, grid, constraints, target) {
  let nodeCount = 0;
  let stoppedBySafety = false;

  function* extend(usedVertices, edges, minRoot, closed) {
    nodeCount++;
    if (nodeCount > ENUM_NODE_SAFETY_CEILING) { stoppedBySafety = true; return; }
    if (edges.length === target) { yield edges.map(e => ({ from: e.from, to: e.to })); return; }

    const sortedUsed = Array.from(usedVertices).sort((a, b) => a - b);
    let u = null, candidates = null;
    for (const v of sortedUsed) {
      if (closed.has(v)) continue;
      const cands = graph.byVertex[v]
        .map(o => o.to)
        .filter(w => w >= minRoot && !usedVertices.has(w))
        .sort((a, b) => a - b);
      if (cands.length > 0) { u = v; candidates = cands; break; }
    }
    if (u === null) return; // Sackgasse — Zielgröße von hier aus nicht erreichbar

    closed.add(u);
    yield* decide(u, candidates, 0, usedVertices, edges, minRoot, closed);
    closed.delete(u); // Backtrack: in einem anderen Zweig darf u erneut offen sein
  }

  function* decide(u, candidates, idx, usedVertices, edges, minRoot, closed) {
    if (stoppedBySafety) return;
    if (edges.length === target) { yield edges.map(e => ({ from: e.from, to: e.to })); return; }
    if (idx >= candidates.length) {
      yield* extend(usedVertices, edges, minRoot, closed);
      return;
    }
    const w = candidates[idx];

    // Option A: w NICHT an u anhängen
    yield* decide(u, candidates, idx + 1, usedVertices, edges, minRoot, closed);
    if (stoppedBySafety) return;

    // Option B: w an u anhängen — Gültigkeit wird frisch geprüft, da
    // Kreuzungs-/Konzentrationsregeln vom bisherigen Baum abhängen.
    if (!usedVertices.has(w)) {
      const usedSegments = edges.map(e => [grid.points[e.from], grid.points[e.to]]);
      if (passesConstraints(u, { to: w }, grid, constraints, usedVertices, usedSegments)) {
        usedVertices.add(w);
        edges.push({ from: u, to: w });
        yield* decide(u, candidates, idx + 1, usedVertices, edges, minRoot, closed);
        edges.pop();
        usedVertices.delete(w);
      }
    }
  }

  function* fullGenerator() {
    for (const start of graph.vertices) {
      if (stoppedBySafety) return;
      yield* extend(new Set([start]), [], start, new Set());
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
