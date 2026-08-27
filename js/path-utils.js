/* =====================================================
   Kleine geteilte Helfer rund um Pfade/Distanzen, die von
   Generierung, Rendering und Export gleichermaßen genutzt
   werden.
   ===================================================== */

export function dist(p1, p2) { return Math.hypot(p1.x - p2.x, p1.y - p2.y); }

export function pathToEdges(path) {
  const edges = [];
  for (let i = 1; i < path.length; i++) edges.push({ from: path[i - 1], to: path[i] });
  return edges;
}
