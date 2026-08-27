/* =====================================================
   RAUTE-RASTER
   Eine Raute ist im Kern ein Dreieck, das sich nach der Mitte
   hin wieder symmetrisch verjüngt: Reihe 0 (oben) hat 1 Punkt,
   die Breite wächst zur mittleren Reihe hin auf `width` an und
   nimmt danach spiegelbildlich wieder auf 1 ab (klassische Raute
   bei width=height, z. B. 5×5 → Reihenbreiten 1,3,5,3,1).

   Wie beim Dreieck wird die "Anzahl der +2-Schritte" linear
   interpoliert und gerundet — hier bezogen auf den Abstand jeder
   Reihe zur Mitte statt zur Spitze. Das garantiert wie beim
   Dreieck durchweg ungerade, zentrierte Reihenbreiten; deshalb
   MUSS `width` ungerade sein. Bei gerader Höhe gibt es keine
   exakte Mittelreihe — die beiden mittleren Reihen erreichen dann
   ggf. nicht ganz die volle Breite (siehe H=4/W=5 → 1,3,3,1),
   analog zum "Plateau"-Verhalten bei Dreieck/Hexagon.
   ===================================================== */
import { buildTaperedRowGridDefinition } from './grid-shared.js';

export function buildRhombusGridDefinition(width, height) {
  function rowWidth(r) {
    if (height === 1) return width;
    const center = (height - 1) / 2;
    const dist = Math.abs(r - center);
    const steps = Math.round((1 - dist / center) * ((width - 1) / 2));
    return 1 + 2 * steps;
  }
  const maxDim = Math.max(width, height);
  return buildTaperedRowGridDefinition('rhombus', height, maxDim, rowWidth, {
    width, cols: width, rows: height
  });
}
