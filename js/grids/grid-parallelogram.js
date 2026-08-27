/* =====================================================
   PARALLELOGRAMM-RASTER
   Jede Reihe hat konstant `sideLength` Punkte (anders als bei
   Dreieck/Trapez ändert sich die Reihenbreite nicht) — stattdessen
   verschiebt sich die START-Spalte jeder Reihe kumulativ um
   `offset` relativ zur vorherigen Reihe: Reihe r beginnt bei
   Spalte r×offset. Ein Versatz von -1 schiebt jede Reihe einen
   Punkt nach links, +2 schiebt zwei Punkte nach rechts — jeweils
   aufsummiert über alle vorherigen Reihen, nicht nur einmalig.
   Gegen zwei Referenzfotos verifiziert (Seitenlänge 4, Höhe 3,
   Versatz -1 bzw. -2). King-Move-Nachbarschaft wie bei allen
   anderen Rastern, existenzgeprüft.
   ===================================================== */
import { clamp } from '../config.js';

export function buildParallelogramGridDefinition(sideLength, height, offset) {
  let minCol = Infinity, maxCol = -Infinity;
  for (let r = 0; r < height; r++) {
    const start = r * offset;
    minCol = Math.min(minCol, start);
    maxCol = Math.max(maxCol, start + sideLength - 1);
  }
  const totalCols = maxCol - minCol + 1;

  const VIEW = 320;
  const margin = 40;
  const maxDim = Math.max(totalCols, height);
  const spacing = maxDim === 1 ? 0 : (VIEW - 2 * margin) / (maxDim - 1);
  const gridWidthPx = (totalCols - 1) * spacing;
  const gridHeightPx = (height - 1) * spacing;
  const offsetX = margin + ((VIEW - 2 * margin) - gridWidthPx) / 2;
  const offsetY = margin + ((VIEW - 2 * margin) - gridHeightPx) / 2;

  const points = {};
  const coordToId = {};
  let id = 1;
  for (let r = 0; r < height; r++) {
    const rowStart = r * offset - minCol;
    for (let i = 0; i < sideLength; i++) {
      const c = rowStart + i;
      points[id] = { x: offsetX + c * spacing, y: offsetY + r * spacing };
      coordToId[r + ',' + c] = id;
      id++;
    }
  }

  const adjacency = {};
  Object.keys(points).forEach(k => (adjacency[k] = []));
  for (let r = 0; r < height; r++) {
    const rowStart = r * offset - minCol;
    for (let i = 0; i < sideLength; i++) {
      const c = rowStart + i;
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

  return {
    shape: 'parallelogram', sideLength, height, offset,
    cols: totalCols, rows: height, points, adjacency, style, spacing
  };
}
