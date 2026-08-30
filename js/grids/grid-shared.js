/* =====================================================
   Gemeinsamer Helper für zeilenweise verjüngte/erweiterte Raster
   (Dreieck, Raute, Trapez): jede Reihe hat eine über `rowWidthFn(r)`
   bestimmte Breite und ist zentriert unter derselben Spalte
   platziert. King-Move-Nachbarschaft, existenzgeprüft.
   ===================================================== */
import { clamp } from '../config.js';

/* =====================================================
   Zweiter Helper: zeilenweise Raster, bei denen eine Zeile aus MEHREREN
   getrennten Spalten-Abschnitten bestehen kann (z. B. ein echtes
   Sternpolygon — ein horizontaler Schnitt durch einen Stern trifft bei
   manchen Höhen zwei oder mehr getrennte Bereiche, nicht nur einen
   durchgehenden Streifen wie bei Dreieck/Raute/Trapez). `rowColumnsFn(r)`
   liefert die vollständige, bereits sortierte Liste eindeutiger
   Spalten-Ganzzahlen dieser Zeile (in einem gemeinsamen, über alle
   Zeilen hinweg konsistenten Koordinatensystem, Spalte 0 = Mittelachse)
   — nicht nur eine Breite. King-Move-Nachbarschaft wie beim anderen
   Helper: Lücken zwischen getrennten Abschnitten bleiben automatisch
   unverbunden, da die dazwischenliegenden Spalten schlicht nicht
   existieren.
   ===================================================== */
export function buildRowSpanGridDefinition(shape, height, maxDim, rowColumnsFn, extraProps) {
  const VIEW = 320;
  const margin = 40;
  const spacing = maxDim === 1 ? 0 : (VIEW - 2 * margin) / (maxDim - 1);
  const gridHeightPx = (height - 1) * spacing;
  const offsetX = margin + (VIEW - 2 * margin) / 2;
  const offsetY = margin + ((VIEW - 2 * margin) - gridHeightPx) / 2;

  const points = {};
  const coordToId = {};
  const colsByRow = [];
  let id = 1;
  for (let r = 0; r < height; r++) {
    const cols = rowColumnsFn(r);
    colsByRow.push(cols);
    cols.forEach(c => {
      points[id] = { x: offsetX + c * spacing, y: offsetY + r * spacing };
      coordToId[r + ',' + c] = id;
      id++;
    });
  }

  const adjacency = {};
  Object.keys(points).forEach(k => (adjacency[k] = []));
  for (let r = 0; r < height; r++) {
    colsByRow[r].forEach(c => {
      const vId = coordToId[r + ',' + c];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const key = (r + dr) + ',' + (c + dc);
          if (coordToId[key] !== undefined) adjacency[vId].push(coordToId[key]);
        }
      }
    });
  }

  const style = {
    rActive: clamp(9 - (maxDim - 3) * 0.85, 2.6, 9),
    rInactive: clamp(6 - (maxDim - 3) * 0.55, 1.8, 6),
    font: clamp(9 - (maxDim - 3) * 0.7, 3.6, 9),
    stroke: clamp(3 - (maxDim - 3) * 0.18, 1.1, 3)
  };

  return Object.assign({ shape, height, points, adjacency, style, spacing }, extraProps);
}

/* -----------------------------------------------------
   Allgemeine Grundlage: liefert für ein BELIEBIGES geschlossenes,
   vom Zentrum aus sternförmiges Vieleck (Eckenliste als {x,y}-Punkte
   im Uhrzeigersinn, im Uhrzeigersinn beliebiger erster Ecke) eine
   Funktion rowColumns(r), die für Zeile r (von 0=oben bis height-1=
   unten) die tatsächlichen, per horizontalem Schnitt durch das echte
   Vieleck ermittelten Spalten liefert — inklusive etwaiger Lücken,
   falls der Schnitt bei dieser Höhe mehrere getrennte Bereiche trifft.
   Zeilen werden an ihrer MITTE abgetastet ((r+0.5)/height) statt exakt
   bei den Eckenhöhen, um Entartungsfälle (Schnitt exakt durch eine
   Ecke) zu vermeiden.
   ----------------------------------------------------- */
export function computePolygonRowColumns(corners, width, height) {
  const sides = corners.length;
  const ys = corners.map(c => c.y);
  const topY = Math.min(...ys);
  const bottomY = Math.max(...ys);
  const maxAbsX = Math.max(...corners.map(c => Math.abs(c.x)));
  const unitPerColumn = width > 1 ? (2 * maxAbsX) / (width - 1) : 1;

  return function rowColumns(r) {
    const y = topY + (bottomY - topY) * (r + 0.5) / height;
    const xs = [];
    for (let i = 0; i < sides; i++) {
      const a = corners[i], b = corners[(i + 1) % sides];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const t = (y - a.y) / (b.y - a.y);
        xs.push(a.x + t * (b.x - a.x));
      }
    }
    xs.sort((p, q) => p - q);
    const colSet = new Set();
    for (let i = 0; i + 1 < xs.length; i += 2) {
      let colLeft = Math.round(xs[i] / unitPerColumn);
      let colRight = Math.round(xs[i + 1] / unitPerColumn);
      if (colRight < colLeft) colRight = colLeft;
      for (let c = colLeft; c <= colRight; c++) colSet.add(c);
    }
    if (colSet.size === 0) colSet.add(0); // Sicherheitsnetz, praktisch nie nötig
    return Array.from(colSet).sort((a, b) => a - b);
  };
}

/* -----------------------------------------------------
   Sternpolygon-Spezialfall: 2×tips Ecken, abwechselnd Außenradius 1
   und Innenradius `innerRatio`, erste Ecke oben. Genutzt sowohl vom
   Sternpolygon (tips variabel) als auch vom Kompassstern (tips fest 4).
   ----------------------------------------------------- */
export function computeStarPolygonRowColumns(tips, innerRatio, width, height) {
  const sides = tips * 2;
  const corners = Array.from({ length: sides }, (_, j) => {
    const angle = j * (2 * Math.PI / sides);
    const r = j % 2 === 0 ? 1 : innerRatio;
    return { x: r * Math.sin(angle), y: -r * Math.cos(angle) };
  });
  return computePolygonRowColumns(corners, width, height);
}

export function buildTaperedRowGridDefinition(shape, height, maxDim, rowWidthFn, extraProps) {
  const VIEW = 320;
  const margin = 40;
  const spacing = maxDim === 1 ? 0 : (VIEW - 2 * margin) / (maxDim - 1);
  const gridHeightPx = (height - 1) * spacing;
  const offsetX = margin + (VIEW - 2 * margin) / 2; // zentrierte Spalte bleibt bei 0
  const offsetY = margin + ((VIEW - 2 * margin) - gridHeightPx) / 2;

  const points = {};
  const coordToId = {};
  let id = 1;
  for (let r = 0; r < height; r++) {
    const w = rowWidthFn(r);
    const colStart = -(w - 1) / 2;
    for (let i = 0; i < w; i++) {
      const c = colStart + i;
      points[id] = { x: offsetX + c * spacing, y: offsetY + r * spacing };
      coordToId[r + ',' + c] = id;
      id++;
    }
  }

  const adjacency = {};
  Object.keys(points).forEach(k => (adjacency[k] = []));
  for (let r = 0; r < height; r++) {
    const w = rowWidthFn(r);
    const colStart = -(w - 1) / 2;
    for (let i = 0; i < w; i++) {
      const c = colStart + i;
      const vId = coordToId[r + ',' + c];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const key = (r + dr) + ',' + (c + dc);
          if (coordToId[key] !== undefined) adjacency[vId].push(coordToId[key]);
        }
      }
    }
  }

  const style = {
    rActive: clamp(9 - (maxDim - 3) * 0.85, 2.6, 9),
    rInactive: clamp(6 - (maxDim - 3) * 0.55, 1.8, 6),
    font: clamp(9 - (maxDim - 3) * 0.7, 3.6, 9),
    stroke: clamp(3 - (maxDim - 3) * 0.18, 1.1, 3)
  };

  return Object.assign({ shape, height, points, adjacency, style, spacing }, extraProps);
}
