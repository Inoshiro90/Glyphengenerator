/* =====================================================
   GRAPH-AUFBEREITUNG
   Aus der Nachbarschaftsliste werden eindeutige,
   ungerichtete Kanten erzeugt (jede Strecke bekommt eine
   feste ID → verhindert Doppelbelegung). Verbotene Punkte
   (forbiddenSet) werden komplett aus dem nutzbaren Graphen
   entfernt: keine Strecke darf von ihnen ausgehen oder bei
   ihnen enden. grid.points bleibt vollständig erhalten,
   damit verbotene Punkte trotzdem gezeichnet werden können.
   ===================================================== */

export function buildGraph(grid, forbiddenSet) {
  forbiddenSet = forbiddenSet || new Set();
  const allVertices = Object.keys(grid.points).map(Number);
  const vertices = allVertices.filter(v => !forbiddenSet.has(v));
  const edges = [];
  const byVertex = {};
  vertices.forEach(v => (byVertex[v] = []));

  vertices.forEach(v => {
    grid.adjacency[v].forEach(w => {
      if (forbiddenSet.has(w)) return;
      if (v < w) {
        const id = edges.length;
        edges.push({ id, a: v, b: w });
        byVertex[v].push({ edgeId: id, to: w });
        byVertex[w].push({ edgeId: id, to: v });
      }
    });
  });

  return { vertices, edges, byVertex, allVertices, forbiddenSet };
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
