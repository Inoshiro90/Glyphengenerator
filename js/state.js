/* =====================================================
   STATE
   Zentraler, veränderlicher Zustand der Anwendung. Als
   Eigenschaften eines einzelnen Objekts modelliert, damit
   andere Module den aktuellen Wert lesen UND (über
   Eigenschafts-Zuweisung) verändern können — ein direkter
   `export let`-Reexport wäre für Konsumenten nicht
   zuweisbar.
   ===================================================== */
import { buildGridDefinition } from './grids/index.js';
import { buildGraph } from './graph.js';

export const state = {
  currentGrid: buildGridDefinition(3, 3),
  currentGraph: null,
  currentMaxInfo: { value: 0, exact: true },

  // Zustand der laufenden "Alle Kombinationen"-Lazy-Loading-Sitzung.
  currentEnumSession: null,
  enumSessionCounter: 0,
  combosObserver: null,

  // Zustand der aktuell angezeigten Einzelglyphe, für den Export.
  currentSingleResult: null
};
state.currentGraph = buildGraph(state.currentGrid, new Set());

export function invalidateEnumSession() {
  if (state.combosObserver) { state.combosObserver.disconnect(); state.combosObserver = null; }
  state.currentEnumSession = null;
}
