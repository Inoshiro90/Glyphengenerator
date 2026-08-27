/* =====================================================
   TRAPEZ-RASTER
   Reihe 0 (oben, kurze Seite) hat `top` Punkte, jede weitere Reihe
   wächst um genau 2 Punkte, bis Reihe (height-1) (unten, lange
   Seite) erreicht ist: Unterseite = top + 2×(Höhe−1) — durch vier
   Beispiele verifiziert (2×4→8, 3×3→7, 4×3→8, 5×4→11). Da JEDE
   Reihe um genau 2 wächst, teilen sich Ober- und Unterseite immer
   dieselbe Parität; die Differenz (Unterseite − Reihenbreite) ist
   dadurch automatisch immer gerade — anders als beim Dreieck muss
   `top` deshalb NICHT zwingend ungerade sein, die Zentrierung
   funktioniert für jede Startbreite.
   ===================================================== */
import { buildTaperedRowGridDefinition } from './grid-shared.js';

export function buildTrapezoidGridDefinition(top, height) {
  function rowWidth(i) { return top + 2 * i; }
  const bottom = top + 2 * (height - 1);
  const maxDim = Math.max(bottom, height);
  return buildTaperedRowGridDefinition('trapezoid', height, maxDim, rowWidth, {
    top, bottom, cols: bottom, rows: height
  });
}
