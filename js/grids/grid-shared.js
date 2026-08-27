/* =====================================================
   Gemeinsamer Helper für zeilenweise verjüngte/erweiterte Raster
   (Dreieck, Raute, Trapez): jede Reihe hat eine über `rowWidthFn(r)`
   bestimmte Breite und ist zentriert unter derselben Spalte
   platziert. King-Move-Nachbarschaft, existenzgeprüft.
   ===================================================== */
import { clamp } from '../config.js';

export function buildTaperedRowGridDefinition(shape, height, maxDim, rowWidthFn, extraProps) {
  const VIEW = 320;
  const margin = 40;
  const spacing = maxDim === 1 ? 0 : (VIEW - 2 * margin) / (maxDim - 1);
  const gridHeightPx = (height - 1) * spacing;
  const offsetX = margin + (VIEW - 2 * margin) / 2; // zentrierte Spalte bleibt bei 0
  const offsetY = margin + ((VIEW - 2 * margin) - gridHeightPx) / 2;

  const points = {};
  const coordToId = {};
  let id = 1;
  for (let r = 0; r < height; r++) {
    const w = rowWidthFn(r);
    const colStart = -(w - 1) / 2;
    for (let i = 0; i < w; i++) {
      const c = colStart + i;
      points[id] = { x: offsetX + c * spacing, y: offsetY + r * spacing };
      coordToId[r + ',' + c] = id;
      id++;
    }
  }

  const adjacency = {};
  Object.keys(points).forEach(k => (adjacency[k] = []));
  for (let r = 0; r < height; r++) {
    const w = rowWidthFn(r);
    const colStart = -(w - 1) / 2;
    for (let i = 0; i < w; i++) {
      const c = colStart + i;
      const vId = coordToId[r + ',' + c];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const key = (r + dr) + ',' + (c + dc);
          if (coordToId[key] !== undefined) adjacency[vId].push(coordToId[key]);
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

  return Object.assign({ shape, height, points, adjacency, style, spacing }, extraProps);
}
