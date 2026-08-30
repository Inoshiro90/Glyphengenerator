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
   MÜSSEN sowohl `width` als auch `height` ungerade sein — nur so
   gibt es eine exakte Mittelreihe, die tatsächlich die volle
   Breite erreicht (bei gerader Höhe gäbe es keine Mittelreihe,
   und die beiden mittleren Reihen blieben unter der vollen Breite
   stecken).
   ===================================================== */
import { buildTaperedRowGridDefinition } from './grid-shared.js';
import { buildStarRadialGridDefinition } from './grid-polygon.js';

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

/* -----------------------------------------------------
   RAUTE — Radial
   Eine Raute hat (unabhängig vom Seitenverhältnis) stets zwei
   zueinander senkrechte Diagonalen — ihre vier Ecken liegen deshalb
   IMMER exakt bei 0°/90°/180°/270°, nur die Länge der beiden
   Diagonalen unterscheidet sich normalerweise (senkrecht: oben/
   unten, waagerecht: links/rechts). Genau das bildet dieser Modus
   ab: zwei unabhängige Streckungsfaktoren statt eines einzigen
   Radius, sonst identisch zur Radial-Konstruktion der regelmäßigen
   Vielecke (konzentrische, ähnliche Kopien + Speichen). Bei
   widthRatio = heightRatio entsteht ein Quadrat (Sonderfall Raute).
   ----------------------------------------------------- */
export function buildRhombusRadialGridDefinition(widthRatio, heightRatio, rings) {
  const corners = [
    { angle: 0, radius: heightRatio },                  // oben
    { angle: Math.PI / 2, radius: widthRatio },         // rechts
    { angle: Math.PI, radius: heightRatio },            // unten
    { angle: 3 * Math.PI / 2, radius: widthRatio }      // links
  ];
  return buildStarRadialGridDefinition('rhombus', corners, rings, { widthRatio, heightRatio });
}
