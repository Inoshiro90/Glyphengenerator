/* =====================================================
   DRACHENTRAPEZ-RASTER
   Verallgemeinerung der Raute: statt einer erzwungenen symmetrischen
   Verjüngung (Raute: obere und untere Hälfte immer gleich lang) lassen
   sich hier die Reihenzahl der oberen Verbreiterung ("Oben") und der
   unteren Verjüngung ("Unten") unabhängig wählen. Die Reihenbreite
   wächst von 1 Punkt an der Spitze über "Oben" Reihen bis zur breitesten
   Reihe ("Breite", muss ungerade sein) an und nimmt danach über "Unten"
   Reihen wieder auf 1 Punkt ab — bei Oben≠Unten entsteht dadurch ein
   asymmetrisches, drachenartiges Profil (die breiteste Reihe liegt nicht
   in der Mitte, sondern näher an der kürzeren der beiden Seiten).
   Sonderfälle: Oben=Unten ergibt exakt eine Raute; Unten=1 ergibt ein
   auf der Spitze stehendes Dreieck; Oben=1 ein auf dem Kopf stehendes.
   ===================================================== */
import { buildTaperedRowGridDefinition } from './grid-shared.js';

export function buildKiteGridDefinition(width, oben, unten) {
  const height = oben + unten - 1;
  function rowWidth(r) {
    const t = r <= oben - 1
      ? (oben > 1 ? r / (oben - 1) : 1)
      : (unten > 1 ? 1 - (r - (oben - 1)) / (unten - 1) : 1);
    const steps = Math.round(t * (width - 1) / 2);
    return 1 + 2 * steps;
  }
  const maxDim = Math.max(width, height);
  return buildTaperedRowGridDefinition('kite', height, maxDim, rowWidth, {
    width, oben, unten, cols: width, rows: height
  });
}
