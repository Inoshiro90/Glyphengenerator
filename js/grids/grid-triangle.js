/* =====================================================
   DREIECK-RASTER
   Reihe 0 (oben) hat 1 Punkt, jede weitere Reihe wird breiter,
   bis Reihe (height-1) (unten) genau `width` Punkte hat. Alle
   Reihenbreiten sind ungerade und zentriert unter derselben
   Spitzenspalte — deshalb MUSS `width` ungerade sein (sonst wäre
   die unterste Reihe nicht symmetrisch zur Spitze zentrierbar).

   Bei width = 2·height−1 (Standardfall, z. B. Breite 5/Höhe 3 aus
   der Vorlage) wächst jede Reihe um genau 2 Punkte. Sind Breite
   und Höhe unabhängig davon gewählt, interpoliert die Formel die
   "Anzahl der +2-Schritte" linear zwischen Reihe 0 und der
   letzten Reihe und rundet — das garantiert weiterhin durchweg
   ungerade, symmetrisch zentrierte Reihenbreiten, auch wenn dabei
   einzelne Reihen dieselbe Breite wiederholen (Plateau).
   ===================================================== */
import { buildTaperedRowGridDefinition } from './grid-shared.js';

export function buildTriangleGridDefinition(width, height) {
  function rowWidth(i) {
    if (height === 1) return width;
    const steps = Math.round(i * ((width - 1) / 2) / (height - 1));
    return 1 + 2 * steps;
  }
  const maxDim = Math.max(width, height);
  return buildTaperedRowGridDefinition('triangle', height, maxDim, rowWidth, {
    width, cols: width, rows: height
  });
}
