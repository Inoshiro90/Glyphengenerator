/* =====================================================
   DRACHENVIERECK-RASTER (Kite)
   Einziger Parameter: h = "Höhe nach oben, inklusive Mittelpunkt".
   Daraus ergibt sich:
   - Breite der Mittelreihe: 2h+1
   - Obere Verjüngung (Reihen 1..h-1): normale ungerade Taper-Folge
     1, 3, 5, …, 2h-3 (wie beim Dreieck, eine Spitze mit 1 Punkt).
   - Mittelreihe (Reihe h): springt direkt auf die volle Breite
     2h+1 (NICHT die von der Taper-Folge erwartete 2h-1 — genau
     dieser zusätzliche Sprung um +2 erzeugt das drachenartige,
     asymmetrische Profil).
   - Untere Verjüngung: h Ebenen mit abnehmender Wiederholung.
     Ebene i (i=0..h-1) hat Breite (2h-1-2i) und wird (h-i) mal
     wiederholt — Ebene 0 (Breite 2h-1, direkt unter der Mittel-
     reihe) also h-mal, Ebene 1 (Breite 2h-3) (h-1)-mal, usw. bis
     Ebene h-1 (Breite 1) genau einmal.
   Gesamtzahl Reihen: h (oben, inkl. Mitte) + h(h+1)/2 (unten).
   Beispiel h=3: Reihenbreiten 1,3,7,5,5,5,3,3,1 (9 Reihen).
   ===================================================== */
import { buildTaperedRowGridDefinition } from './grid-shared.js';
import { buildStarRadialGridDefinition } from './grid-polygon.js';

export function buildKiteGridDefinition(h) {
  const width = 2 * h + 1;
  const rowWidths = [];
  for (let r = 1; r <= h - 1; r++) rowWidths.push(2 * r - 1);
  rowWidths.push(width); // Mittelreihe: Sprung auf volle Breite
  for (let i = 0; i <= h - 1; i++) {
    const value = 2 * h - 1 - 2 * i;
    const repeat = h - i;
    for (let j = 0; j < repeat; j++) rowWidths.push(value);
  }
  const height = rowWidths.length;
  const maxDim = Math.max(width, height);
  return buildTaperedRowGridDefinition('kite', height, maxDim, r => rowWidths[r], {
    h, width, cols: width, rows: height
  });
}

/* -----------------------------------------------------
   DRACHENVIERECK — Radial
   Ein Drachenviereck ist links/rechts symmetrisch (wie die Raute),
   aber oben/unten UNSYMMETRISCH: eine "kurze" Spitze und ein
   "langer Schwanz" auf derselben (senkrechten) Achse. Modelliert als
   Sonderfall des allgemeinen Radial-Ansatzes mit vier individuellen
   Eckfaktoren: oben und die beiden Seiten bleiben bei Radius 1, nur
   der untere Punkt wird um tailRatio gestreckt (tailRatio > 1 ergibt
   den charakteristischen langen Schwanz; tailRatio = 1 ergibt eine
   Raute als Sonderfall).
   ----------------------------------------------------- */
export function buildKiteRadialGridDefinition(tailRatio, rings) {
  const corners = [
    { angle: 0, radius: 1 },                       // oben (Spitze)
    { angle: Math.PI / 2, radius: 1 },              // rechts
    { angle: Math.PI, radius: tailRatio },          // unten (Schwanz)
    { angle: 3 * Math.PI / 2, radius: 1 }           // links
  ];
  return buildStarRadialGridDefinition('kite', corners, rings, { tailRatio });
}
