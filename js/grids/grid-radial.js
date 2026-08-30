/* =====================================================
   KREIS-/ELLIPSEN-RASTER
   Ring 0 ist der Mittelpunkt. Ring k (k ≥ 1) hat unitsPerRing×k Punkte
   (Standard-Auflösung 4: Ring1=4, Ring2=8, Ring3=12, …) — diese Regel
   bestimmt nur die ANZAHL und NUMMERIERUNG pro Ring, nicht die
   Position. Die Punkte werden auf echten konzentrischen Kreisen
   platziert (Polarkoordinaten: Radius ∝ Ringindex, gleichmäßig
   verteilter Winkel), nicht auf einem quadratischen Gitter — sonst
   entstünde ein Diamant statt eines Kreises. Nummerierung: äußerster
   Ring zuerst, im Uhrzeigersinn ab 12 Uhr, Zentrum zuletzt.

   Die Auflösung (unitsPerRing) ist bewusst konfigurierbar: bei der
   Standard-Auflösung 4 wirkt der Kreis bei wenigen Ringen eher eckig/
   quadratisch (Ring1 hat z. B. nur 4 Punkte, exakt wie beim
   Quadrat-Radial); der "Radial"-Modus des Kreis-Dropdowns erlaubt eine
   höhere Auflösung, damit auch bei wenigen Ringen ein deutlich
   runderer Eindruck entsteht — die Konstruktion selbst (Ringe +
   Speichen auf echten Kreisen) ist in beiden Fällen identisch, nur
   die Punktdichte pro Ring unterscheidet sich.

   Da die Punkte nicht mehr auf einem Ganzzahl-Gitter liegen, kann
   die Nachbarschaft nicht mehr per King-Move (dx,dy) berechnet
   werden. Stattdessen gilt für dieses Raster eine eigene Regel:
   - Ring-Nachbarschaft: jeder Punkt verbindet sich mit seinem
     Vorgänger/Nachfolger im selben Ring (jeder Ring bildet einen
     geschlossenen Kreis aus Strecken).
   - Radiale Speiche: jeder Punkt verbindet sich zusätzlich mit
     dem winkelmäßig nächstgelegenen Punkt im nächst-inneren Ring
     (bzw. mit dem Zentrum, falls es sich um Ring 1 handelt).

   ELLIPSE ist dieselbe Konstruktion mit unabhängiger horizontaler
   (rx) und vertikaler (ry) Streckung statt eines einzelnen Radius:
   Ringzahl/Topologie (welche Punkte existieren, unitsPerRing pro
   Ring, Nachbarschaft) richten sich nach n=max(rx,ry); beim
   Umrechnen von Winkel+Ringindex in Bildschirmkoordinaten wird x mit
   rx/n und y mit ry/n skaliert. Für rx=ry ergibt sich exakt der Kreis
   (Spezialfall) — die Winkel selbst werden VOR der Streckung
   berechnet, wodurch die radialen Speichen auch bei stark
   unterschiedlichem rx/ry sinnvoll bleiben.
   ===================================================== */
import { clamp } from '../config.js';

export function buildRadialGridDefinition(shape, rx, ry, unitsPerRing) {
  unitsPerRing = unitsPerRing || 4; // Kreis/Ellipse: 4 Punkte pro Ring und Ringindex
  const VIEW = 320;
  const margin = 40;
  const cx = VIEW / 2;
  const cy = VIEW / 2;
  const n = Math.max(rx, ry); // Ringzahl für Topologie/Punktzahl
  const unit = n === 0 ? 0 : (VIEW - 2 * margin) / 2 / n;
  const scaleX = n === 0 ? 1 : rx / n;
  const scaleY = n === 0 ? 1 : ry / n;

  const points = {};
  const ringsById = {}; // Ringindex k -> [{ id, angle }], für Nachbarschaftsaufbau
  let id = 1;
  for (let k = n; k >= 1; k--) {
    const count = unitsPerRing * k;
    const ringPts = [];
    for (let i = 0; i < count; i++) {
      const angle = i * (2 * Math.PI / count); // 0 = 12 Uhr, wächst im Uhrzeigersinn
      points[id] = {
        x: cx + unit * k * scaleX * Math.sin(angle),
        y: cy - unit * k * scaleY * Math.cos(angle)
      };
      ringPts.push({ id, angle });
      id++;
    }
    ringsById[k] = ringPts;
  }
  const centerId = id;
  points[centerId] = { x: cx, y: cy };
  ringsById[0] = [{ id: centerId, angle: 0 }];

  const adjacency = {};
  Object.keys(points).forEach(k => (adjacency[k] = []));
  function addEdge(a, b) {
    if (!adjacency[a].includes(b)) adjacency[a].push(b);
    if (!adjacency[b].includes(a)) adjacency[b].push(a);
  }

  // Ring-Zyklus: jeder Ring ist ein geschlossener Kreis aus Nachbarn
  for (let k = n; k >= 1; k--) {
    const ringPts = ringsById[k];
    const count = ringPts.length;
    for (let i = 0; i < count; i++) {
      addEdge(ringPts[i].id, ringPts[(i + 1) % count].id);
    }
  }

  // Radiale Speichen: jeder Punkt eines Rings verbindet sich mit dem
  // winkelmäßig nächstgelegenen Punkt im nächst-inneren Ring.
  for (let k = n; k >= 2; k--) {
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
  if (n >= 1) {
    ringsById[1].forEach(p => addEdge(p.id, centerId));
  }

  const maxDim = 2 * n + 1; // nur für Stil-Skalierung, keine Gitterbedeutung mehr
  const style = {
    rActive: clamp(9 - (maxDim - 3) * 0.85, 2.6, 9),
    rInactive: clamp(6 - (maxDim - 3) * 0.55, 1.8, 6),
    font: clamp(9 - (maxDim - 3) * 0.7, 3.6, 9),
    stroke: clamp(3 - (maxDim - 3) * 0.18, 1.1, 3)
  };

  return { shape, n, rx, ry, unitsPerRing, cols: maxDim, rows: maxDim, points, adjacency, style, spacing: unit };
}

export function buildCircleGridDefinition(n, resolution) {
  const grid = buildRadialGridDefinition('circle', n, n, resolution);
  return Object.assign(grid, { mode: resolution ? 'radial' : 'standard' });
}

export function buildEllipseGridDefinition(rx, ry) {
  return buildRadialGridDefinition('ellipse', rx, ry);
}

/* =====================================================
   HALBKREIS-RASTER
   Dieselbe Ring-/Speichen-Konstruktion wie beim Kreis, aber auf einen
   180°-Bogen von 9 Uhr (−90°) über 12 Uhr (0°) bis 3 Uhr (+90°)
   beschränkt — die Kuppel wölbt sich nach oben, die flache Grundseite
   liegt waagerecht auf halber Höhe. Konfigurierbare "Auflösung"
   (Standard 2): Ring k hat Auflösung×k+1 Punkte (statt Auflösung×k
   beim Vollkreis, exakt die Hälfte plus die beiden Bogen-Enden) — bei
   Standard-Auflösung 2 ergibt das die bisherigen 2k+1 Punkte. Die
   Auflösung MUSS gerade sein, sonst läge kein Punkt exakt auf der
   Kuppelspitze (Winkel 0°) und die Grundseiten-Symmetrie bräche.
   Der Ring-Zyklus bleibt eine OFFENE Kette (kein Kanten-Schluss zwischen
   erstem und letztem Punkt — sonst entstünde eine Sehne quer durch den
   Kreis statt der geraden Grundseite). Die Grundseite selbst braucht
   keine eigene Sonderbehandlung: da die beiden Bogen-Enden jedes Rings
   exakt bei −90°/+90° liegen, erzeugt die normale radiale
   Speichen-Regel (nächstgelegener Winkel im inneren Ring) automatisch
   zwei gerade Ketten vom Zentrum bis zum äußersten Ring entlang dieser
   beiden Winkel — das IST die flache Grundseite.
   ===================================================== */
export function buildSemicircleGridDefinition(n, resolution) {
  const res = resolution || 2;
  const VIEW = 320;
  const margin = 40;
  const cx = VIEW / 2;
  // Die Kuppel ist doppelt so breit wie hoch; die Breite (2×unit×n) füllt
  // die volle nutzbare Breite aus, die Höhe (unit×n) wird vertikal
  // zentriert statt am oberen Rand zu kleben.
  const unit = n === 0 ? 0 : (VIEW - 2 * margin) / (2 * n);
  const domeHeight = unit * n;
  const topOffset = margin + ((VIEW - 2 * margin) - domeHeight) / 2;
  const cy = topOffset + domeHeight; // Grundlinie = Unterkante der Kuppel

  const points = {};
  const ringsById = {};
  let id = 1;
  for (let k = n; k >= 1; k--) {
    const count = res * k + 1;
    const ringPts = [];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + i * (Math.PI / (res * k)); // -90° .. +90°
      points[id] = { x: cx + unit * k * Math.sin(angle), y: cy - unit * k * Math.cos(angle) };
      ringPts.push({ id, angle });
      id++;
    }
    ringsById[k] = ringPts;
  }
  const centerId = id;
  points[centerId] = { x: cx, y: cy };
  ringsById[0] = [{ id: centerId, angle: 0 }];

  const adjacency = {};
  Object.keys(points).forEach(k => (adjacency[k] = []));
  function addEdge(a, b) {
    if (!adjacency[a].includes(b)) adjacency[a].push(b);
    if (!adjacency[b].includes(a)) adjacency[b].push(a);
  }

  // Bogen jedes Rings: OFFENE Kette (kein Schluss zwischen den Enden).
  for (let k = n; k >= 1; k--) {
    const ringPts = ringsById[k];
    for (let i = 0; i < ringPts.length - 1; i++) addEdge(ringPts[i].id, ringPts[i + 1].id);
  }

  // Radiale Speichen: winkelmäßig nächstgelegener Punkt im inneren Ring
  // (erzeugt für die Bogen-Enden automatisch die gerade Grundseite).
  for (let k = n; k >= 2; k--) {
    const outer = ringsById[k];
    const inner = ringsById[k - 1];
    outer.forEach(p => {
      let best = null, bestDiff = Infinity;
      inner.forEach(q => {
        const diff = Math.abs(p.angle - q.angle);
        if (diff < bestDiff) { bestDiff = diff; best = q; }
      });
      addEdge(p.id, best.id);
    });
  }
  if (n >= 1) {
    ringsById[1].forEach(p => addEdge(p.id, centerId));
  }

  const maxDim = 2 * n + 1;
  const style = {
    rActive: clamp(9 - (maxDim - 3) * 0.85, 2.6, 9),
    rInactive: clamp(6 - (maxDim - 3) * 0.55, 1.8, 6),
    font: clamp(9 - (maxDim - 3) * 0.7, 3.6, 9),
    stroke: clamp(3 - (maxDim - 3) * 0.18, 1.1, 3)
  };

  return { shape: 'semicircle', mode: resolution ? 'radial' : 'standard', resolution: res, n, cols: maxDim, rows: maxDim, points, adjacency, style, spacing: unit };
}
