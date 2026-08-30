/* =====================================================
   KOMPASSSTERN-RASTER
   Klassische Windrose: 4 lange Hauptarme (Nord/Ost/Süd/West) und 4
   kürzere Nebenarme dazwischen (Nordost/Südost/Südwest/Nordwest).

   STANDARD (zeilenbasiert): Wie beim Sternpolygon wird das ECHTE
   Vieleck (8 Ecken, abwechselnd Außenradius 1 / Innenradius 35 %,
   identisch zur Radial-Konstruktion unten) per horizontalem Schnitt
   zeilenweise abgetastet (computeStarPolygonRowColumns). Ein
   senkrechter Schnitt durch einen 4-armigen Kompassstern bleibt bei
   jeder Höhe einsträngig (die Ost-/West-Arme liegen exakt auf der
   Mittelzeile, nicht versetzt), das Profil ist deshalb kein
   gestapeltes Sternmuster wie beim Sternpolygon, sondern EIN
   zusammenhängender Umriss — anders als eine Raute wächst die
   Zeilenbreite dabei aber NICHT linear zur Mitte hin, sondern folgt
   der eingebuchteten Vieleck-Kontur (an den Nebenarm-Ecken springt sie
   sprunghaft, nicht gleichmäßig) und wirkt dadurch deutlich spitzer/
   spikiger als eine schlichte Raute.

   RADIAL: 8 Ecken im Abstand von 45°, abwechselnd auf vollem Radius
   (die 4 Hauptarme N/O/S/W) und einem deutlich kürzeren inneren
   Radius (die 4 Nebenarme) — sonst identisch zur Radial-Konstruktion
   der übrigen Vielecke.
   ===================================================== */
import { buildRowSpanGridDefinition, computeStarPolygonRowColumns } from './grid-shared.js';
import { buildStarRadialGridDefinition } from './grid-polygon.js';

export const COMPASS_INNER_RATIO = 0.35;
const COMPASS_TIPS = 4;

export function buildCompassGridDefinition(width, height) {
  const rowColumns = computeStarPolygonRowColumns(COMPASS_TIPS, COMPASS_INNER_RATIO, width, height);
  const maxDim = Math.max(width, height);
  return buildRowSpanGridDefinition('compass', height, maxDim, rowColumns, {
    width, cols: width, rows: height
  });
}

export function buildCompassRadialGridDefinition(rings) {
  const sides = 8;
  const corners = Array.from({ length: sides }, (_, j) => ({
    angle: j * (2 * Math.PI / sides),
    radius: j % 2 === 0 ? 1 : COMPASS_INNER_RATIO
  }));
  return buildStarRadialGridDefinition('compass', corners, rings, {});
}
