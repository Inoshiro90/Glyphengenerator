/* =====================================================
   RASTER-ERZEUGUNG (RECHTECK/QUADRAT)
   Punkte werden auf einem cols×rows-Gitter angeordnet
   (auch nicht-quadratisch, z. B. 2×3, 4×6, 7×3). Zwei
   Punkte gelten als "im Umkreis" (verbindbar), wenn sie
   höchstens ein Feld waagerecht, senkrecht oder diagonal
   auseinanderliegen (King-Move-Nachbarschaft) — exakt das
   Muster aus der 3×3-Vorgabe (z. B. Punkt 5 verbindet
   sich mit allen 8 Nachbarn, Eckpunkte nur mit 3).
   ===================================================== */
import { clamp } from '../config.js';

export function buildGridDefinition(cols, rows) {
  const VIEW = 320;
  const margin = 40;
  const maxDim = Math.max(cols, rows);

  // Gleichmäßiger Punktabstand auf beiden Achsen (quadratische
  // Zellen), zentriert im Koordinatensystem — auch bei
  // rechteckigen Rastern wie 2×3 oder 7×3.
  const spacing = maxDim === 1 ? 0 : (VIEW - 2 * margin) / (maxDim - 1);
  const gridWidthPx = (cols - 1) * spacing;
  const gridHeightPx = (rows - 1) * spacing;
  const offsetX = margin + ((VIEW - 2 * margin) - gridWidthPx) / 2;
  const offsetY = margin + ((VIEW - 2 * margin) - gridHeightPx) / 2;

  const points = {};
  const coordToId = {};
  let id = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      points[id] = { x: offsetX + c * spacing, y: offsetY + r * spacing };
      coordToId[r + ',' + c] = id;
      id++;
    }
  }

  const adjacency = {};
  Object.keys(points).forEach(k => (adjacency[k] = []));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = coordToId[r + ',' + c];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            adjacency[v].push(coordToId[nr + ',' + nc]);
          }
        }
      }
    }
  }

  // Visuelle Feinjustierung je nach Rasterdichte (skaliert stufenlos
  // mit der größeren Kantenlänge, damit auch ungewöhnliche
  // benutzerdefinierte Größen wie 7×3 gut lesbar bleiben).
  const style = {
    rActive: clamp(9 - (maxDim - 3) * 0.85, 2.6, 9),
    rInactive: clamp(6 - (maxDim - 3) * 0.55, 1.8, 6),
    font: clamp(9 - (maxDim - 3) * 0.7, 3.6, 9),
    stroke: clamp(3 - (maxDim - 3) * 0.18, 1.1, 3)
  };

  return { shape: 'rect', cols, rows, points, adjacency, style, spacing };
}
