/* =====================================================
   STERNPOLYGON-RASTER
   Gemeinsamer Parameter für beide Modi: `points` = Anzahl der Spitzen.

   STANDARD (zeilenbasiert): Statt einer erfundenen Wellenformel wird
   jetzt das ECHTE Sternpolygon (2×Spitzen Ecken, abwechselnd
   Außenradius 1 und Innenradius 45 %, wie bei Radial) per horizontalem
   Schnitt zeilenweise abgetastet (computeStarPolygonRowColumns) — bei
   den meisten Spitzenzahlen trifft ein Schnitt auf mehrere getrennte
   Bereiche (z. B. bei einem klassischen 5-zackigen Stern), deshalb
   der Mehrfach-Abschnitts-Helper buildRowSpanGridDefinition statt des
   einfachen Einzelbreiten-Helpers. Das Ergebnis ist ein tatsächlicher
   Sternumriss, kein gestapeltes Auf-und-Ab.

   RADIAL: klassische Konstruktion eines Sternpolygons mit 2·Spitzen
   Ecken, die abwechselnd auf dem äußeren Radius (Spitze) und einem
   festen inneren Radius (Talsohle, 45 % des äußeren) liegen — sonst
   identisch zur Radial-Konstruktion der übrigen Vielecke (konzen-
   trische, ähnliche Kopien + Speichen zum Zentrum).
   ===================================================== */
import { buildRowSpanGridDefinition, computeStarPolygonRowColumns } from './grid-shared.js';
import { buildStarRadialGridDefinition } from './grid-polygon.js';

export const STAR_INNER_RATIO = 0.45;

export function buildStarGridDefinition(points, width, height) {
  const rowColumns = computeStarPolygonRowColumns(points, STAR_INNER_RATIO, width, height);
  const maxDim = Math.max(width, height);
  return buildRowSpanGridDefinition('star', height, maxDim, rowColumns, {
    tips: points, width, cols: width, rows: height
  });
}

export function buildStarPolygonRadialGridDefinition(points, rings) {
  const sides = points * 2;
  const corners = Array.from({ length: sides }, (_, j) => ({
    angle: j * (2 * Math.PI / sides),
    radius: j % 2 === 0 ? 1 : STAR_INNER_RATIO
  }));
  return buildStarRadialGridDefinition('star', corners, rings, { tips: points });
}
