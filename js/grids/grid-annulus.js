/* =====================================================
   KREISRING-RASTER (Annulus)
   Dieselbe Ring-/Speichen-Konstruktion wie beim Kreis (Ring k hat 4k
   Punkte auf echten konzentrischen Kreisen, Ring-Umriss + radiale
   Speichen zum winkelmäßig nächstgelegenen Punkt im nächst-inneren
   Ring), aber die innersten `hollow` Ringe UND der Mittelpunkt werden
   komplett weggelassen — dadurch entsteht eine echte Aushöhlung in
   der Mitte statt eines gefüllten Kreises. Der neue innerste
   verbleibende Ring (Ring hollow+1) bekommt dadurch keine nach innen
   führenden Speichen mehr, nur seinen eigenen geschlossenen
   Ring-Umriss — das IST der Innenrand der Aushöhlung.
   `hollow` muss mindestens 1 und höchstens rings-1 sein, damit
   tatsächlich sowohl ein Loch als auch mindestens ein realer Ring
   übrig bleibt.
   ===================================================== */
import { clamp } from '../config.js';

export function buildAnnulusGridDefinition(rings, hollow) {
  const VIEW = 320;
  const margin = 40;
  const cx = VIEW / 2;
  const cy = VIEW / 2;
  const n = rings;
  const unit = n === 0 ? 0 : (VIEW - 2 * margin) / 2 / n;
  const unitsPerRing = 4;

  const points = {};
  const ringsById = {};
  let id = 1;
  for (let k = n; k >= hollow + 1; k--) {
    const count = unitsPerRing * k;
    const ringPts = [];
    for (let i = 0; i < count; i++) {
      const angle = i * (2 * Math.PI / count);
      points[id] = { x: cx + unit * k * Math.sin(angle), y: cy - unit * k * Math.cos(angle) };
      ringPts.push({ id, angle });
      id++;
    }
    ringsById[k] = ringPts;
  }

  const adjacency = {};
  Object.keys(points).forEach(k => (adjacency[k] = []));
  function addEdge(a, b) {
    if (!adjacency[a].includes(b)) adjacency[a].push(b);
    if (!adjacency[b].includes(a)) adjacency[b].push(a);
  }

  // Ring-Zyklus für jeden verbleibenden Ring (auch den innersten —
  // der bildet den Innenrand der Aushöhlung).
  for (let k = n; k >= hollow + 1; k--) {
    const ringPts = ringsById[k];
    const count = ringPts.length;
    for (let i = 0; i < count; i++) addEdge(ringPts[i].id, ringPts[(i + 1) % count].id);
  }

  // Radiale Speichen nur zwischen tatsächlich vorhandenen Ringpaaren;
  // der innerste verbleibende Ring (hollow+1) bekommt KEINE Speiche
  // nach innen (dort ist die Aushöhlung, kein Ring, kein Mittelpunkt).
  for (let k = n; k >= hollow + 2; k--) {
    const outer = ringsById[k];
    const inner = ringsById[k - 1];
    outer.forEach(p => {
      let best = null, bestDiff = Infinity;
      inner.forEach(q => {
        let diff = Math.abs(p.angle - q.angle);
        diff = Math.min(diff, 2 * Math.PI - diff);
        if (diff < bestDiff) { bestDiff = diff; best = q; }
      });
      addEdge(p.id, best.id);
    });
  }

  const maxDim = 2 * n + 1;
  const style = {
    rActive: clamp(9 - (maxDim - 3) * 0.85, 2.6, 9),
    rInactive: clamp(6 - (maxDim - 3) * 0.55, 1.8, 6),
    font: clamp(9 - (maxDim - 3) * 0.7, 3.6, 9),
    stroke: clamp(3 - (maxDim - 3) * 0.18, 1.1, 3)
  };

  return { shape: 'annulus', n, hollow, cols: maxDim, rows: maxDim, points, adjacency, style, spacing: unit };
}
