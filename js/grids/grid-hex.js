/* =====================================================
   HEXAGON-RASTER
   Ein Hexagon wird als Teilmenge eines rechteckigen Punktrasters
   erzeugt: Reihen wachsen symmetrisch von 1 Punkt auf die volle
   Breite (Anzahl der "Schrägseiten"-Reihen = d), verharren dann für
   "Vertikalseiten" (v) Reihen auf voller Breite, und verjüngen sich
   danach spiegelbildlich wieder auf 1 Punkt. Für d=3, v=3 ergeben
   sich so die Reihenbreiten 1,3,5,5,5,3,1 — exakt das vom Nutzer
   vorgegebene Muster. Die King-Move-Nachbarschaft bleibt unverändert,
   zählt aber nur tatsächlich existierende (nicht weggeschnittene)
   Nachbarpunkte.
   ===================================================== */
import { clamp } from '../config.js';

export function buildHexGridDefinition(d, v) {
  const W = 2 * d - 1;                 // maximale Breite (mittlere Reihen)
  const topTaper = d;                  // Reihen, die von 1 auf W aufweiten (inkl. der Reihe mit Breite W)
  const midRows = v - 1;               // zusätzliche Reihen auf voller Breite W
  const bottomTaper = d - 1;           // Reihen, die spiegelbildlich wieder auf 1 verjüngen
  const totalRows = topTaper + midRows + bottomTaper;

  function rowWidth(r) {
    if (r < topTaper) return 2 * (r + 1) - 1;
    if (r < topTaper + midRows) return W;
    const idxFromEnd = totalRows - 1 - r;
    return 2 * (idxFromEnd + 1) - 1;
  }

  const VIEW = 320;
  const margin = 40;
  const maxDim = Math.max(W, totalRows);
  const spacing = maxDim === 1 ? 0 : (VIEW - 2 * margin) / (maxDim - 1);
  const gridWidthPx = (W - 1) * spacing;
  const gridHeightPx = (totalRows - 1) * spacing;
  const offsetX = margin + ((VIEW - 2 * margin) - gridWidthPx) / 2;
  const offsetY = margin + ((VIEW - 2 * margin) - gridHeightPx) / 2;

  const points = {};
  const coordToId = {};
  let id = 1;
  for (let r = 0; r < totalRows; r++) {
    const width = rowWidth(r);
    const colStart = (W - width) / 2; // horizontal zentriert unter der breitesten Reihe
    for (let i = 0; i < width; i++) {
      const c = colStart + i;
      points[id] = { x: offsetX + c * spacing, y: offsetY + r * spacing };
      coordToId[r + ',' + c] = id;
      id++;
    }
  }

  const adjacency = {};
  Object.keys(points).forEach(k => (adjacency[k] = []));
  for (let r = 0; r < totalRows; r++) {
    const width = rowWidth(r);
    const colStart = (W - width) / 2;
    for (let i = 0; i < width; i++) {
      const c = colStart + i;
      const vId = coordToId[r + ',' + c];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const key = (r + dr) + ',' + (c + dc);
          if (coordToId[key] !== undefined) {
            adjacency[vId].push(coordToId[key]);
          }
        }
      }
    }
  }

  const style = {
    rActive: clamp(9 - (maxDim - 3) * 0.85, 2.6, 9),
    rInactive: clamp(6 - (maxDim - 3) * 0.55, 1.8, 6),
    font: clamp(9 - (maxDim - 3) * 0.7, 3.6, 9),
    stroke: clamp(3 - (maxDim - 3) * 0.18, 1.1, 3)
  };

  return { shape: 'hex', d, v, cols: W, rows: totalRows, points, adjacency, style, spacing };
}
