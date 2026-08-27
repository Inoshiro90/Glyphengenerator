/* =====================================================
   ERWEITERTE OPTIONEN — Constraint-Prüfung
   Vier unabhängig kombinierbare Regeln, die bei der
   Kandidatenwahl während der Backtracking-Suche geprüft
   werden:

   - Kreuzungen vermeiden: geometrische Schnittprüfung
     zweier Streckenabschnitte (Orientierungstest).
   - Punktbelastung vermeiden: kein Punkt darf mehr als
     einmal angewählt werden (Trail → einfacher Pfad).
   - Konzentration vermeiden: ein neuer Punkt wird
     abgelehnt, wenn zu viele Punkte in seiner unmittel-
     baren Umgebung bereits belegt sind (Heuristik, kein
     exaktes Optimierungsverfahren).
   ===================================================== */
import { CONCENTRATION_RADIUS_FACTOR, CONCENTRATION_THRESHOLD } from './config.js';

export function pointsEqual(p, q) {
  return Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6;
}

export function orientation(p, q, r) {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 1 : 2;
}

export function onSegment(p, q, r) {
  return Math.min(p.x, r.x) - 1e-6 <= q.x && q.x <= Math.max(p.x, r.x) + 1e-6 &&
         Math.min(p.y, r.y) - 1e-6 <= q.y && q.y <= Math.max(p.y, r.y) + 1e-6;
}

// Zwei Strecken "kreuzen" sich nur, wenn sie sich in ihrem Inneren
// schneiden. Ein gemeinsamer Endpunkt (Punkt, an dem zwei Strecken
// zusammentreffen) zählt bewusst NICHT als Kreuzung.
export function segmentsProperlyIntersect(p1, p2, p3, p4) {
  if (pointsEqual(p1, p3) || pointsEqual(p1, p4) || pointsEqual(p2, p3) || pointsEqual(p2, p4)) return false;
  const o1 = orientation(p1, p2, p3), o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1), o4 = orientation(p3, p4, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p3, p2)) return true;
  if (o2 === 0 && onSegment(p1, p4, p2)) return true;
  if (o3 === 0 && onSegment(p3, p1, p4)) return true;
  if (o4 === 0 && onSegment(p3, p2, p4)) return true;
  return false;
}

export function crossesAny(newSeg, usedSegments) {
  for (const seg of usedSegments) {
    if (segmentsProperlyIntersect(newSeg[0], newSeg[1], seg[0], seg[1])) return true;
  }
  return false;
}

// Heuristik: Anteil bereits belegter Punkte im unmittelbaren Umkreis
// des Kandidaten. usedLookup ist ein Set ODER eine Map — beide
// unterstützen .has(), daher funktioniert die Funktion unverändert
// sowohl im Trail- als auch im Ast-Modus.
export function concentrationTooHigh(candidateVertex, usedLookup, grid) {
  if (!grid.spacing) return false;
  const p = grid.points[candidateVertex];
  const radius = grid.spacing * CONCENTRATION_RADIUS_FACTOR;
  let nearbyTotal = 0, nearbyUsed = 0;
  for (const key in grid.points) {
    const v = Number(key);
    if (v === candidateVertex) continue;
    const q = grid.points[v];
    if (Math.hypot(p.x - q.x, p.y - q.y) <= radius) {
      nearbyTotal++;
      if (usedLookup.has(v)) nearbyUsed++;
    }
  }
  if (nearbyTotal === 0) return false;
  return (nearbyUsed / nearbyTotal) > CONCENTRATION_THRESHOLD;
}

export function vcAdd(map, v) { map.set(v, (map.get(v) || 0) + 1); }

export function vcRemove(map, v) {
  const c = (map.get(v) || 0) - 1;
  if (c <= 0) map.delete(v); else map.set(v, c);
}

// Zentrales Prädikat: prüft einen Kandidaten-Schritt (fromVertex → opt.to)
// gegen alle aktiven erweiterten Optionen.
export function passesConstraints(fromVertex, opt, grid, constraints, usedLookup, usedSegments) {
  if (constraints.avoidPointReuse && usedLookup.has(opt.to)) return false;
  if (constraints.avoidCrossing) {
    const seg = [grid.points[fromVertex], grid.points[opt.to]];
    if (crossesAny(seg, usedSegments)) return false;
  }
  if (constraints.avoidConcentration && concentrationTooHigh(opt.to, usedLookup, grid)) return false;
  return true;
}
