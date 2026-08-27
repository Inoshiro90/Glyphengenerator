/* =====================================================
   REGELMÄSSIGE VIELECKE (Fünfeck, Siebeneck, Achteck, Neuneck, Zehneck)
   Konzentrische, ähnliche N-Ecke ("Speichenrad"): Ring k (k=1..Ringe)
   besteht aus genau `sides` Punkten auf den Ecken eines regelmäßigen
   N-Ecks mit Radius ∝ k, alle auf denselben `sides` Winkeln (anders als
   beim Kreis-Raster, wo jeder Ring MEHR Punkte als der vorherige hat —
   hier bleibt die Eckenzahl über alle Ringe hinweg konstant, wodurch
   der äußerste Ring exakt die Silhouette eines echten N-Ecks bildet).
   Nachbarschaft: jeder Ring bildet einen geschlossenen N-Eck-Umriss
   (Kante zu den beiden Nachbar-Ecken im selben Ring), außerdem
   verbindet sich jede Ecke radial mit der winkelgleichen Ecke des
   nächst-inneren Rings (bzw. mit dem Zentrum bei Ring 1) — bei fester
   Eckenzahl pro Ring ist das immer eindeutig, keine Winkelsuche nötig.
   ===================================================== */
import { clamp } from '../config.js';

export function buildPolygonGridDefinition(shape, sides, rings) {
  const VIEW = 320;
  const margin = 40;
  const cx = VIEW / 2;
  const cy = VIEW / 2;
  const unit = rings === 0 ? 0 : (VIEW - 2 * margin) / 2 / rings;

  const points = {};
  const ringsById = {};
  let id = 1;
  for (let k = rings; k >= 1; k--) {
    const ringPts = [];
    for (let i = 0; i < sides; i++) {
      const angle = i * (2 * Math.PI / sides); // 0 = 12 Uhr, wächst im Uhrzeigersinn
      points[id] = { x: cx + unit * k * Math.sin(angle), y: cy - unit * k * Math.cos(angle) };
      ringPts.push({ id, angle });
      id++;
    }
    ringsById[k] = ringPts;
  }
  const centerId = id;
  points[centerId] = { x: cx, y: cy };

  const adjacency = {};
  Object.keys(points).forEach(k => (adjacency[k] = []));
  function addEdge(a, b) {
    if (!adjacency[a].includes(b)) adjacency[a].push(b);
    if (!adjacency[b].includes(a)) adjacency[b].push(a);
  }

  // Umriss jedes Rings: geschlossenes N-Eck aus den `sides` Ecken.
  for (let k = rings; k >= 1; k--) {
    const ringPts = ringsById[k];
    for (let i = 0; i < sides; i++) addEdge(ringPts[i].id, ringPts[(i + 1) % sides].id);
  }
  // Radiale Speichen: gleicher Eckenindex, ein Ring weiter innen.
  for (let k = rings; k >= 2; k--) {
    for (let i = 0; i < sides; i++) addEdge(ringsById[k][i].id, ringsById[k - 1][i].id);
  }
  if (rings >= 1) {
    for (let i = 0; i < sides; i++) addEdge(ringsById[1][i].id, centerId);
  }

  const maxDim = 2 * rings + 1;
  const style = {
    rActive: clamp(9 - (maxDim - 3) * 0.85, 2.6, 9),
    rInactive: clamp(6 - (maxDim - 3) * 0.55, 1.8, 6),
    font: clamp(9 - (maxDim - 3) * 0.7, 3.6, 9),
    stroke: clamp(3 - (maxDim - 3) * 0.18, 1.1, 3)
  };

  return { shape, sides, n: rings, cols: maxDim, rows: maxDim, points, adjacency, style, spacing: unit };
}

export function buildPentagonGridDefinition(rings) { return buildPolygonGridDefinition('pentagon', 5, rings); }
export function buildHeptagonGridDefinition(rings) { return buildPolygonGridDefinition('heptagon', 7, rings); }
export function buildOctagonGridDefinition(rings) { return buildPolygonGridDefinition('octagon', 8, rings); }
export function buildNonagonGridDefinition(rings) { return buildPolygonGridDefinition('nonagon', 9, rings); }
export function buildDecagonGridDefinition(rings) { return buildPolygonGridDefinition('decagon', 10, rings); }
