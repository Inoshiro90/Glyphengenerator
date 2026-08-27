/* =====================================================
   MEHRERE ELEMENTE
   Statt eines einzelnen Elements entstehen `count` getrennte,
   unverbundene Elemente, die sich gemeinsam den Punktevorrat
   `total` teilen — kein Punkt taucht in mehr als einem Element
   auf. Jedes Element bekommt dabei zwischen `min` und `max`
   Punkten zugewiesen.

   Kombinierbar mit Ast-Generierung: ist `constraints.treeMode`
   zusätzlich aktiv, ist jedes einzelne Element selbst ein
   verzweigender Ast (statt einer einfachen Linie) — die beiden
   Modi schließen sich technisch nicht aus, da "mehrere Elemente"
   nur regelt, WIE VIELE getrennte Teilgraphen entstehen und wie
   sie sich den Punktevorrat teilen, während "Ast-Generierung"
   nur regelt, WIE ein einzelner Teilgraph intern aufgebaut wird
   (Linie vs. verzweigender Baum).

   Ablauf pro Versuch:
   1. distributeSizes(...) verteilt `total` Punkte auf `count`
      Elemente: jedes Element bekommt zunächst unabhängig eine
      ZUFÄLLIG gewürfelte Größe irgendwo zwischen `min` und `max`
      (nicht nur `min` plus ein paar Reste) — das sorgt für spürbare
      Varianz zwischen den Elementen, statt dass fast alle nahe am
      Durchschnitt landen. Die Summe dieser Würfe trifft `total`
      i. d. R. nicht exakt; die Differenz wird danach Punkt für Punkt
      auf zufällig gewählte Elemente verteilt (unter Einhaltung von
      `min`/`max`), bis die Gesamtzahl exakt erreicht ist — das ist
      die abschließende Prüfung, dass wirklich alle Punkte verteilt
      wurden. Ist die Checkbox "Möglichst gleichmäßige Verteilung"
      aktiv, wird stattdessen distributeSizesBalanced(...) verwendet.
   2. Für jede Elementgröße wird — in zufälliger Reihenfolge —
      ein einfacher Pfad ODER ein Baum (je nach Ast-Generierung)
      exakt dieser Punktzahl gesucht, wobei bereits von früheren
      Elementen belegte Punkte (`globalUsed`) komplett als
      Kandidaten ausscheiden (kein Punkt wird zwischen Elementen
      geteilt).

   Schlägt ein Element fehl (z. B. weil die verbleibenden freien
   Punkte keinen zusammenhängenden Teilgraphen dieser Größe mehr
   hergeben), wird der gesamte Versuch verworfen und neu
   gestartet (MULTI_RETRIES) — mit frischer Größenverteilung und
   frischer Zufallsreihenfolge.
   ===================================================== */
import { MULTI_NODE_BUDGET_PER_ELEMENT, MULTI_RETRIES } from '../config.js';
import { shuffle } from '../graph.js';
import { passesConstraints, vcAdd, vcRemove } from '../constraints.js';
import { pathToEdges } from '../path-utils.js';

export function distributeSizes(total, count, min, max, balanced) {
  if (count * min > total || total > count * max) return null;
  return balanced
    ? distributeSizesBalanced(total, count, min, max)
    : distributeSizesRandom(total, count, min, max);
}

// Würfelt für jedes Element unabhängig eine Größe zwischen `min` und
// `max` (Gleichverteilung über die volle Spanne — das ist der
// eigentliche Grund für Varianz, im Gegensatz zu einem Start bei
// `min` für alle Elemente). Die Summe der Würfe weicht von `total`
// i. d. R. ab; die Differenz wird anschließend Punkt für Punkt auf
// zufällig gewählte, noch nicht ausgeschöpfte Elemente verteilt
// (aufstocken bei zu wenig, kürzen bei zu viel), bis exakt `total`
// erreicht ist. Durch `count*min<=total<=count*max` (bereits oben
// geprüft) ist dieser letzte Schritt immer lösbar — im äußersten
// Fall bei "alle auf min" bzw. "alle auf max".
export function distributeSizesRandom(total, count, min, max) {
  const sizes = new Array(count);
  for (let i = 0; i < count; i++) {
    sizes[i] = min + Math.floor(Math.random() * (max - min + 1));
  }
  let diff = total - sizes.reduce((sum, s) => sum + s, 0);
  while (diff !== 0) {
    const candidates = [];
    for (let i = 0; i < count; i++) {
      if (diff > 0 && sizes[i] < max) candidates.push(i);
      else if (diff < 0 && sizes[i] > min) candidates.push(i);
    }
    if (candidates.length === 0) return null; // kann bei eingehaltener Vorbedingung nicht auftreten
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    if (diff > 0) { sizes[idx]++; diff--; } else { sizes[idx]--; diff++; }
  }
  return sizes;
}

// Verteilt `total` möglichst gleichmäßig auf `count` Elemente: alle
// bekommen ⌊total÷count⌋, der Rest (`total mod count`) wird einzeln
// (je +1) auf eine zufällig ausgeloste Teilmenge der Elemente verteilt
// — bewusst kein deterministisches "die ersten N Elemente", damit bei
// wiederholter Generierung nicht immer dieselben Elemente die
// "Extra-Punkte" bekommen.
export function distributeSizesBalanced(total, count, min, max) {
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  const sizes = new Array(count).fill(base);
  const order = shuffle(Array.from({ length: count }, (_, i) => i));
  for (let i = 0; i < remainder; i++) sizes[order[i]]++;
  return sizes;
}

// Sucht einen einfachen Pfad (keine Punktwiederholung) mit genau
// `targetPoints` Punkten, dessen Punkte allesamt außerhalb von
// `globalUsed` liegen (von anderen Elementen bereits belegte Punkte).
// Baugleich zu generateSingleTrail, aber mit zusätzlichem Ausschluss-
// Filter und punktbasiertem statt kantenbasiertem Ziel.
export function generateElementPath(targetPoints, graph, grid, constraints, globalUsed, nodeBudget) {
  const targetEdges = targetPoints - 1;
  let budget = nodeBudget;
  const usedEdges = new Array(graph.edges.length).fill(false);

  function dfs(vertex, path, usedVertexCount, usedSegments) {
    budget--;
    if (budget <= 0) return false;
    if (path.length - 1 === targetEdges) return true;
    const rawOptions = graph.byVertex[vertex].filter(o => !usedEdges[o.edgeId] && !globalUsed.has(o.to));
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

  const starts = shuffle(graph.vertices.filter(v => !globalUsed.has(v)));
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

// Sucht einen verzweigenden Baum (kein Punkt kommt mehrfach vor,
// Wachstum an einem BELIEBIGEN bereits im Baum enthaltenen Punkt)
// mit genau `targetPoints` Punkten, dessen Punkte allesamt außerhalb
// von `globalUsed` liegen. Baugleich zu generateTree, aber mit
// zusätzlichem Ausschluss-Filter und eigenem Punktebudget statt der
// globalen GENERATION_NODE_BUDGET-Konstante.
export function generateElementTree(targetPoints, graph, grid, constraints, globalUsed, nodeBudget) {
  const targetEdges = targetPoints - 1;
  let budget = nodeBudget;
  const usedEdges = new Array(graph.edges.length).fill(false);

  function tryGrow(remaining, usedVertices, usedSegments, edges) {
    budget--;
    if (budget <= 0) return false;
    if (remaining === 0) return true;
    const frontier = shuffle(Array.from(usedVertices));
    for (const u of frontier) {
      const rawOptions = graph.byVertex[u].filter(o => !usedEdges[o.edgeId] && !usedVertices.has(o.to) && !globalUsed.has(o.to));
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

  const starts = shuffle(graph.vertices.filter(v => !globalUsed.has(v)));
  for (const start of starts) {
    usedEdges.fill(false);
    const usedVertices = new Set([start]);
    const edges = [];
    if (tryGrow(targetEdges, usedVertices, [], edges)) return { root: start, edges, vertices: Array.from(usedVertices) };
    if (budget <= 0) break;
  }
  return null;
}

export function generateMultiElements(config, graph, grid, constraints) {
  const sizes = distributeSizes(config.total, config.count, config.min, config.max, constraints.multiBalanced);
  if (!sizes) return null;
  const order = shuffle(sizes.slice());
  const globalUsed = new Set();
  const elements = [];
  for (const size of order) {
    let element;
    if (constraints.treeMode) {
      const tree = generateElementTree(size, graph, grid, constraints, globalUsed, MULTI_NODE_BUDGET_PER_ELEMENT);
      if (!tree) return null;
      element = { root: tree.root, edges: tree.edges, points: tree.vertices };
    } else {
      const path = generateElementPath(size, graph, grid, constraints, globalUsed, MULTI_NODE_BUDGET_PER_ELEMENT);
      if (!path) return null;
      element = { root: path[0], edges: pathToEdges(path), points: path };
    }
    element.points.forEach(v => globalUsed.add(v));
    elements.push(element);
  }
  return { elements };
}

export function generateMultiWithRetries(config, graph, grid, constraints) {
  for (let i = 0; i < MULTI_RETRIES; i++) {
    const result = generateMultiElements(config, graph, grid, constraints);
    if (result) return result;
  }
  return null;
}
