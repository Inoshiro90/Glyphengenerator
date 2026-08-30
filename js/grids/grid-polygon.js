/* =====================================================
   FÜNFECK, SIEBENECK, ACHTECK, NEUNECK, ZEHNECK
   Jedes dieser Vielecke hat mehrere wählbare Konstruktionsarten
   ("Modus"). Alle nicht-radialen Modi sind reine "Reihenbreiten"-
   Raster (wie Dreieck/Raute/Trapez) und nutzen daher denselben
   buildTaperedRowGridDefinition-Helfer — nur die Liste der
   Reihenbreiten unterscheidet sich je Modus.
   ===================================================== */
import { buildTaperedRowGridDefinition } from './grid-shared.js';
import { clamp } from '../config.js';

/* -----------------------------------------------------
   RADIAL (alle fünf Vielecke)
   Wie beim Kreis: Ring k hat `sides × k` Punkte — Ring1 hat also
   genau `sides` Punkte auf den echten Eck-Winkeln, Ring2 doppelt so
   viele (ein zusätzlicher Punkt je Kante), Ring3 dreimal so viele
   (zwei zusätzliche je Kante), usw.

   Anders als beim Kreis liegen die eingefügten Punkte NICHT auf
   einem Kreisbogen (das würde aus dem Vieleck wieder einen Kreis
   machen), sondern linear interpoliert auf der GERADEN Strecke
   zwischen zwei benachbarten Ecken desselben Rings — jeder Ring
   bildet dadurch ein echtes, geradlinig begrenztes N-Eck (nur
   größer skaliert), keinen Kreis.
   ----------------------------------------------------- */
/* -----------------------------------------------------
   ALLGEMEINE GRUNDLAGE (alle "Radial"-Modi, auch die nicht-
   regelmäßigen Vielecke wie Raute/Drachenviereck)
   Jede Ecke wird nicht mehr nur über einen gemeinsamen Winkel-
   Schritt (2π/sides) beschrieben, sondern über ein individuelles
   {angle, radius}-Paar — radius ist ein relativer Faktor (1 = volle
   Ausdehnung bei Ring n). Ein regelmäßiges Vieleck ist damit nur
   der Spezialfall "alle radius = 1, Winkel gleichmäßig verteilt";
   eine Raute oder ein Drachenviereck nutzt stattdessen pro Ecke
   unterschiedliche radius-Werte (z. B. oben/unten anders als
   links/rechts), bleibt aber exakt dieselbe Ring-/Speichen-Logik:
   pro Ring werden die Vieleck-Ecken auf den Faktor k/n skaliert
   (Ähnlichkeitszentrum = Mittelpunkt), Kantenpunkte linear
   dazwischen interpoliert (gerade Kanten, kein Kreisbogen), und
   jeder Punkt verbindet sich radial mit dem winkelmäßig
   nächstgelegenen Punkt des nächst-inneren Rings.
   ----------------------------------------------------- */
export function buildStarRadialGridDefinition(shape, corners, rings, extraProps) {
  const VIEW = 320;
  const margin = 40;
  const cx = VIEW / 2;
  const cy = VIEW / 2;
  const n = rings;
  const sides = corners.length;
  const maxRadius = Math.max(...corners.map(c => c.radius));
  const unit = n === 0 || maxRadius === 0 ? 0 : (VIEW - 2 * margin) / 2 / n / maxRadius;

  function corner(k, j) {
    const { angle, radius } = corners[j];
    return { x: cx + unit * radius * k * Math.sin(angle), y: cy - unit * radius * k * Math.cos(angle) };
  }

  const points = {};
  const ringsById = {};
  let id = 1;
  for (let k = n; k >= 1; k--) {
    const ringPts = [];
    for (let j = 0; j < sides; j++) {
      const a = corner(k, j);
      const b = corner(k, (j + 1) % sides);
      // k Punkte je Kante (die Start-Ecke selbst plus k-1 linear
      // interpolierte Zwischenpunkte); die End-Ecke wird NICHT
      // mitgezählt, da sie bereits Startpunkt der nächsten Kante ist.
      for (let m = 0; m < k; m++) {
        const t = m / k;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const angle = Math.atan2(x - cx, -(y - cy));
        points[id] = { x, y };
        ringPts.push({ id, angle });
        id++;
      }
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

  // Ring-Umriss: die Punkte jedes Rings wurden bereits in Kanten-
  // Reihenfolge (im Uhrzeigersinn) erzeugt, einfach der Reihe nach
  // verbinden (inkl. Rücksprung vom letzten zum ersten Punkt).
  for (let k = n; k >= 1; k--) {
    const ringPts = ringsById[k];
    const count = ringPts.length;
    for (let i = 0; i < count; i++) addEdge(ringPts[i].id, ringPts[(i + 1) % count].id);
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

  const maxDim = 2 * n + 1;
  const style = {
    rActive: clamp(9 - (maxDim - 3) * 0.85, 2.6, 9),
    rInactive: clamp(6 - (maxDim - 3) * 0.55, 1.8, 6),
    font: clamp(9 - (maxDim - 3) * 0.7, 3.6, 9),
    stroke: clamp(3 - (maxDim - 3) * 0.18, 1.1, 3)
  };

  return Object.assign(
    { shape, n, mode: 'radial', cols: maxDim, rows: maxDim, points, adjacency, style, spacing: unit },
    extraProps
  );
}

// Regelmäßiges Vieleck (Spezialfall: alle Ecken gleich weit vom
// Mittelpunkt entfernt, gleichmäßig verteilte Winkel) — unverändertes
// Verhalten/Ergebnis gegenüber der ursprünglichen Implementierung.
export function buildPolygonRadialGridDefinition(shape, sides, rings) {
  const corners = Array.from({ length: sides }, (_, j) => ({ angle: j * (2 * Math.PI / sides), radius: 1 }));
  return buildStarRadialGridDefinition(shape, corners, rings, { sides });
}

// QUADRAT (Rechteck-Raster, Radial-Modus) — regelmäßiges Vieleck mit
// 4 Seiten; Ecke 0 liegt oben (12 Uhr), das Quadrat erscheint dadurch
// als auf der Spitze stehende Raute (wie bei den übrigen Vielecken:
// "Radial" ist eine eigenständige, von der Reihen-Variante bewusst
// verschiedene Konstruktionsart).
// QUADRAT (Rechteck-Raster, Radial-Modus) — regelmäßiges Vieleck mit
// 4 Seiten. Ecken NICHT wie bei den übrigen Vielecken bei 0°/90°/180°/
// 270° (das ergäbe eine auf der Spitze stehende Raute), sondern um eine
// halbe Seiten-Winkelbreite (45°) gedreht auf 45°/135°/225°/315° — so
// liegt jeweils die MITTE einer Kante oben/rechts/unten/links, das
// Quadrat steht also flach auf der Seite statt auf der Spitze.
export function buildSquareRadialGridDefinition(rings) {
  const sides = 4;
  const rotation = Math.PI / sides;
  const corners = Array.from({ length: sides }, (_, j) => ({
    angle: rotation + j * (2 * Math.PI / sides), radius: 1
  }));
  return buildStarRadialGridDefinition('square', corners, rings, { sides });
}

// HEXAGON (Radial-Modus) — regelmäßiges Sechseck. Shape-Bezeichner
// bewusst 'hex' (nicht 'hexagon'), damit er mit dem intern überall
// genutzten Kürzel des bestehenden Hexagon-Standard-Modus übereinstimmt
// (GRID_BUILDERS-Schlüssel, specFromGrid, specsEqual, DIMS_LABEL).
export function buildHexagonRadialGridDefinition(rings) {
  return buildPolygonRadialGridDefinition('hex', 6, rings);
}

// DREIECK (Radial-Modus) — regelmäßiges (gleichseitiges) Dreieck.
export function buildTriangleRadialGridDefinition(rings) {
  return buildPolygonRadialGridDefinition('triangle', 3, rings);
}

// Gemeinsame Reihenbreiten-Formel der Raute (Peak in der Mitte),
// hier direkt als Array-Erzeuger statt als Live-Grid, da einige
// Modi (Diamant/Quadrat) nur einen Teil dieser Reihen verwenden
// oder zusätzliche Reihen anhängen.
function rhombusRowWidths(size) {
  const widths = [];
  const center = (size - 1) / 2;
  for (let r = 0; r < size; r++) {
    const dist = Math.abs(r - center);
    const steps = center === 0 ? (size - 1) / 2 : Math.round((1 - dist / center) * ((size - 1) / 2));
    widths.push(1 + 2 * steps);
  }
  return widths;
}

function fromRowWidths(shape, widths, extraProps) {
  const height = widths.length;
  const maxDim = Math.max(...widths, height);
  return buildTaperedRowGridDefinition(shape, height, maxDim, r => widths[r], extraProps || {});
}

/* -----------------------------------------------------
   FÜNFECK — Diamant
   Eine Raute (size×size), deren letzte Reihe (die untere Spitze,
   immer Breite 1) abgeschnitten wird — das Abschneiden EINER Ecke
   eines Vierecks erzeugt genau ein Fünfeck (5 Seiten statt 4).
   Beispiel size=5: Raute wäre 1,3,5,3,1 → Diamant: 1,3,5,3.
   ----------------------------------------------------- */
export function buildPentagonDiamondGridDefinition(size) {
  const widths = rhombusRowWidths(size).slice(0, size - 1);
  return fromRowWidths('pentagon', widths, { mode: 'diamond', size, cols: size, rows: widths.length });
}

/* -----------------------------------------------------
   FÜNFECK — Quadrat
   Wie Diamant, aber um eine Reihe verlängert (Wiederholung der
   letzten Diamant-Reihenbreite), damit das Fünfeck exakt in ein
   size×size-Quadrat passt. Beispiel size=5: 1,3,5,3,3.
   ----------------------------------------------------- */
export function buildPentagonSquareGridDefinition(size) {
  const diamond = rhombusRowWidths(size).slice(0, size - 1);
  const widths = diamond.concat([diamond[diamond.length - 1]]);
  return fromRowWidths('pentagon', widths, { mode: 'square', size, cols: size, rows: widths.length });
}

export function buildPentagonRadialGridDefinition(rings) {
  return buildPolygonRadialGridDefinition('pentagon', 5, rings);
}

/* -----------------------------------------------------
   SIEBENECK — Rechteck
   Spitze (1 Punkt) → volle Breite W für (Höhe−2) Reihen ("Wände")
   → eine letzte Reihe, die nur einen Taper-Schritt schmaler ist
   (W−2, statt bis auf 1 zu verjüngen) und damit eine flache
   Unterkante bildet. Beispiel 5×4: 1,5,5,3.
   ----------------------------------------------------- */
export function buildHeptagonRectangleGridDefinition(width, height) {
  const widths = [1, ...Array(Math.max(0, height - 2)).fill(width), width - 2];
  return fromRowWidths('heptagon', widths, { mode: 'rectangle', width, height, cols: width, rows: height });
}

export function buildHeptagonRadialGridDefinition(rings) {
  return buildPolygonRadialGridDefinition('heptagon', 7, rings);
}

/* -----------------------------------------------------
   ACHTECK — Quadrat
   Symmetrische Variante des Siebenecks: oben UND unten je eine
   Reihe mit Breite (size−2) statt einer einzelnen Spitze, dazwischen
   (size−2) Reihen auf voller Breite — entspricht einem Quadrat mit
   allen 4 abgeschnittenen Ecken (klassisches Achteck).
   Beispiel 4×4: 2,4,4,2.
   ----------------------------------------------------- */
export function buildOctagonSquareGridDefinition(size) {
  const widths = [size - 2, ...Array(Math.max(0, size - 2)).fill(size), size - 2];
  return fromRowWidths('octagon', widths, { mode: 'square', size, cols: size, rows: widths.length });
}

export function buildOctagonRadialGridDefinition(rings) {
  return buildPolygonRadialGridDefinition('octagon', 8, rings);
}

/* -----------------------------------------------------
   NEUNECK (Quadrat) / ZEHNECK (Rechteck) — gemeinsame "Spitzen"-Formel
   Spitze (1 Punkt) → k Reihen bei (Breite−2) → Scheitelreihe auf
   voller Breite → k weitere Reihen bei (Breite−2) → eine letzte,
   um einen Taper-Schritt schmalere Reihe (Breite−4) statt einer
   erneuten Spitze. k = (Höhe−3)/2, Höhe muss daher ungerade sein.
   Bei width=height (Neuneck) entsteht ein Quadrat, bei
   unabhängigem width/height (Zehneck) ein Rechteck.
   Beispiel Neuneck 7×7 (k=2): 1,5,5,7,5,5,3.
   Beispiel Zehneck 7×5 (k=1): 1,5,7,5,3.
   ----------------------------------------------------- */
function peakTaperRowWidths(width, height) {
  const k = (height - 3) / 2;
  const side = Array(Math.max(0, k)).fill(width - 2);
  return [1, ...side, width, ...side, width - 4];
}

export function buildNonagonSquareGridDefinition(size) {
  const widths = peakTaperRowWidths(size, size);
  return fromRowWidths('nonagon', widths, { mode: 'square', size, cols: size, rows: widths.length });
}

export function buildNonagonRadialGridDefinition(rings) {
  return buildPolygonRadialGridDefinition('nonagon', 9, rings);
}

export function buildDecagonRectangleGridDefinition(width, height) {
  const widths = peakTaperRowWidths(width, height);
  return fromRowWidths('decagon', widths, { mode: 'rectangle', width, height, cols: width, rows: height });
}

export function buildDecagonRadialGridDefinition(rings) {
  return buildPolygonRadialGridDefinition('decagon', 10, rings);
}
