/* =====================================================
   KREUZ-RASTER
   Ein symmetrisches Kreuz (Plus-Zeichen) aus einem senkrechten und
   einem waagerechten Balken gleicher Breite. Parametrisiert über
   `armWidth` (0 < Wert < 1): Verhältnis von Balkenbreite zu
   Gesamtausdehnung — bei armWidth nahe 0 ein dünnes, spinnenbeiniges
   Kreuz, bei armWidth nahe 1 ein fast quadratisches Kreuz. Das echte
   Kreuz-Vieleck hat 12 Ecken (4 flache Armenden statt spitzer Zacken,
   dazwischen 8 einspringende Ecken an den inneren Balkenübergängen)
   und ist vom Zentrum aus vollständig einsehbar (sternförmig), fügt
   sich also nahtlos in dieselbe Radial-Konstruktion wie die übrigen
   Vielecke ein.

   STANDARD (zeilenbasiert): Wie bei Sternpolygon/Kompassstern wird das
   echte 12-Ecken-Vieleck per horizontalem Schnitt zeilenweise
   abgetastet (computePolygonRowColumns). Ein senkrechter Schnitt durch
   ein achsenausgerichtetes Kreuz bleibt bei JEDER Höhe einsträngig
   (nachweisbar, da die Balken exakt achsenparallel liegen) — anders
   als beim Sternpolygon entstehen hier also nie Lücken, das Profil
   ist ein schmal-breit-schmales Band (schmale Armbreite oben, volle
   Breite im mittleren Balkenband, schmale Armbreite unten).

   RADIAL: Die 12 echten Kreuz-Ecken werden (wie bei den übrigen
   Vielecken) konzentrisch skaliert und mit Speichen zum Zentrum
   verbunden — ergibt ein kreuzförmiges Ring-Mandala.
   ===================================================== */
import { buildRowSpanGridDefinition, computePolygonRowColumns } from './grid-shared.js';
import { buildStarRadialGridDefinition } from './grid-polygon.js';

export const CROSS_ARM_WIDTH_MIN = 0.1;
export const CROSS_ARM_WIDTH_MAX = 0.8;
export const CROSS_ARM_WIDTH_DEFAULT = 0.35;

function crossCorners(armWidth) {
  const w = armWidth, R = 1;
  const raw = [
    [w, -R], [w, -w], [R, -w], [R, w], [w, w], [w, R],
    [-w, R], [-w, w], [-R, w], [-R, -w], [-w, -w], [-w, -R]
  ];
  return raw.map(([x, y]) => ({ x, y }));
}

export function buildCrossGridDefinition(armWidth, width, height) {
  const rowColumns = computePolygonRowColumns(crossCorners(armWidth), width, height);
  const maxDim = Math.max(width, height);
  return buildRowSpanGridDefinition('cross', height, maxDim, rowColumns, {
    armWidth, width, cols: width, rows: height
  });
}

export function buildCrossRadialGridDefinition(armWidth, rings) {
  const corners = crossCorners(armWidth).map(({ x, y }) => ({
    angle: Math.atan2(x, -y),
    radius: Math.sqrt(x * x + y * y)
  }));
  return buildStarRadialGridDefinition('cross', corners, rings, { armWidth });
}
