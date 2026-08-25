(function () {
  "use strict";

  /* =====================================================
     THEME TOGGLE
     ===================================================== */
  const html = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const iconSun = document.getElementById('iconSun');
  const iconMoon = document.getElementById('iconMoon');

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Zu Light Mode wechseln' : 'Zu Dark Mode wechseln');
    iconSun.style.display = theme === 'dark' ? 'block' : 'none';
    iconMoon.style.display = theme === 'dark' ? 'none' : 'block';
  }
  themeToggle.addEventListener('click', () => {
    applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* =====================================================
     KONSTANTEN / BUDGETS
     Schutz gegen Endlosläufe im Browser bei größeren
     Rastern bzw. hohen Schrittzahlen.
     ===================================================== */
  const EXACT_EDGE_LIMIT       = 26;     // bis hierhin exakte Berechnung (Bitmask-DP)
  const MAX_STEPS_TIME_BUDGET  = 500;    // ms, für approximative Maximalsuche (größere Raster)
  const GENERATION_NODE_BUDGET = 200000; // Rekursionsschritte pro Generierungsversuch
  const GENERATION_RETRIES     = 5;

  // "Mehrere Elemente": pro Element eigenes Budget, plus Versuche für die
  // Gesamtkonstruktion (Größenverteilung + alle Elemente), falls ein
  // einzelnes Element mit der gewählten Punktzahl/Restfläche nicht
  // erzeugbar ist.
  const MULTI_NODE_BUDGET_PER_ELEMENT = 100000;
  const MULTI_RETRIES                 = 8;

  // "Alle Kombinationen" hat KEIN festes Anzeige-Limit mehr. Stattdessen:
  // - Ergebnisse werden per Generator lazy berechnet (nur was gebraucht wird)
  // - jeder Ladeschritt läuft zeitgescheibelt, damit der Main-Thread nie blockiert
  // - eine sehr hohe Sicherheitsgrenze fängt nur pathologische Extremfälle ab
  const ENUM_BATCH_SIZE           = 48;      // Karten pro Ladeschritt (Scroll/Button)
  const ENUM_BATCH_TIME_SLICE_MS  = 35;      // max. ms Rechenzeit am Stück, bevor an den Browser abgegeben wird
  const ENUM_NODE_SAFETY_CEILING  = 3000000; // Notausstieg gegen pathologische Endlossuchen
  const ENUM_AUTO_LOAD_SOFT_LIMIT = 3000;    // ab hier: manueller Button statt automatischem Nachladen

  /* =====================================================
     RASTER-ERZEUGUNG
     Punkte werden auf einem cols×rows-Gitter angeordnet
     (auch nicht-quadratisch, z. B. 2×3, 4×6, 7×3). Zwei
     Punkte gelten als "im Umkreis" (verbindbar), wenn sie
     höchstens ein Feld waagerecht, senkrecht oder diagonal
     auseinanderliegen (King-Move-Nachbarschaft) — exakt das
     Muster aus der 3×3-Vorgabe (z. B. Punkt 5 verbindet
     sich mit allen 8 Nachbarn, Eckpunkte nur mit 3).
     ===================================================== */
  const CUSTOM_MIN_DIM = 2;
  const CUSTOM_MAX_DIM = 12;

  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function buildGridDefinition(cols, rows) {
    const VIEW = 320;
    const margin = 40;
    const maxDim = Math.max(cols, rows);

    // Gleichmäßiger Punktabstand auf beiden Achsen (quadratische
    // Zellen), zentriert im Koordinatensystem — auch bei
    // rechteckigen Rastern wie 2×3 oder 7×3.
    const spacing = maxDim === 1 ? 0 : (VIEW - 2 * margin) / (maxDim - 1);
    const gridWidthPx = (cols - 1) * spacing;
    const gridHeightPx = (rows - 1) * spacing;
    const offsetX = margin + ((VIEW - 2 * margin) - gridWidthPx) / 2;
    const offsetY = margin + ((VIEW - 2 * margin) - gridHeightPx) / 2;

    const points = {};
    const coordToId = {};
    let id = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        points[id] = { x: offsetX + c * spacing, y: offsetY + r * spacing };
        coordToId[r + ',' + c] = id;
        id++;
      }
    }

    const adjacency = {};
    Object.keys(points).forEach(k => (adjacency[k] = []));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = coordToId[r + ',' + c];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              adjacency[v].push(coordToId[nr + ',' + nc]);
            }
          }
        }
      }
    }

    // Visuelle Feinjustierung je nach Rasterdichte (skaliert stufenlos
    // mit der größeren Kantenlänge, damit auch ungewöhnliche
    // benutzerdefinierte Größen wie 7×3 gut lesbar bleiben).
    const style = {
      rActive: clamp(9 - (maxDim - 3) * 0.85, 2.6, 9),
      rInactive: clamp(6 - (maxDim - 3) * 0.55, 1.8, 6),
      font: clamp(9 - (maxDim - 3) * 0.7, 3.6, 9),
      stroke: clamp(3 - (maxDim - 3) * 0.18, 1.1, 3)
    };

    return { shape: 'rect', cols, rows, points, adjacency, style, spacing };
  }

  /* =====================================================
     HEXAGON-RASTER
     Ein Hexagon wird als Teilmenge eines rechteckigen Punktrasters
     erzeugt: Reihen wachsen symmetrisch von 1 Punkt auf die volle
     Breite (Anzahl der "Schrägseiten"-Reihen = d), verharren dann für
     "Vertikalseiten" (v) Reihen auf voller Breite, und verjüngen sich
     danach spiegelbildlich wieder auf 1 Punkt. Für d=3, v=3 ergeben
     sich so die Reihenbreiten 1,3,5,5,5,3,1 — exakt das vom Nutzer
     vorgegebene Muster. Die King-Move-Nachbarschaft bleibt unverändert,
     zählt aber nur tatsächlich existierende (nicht weggeschnittene)
     Nachbarpunkte.
     ===================================================== */
  function buildHexGridDefinition(d, v) {
    const W = 2 * d - 1;                 // maximale Breite (mittlere Reihen)
    const topTaper = d;                  // Reihen, die von 1 auf W aufweiten (inkl. der Reihe mit Breite W)
    const midRows = v - 1;               // zusätzliche Reihen auf voller Breite W
    const bottomTaper = d - 1;           // Reihen, die spiegelbildlich wieder auf 1 verjüngen
    const totalRows = topTaper + midRows + bottomTaper;

    function rowWidth(r) {
      if (r < topTaper) return 2 * (r + 1) - 1;
      if (r < topTaper + midRows) return W;
      const idxFromEnd = totalRows - 1 - r;
      return 2 * (idxFromEnd + 1) - 1;
    }

    const VIEW = 320;
    const margin = 40;
    const maxDim = Math.max(W, totalRows);
    const spacing = maxDim === 1 ? 0 : (VIEW - 2 * margin) / (maxDim - 1);
    const gridWidthPx = (W - 1) * spacing;
    const gridHeightPx = (totalRows - 1) * spacing;
    const offsetX = margin + ((VIEW - 2 * margin) - gridWidthPx) / 2;
    const offsetY = margin + ((VIEW - 2 * margin) - gridHeightPx) / 2;

    const points = {};
    const coordToId = {};
    let id = 1;
    for (let r = 0; r < totalRows; r++) {
      const width = rowWidth(r);
      const colStart = (W - width) / 2; // horizontal zentriert unter der breitesten Reihe
      for (let i = 0; i < width; i++) {
        const c = colStart + i;
        points[id] = { x: offsetX + c * spacing, y: offsetY + r * spacing };
        coordToId[r + ',' + c] = id;
        id++;
      }
    }

    const adjacency = {};
    Object.keys(points).forEach(k => (adjacency[k] = []));
    for (let r = 0; r < totalRows; r++) {
      const width = rowWidth(r);
      const colStart = (W - width) / 2;
      for (let i = 0; i < width; i++) {
        const c = colStart + i;
        const vId = coordToId[r + ',' + c];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const key = (r + dr) + ',' + (c + dc);
            if (coordToId[key] !== undefined) {
              adjacency[vId].push(coordToId[key]);
            }
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

    return { shape: 'hex', d, v, cols: W, rows: totalRows, points, adjacency, style, spacing };
  }

  /* =====================================================
     KREIS-RASTER
     Ring 0 ist der Mittelpunkt. Ring k (k ≥ 1) hat 4k Punkte
     (Ring1=4, Ring2=8, Ring3=12, …) — diese Regel bestimmt nur die
     ANZAHL und NUMMERIERUNG pro Ring, nicht die Position. Die Punkte
     werden auf echten konzentrischen Kreisen platziert (Polarkoor-
     dinaten: Radius ∝ Ringindex, gleichmäßig verteilter Winkel),
     nicht auf einem quadratischen Gitter — sonst entstünde ein
     Diamant statt eines Kreises. Nummerierung: äußerster Ring
     zuerst, im Uhrzeigersinn ab 12 Uhr, Zentrum zuletzt.

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
     Ringzahl/Topologie (welche Punkte existieren, 4k pro Ring,
     Nachbarschaft) richten sich nach n=max(rx,ry); beim Umrechnen
     von Winkel+Ringindex in Bildschirmkoordinaten wird x mit rx/n
     und y mit ry/n skaliert. Für rx=ry ergibt sich exakt der Kreis
     (Spezialfall) — die Winkel selbst werden VOR der Streckung
     berechnet, wodurch die radialen Speichen auch bei stark
     unterschiedlichem rx/ry sinnvoll bleiben.
     ===================================================== */
  function buildRadialGridDefinition(shape, rx, ry) {
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
      const count = 4 * k;
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

    return { shape, n, rx, ry, cols: maxDim, rows: maxDim, points, adjacency, style, spacing: unit };
  }

  function buildCircleGridDefinition(n) {
    return buildRadialGridDefinition('circle', n, n);
  }

  function buildEllipseGridDefinition(rx, ry) {
    return buildRadialGridDefinition('ellipse', rx, ry);
  }

  /* =====================================================
     Gemeinsamer Helper für zeilenweise verjüngte/erweiterte Raster
     (Dreieck, Trapez): jede Reihe hat eine über `rowWidthFn(r)`
     bestimmte Breite und ist zentriert unter derselben Spalte
     platziert. King-Move-Nachbarschaft, existenzgeprüft.
     ===================================================== */
  function buildTaperedRowGridDefinition(shape, height, maxDim, rowWidthFn, extraProps) {
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

  /* =====================================================
     DREIECK-RASTER
     Reihe 0 (oben) hat 1 Punkt, jede weitere Reihe wird breiter,
     bis Reihe (height-1) (unten) genau `width` Punkte hat. Alle
     Reihenbreiten sind ungerade und zentriert unter derselben
     Spitzenspalte — deshalb MUSS `width` ungerade sein (sonst wäre
     die unterste Reihe nicht symmetrisch zur Spitze zentrierbar).

     Bei width = 2·height−1 (Standardfall, z. B. Breite 5/Höhe 3 aus
     der Vorlage) wächst jede Reihe um genau 2 Punkte. Sind Breite
     und Höhe unabhängig davon gewählt, interpoliert die Formel die
     "Anzahl der +2-Schritte" linear zwischen Reihe 0 und der
     letzten Reihe und rundet — das garantiert weiterhin durchweg
     ungerade, symmetrisch zentrierte Reihenbreiten, auch wenn dabei
     einzelne Reihen dieselbe Breite wiederholen (Plateau).
     ===================================================== */
  function buildTriangleGridDefinition(width, height) {
    function rowWidth(i) {
      if (height === 1) return width;
      const steps = Math.round(i * ((width - 1) / 2) / (height - 1));
      return 1 + 2 * steps;
    }
    const maxDim = Math.max(width, height);
    return buildTaperedRowGridDefinition('triangle', height, maxDim, rowWidth, {
      width, cols: width, rows: height
    });
  }

  /* =====================================================
     RAUTE-RASTER
     Eine Raute ist im Kern ein Dreieck, das sich nach der Mitte
     hin wieder symmetrisch verjüngt: Reihe 0 (oben) hat 1 Punkt,
     die Breite wächst zur mittleren Reihe hin auf `width` an und
     nimmt danach spiegelbildlich wieder auf 1 ab (klassische Raute
     bei width=height, z. B. 5×5 → Reihenbreiten 1,3,5,3,1).

     Wie beim Dreieck wird die "Anzahl der +2-Schritte" linear
     interpoliert und gerundet — hier bezogen auf den Abstand jeder
     Reihe zur Mitte statt zur Spitze. Das garantiert wie beim
     Dreieck durchweg ungerade, zentrierte Reihenbreiten; deshalb
     MUSS `width` ungerade sein. Bei gerader Höhe gibt es keine
     exakte Mittelreihe — die beiden mittleren Reihen erreichen dann
     ggf. nicht ganz die volle Breite (siehe H=4/W=5 → 1,3,3,1),
     analog zum "Plateau"-Verhalten bei Dreieck/Hexagon.
     ===================================================== */
  function buildRhombusGridDefinition(width, height) {
    function rowWidth(r) {
      if (height === 1) return width;
      const center = (height - 1) / 2;
      const dist = Math.abs(r - center);
      const steps = Math.round((1 - dist / center) * ((width - 1) / 2));
      return 1 + 2 * steps;
    }
    const maxDim = Math.max(width, height);
    return buildTaperedRowGridDefinition('rhombus', height, maxDim, rowWidth, {
      width, cols: width, rows: height
    });
  }

  /* =====================================================
     TRAPEZ-RASTER
     Reihe 0 (oben, kurze Seite) hat `top` Punkte, jede weitere Reihe
     wächst um genau 2 Punkte, bis Reihe (height-1) (unten, lange
     Seite) erreicht ist: Unterseite = top + 2×(Höhe−1) — durch vier
     Beispiele verifiziert (2×4→8, 3×3→7, 4×3→8, 5×4→11). Da JEDE
     Reihe um genau 2 wächst, teilen sich Ober- und Unterseite immer
     dieselbe Parität; die Differenz (Unterseite − Reihenbreite) ist
     dadurch automatisch immer gerade — anders als beim Dreieck muss
     `top` deshalb NICHT zwingend ungerade sein, die Zentrierung
     funktioniert für jede Startbreite.
     ===================================================== */
  function buildTrapezoidGridDefinition(top, height) {
    function rowWidth(i) { return top + 2 * i; }
    const bottom = top + 2 * (height - 1);
    const maxDim = Math.max(bottom, height);
    return buildTaperedRowGridDefinition('trapezoid', height, maxDim, rowWidth, {
      top, bottom, cols: bottom, rows: height
    });
  }

  /* =====================================================
     PARALLELOGRAMM-RASTER
     Jede Reihe hat konstant `sideLength` Punkte (anders als bei
     Dreieck/Trapez ändert sich die Reihenbreite nicht) — stattdessen
     verschiebt sich die START-Spalte jeder Reihe kumulativ um
     `offset` relativ zur vorherigen Reihe: Reihe r beginnt bei
     Spalte r×offset. Ein Versatz von -1 schiebt jede Reihe einen
     Punkt nach links, +2 schiebt zwei Punkte nach rechts — jeweils
     aufsummiert über alle vorherigen Reihen, nicht nur einmalig.
     Gegen zwei Referenzfotos verifiziert (Seitenlänge 4, Höhe 3,
     Versatz -1 bzw. -2). King-Move-Nachbarschaft wie bei allen
     anderen Rastern, existenzgeprüft.
     ===================================================== */
  function buildParallelogramGridDefinition(sideLength, height, offset) {
    let minCol = Infinity, maxCol = -Infinity;
    for (let r = 0; r < height; r++) {
      const start = r * offset;
      minCol = Math.min(minCol, start);
      maxCol = Math.max(maxCol, start + sideLength - 1);
    }
    const totalCols = maxCol - minCol + 1;

    const VIEW = 320;
    const margin = 40;
    const maxDim = Math.max(totalCols, height);
    const spacing = maxDim === 1 ? 0 : (VIEW - 2 * margin) / (maxDim - 1);
    const gridWidthPx = (totalCols - 1) * spacing;
    const gridHeightPx = (height - 1) * spacing;
    const offsetX = margin + ((VIEW - 2 * margin) - gridWidthPx) / 2;
    const offsetY = margin + ((VIEW - 2 * margin) - gridHeightPx) / 2;

    const points = {};
    const coordToId = {};
    let id = 1;
    for (let r = 0; r < height; r++) {
      const rowStart = r * offset - minCol;
      for (let i = 0; i < sideLength; i++) {
        const c = rowStart + i;
        points[id] = { x: offsetX + c * spacing, y: offsetY + r * spacing };
        coordToId[r + ',' + c] = id;
        id++;
      }
    }

    const adjacency = {};
    Object.keys(points).forEach(k => (adjacency[k] = []));
    for (let r = 0; r < height; r++) {
      const rowStart = r * offset - minCol;
      for (let i = 0; i < sideLength; i++) {
        const c = rowStart + i;
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

    return {
      shape: 'parallelogram', sideLength, height, offset,
      cols: totalCols, rows: height, points, adjacency, style, spacing
    };
  }

  /* =====================================================
     GRAPH-AUFBEREITUNG
     Aus der Nachbarschaftsliste werden eindeutige,
     ungerichtete Kanten erzeugt (jede Strecke bekommt eine
     feste ID → verhindert Doppelbelegung). Verbotene Punkte
     (forbiddenSet) werden komplett aus dem nutzbaren Graphen
     entfernt: keine Strecke darf von ihnen ausgehen oder bei
     ihnen enden. grid.points bleibt vollständig erhalten,
     damit verbotene Punkte trotzdem gezeichnet werden können.
     ===================================================== */
  function buildGraph(grid, forbiddenSet) {
    forbiddenSet = forbiddenSet || new Set();
    const allVertices = Object.keys(grid.points).map(Number);
    const vertices = allVertices.filter(v => !forbiddenSet.has(v));
    const edges = [];
    const byVertex = {};
    vertices.forEach(v => (byVertex[v] = []));

    vertices.forEach(v => {
      grid.adjacency[v].forEach(w => {
        if (forbiddenSet.has(w)) return;
        if (v < w) {
          const id = edges.length;
          edges.push({ id, a: v, b: w });
          byVertex[v].push({ edgeId: id, to: w });
          byVertex[w].push({ edgeId: id, to: v });
        }
      });
    });

    return { vertices, edges, byVertex, allVertices, forbiddenSet };
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

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
  const CONCENTRATION_RADIUS_FACTOR = 1.55;
  const CONCENTRATION_THRESHOLD = 0.55;

  function pointsEqual(p, q) {
    return Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6;
  }
  function orientation(p, q, r) {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < 1e-9) return 0;
    return val > 0 ? 1 : 2;
  }
  function onSegment(p, q, r) {
    return Math.min(p.x, r.x) - 1e-6 <= q.x && q.x <= Math.max(p.x, r.x) + 1e-6 &&
           Math.min(p.y, r.y) - 1e-6 <= q.y && q.y <= Math.max(p.y, r.y) + 1e-6;
  }
  // Zwei Strecken "kreuzen" sich nur, wenn sie sich in ihrem Inneren
  // schneiden. Ein gemeinsamer Endpunkt (Punkt, an dem zwei Strecken
  // zusammentreffen) zählt bewusst NICHT als Kreuzung.
  function segmentsProperlyIntersect(p1, p2, p3, p4) {
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
  function crossesAny(newSeg, usedSegments) {
    for (const seg of usedSegments) {
      if (segmentsProperlyIntersect(newSeg[0], newSeg[1], seg[0], seg[1])) return true;
    }
    return false;
  }

  // Heuristik: Anteil bereits belegter Punkte im unmittelbaren Umkreis
  // des Kandidaten. usedLookup ist ein Set ODER eine Map — beide
  // unterstützen .has(), daher funktioniert die Funktion unverändert
  // sowohl im Trail- als auch im Ast-Modus.
  function concentrationTooHigh(candidateVertex, usedLookup, grid) {
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

  function vcAdd(map, v) { map.set(v, (map.get(v) || 0) + 1); }
  function vcRemove(map, v) {
    const c = (map.get(v) || 0) - 1;
    if (c <= 0) map.delete(v); else map.set(v, c);
  }

  // Zentrales Prädikat: prüft einen Kandidaten-Schritt (fromVertex → opt.to)
  // gegen alle aktiven erweiterten Optionen.
  function passesConstraints(fromVertex, opt, grid, constraints, usedLookup, usedSegments) {
    if (constraints.avoidPointReuse && usedLookup.has(opt.to)) return false;
    if (constraints.avoidCrossing) {
      const seg = [grid.points[fromVertex], grid.points[opt.to]];
      if (crossesAny(seg, usedSegments)) return false;
    }
    if (constraints.avoidConcentration && concentrationTooHigh(opt.to, usedLookup, grid)) return false;
    return true;
  }

  /* =====================================================
     MAXIMALE SCHRITTZAHL
     Längster "Trail" (Kantenzug ohne Kantenwiederholung,
     Punkte dürfen mehrfach besucht werden).

     - Kleine Raster (3×3, ≤26 Kanten): exakte Lösung per
       Memoisation über (Knoten, Kanten-Bitmaske).
     - Größere Raster (4×4, 5×5): eine erschöpfende exakte
       Suche ist praktisch nicht mehr berechenbar (>2^40
       Zustände). Stattdessen wird per zeitlich begrenzter,
       wiederholt neu gestarteter Tiefensuche der längste
       tatsächlich gefundene Trail ermittelt — ein sehr
       nah am echten Optimum liegender, klar gekennzeichneter
       Näherungswert.
     ===================================================== */
  function exactLongestTrail(graph) {
    const memo = new Map();
    const MULT = 1 << 27;

    function rec(vertex, mask) {
      const key = vertex * MULT + mask;
      if (memo.has(key)) return memo.get(key);
      let best = 0;
      for (const { edgeId, to } of graph.byVertex[vertex]) {
        const bit = 1 << edgeId;
        if (!(mask & bit)) {
          const val = 1 + rec(to, mask | bit);
          if (val > best) best = val;
        }
      }
      memo.set(key, best);
      return best;
    }

    let max = 0;
    graph.vertices.forEach(v => {
      const val = rec(v, 0);
      if (val > max) max = val;
    });
    return max;
  }

  function approxLongestTrail(graph, grid, constraints, timeBudgetMs) {
    const deadline = Date.now() + timeBudgetMs;
    const usedEdges = new Array(graph.edges.length).fill(false);
    let bestLen = 0, calls = 0, stop = false;

    function dfs(vertex, depth, usedVertexCount, usedSegments) {
      calls++;
      if ((calls & 511) === 0 && Date.now() > deadline) { stop = true; return; }
      if (depth > bestLen) bestLen = depth;
      const rawOptions = graph.byVertex[vertex].filter(o => !usedEdges[o.edgeId]);
      const options = shuffle(rawOptions).filter(opt => passesConstraints(vertex, opt, grid, constraints, usedVertexCount, usedSegments));
      for (const opt of options) {
        if (stop) return;
        usedEdges[opt.edgeId] = true;
        vcAdd(usedVertexCount, opt.to);
        usedSegments.push([grid.points[vertex], grid.points[opt.to]]);
        dfs(opt.to, depth + 1, usedVertexCount, usedSegments);
        usedSegments.pop();
        vcRemove(usedVertexCount, opt.to);
        usedEdges[opt.edgeId] = false;
        if (stop) return;
      }
    }

    while (!stop && Date.now() < deadline) {
      usedEdges.fill(false);
      const start = graph.vertices[Math.floor(Math.random() * graph.vertices.length)];
      const usedVertexCount = new Map();
      vcAdd(usedVertexCount, start);
      dfs(start, 0, usedVertexCount, []);
    }
    return bestLen;
  }

  // Wie approxLongestTrail, aber für den Ast-Modus: statt einer
  // durchgehenden Linie wächst hier ein Baum (jeder neue Punkt hängt
  // sich an einen beliebigen bereits benutzten Punkt an).
  function approxLongestTree(graph, grid, constraints, timeBudgetMs) {
    const deadline = Date.now() + timeBudgetMs;
    const usedEdges = new Array(graph.edges.length).fill(false);
    let bestLen = 0, calls = 0, stop = false;

    function grow(usedVertices, usedSegments, size) {
      calls++;
      if ((calls & 511) === 0 && Date.now() > deadline) { stop = true; return; }
      if (size > bestLen) bestLen = size;
      const frontier = shuffle(Array.from(usedVertices));
      for (const u of frontier) {
        if (stop) return;
        const rawOptions = graph.byVertex[u].filter(o => !usedEdges[o.edgeId] && !usedVertices.has(o.to));
        const options = shuffle(rawOptions).filter(opt => passesConstraints(u, opt, grid, constraints, usedVertices, usedSegments));
        for (const opt of options) {
          if (stop) return;
          usedEdges[opt.edgeId] = true;
          usedVertices.add(opt.to);
          usedSegments.push([grid.points[u], grid.points[opt.to]]);
          grow(usedVertices, usedSegments, size + 1);
          usedSegments.pop();
          usedVertices.delete(opt.to);
          usedEdges[opt.edgeId] = false;
          if (stop) return;
        }
      }
    }

    while (!stop && Date.now() < deadline) {
      usedEdges.fill(false);
      const start = graph.vertices[Math.floor(Math.random() * graph.vertices.length)];
      grow(new Set([start]), [], 0);
    }
    return bestLen;
  }

  function computeMaxSteps(graph, grid, constraints) {
    if (constraints.treeMode) {
      return { value: approxLongestTree(graph, grid, constraints, MAX_STEPS_TIME_BUDGET), exact: false };
    }
    const advanced = constraints.avoidCrossing || constraints.avoidPointReuse || constraints.avoidConcentration;
    if (!advanced && graph.edges.length <= EXACT_EDGE_LIMIT) {
      return { value: exactLongestTrail(graph), exact: true };
    }
    return { value: approxLongestTrail(graph, grid, constraints, MAX_STEPS_TIME_BUDGET), exact: false };
  }

  /* =====================================================
     ZUFÄLLIGE GLYPHEN-ERZEUGUNG
     Echtes Backtracking: An jedem Punkt wird zufällig unter
     den noch unbenutzten Nachbarstrecken gewählt; führt eine
     Wahl in eine Sackgasse, wird zurückgesprungen (Backtrack)
     und die nächste Option probiert. Ein Kanten-Budget
     verhindert ein Hängenbleiben bei sehr großen Rastern.
     ===================================================== */
  function generateSingleTrail(target, graph, grid, constraints, nodeBudget) {
    const usedEdges = new Array(graph.edges.length).fill(false);
    let budget = nodeBudget;

    function dfs(vertex, path, usedVertexCount, usedSegments) {
      budget--;
      if (budget <= 0) return false;
      if (path.length - 1 === target) return true;
      const rawOptions = graph.byVertex[vertex].filter(o => !usedEdges[o.edgeId]);
      const options = shuffle(rawOptions).filter(opt => passesConstraints(vertex, opt, grid, constraints, usedVertexCount, usedSegments));
      for (const opt of options) {
        usedEdges[opt.edgeId] = true;
        path.push(opt.to);
        vcAdd(usedVertexCount, opt.to);
        usedSegments.push([grid.points[vertex], grid.points[opt.to]]);
        if (dfs(opt.to, path, usedVertexCount, usedSegments)) return true;
        usedSegments.pop();
        vcRemove(usedVertexCount, opt.to);
        path.pop();
        usedEdges[opt.edgeId] = false;
        if (budget <= 0) return false;
      }
      return false;
    }

    const starts = shuffle(graph.vertices.slice());
    for (const start of starts) {
      usedEdges.fill(false);
      const path = [start];
      const usedVertexCount = new Map();
      vcAdd(usedVertexCount, start);
      if (dfs(start, path, usedVertexCount, [])) return path;
      if (budget <= 0) break;
    }
    return null;
  }

  function generateWithRetries(target, graph, grid, constraints) {
    for (let i = 0; i < GENERATION_RETRIES; i++) {
      const path = generateSingleTrail(target, graph, grid, constraints, GENERATION_NODE_BUDGET);
      if (path) return path;
    }
    return null;
  }

  /* =====================================================
     AST-GENERIERUNG
     Statt einer durchgehenden Linie wird ein Baum erzeugt:
     jeder neue Punkt wird an einen BELIEBIGEN bereits im
     Baum enthaltenen Punkt angehängt (nicht zwingend an das
     zuletzt hinzugefügte Ende). Da jeder Punkt höchstens
     einmal vorkommt, entstehen durch Konstruktion garantiert
     keine Zyklen bzw. Rückverbindungen — echte, frei
     verzweigende Äste.
     ===================================================== */
  function generateTree(target, graph, grid, constraints, nodeBudget) {
    let budget = nodeBudget;
    const usedEdges = new Array(graph.edges.length).fill(false);

    function tryGrow(remaining, usedVertices, usedSegments, edges) {
      budget--;
      if (budget <= 0) return false;
      if (remaining === 0) return true;
      const frontier = shuffle(Array.from(usedVertices));
      for (const u of frontier) {
        const rawOptions = graph.byVertex[u].filter(o => !usedEdges[o.edgeId] && !usedVertices.has(o.to));
        const options = shuffle(rawOptions).filter(opt => passesConstraints(u, opt, grid, constraints, usedVertices, usedSegments));
        for (const opt of options) {
          usedEdges[opt.edgeId] = true;
          usedVertices.add(opt.to);
          usedSegments.push([grid.points[u], grid.points[opt.to]]);
          edges.push({ from: u, to: opt.to });
          if (tryGrow(remaining - 1, usedVertices, usedSegments, edges)) return true;
          edges.pop();
          usedSegments.pop();
          usedVertices.delete(opt.to);
          usedEdges[opt.edgeId] = false;
          if (budget <= 0) return false;
        }
      }
      return false;
    }

    const starts = shuffle(graph.vertices.slice());
    for (const start of starts) {
      usedEdges.fill(false);
      const usedVertices = new Set([start]);
      const edges = [];
      if (tryGrow(target, usedVertices, [], edges)) return { root: start, edges };
      if (budget <= 0) break;
    }
    return null;
  }

  function generateTreeWithRetries(target, graph, grid, constraints) {
    for (let i = 0; i < GENERATION_RETRIES; i++) {
      const tree = generateTree(target, graph, grid, constraints, GENERATION_NODE_BUDGET);
      if (tree) return tree;
    }
    return null;
  }

  /* =====================================================
     MEHRERE ELEMENTE
     Statt eines einzelnen Elements entstehen `count` getrennte,
     unverbundene Linien (einfache Pfade ohne Punktwiederholung),
     die sich gemeinsam den Punktevorrat `total` teilen — kein
     Punkt taucht in mehr als einem Element auf. Jedes Element
     bekommt dabei zwischen `min` und `max` Punkten zugewiesen.

     Ablauf pro Versuch:
     1. distributeSizes(...) verteilt `total` Punkte zufällig auf
        `count` Elemente (jedes startet bei `min`, der Rest wird
        zufällig auf Elemente mit noch freier Kapazität bis `max`
        verteilt).
     2. Für jede Elementgröße wird — in zufälliger Reihenfolge —
        ein einfacher Pfad exakt dieser Punktzahl gesucht, wobei
        bereits von früheren Elementen belegte Punkte (`globalUsed`)
        komplett als Kandidaten ausscheiden (kein Punkt wird
        zwischen Elementen geteilt).

     Schlägt ein Element fehl (z. B. weil die verbleibenden freien
     Punkte keinen zusammenhängenden Pfad dieser Länge mehr
     hergeben), wird der gesamte Versuch verworfen und neu
     gestartet (MULTI_RETRIES) — mit frischer Größenverteilung und
     frischer Zufallsreihenfolge.
     ===================================================== */
  function distributeSizes(total, count, min, max) {
    if (count * min > total || total > count * max) return null;
    const sizes = new Array(count).fill(min);
    const capacity = new Array(count).fill(max - min);
    let remaining = total - count * min;
    while (remaining > 0) {
      const candidates = [];
      for (let i = 0; i < count; i++) if (capacity[i] > 0) candidates.push(i);
      if (candidates.length === 0) return null; // sollte nach obigem Check nicht vorkommen
      const idx = candidates[Math.floor(Math.random() * candidates.length)];
      sizes[idx]++;
      capacity[idx]--;
      remaining--;
    }
    return sizes;
  }

  // Sucht einen einfachen Pfad (keine Punktwiederholung) mit genau
  // `targetPoints` Punkten, dessen Punkte allesamt außerhalb von
  // `globalUsed` liegen (von anderen Elementen bereits belegte Punkte).
  // Baugleich zu generateSingleTrail, aber mit zusätzlichem Ausschluss-
  // Filter und punktbasiertem statt kantenbasiertem Ziel.
  function generateElementPath(targetPoints, graph, grid, constraints, globalUsed, nodeBudget) {
    const targetEdges = targetPoints - 1;
    let budget = nodeBudget;
    const usedEdges = new Array(graph.edges.length).fill(false);

    function dfs(vertex, path, usedVertexCount, usedSegments) {
      budget--;
      if (budget <= 0) return false;
      if (path.length - 1 === targetEdges) return true;
      const rawOptions = graph.byVertex[vertex].filter(o => !usedEdges[o.edgeId] && !globalUsed.has(o.to));
      const options = shuffle(rawOptions).filter(opt => passesConstraints(vertex, opt, grid, constraints, usedVertexCount, usedSegments));
      for (const opt of options) {
        usedEdges[opt.edgeId] = true;
        path.push(opt.to);
        vcAdd(usedVertexCount, opt.to);
        usedSegments.push([grid.points[vertex], grid.points[opt.to]]);
        if (dfs(opt.to, path, usedVertexCount, usedSegments)) return true;
        usedSegments.pop();
        vcRemove(usedVertexCount, opt.to);
        path.pop();
        usedEdges[opt.edgeId] = false;
        if (budget <= 0) return false;
      }
      return false;
    }

    const starts = shuffle(graph.vertices.filter(v => !globalUsed.has(v)));
    for (const start of starts) {
      usedEdges.fill(false);
      const path = [start];
      const usedVertexCount = new Map();
      vcAdd(usedVertexCount, start);
      if (dfs(start, path, usedVertexCount, [])) return path;
      if (budget <= 0) break;
    }
    return null;
  }

  function generateMultiElements(config, graph, grid, constraints) {
    const sizes = distributeSizes(config.total, config.count, config.min, config.max);
    if (!sizes) return null;
    const order = shuffle(sizes.slice());
    const globalUsed = new Set();
    const elements = [];
    for (const size of order) {
      const path = generateElementPath(size, graph, grid, constraints, globalUsed, MULTI_NODE_BUDGET_PER_ELEMENT);
      if (!path) return null;
      path.forEach(v => globalUsed.add(v));
      elements.push(path);
    }
    return { elements };
  }

  function generateMultiWithRetries(config, graph, grid, constraints) {
    for (let i = 0; i < MULTI_RETRIES; i++) {
      const result = generateMultiElements(config, graph, grid, constraints);
      if (result) return result;
    }
    return null;
  }

  /* =====================================================
     ALLE KOMBINATIONEN (ohne Duplikate) — Lazy Generation
     Statt vorab ein Array mit einer harten Obergrenze zu
     füllen, liefert ein JS-Generator (`function*`) jede
     gültige Punktfolge erst dann, wenn sie tatsächlich
     angefordert wird ("Pull statt Push"). So wird nie mehr
     berechnet als die Oberfläche gerade anzeigen will.

     createEnumerationSession(...) baut den Generator auf.
     session.pullBatch(count, timeSliceMs, onBatch) holt die
     nächsten `count` Treffer, rechnet dabei aber nie länger
     als `timeSliceMs` am Stück — reicht die Zeit nicht,
     wird die Arbeit über setTimeout(...,0) auf den nächsten
     Tick verteilt, sodass der Main-Thread nie blockiert.

     Eine sehr hohe Knoten-Sicherheitsgrenze (nicht die
     Ergebnisanzahl!) fängt nur pathologische Fälle ab, in
     denen gültige Treffer extrem selten sind.
     ===================================================== */
  function createEnumerationSession(graph, grid, constraints, target) {
    let nodeCount = 0;
    let stoppedBySafety = false;
    const usedEdges = new Array(graph.edges.length).fill(false);

    function* dfs(vertex, path, usedVertexCount, usedSegments) {
      nodeCount++;
      if (nodeCount > ENUM_NODE_SAFETY_CEILING) { stoppedBySafety = true; return; }
      if (path.length - 1 === target) {
        yield path.slice();
        return;
      }
      for (const opt of graph.byVertex[vertex]) {
        if (stoppedBySafety) return;
        if (!usedEdges[opt.edgeId] && passesConstraints(vertex, opt, grid, constraints, usedVertexCount, usedSegments)) {
          usedEdges[opt.edgeId] = true;
          vcAdd(usedVertexCount, opt.to);
          usedSegments.push([grid.points[vertex], grid.points[opt.to]]);
          path.push(opt.to);
          yield* dfs(opt.to, path, usedVertexCount, usedSegments);
          path.pop();
          usedSegments.pop();
          vcRemove(usedVertexCount, opt.to);
          usedEdges[opt.edgeId] = false;
          if (stoppedBySafety) return;
        }
      }
    }

    function* fullGenerator() {
      for (const start of graph.vertices) {
        if (stoppedBySafety) return;
        const usedVertexCount = new Map();
        vcAdd(usedVertexCount, start);
        yield* dfs(start, [start], usedVertexCount, []);
      }
    }

    const iterator = fullGenerator();

    return {
      pullBatch(count, timeSliceMs, onBatch) {
        const results = [];
        let done = false;

        function step() {
          const deadline = Date.now() + timeSliceMs;
          while (results.length < count) {
            const { value, done: genDone } = iterator.next();
            if (genDone) { done = true; break; }
            results.push(value);
            if (Date.now() > deadline) break;
          }
          if (results.length >= count || done || stoppedBySafety) {
            // WICHTIG: onBatch immer asynchron aufrufen (auch wenn der Batch
            // sofort fertig ist). Riefe ein Aufrufer von hier aus direkt
            // synchron den nächsten Batch ab, würde der native Call-Stack
            // bei sehr vielen schnellen Batches unbegrenzt anwachsen — durch
            // setTimeout(...,0) wird die Kette nach jedem Batch garantiert
            // zurückgesetzt.
            setTimeout(() => onBatch(results, { done: done || stoppedBySafety, stoppedBySafety }), 0);
          } else {
            setTimeout(step, 0);
          }
        }
        step();
      }
    };
  }

  /* =====================================================
     ALLE KOMBINATIONEN — Ast-Modus (kanonische Baum-Enumeration)
     Ein Baum ist nur eine MENGE von Kanten, keine Reihenfolge —
     anders als bei einem Trail gibt es also keine "natürliche"
     Konstruktionsreihenfolge, die Duplikate automatisch ausschließt.
     generateTree() darf an jedem bereits benutzten Punkt weiter-
     wachsen; ohne Gegenmaßnahme würde derselbe Baum über viele
     verschiedene Bau-Reihenfolgen mehrfach gefunden.

     Zwei Regeln erzwingen stattdessen, dass jeder Baum GENAU EINMAL
     entsteht (Standardtechnik aus der Subgraph-Enumeration, siehe
     ESU/Wernicke-Algorithmus):

     1. Startpunkt-Kanonisierung: ein Durchlauf mit Startpunkt `minRoot`
        darf niemals einen Punkt mit kleinerer Nummer als `minRoot`
        aufnehmen. Dadurch kann ein Baum nur von genau EINEM
        Startpunkt aus rekonstruiert werden — seinem punktweise
        kleinsten Mitglied.
     2. Fester Wachstumspunkt + einmalige Entscheidung: es wächst
        immer nur der punktweise KLEINSTE noch offene (unentschiedene)
        Punkt weiter. Für dessen Kandidaten wird in fester Reihenfolge
        je EINMAL "anhängen" oder "überspringen" entschieden (Teilmengen-
        Erzeugung) — sobald alle Kandidaten entschieden sind, gilt der
        Punkt als endgültig geschlossen (`closed`) und wird nie wieder
        aufgegriffen. Ohne dieses "closed"-Gedächtnis würde derselbe
        Punkt beim nächsten Aufruf erneut als offen erkannt, was zu
        einer Endlosschleife führen würde.
     ===================================================== */
  function createTreeEnumerationSession(graph, grid, constraints, target) {
    let nodeCount = 0;
    let stoppedBySafety = false;

    function* extend(usedVertices, edges, minRoot, closed) {
      nodeCount++;
      if (nodeCount > ENUM_NODE_SAFETY_CEILING) { stoppedBySafety = true; return; }
      if (edges.length === target) { yield edges.map(e => ({ from: e.from, to: e.to })); return; }

      const sortedUsed = Array.from(usedVertices).sort((a, b) => a - b);
      let u = null, candidates = null;
      for (const v of sortedUsed) {
        if (closed.has(v)) continue;
        const cands = graph.byVertex[v]
          .map(o => o.to)
          .filter(w => w >= minRoot && !usedVertices.has(w))
          .sort((a, b) => a - b);
        if (cands.length > 0) { u = v; candidates = cands; break; }
      }
      if (u === null) return; // Sackgasse — Zielgröße von hier aus nicht erreichbar

      closed.add(u);
      yield* decide(u, candidates, 0, usedVertices, edges, minRoot, closed);
      closed.delete(u); // Backtrack: in einem anderen Zweig darf u erneut offen sein
    }

    function* decide(u, candidates, idx, usedVertices, edges, minRoot, closed) {
      if (stoppedBySafety) return;
      if (edges.length === target) { yield edges.map(e => ({ from: e.from, to: e.to })); return; }
      if (idx >= candidates.length) {
        yield* extend(usedVertices, edges, minRoot, closed);
        return;
      }
      const w = candidates[idx];

      // Option A: w NICHT an u anhängen
      yield* decide(u, candidates, idx + 1, usedVertices, edges, minRoot, closed);
      if (stoppedBySafety) return;

      // Option B: w an u anhängen — Gültigkeit wird frisch geprüft, da
      // Kreuzungs-/Konzentrationsregeln vom bisherigen Baum abhängen.
      if (!usedVertices.has(w)) {
        const usedSegments = edges.map(e => [grid.points[e.from], grid.points[e.to]]);
        if (passesConstraints(u, { to: w }, grid, constraints, usedVertices, usedSegments)) {
          usedVertices.add(w);
          edges.push({ from: u, to: w });
          yield* decide(u, candidates, idx + 1, usedVertices, edges, minRoot, closed);
          edges.pop();
          usedVertices.delete(w);
        }
      }
    }

    function* fullGenerator() {
      for (const start of graph.vertices) {
        if (stoppedBySafety) return;
        yield* extend(new Set([start]), [], start, new Set());
      }
    }

    const iterator = fullGenerator();

    return {
      pullBatch(count, timeSliceMs, onBatch) {
        const results = [];
        let done = false;

        function step() {
          const deadline = Date.now() + timeSliceMs;
          while (results.length < count) {
            const { value, done: genDone } = iterator.next();
            if (genDone) { done = true; break; }
            results.push(value);
            if (Date.now() > deadline) break;
          }
          if (results.length >= count || done || stoppedBySafety) {
            // WICHTIG: onBatch immer asynchron aufrufen (auch wenn der Batch
            // sofort fertig ist). Riefe ein Aufrufer von hier aus direkt
            // synchron den nächsten Batch ab, würde der native Call-Stack
            // bei sehr vielen schnellen Batches unbegrenzt anwachsen — durch
            // setTimeout(...,0) wird die Kette nach jedem Batch garantiert
            // zurückgesetzt.
            setTimeout(() => onBatch(results, { done: done || stoppedBySafety, stoppedBySafety }), 0);
          } else {
            setTimeout(step, 0);
          }
        }
        step();
      }
    };
  }

  /* =====================================================
     RENDERING
     ===================================================== */
  const outputCanvas   = document.getElementById('outputCanvas');
  const sequenceFooter = document.getElementById('sequenceFooter');
  const sequenceChain  = document.getElementById('sequenceChain');
  const statusBadge    = document.getElementById('statusBadge');
  const outputTitle    = document.getElementById('outputTitle');

  function dist(p1, p2) { return Math.hypot(p1.x - p2.x, p1.y - p2.y); }

  function pathToEdges(path) {
    const edges = [];
    for (let i = 1; i < path.length; i++) edges.push({ from: path[i - 1], to: path[i] });
    return edges;
  }

  // Einheitliches Rendering für Trail- UND Ast-Modus: beide werden als
  // einfache Kantenliste { from, to } beschrieben. Im Trail-Modus bilden
  // die Kanten eine durchgehende Kette, im Ast-Modus verzweigen sie sich.
  function glyphSVG(grid, graph, edges, opts) {
    opts = opts || {};
    const { points, style } = grid;
    const usedVertexSet = new Set();
    edges.forEach(e => { usedVertexSet.add(e.from); usedVertexSet.add(e.to); });
    const forbiddenSet = graph.forbiddenSet || new Set();
    const allVertices = graph.allVertices || graph.vertices;
    const animate = !!opts.animate;
    const showStartRing = !!opts.showStartRing;
    const rootVertex = opts.rootVertex !== undefined && opts.rootVertex !== null
      ? opts.rootVertex
      : (edges.length ? edges[0].from : null);
    // Mehrere Elemente haben je einen eigenen Startpunkt — rootVertices
    // (Array) hat Vorrang vor dem einzelnen rootVertex, fällt aber darauf
    // zurück, damit Trail-/Ast-Aufrufe unverändert funktionieren.
    const rootVertices = Array.isArray(opts.rootVertices) && opts.rootVertices.length
      ? opts.rootVertices
      : (rootVertex !== null ? [rootVertex] : []);

    let svg = `<svg class="${opts.mainClass || ''}" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">`;

    edges.forEach((e, i) => {
      const from = points[e.from];
      const to = points[e.to];
      const len = dist(from, to);
      if (animate) {
        const delay = i * 70;
        svg += `<line class="glyph-edge" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"
          style="stroke-width:${style.stroke};stroke-dasharray:${len};stroke-dashoffset:${len};
          animation:drawEdge var(--dur-slower) var(--ease-out) ${delay}ms forwards;--len:${len}px"/>`;
      } else {
        svg += `<line class="glyph-edge" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" style="stroke-width:${style.stroke}"/>`;
      }
    });

    allVertices.forEach(v => {
      const p = points[v];
      const forbidden = forbiddenSet.has(v);
      const active = usedVertexSet.has(v);
      const radius = forbidden ? style.rInactive : (active ? style.rActive : style.rInactive);

      if (forbidden) {
        const m = radius * 0.5;
        svg += `<g>
          <circle class="glyph-point-forbidden-bg" cx="${p.x}" cy="${p.y}" r="${radius}"/>
          <line class="glyph-point-forbidden-mark" x1="${p.x - m}" y1="${p.y - m}" x2="${p.x + m}" y2="${p.y + m}"/>
          <line class="glyph-point-forbidden-mark" x1="${p.x + m}" y1="${p.y - m}" x2="${p.x - m}" y2="${p.y + m}"/>
        </g>`;
        return;
      }

      const activeStyle = active ? `stroke:var(--color-accent);stroke-width:1.5` : '';
      if (animate) {
        const delay = active ? 30 : 0;
        svg += `<g style="animation:popPoint var(--dur-base) var(--ease-spring) ${delay}ms backwards;transform-origin:${p.x}px ${p.y}px">
          <circle class="glyph-point-bg" cx="${p.x}" cy="${p.y}" r="${radius}" style="${activeStyle}"/>
          <text class="glyph-point-label" x="${p.x}" y="${p.y + 0.5}" style="font-size:${style.font}px">${v}</text>
        </g>`;
      } else {
        svg += `<circle class="glyph-point-bg" cx="${p.x}" cy="${p.y}" r="${radius}" style="${activeStyle}"/>
          <text class="glyph-point-label" x="${p.x}" y="${p.y + 0.5}" style="font-size:${style.font}px">${v}</text>`;
      }
    });

    if (showStartRing) {
      rootVertices.forEach((rv, i) => {
        const startP = points[rv];
        if (!startP) return;
        const delay = animate ? edges.length * 70 + 100 + i * 40 : 0;
        svg += `<circle class="glyph-start-ring" cx="${startP.x}" cy="${startP.y}" r="${style.rActive + 5}"
          style="opacity:${animate ? 0 : 1};${animate ? `animation:popPoint var(--dur-slow) var(--ease-out) ${delay}ms forwards` : ''}"/>`;
      });
    }

    svg += `</svg>`;
    return svg;
  }

  /* =====================================================
     EXPORT (SVG / PNG)
     glyphSVG() liefert Markup, das auf CSS-Variablen und
     externe Klassen der Seite angewiesen ist (funktioniert
     nur eingebettet im Tool). Für einen eigenständigen Export
     werden dieselben Klassen mit AUFGELÖSTEN, literalen
     Farbwerten (passend zum aktuell aktiven Theme) in einem
     eingebetteten <style>-Block mitgeliefert — die Datei
     funktioniert dann unabhängig vom Tool, in jedem Programm.
     Export nutzt animate:false (fertig gezeichneter Endzustand,
     keine Zeichen-Animation) und einen transparenten Hintergrund.
     ===================================================== */
  const EXPORT_THEME_COLORS = {
    light: { accent: '#0075de', surface: '#ffffff', border: 'rgba(0,0,0,0.1)', muted: '#a39e98', teal: '#2a9d99', warm: '#f6f5f4', gray300: '#a39e98', orange: '#dd5b00' },
    dark:  { accent: '#4d9de0', surface: '#202020', border: 'rgba(255,255,255,0.09)', muted: '#6b6b69', teal: '#2a9d99', warm: '#252525', gray300: '#6b6b69', orange: '#dd5b00' }
  };
  const PNG_EXPORT_SIZE = 1024;
  const PNG_EXPORT_SIZE_CARD = 640;

  function getActiveThemeColors() {
    return EXPORT_THEME_COLORS[html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'];
  }

  function buildStandaloneSVG(grid, graph, edges, opts) {
    const c = getActiveThemeColors();
    const rootVertex = (opts && opts.rootVertex !== undefined) ? opts.rootVertex : (edges.length ? edges[0].from : null);
    const rootVertices = (opts && Array.isArray(opts.rootVertices)) ? opts.rootVertices : undefined;
    const inner = glyphSVG(grid, graph, edges, { animate: false, showStartRing: true, rootVertex, rootVertices });
    const styleBlock = `<style>
      .glyph-edge { fill:none; stroke-linecap:round; }
      .glyph-edge { stroke:${c.accent}; }
      .glyph-point-bg { fill:${c.surface}; stroke:${c.border}; stroke-width:1; }
      .glyph-point-label { fill:${c.muted}; font-family:'Roboto Mono',Consolas,Menlo,monospace; font-weight:500; text-anchor:middle; dominant-baseline:central; }
      .glyph-start-ring { fill:none; stroke:${c.teal}; stroke-width:2; }
      .glyph-point-forbidden-bg { fill:${c.warm}; stroke:${c.gray300}; stroke-width:1; stroke-dasharray:2 2; opacity:0.75; }
      .glyph-point-forbidden-mark { stroke:${c.orange}; stroke-width:1.4; stroke-linecap:round; opacity:0.85; }
    </style>`;
    return inner
      .replace('<svg ', '<svg width="1024" height="1024" ')
      .replace(/(<svg[^>]*>)/, `$1${styleBlock}`)
      .replace(/var\(--color-accent\)/g, c.accent);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadSVGString(svgString, filename) {
    downloadBlob(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }), filename);
  }

  function downloadSVGAsPNG(svgString, filename, pixelSize) {
    const url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelSize;
      canvas.height = pixelSize;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, pixelSize, pixelSize);
      canvas.toBlob(pngBlob => {
        if (pngBlob) downloadBlob(pngBlob, filename);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  function buildExportFilename(prefix, ext) {
    const dims = currentGrid.shape === 'hex'
      ? `hex${currentGrid.d}x${currentGrid.v}`
      : currentGrid.shape === 'circle'
      ? `kreis${currentGrid.n}`
      : currentGrid.shape === 'ellipse'
      ? `ellipse${currentGrid.rx}x${currentGrid.ry}`
      : currentGrid.shape === 'triangle'
      ? `dreieck${currentGrid.width}x${currentGrid.height}`
      : currentGrid.shape === 'rhombus'
      ? `raute${currentGrid.width}x${currentGrid.height}`
      : currentGrid.shape === 'trapezoid'
      ? `trapez${currentGrid.top}x${currentGrid.height}`
      : currentGrid.shape === 'parallelogram'
      ? `parallelogramm${currentGrid.sideLength}x${currentGrid.height}_versatz${currentGrid.offset}`
      : `${currentGrid.cols}x${currentGrid.rows}`;
    if (currentSingleResult && currentSingleResult.isMulti) {
      return `${prefix}_${dims}_${currentSingleResult.elements.length}elemente.${ext}`;
    }
    const steps = stepsInput.value || '0';
    return `${prefix}_${dims}_${steps}schritte.${ext}`;
  }

  function renderSingle(grid, graph, result) {
    invalidateEnumSession();
    outputCanvas.classList.remove('combos-mode');
    outputCanvas.classList.add('single-mode');
    const isTree = result.mode === 'tree';
    const edges = isTree ? result.edges : pathToEdges(result.path);
    const rootVertex = isTree ? result.root : result.path[0];

    outputCanvas.innerHTML = glyphSVG(grid, graph, edges, {
      animate: true, showStartRing: true, mainClass: 'glyph-main', rootVertex
    });

    sequenceChain.innerHTML = isTree
      ? edges.map(e => `<span class="badge">${e.from}→${e.to}</span>`).join('')
      : result.path.map(v => `<span class="badge">${v}</span>`).join('<span class="arrow">→</span>');
    sequenceFooter.style.display = 'block';
    outputTitle.textContent = isTree ? 'Ast-Glyphe' : 'Glyphe';
    statusBadge.textContent = `${edges.length} Schritte`;

    currentSingleResult = { grid, graph, edges, rootVertex, isTree };
  }

  // Rendering für den "Mehrere Elemente"-Modus: mehrere getrennte,
  // unverbundene Pfade werden als eine gemeinsame Kantenliste gezeichnet
  // (jedes Element bekommt einen eigenen Startring) und in der
  // Punktreihenfolge-Leiste nach Element gruppiert aufgelistet.
  function renderMulti(grid, graph, multi) {
    invalidateEnumSession();
    outputCanvas.classList.remove('combos-mode');
    outputCanvas.classList.add('single-mode');
    const elements = multi.elements;
    const edges = elements.reduce((acc, path) => acc.concat(pathToEdges(path)), []);
    const rootVertices = elements.map(p => p[0]);

    outputCanvas.innerHTML = glyphSVG(grid, graph, edges, {
      animate: true, showStartRing: true, mainClass: 'glyph-main', rootVertices
    });

    sequenceChain.innerHTML = elements.map((path, i) => {
      const chain = path.map(v => `<span class="badge">${v}</span>`).join('<span class="arrow">→</span>');
      return `<div style="width:100%;display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-1);margin-bottom:var(--space-1)">
        <span class="badge badge-orange">Element ${i + 1}</span>${chain}
      </div>`;
    }).join('');
    sequenceFooter.style.display = 'block';
    outputTitle.textContent = 'Mehrere-Elemente-Glyphe';
    const totalPoints = elements.reduce((sum, p) => sum + p.length, 0);
    statusBadge.textContent = `${elements.length} Elemente · ${totalPoints} Punkte`;

    currentSingleResult = {
      grid, graph, edges, rootVertex: rootVertices.length ? rootVertices[0] : null,
      rootVertices, isTree: false, isMulti: true, elements
    };
  }

  /* ---------- "Alle Kombinationen" — Lazy-Loading-Ansicht ---------- */
  function initCombosView() {
    outputCanvas.classList.remove('single-mode');
    outputCanvas.classList.add('combos-mode');
    sequenceFooter.style.display = 'none';
    outputCanvas.innerHTML =
      `<div class="combos-grid" id="combosGrid"></div>
       <div class="combos-status" id="combosStatus"></div>
       <div class="combos-sentinel" id="combosSentinel"></div>`;
    outputTitle.textContent = 'Alle Kombinationen';
  }

  function appendComboCards(grid, graph, results, startIndex, isTree) {
    const combosGrid = document.getElementById('combosGrid');
    if (!combosGrid) return;
    let html = '';
    results.forEach((item, i) => {
      const edges = isTree ? item : pathToEdges(item);
      const caption = isTree
        ? edges.map(e => `${e.from}→${e.to}`).join(', ')
        : item.join(' → ');
      const svg = glyphSVG(grid, graph, edges, { animate: false });
      const delay = Math.min(i, 30) * 12;
      const edgesJson = JSON.stringify(edges);
      html += `<div class="combo-card" style="animation-delay:${delay}ms" data-edges='${edgesJson}'>
        <div class="combo-card-actions">
          <button class="combo-action" data-action="svg" title="Als SVG exportieren" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path></svg>
          </button>
          <button class="combo-action" data-action="png" title="Als PNG exportieren" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>
          </button>
        </div>
        <span class="combo-index">#${startIndex + i + 1}</span>
        ${svg}
        <div class="combo-caption">${caption}</div>
      </div>`;
    });
    combosGrid.insertAdjacentHTML('beforeend', html);
  }

  function updateCombosStatus(loadedCount, state) {
    const statusEl = document.getElementById('combosStatus');
    if (!statusEl) return;
    if (state === 'loading') {
      statusEl.innerHTML = `<div class="combos-loading">Lade weitere Kombinationen… (${loadedCount} geladen)</div>`;
    } else if (state === 'done') {
      statusEl.innerHTML = `<div class="combos-done">Alle ${loadedCount} möglichen Kombinationen geladen.</div>`;
    } else if (state === 'safety') {
      statusEl.innerHTML = `<div class="truncation-note">Sicherheitslimit erreicht — ${loadedCount} Kombinationen geladen. Die tatsächliche
        Gesamtzahl ist bei dieser Schrittzahl/diesem Raster deutlich höher; weiteres Laden würde den Browser zu stark belasten.
        Reduziere die Schrittzahl für eine vollständige Übersicht.</div>`;
    } else if (state === 'manual') {
      statusEl.innerHTML = `<button class="btn btn-secondary" id="loadMoreBtn" type="button">Weitere Kombinationen laden (${loadedCount} bisher)</button>`;
      document.getElementById('loadMoreBtn').addEventListener('click', () => loadMoreCombos());
    } else {
      statusEl.innerHTML = `<div class="combos-count-hint">${loadedCount} geladen — scrolle für mehr</div>`;
    }
  }

  function setupSentinelObserver() {
    const sentinel = document.getElementById('combosSentinel');
    if (!sentinel) return;
    if (combosObserver) combosObserver.disconnect();
    combosObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMoreCombos();
    }, { root: outputCanvas, rootMargin: '200px' });
    combosObserver.observe(sentinel);
  }

  function loadMoreCombos() {
    if (!currentEnumSession || currentEnumSession.done || currentEnumSession.loading) return;
    currentEnumSession.loading = true;
    const sessionId = currentEnumSession.id;
    updateCombosStatus(currentEnumSession.loadedCount, 'loading');

    currentEnumSession.session.pullBatch(ENUM_BATCH_SIZE, ENUM_BATCH_TIME_SLICE_MS, (results, meta) => {
      if (!currentEnumSession || currentEnumSession.id !== sessionId) return; // Sitzung inzwischen verworfen
      currentEnumSession.loading = false;

      if (results.length > 0) {
        appendComboCards(currentGrid, currentGraph, results, currentEnumSession.loadedCount, currentEnumSession.isTree);
        currentEnumSession.loadedCount += results.length;
      }

      if (meta.done) {
        currentEnumSession.done = true;
        if (combosObserver) { combosObserver.disconnect(); combosObserver = null; }
        if (currentEnumSession.loadedCount === 0) {
          renderEmpty('Für diese Schrittzahl existiert keine gültige Kombination.');
          statusBadge.textContent = 'Keine Treffer';
          return;
        }
        updateCombosStatus(currentEnumSession.loadedCount, meta.stoppedBySafety ? 'safety' : 'done');
        statusBadge.textContent = meta.stoppedBySafety
          ? `${currentEnumSession.loadedCount}+ Kombinationen`
          : `${currentEnumSession.loadedCount} Kombinationen`;
      } else if (currentEnumSession.loadedCount >= ENUM_AUTO_LOAD_SOFT_LIMIT) {
        if (combosObserver) { combosObserver.disconnect(); combosObserver = null; }
        updateCombosStatus(currentEnumSession.loadedCount, 'manual');
        statusBadge.textContent = `${currentEnumSession.loadedCount}+ Kombinationen`;
      } else {
        updateCombosStatus(currentEnumSession.loadedCount, 'idle');
        statusBadge.textContent = `${currentEnumSession.loadedCount}+ Kombinationen`;
      }
    });
  }

  function renderEmpty(message) {
    invalidateEnumSession();
    currentSingleResult = null;
    outputCanvas.classList.remove('combos-mode');
    outputCanvas.classList.add('single-mode');
    sequenceFooter.style.display = 'none';
    outputCanvas.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"></circle><circle cx="18" cy="6" r="2"></circle><circle cx="6" cy="18" r="2"></circle><circle cx="18" cy="18" r="2"></circle><circle cx="12" cy="12" r="2"></circle></svg>
      <div>${message}</div>
    </div>`;
    outputTitle.textContent = 'Glyphe';
  }

  /* =====================================================
     STATE + WIRING
     ===================================================== */
  let currentGrid = buildGridDefinition(3, 3);
  let currentGraph = buildGraph(currentGrid, new Set());
  let currentMaxInfo = { value: 0, exact: true };

  // Zustand der laufenden "Alle Kombinationen"-Lazy-Loading-Sitzung.
  let currentEnumSession = null;
  let enumSessionCounter = 0;
  let combosObserver = null;

  // Zustand der aktuell angezeigten Einzelglyphe, für den Export.
  let currentSingleResult = null;

  function invalidateEnumSession() {
    if (combosObserver) { combosObserver.disconnect(); combosObserver = null; }
    currentEnumSession = null;
  }

  const exportSvgBtn = document.getElementById('exportSvgBtn');
  const exportPngBtn = document.getElementById('exportPngBtn');

  exportSvgBtn.addEventListener('click', () => {
    if (!currentSingleResult) return;
    const { grid, graph, edges, rootVertex, rootVertices } = currentSingleResult;
    const svgString = buildStandaloneSVG(grid, graph, edges, { rootVertex, rootVertices });
    downloadSVGString(svgString, buildExportFilename('glyphe', 'svg'));
  });

  exportPngBtn.addEventListener('click', () => {
    if (!currentSingleResult) return;
    const { grid, graph, edges, rootVertex, rootVertices } = currentSingleResult;
    const svgString = buildStandaloneSVG(grid, graph, edges, { rootVertex, rootVertices });
    downloadSVGAsPNG(svgString, buildExportFilename('glyphe', 'png'), PNG_EXPORT_SIZE);
  });

  // Delegierter Klick-Handler für die kleinen Export-Icons auf den
  // Kombinationskarten (werden dynamisch per insertAdjacentHTML erzeugt,
  // daher Delegation statt einzelner Listener pro Karte).
  outputCanvas.addEventListener('click', (e) => {
    const btn = e.target.closest('.combo-action');
    if (!btn) return;
    const card = btn.closest('.combo-card');
    if (!card || !card.dataset.edges) return;
    const edges = JSON.parse(card.dataset.edges);
    const indexLabel = card.querySelector('.combo-index');
    const idx = indexLabel ? indexLabel.textContent.replace('#', '') : '0';
    const rootVertex = edges.length ? edges[0].from : null;
    const svgString = buildStandaloneSVG(currentGrid, currentGraph, edges, { rootVertex });
    if (btn.dataset.action === 'svg') {
      downloadSVGString(svgString, buildExportFilename(`kombination-${idx}`, 'svg'));
    } else {
      downloadSVGAsPNG(svgString, buildExportFilename(`kombination-${idx}`, 'png'), PNG_EXPORT_SIZE_CARD);
    }
  });

  const gridSelect         = document.getElementById('gridSelect');
  const customGridGroup    = document.getElementById('customGridGroup');
  const customWidth        = document.getElementById('customWidth');
  const customHeight       = document.getElementById('customHeight');
  const customGridError    = document.getElementById('customGridError');
  const hexGridGroup       = document.getElementById('hexGridGroup');
  const hexDiag            = document.getElementById('hexDiag');
  const hexVert            = document.getElementById('hexVert');
  const hexGridError       = document.getElementById('hexGridError');
  const circleGridGroup    = document.getElementById('circleGridGroup');
  const circleRings        = document.getElementById('circleRings');
  const circleGridError    = document.getElementById('circleGridError');
  const ellipseGridGroup   = document.getElementById('ellipseGridGroup');
  const ellipseWidth       = document.getElementById('ellipseWidth');
  const ellipseHeight      = document.getElementById('ellipseHeight');
  const ellipseGridError   = document.getElementById('ellipseGridError');
  const triangleGridGroup  = document.getElementById('triangleGridGroup');
  const triangleWidth      = document.getElementById('triangleWidth');
  const triangleHeight     = document.getElementById('triangleHeight');
  const triangleGridError  = document.getElementById('triangleGridError');
  const rhombusGridGroup   = document.getElementById('rhombusGridGroup');
  const rhombusWidth       = document.getElementById('rhombusWidth');
  const rhombusHeight      = document.getElementById('rhombusHeight');
  const rhombusGridError   = document.getElementById('rhombusGridError');
  const trapezoidGridGroup = document.getElementById('trapezoidGridGroup');
  const trapezoidTop       = document.getElementById('trapezoidTop');
  const trapezoidHeight    = document.getElementById('trapezoidHeight');
  const trapezoidGridError = document.getElementById('trapezoidGridError');
  const parallelogramGridGroup = document.getElementById('parallelogramGridGroup');
  const parallelogramSide      = document.getElementById('parallelogramSide');
  const parallelogramHeight    = document.getElementById('parallelogramHeight');
  const parallelogramOffset    = document.getElementById('parallelogramOffset');
  const parallelogramGridError = document.getElementById('parallelogramGridError');
  const forbiddenEnabled   = document.getElementById('forbiddenEnabled');
  const forbiddenFieldWrap = document.getElementById('forbiddenFieldWrap');
  const forbiddenInput     = document.getElementById('forbiddenInput');
  const forbiddenError     = document.getElementById('forbiddenError');
  const forbiddenRangeHint = document.getElementById('forbiddenRangeHint');
  const avoidCrossingBox     = document.getElementById('avoidCrossing');
  const avoidPointReuseBox   = document.getElementById('avoidPointReuse');
  const avoidConcentrationBox = document.getElementById('avoidConcentration');
  const treeModeBox          = document.getElementById('treeMode');
  const multiModeBox         = document.getElementById('multiMode');
  const stepsGroup         = document.getElementById('stepsGroup');
  const stepsInput         = document.getElementById('stepsInput');
  const maxStepsLabel      = document.getElementById('maxSteps');
  const maxStepsQualifier  = document.getElementById('maxStepsQualifier');
  const stepsError         = document.getElementById('stepsError');
  const multiFieldsGroup   = document.getElementById('multiFieldsGroup');
  const multiTotalPoints   = document.getElementById('multiTotalPoints');
  const multiElementCount  = document.getElementById('multiElementCount');
  const multiMinPoints     = document.getElementById('multiMinPoints');
  const multiMaxPoints     = document.getElementById('multiMaxPoints');
  const multiFieldsError   = document.getElementById('multiFieldsError');
  const multiFieldsErrorDefaultText = multiFieldsError.textContent;
  const generateBtn        = document.getElementById('generateBtn');
  const enumerateBtn       = document.getElementById('enumerateBtn');
  const regenerateBtn      = document.getElementById('regenerateBtn');

  customWidth.max = CUSTOM_MAX_DIM;
  customHeight.max = CUSTOM_MAX_DIM;
  hexDiag.max = CUSTOM_MAX_DIM;
  hexVert.max = CUSTOM_MAX_DIM;
  circleRings.max = CUSTOM_MAX_DIM;
  ellipseWidth.max = CUSTOM_MAX_DIM;
  ellipseHeight.max = CUSTOM_MAX_DIM;
  triangleWidth.max = CUSTOM_MAX_DIM;
  triangleHeight.max = CUSTOM_MAX_DIM;
  rhombusWidth.max = CUSTOM_MAX_DIM;
  rhombusHeight.max = CUSTOM_MAX_DIM;
  trapezoidTop.max = CUSTOM_MAX_DIM;
  trapezoidHeight.max = CUSTOM_MAX_DIM;
  parallelogramSide.max = CUSTOM_MAX_DIM;
  parallelogramHeight.max = CUSTOM_MAX_DIM;
  parallelogramOffset.min = -CUSTOM_MAX_DIM;
  parallelogramOffset.max = CUSTOM_MAX_DIM;

  // Liest die fünf erweiterten Optionen aus. Ast-Generierung UND
  // "Mehrere Elemente" schließen "Punktbelastung vermeiden" zwangsläufig
  // mit ein (ein Baum kann per Konstruktion keinen Punkt doppelt
  // enthalten; die einzelnen Linien mehrerer Elemente ebenso wenig, da
  // sich sonst ihre Punktzahl nicht exakt der geplanten Aufteilung
  // zuordnen ließe).
  function getConstraints() {
    const treeMode = treeModeBox.checked;
    const multiMode = multiModeBox.checked;
    return {
      avoidCrossing: avoidCrossingBox.checked,
      avoidPointReuse: (treeMode || multiMode) ? true : avoidPointReuseBox.checked,
      avoidConcentration: avoidConcentrationBox.checked,
      treeMode,
      multiMode
    };
  }

  // Zentrale Quelle der Wahrheit dafür, ob Generieren/Enumerieren gerade
  // erlaubt sind. Wird sowohl nach der Maximalschritt-Berechnung als auch
  // nach jedem setBusy(false) aufgerufen — vorher wurde enumerateBtn im
  // Ast-Modus fälschlich wieder aktiviert, sobald irgendeine andere
  // Aktion (z. B. "Zufällige Glyphe") den Busy-Zustand zurücksetzte.
  function updateActionButtonsEnabled() {
    if (multiModeBox.checked) {
      const config = validateMultiFields();
      const readyOk = !!config && config.total <= currentGraph.vertices.length;
      generateBtn.disabled = !readyOk;
      enumerateBtn.disabled = true; // "Alle Kombinationen" gibt es im Mehrere-Elemente-Modus nicht
    } else {
      const hasValidMax = currentMaxInfo.value >= 1;
      generateBtn.disabled = !hasValidMax;
      enumerateBtn.disabled = !hasValidMax;
    }
    regenerateBtn.disabled = regenerateBtn.dataset.armed !== '1';
  }

  // Ast-Generierung und "Mehrere Elemente" schließen sich gegenseitig
  // aus (beide implizieren bereits jeweils "Punktbelastung vermeiden"
  // auf unterschiedliche Weise) — ist der eine Modus aktiv, wird der
  // andere Checkbox gesperrt, statt beide gleichzeitig zuzulassen.
  function syncModeExclusivity() {
    const treeOn = treeModeBox.checked;
    const multiOn = multiModeBox.checked;
    treeModeBox.disabled = multiOn;
    multiModeBox.disabled = treeOn;
    const forceReuse = treeOn || multiOn;
    avoidPointReuseBox.disabled = forceReuse;
    if (forceReuse) avoidPointReuseBox.checked = true;
  }

  function setBusy(busy) {
    const controls = [generateBtn, enumerateBtn, regenerateBtn, gridSelect, stepsInput,
      customWidth, customHeight, forbiddenEnabled, forbiddenInput,
      avoidCrossingBox, avoidPointReuseBox, avoidConcentrationBox, treeModeBox, multiModeBox,
      multiTotalPoints, multiElementCount, multiMinPoints, multiMaxPoints];
    controls.forEach(el => (el.disabled = busy));
    if (!busy) {
      updateActionButtonsEnabled();
      syncModeExclusivity();
    }
  }

  function refreshMaxSteps() {
    if (multiModeBox.checked) {
      refreshMultiReadiness();
      return;
    }
    statusBadge.textContent = 'Berechne Maximum…';
    generateBtn.disabled = true;
    enumerateBtn.disabled = true;

    // Kurz verzögern, damit der Status sichtbar wird, bevor die
    // (bei größeren Rastern spürbare) Berechnung synchron läuft.
    setTimeout(() => {
      const constraints = getConstraints();
      currentMaxInfo = computeMaxSteps(currentGraph, currentGrid, constraints);
      maxStepsLabel.textContent = currentMaxInfo.value;
      maxStepsQualifier.textContent = currentMaxInfo.exact
        ? '(exakt)'
        : '(größter gefundener Wert – ggf. minimal höher möglich)';
      stepsInput.max = currentMaxInfo.value;
      if (Number(stepsInput.value) > currentMaxInfo.value || !stepsInput.value) {
        stepsInput.value = currentMaxInfo.value;
      }
      validateSteps();
      statusBadge.textContent = currentMaxInfo.value < 1 ? 'Kein Pfad möglich' : 'Bereit';
      updateActionButtonsEnabled();
    }, 20);
  }

  // Prüft die vier Eingabefelder des "Mehrere Elemente"-Modus rein
  // arithmetisch (unabhängig vom aktuellen Raster): Minimum ≥ 2,
  // Minimum ≤ Maximum ≤ Gesamtzahl, und die vom Nutzer geforderte
  // Sanity-Check-Regel "Gesamtzahl ÷ Anzahl Elemente darf nie unter 2
  // fallen" — zusammen mit der allgemeineren Aufteilbarkeits-Prüfung
  // (Anzahl×Minimum ≤ Gesamtzahl ≤ Anzahl×Maximum), die diese Regel für
  // ein beliebiges Minimum > 2 mit abdeckt.
  function validateMultiFields() {
    const total = Number(multiTotalPoints.value);
    const count = Number(multiElementCount.value);
    const min = Number(multiMinPoints.value);
    const max = Number(multiMaxPoints.value);

    const basicValid =
      Number.isInteger(total) && total >= 2 &&
      Number.isInteger(count) && count >= 1 &&
      Number.isInteger(min) && min >= 2 &&
      Number.isInteger(max) && max >= min && max <= total;

    const feasible = basicValid
      && (total / count) >= 2
      && (count * min) <= total
      && total <= (count * max);

    const invalid = !feasible;
    [multiTotalPoints, multiElementCount, multiMinPoints, multiMaxPoints]
      .forEach(el => el.classList.toggle('error', invalid));
    if (invalid) multiFieldsError.textContent = multiFieldsErrorDefaultText;
    multiFieldsError.classList.toggle('visible', invalid);

    return feasible ? { total, count, min, max } : null;
  }

  // Wie refreshMaxSteps(), aber für den "Mehrere Elemente"-Modus: statt
  // einer Maximalschrittzahl wird geprüft, ob die eingetragene
  // Punkte-/Element-Konfiguration arithmetisch erfüllbar ist UND ob das
  // aktuelle Raster (abzüglich verbotener Punkte) überhaupt genug
  // nutzbare Punkte dafür hat.
  function refreshMultiReadiness() {
    enumerateBtn.disabled = true;
    const config = validateMultiFields();
    if (!config) {
      generateBtn.disabled = true;
      statusBadge.textContent = 'Ungültige Eingabe';
      return;
    }
    const availablePoints = currentGraph.vertices.length;
    if (config.total > availablePoints) {
      [multiTotalPoints, multiElementCount, multiMinPoints, multiMaxPoints]
        .forEach(el => el.classList.add('error'));
      multiFieldsError.textContent =
        `Nicht genug nutzbare Punkte im aktuellen Raster (benötigt ${config.total}, verfügbar ${availablePoints}).`;
      multiFieldsError.classList.add('visible');
      generateBtn.disabled = true;
      statusBadge.textContent = 'Nicht genug Punkte';
      return;
    }
    generateBtn.disabled = false;
    statusBadge.textContent = 'Bereit';
  }

  function validateSteps() {
    const val = Number(stepsInput.value);
    const invalid = !Number.isInteger(val) || val < 1 || val > currentMaxInfo.value;
    stepsInput.classList.toggle('error', invalid);
    stepsError.classList.toggle('visible', invalid);
    return invalid ? null : val;
  }

  stepsInput.addEventListener('input', validateSteps);

  function runGeneration() {
    const constraints = getConstraints();

    if (constraints.multiMode) {
      const config = validateMultiFields();
      if (!config) return;
      setBusy(true);
      statusBadge.textContent = 'Erzeuge Glyphen…';
      setTimeout(() => {
        const multi = generateMultiWithRetries(config, currentGraph, currentGrid, constraints);
        if (multi) {
          renderMulti(currentGrid, currentGraph, multi);
          regenerateBtn.dataset.armed = '1';
        } else {
          renderEmpty('Für diese Kombination aus Punktzahl, Elementanzahl, Minimum und Maximum konnte keine gültige Glyphe gefunden werden. Versuche kleinere Werte oder weniger Einschränkungen.');
          statusBadge.textContent = 'Nicht gefunden';
        }
        setBusy(false);
      }, 10);
      return;
    }

    const steps = validateSteps();
    if (steps === null) return;
    setBusy(true);
    statusBadge.textContent = 'Erzeuge Glyphe…';
    setTimeout(() => {
      let result = null;
      if (constraints.treeMode) {
        const tree = generateTreeWithRetries(steps, currentGraph, currentGrid, constraints);
        if (tree) result = { mode: 'tree', edges: tree.edges, root: tree.root };
      } else {
        const path = generateWithRetries(steps, currentGraph, currentGrid, constraints);
        if (path) result = { mode: 'trail', path };
      }
      if (result) {
        renderSingle(currentGrid, currentGraph, result);
        regenerateBtn.dataset.armed = '1';
      } else {
        renderEmpty('Für diese Schrittzahl konnte keine gültige Glyphe gefunden werden. Versuche eine kleinere Zahl oder weniger Einschränkungen.');
        statusBadge.textContent = 'Nicht gefunden';
      }
      setBusy(false);
    }, 10);
  }

  function runEnumeration() {
    const constraints = getConstraints();
    if (constraints.multiMode) return; // "Alle Kombinationen" gibt es im Mehrere-Elemente-Modus nicht (Button ist gesperrt)
    const steps = validateSteps();
    if (steps === null) return;

    invalidateEnumSession();
    enumSessionCounter++;
    const isTree = constraints.treeMode;
    const session = isTree
      ? createTreeEnumerationSession(currentGraph, currentGrid, constraints, steps)
      : createEnumerationSession(currentGraph, currentGrid, constraints, steps);
    currentEnumSession = { id: enumSessionCounter, session, loadedCount: 0, done: false, loading: false, isTree };

    initCombosView();
    outputTitle.textContent = isTree ? 'Alle Ast-Kombinationen' : 'Alle Kombinationen';
    statusBadge.textContent = 'Suche Kombinationen…';
    loadMoreCombos();
    setupSentinelObserver();
  }

  /* Ermittelt die aktuelle Raster-Spezifikation aus der Auswahl:
     feste Größe, "Benutzerdefiniert" (Rechteck) oder "Hexagon".
     Gibt ein generisches { shape, ... } Objekt zurück. */
  function getSelectedDimensions() {
    if (gridSelect.value === 'custom') {
      const w = Number(customWidth.value);
      const h = Number(customHeight.value);
      const invalid =
        !Number.isInteger(w) || !Number.isInteger(h) ||
        w < CUSTOM_MIN_DIM || h < CUSTOM_MIN_DIM ||
        w > CUSTOM_MAX_DIM || h > CUSTOM_MAX_DIM;
      customWidth.classList.toggle('error', invalid);
      customHeight.classList.toggle('error', invalid);
      customGridError.classList.toggle('visible', invalid);
      customGridError.textContent = `Breite und Höhe müssen zwischen ${CUSTOM_MIN_DIM} und ${CUSTOM_MAX_DIM} liegen.`;
      if (invalid) return null;
      return { shape: 'rect', cols: w, rows: h };
    }
    customGridError.classList.remove('visible');
    customWidth.classList.remove('error');
    customHeight.classList.remove('error');

    if (gridSelect.value === 'hexagon') {
      const d = Number(hexDiag.value);
      const v = Number(hexVert.value);
      const invalid =
        !Number.isInteger(d) || !Number.isInteger(v) ||
        d < 1 || v < 1 ||
        d > CUSTOM_MAX_DIM || v > CUSTOM_MAX_DIM;
      hexDiag.classList.toggle('error', invalid);
      hexVert.classList.toggle('error', invalid);
      hexGridError.classList.toggle('visible', invalid);
      hexGridError.textContent = `Schrägseiten und Vertikalseiten müssen zwischen 1 und ${CUSTOM_MAX_DIM} liegen.`;
      if (invalid) return null;
      return { shape: 'hex', d, v };
    }
    hexGridError.classList.remove('visible');
    hexDiag.classList.remove('error');
    hexVert.classList.remove('error');

    if (gridSelect.value === 'circle') {
      const n = Number(circleRings.value);
      const invalid = !Number.isInteger(n) || n < 1 || n > CUSTOM_MAX_DIM;
      circleRings.classList.toggle('error', invalid);
      circleGridError.classList.toggle('visible', invalid);
      circleGridError.textContent = `Die Ringzahl muss zwischen 1 und ${CUSTOM_MAX_DIM} liegen.`;
      if (invalid) return null;
      return { shape: 'circle', n };
    }
    circleGridError.classList.remove('visible');
    circleRings.classList.remove('error');

    if (gridSelect.value === 'ellipse') {
      const rx = Number(ellipseWidth.value);
      const ry = Number(ellipseHeight.value);
      const invalid =
        !Number.isInteger(rx) || !Number.isInteger(ry) ||
        rx < 1 || ry < 1 ||
        rx > CUSTOM_MAX_DIM || ry > CUSTOM_MAX_DIM;
      ellipseWidth.classList.toggle('error', invalid);
      ellipseHeight.classList.toggle('error', invalid);
      ellipseGridError.classList.toggle('visible', invalid);
      ellipseGridError.textContent = `Breite und Höhe müssen zwischen 1 und ${CUSTOM_MAX_DIM} liegen.`;
      if (invalid) return null;
      return { shape: 'ellipse', rx, ry };
    }
    ellipseGridError.classList.remove('visible');
    ellipseWidth.classList.remove('error');
    ellipseHeight.classList.remove('error');

    if (gridSelect.value === 'triangle') {
      const width = Number(triangleWidth.value);
      const height = Number(triangleHeight.value);
      const invalid =
        !Number.isInteger(width) || !Number.isInteger(height) ||
        width < 1 || height < 1 ||
        width % 2 === 0 ||
        width > CUSTOM_MAX_DIM || height > CUSTOM_MAX_DIM;
      triangleWidth.classList.toggle('error', invalid);
      triangleHeight.classList.toggle('error', invalid);
      triangleGridError.classList.toggle('visible', invalid);
      triangleGridError.textContent = width % 2 === 0
        ? 'Die Breite muss ungerade sein, damit die Reihen zentriert bleiben.'
        : `Breite und Höhe müssen zwischen 1 und ${CUSTOM_MAX_DIM} liegen.`;
      if (invalid) return null;
      return { shape: 'triangle', width, height };
    }
    triangleGridError.classList.remove('visible');
    triangleWidth.classList.remove('error');
    triangleHeight.classList.remove('error');

    if (gridSelect.value === 'rhombus') {
      const width = Number(rhombusWidth.value);
      const height = Number(rhombusHeight.value);
      const invalid =
        !Number.isInteger(width) || !Number.isInteger(height) ||
        width < 1 || height < 1 ||
        width % 2 === 0 ||
        width > CUSTOM_MAX_DIM || height > CUSTOM_MAX_DIM;
      rhombusWidth.classList.toggle('error', invalid);
      rhombusHeight.classList.toggle('error', invalid);
      rhombusGridError.classList.toggle('visible', invalid);
      rhombusGridError.textContent = width % 2 === 0
        ? 'Die Breite muss ungerade sein, damit die Reihen zentriert bleiben.'
        : `Breite und Höhe müssen zwischen 1 und ${CUSTOM_MAX_DIM} liegen.`;
      if (invalid) return null;
      return { shape: 'rhombus', width, height };
    }
    rhombusGridError.classList.remove('visible');
    rhombusWidth.classList.remove('error');
    rhombusHeight.classList.remove('error');

    if (gridSelect.value === 'trapezoid') {
      const top = Number(trapezoidTop.value);
      const height = Number(trapezoidHeight.value);
      const invalid =
        !Number.isInteger(top) || !Number.isInteger(height) ||
        top < 1 || height < 1 ||
        top > CUSTOM_MAX_DIM || height > CUSTOM_MAX_DIM;
      trapezoidTop.classList.toggle('error', invalid);
      trapezoidHeight.classList.toggle('error', invalid);
      trapezoidGridError.classList.toggle('visible', invalid);
      trapezoidGridError.textContent = `Oberseite und Höhe müssen zwischen 1 und ${CUSTOM_MAX_DIM} liegen.`;
      if (invalid) return null;
      return { shape: 'trapezoid', top, height };
    }
    trapezoidGridError.classList.remove('visible');
    trapezoidTop.classList.remove('error');
    trapezoidHeight.classList.remove('error');

    if (gridSelect.value === 'parallelogram') {
      const sideLength = Number(parallelogramSide.value);
      const height = Number(parallelogramHeight.value);
      const offset = Number(parallelogramOffset.value);
      const invalid =
        !Number.isInteger(sideLength) || !Number.isInteger(height) || !Number.isInteger(offset) ||
        sideLength < 1 || height < 1 ||
        sideLength > CUSTOM_MAX_DIM || height > CUSTOM_MAX_DIM ||
        offset < -CUSTOM_MAX_DIM || offset > CUSTOM_MAX_DIM;
      parallelogramSide.classList.toggle('error', invalid);
      parallelogramHeight.classList.toggle('error', invalid);
      parallelogramOffset.classList.toggle('error', invalid);
      parallelogramGridError.classList.toggle('visible', invalid);
      parallelogramGridError.textContent = `Seitenlänge und Höhe müssen zwischen 1 und ${CUSTOM_MAX_DIM} liegen, Versatz zwischen -${CUSTOM_MAX_DIM} und ${CUSTOM_MAX_DIM}.`;
      if (invalid) return null;
      return { shape: 'parallelogram', sideLength, height, offset };
    }
    parallelogramGridError.classList.remove('visible');
    parallelogramSide.classList.remove('error');
    parallelogramHeight.classList.remove('error');
    parallelogramOffset.classList.remove('error');

    const [cols, rows] = gridSelect.value.split('x').map(Number);
    return { shape: 'rect', cols, rows };
  }

  /* Liest die Raster-Spezifikation aus einem bereits existierenden
     Grid-Objekt aus (für refreshForbiddenOnly, wo die Größe gleich
     bleiben soll). */
  function specFromGrid(grid) {
    if (grid.shape === 'hex') return { shape: 'hex', d: grid.d, v: grid.v };
    if (grid.shape === 'circle') return { shape: 'circle', n: grid.n };
    if (grid.shape === 'ellipse') return { shape: 'ellipse', rx: grid.rx, ry: grid.ry };
    if (grid.shape === 'triangle') return { shape: 'triangle', width: grid.width, height: grid.height };
    if (grid.shape === 'rhombus') return { shape: 'rhombus', width: grid.width, height: grid.height };
    if (grid.shape === 'trapezoid') return { shape: 'trapezoid', top: grid.top, height: grid.height };
    if (grid.shape === 'parallelogram') return { shape: 'parallelogram', sideLength: grid.sideLength, height: grid.height, offset: grid.offset };
    return { shape: 'rect', cols: grid.cols, rows: grid.rows };
  }

  function specsEqual(a, b) {
    if (a.shape !== b.shape) return false;
    if (a.shape === 'hex') return a.d === b.d && a.v === b.v;
    if (a.shape === 'circle') return a.n === b.n;
    if (a.shape === 'ellipse') return a.rx === b.rx && a.ry === b.ry;
    if (a.shape === 'triangle') return a.width === b.width && a.height === b.height;
    if (a.shape === 'rhombus') return a.width === b.width && a.height === b.height;
    if (a.shape === 'trapezoid') return a.top === b.top && a.height === b.height;
    if (a.shape === 'parallelogram') return a.sideLength === b.sideLength && a.height === b.height && a.offset === b.offset;
    return a.cols === b.cols && a.rows === b.rows;
  }

  /* Liest & validiert die Liste verbotener Punkte für die aktuelle
     Rastergröße. Verbotene Punkte dürfen weder Start, Ziel noch
     Zwischenstation einer Strecke sein. */
  function parseForbiddenPoints(totalPoints) {
    if (!forbiddenEnabled.checked) return { set: new Set(), error: null };
    const raw = forbiddenInput.value.trim();
    if (raw === '') return { set: new Set(), error: null };

    const tokens = raw.split(/[,\s]+/).filter(Boolean);
    const set = new Set();
    let outOfRange = false;
    tokens.forEach(t => {
      const num = Number(t);
      if (!Number.isInteger(num) || num < 1 || num > totalPoints) { outOfRange = true; return; }
      set.add(num);
    });
    if (outOfRange) {
      return { set: new Set(), error: `Bitte nur ganze Zahlen zwischen 1 und ${totalPoints} angeben (kommagetrennt).` };
    }
    if (set.size >= totalPoints) {
      return { set: new Set(), error: 'Es muss mindestens ein Punkt nutzbar bleiben.' };
    }
    return { set, error: null };
  }

  /* Baut Raster + Graph für gegebene Dimensionen tatsächlich neu auf
     (ohne Rückfrage) und berücksichtigt dabei verbotene Punkte. */
  function performRebuild(spec) {
    currentGrid = spec.shape === 'hex'
      ? buildHexGridDefinition(spec.d, spec.v)
      : spec.shape === 'circle'
      ? buildCircleGridDefinition(spec.n)
      : spec.shape === 'ellipse'
      ? buildEllipseGridDefinition(spec.rx, spec.ry)
      : spec.shape === 'triangle'
      ? buildTriangleGridDefinition(spec.width, spec.height)
      : spec.shape === 'rhombus'
      ? buildRhombusGridDefinition(spec.width, spec.height)
      : spec.shape === 'trapezoid'
      ? buildTrapezoidGridDefinition(spec.top, spec.height)
      : spec.shape === 'parallelogram'
      ? buildParallelogramGridDefinition(spec.sideLength, spec.height, spec.offset)
      : buildGridDefinition(spec.cols, spec.rows);
    const totalPoints = Object.keys(currentGrid.points).length;
    forbiddenRangeHint.textContent = `1–${totalPoints}`;

    const { set: forbiddenSet, error: forbiddenErrorMsg } = parseForbiddenPoints(totalPoints);
    forbiddenInput.classList.toggle('error', !!forbiddenErrorMsg);
    forbiddenError.classList.toggle('visible', !!forbiddenErrorMsg);
    if (forbiddenErrorMsg) forbiddenError.textContent = forbiddenErrorMsg;

    regenerateBtn.dataset.armed = '0';

    if (forbiddenErrorMsg) {
      currentGraph = buildGraph(currentGrid, new Set());
      renderEmpty('Bitte die verbotenen Punkte korrigieren, um fortzufahren.');
      statusBadge.textContent = 'Ungültige Eingabe';
      generateBtn.disabled = true;
      enumerateBtn.disabled = true;
      return;
    }

    currentGraph = buildGraph(currentGrid, forbiddenSet);
    const forbiddenNote = forbiddenSet.size > 0
      ? ` (${forbiddenSet.size} Punkt${forbiddenSet.size > 1 ? 'e' : ''} gesperrt)`
      : '';
    renderEmpty(`Noch keine Glyphe erzeugt. Wähle die Schritte und klicke auf „Zufällige Glyphe“ oder „Alle Kombinationen“.${forbiddenNote}`);
    refreshMaxSteps();
  }

  /* Öffentlicher Einstiegspunkt: prüft, ob sich die Rastergröße/-form
     tatsächlich geändert hat und warnt in diesem Fall, bevor die
     eingetragenen verbotenen Punkte gelöscht werden. */
  function rebuildGridAndRefresh() {
    const spec = getSelectedDimensions();
    if (!spec) {
      renderEmpty('Bitte gültige Werte für die Rastergröße eingeben.');
      statusBadge.textContent = 'Ungültiges Raster';
      generateBtn.disabled = true;
      enumerateBtn.disabled = true;
      return;
    }

    const specChanged = !specsEqual(spec, currentGrid);
    const hasForbiddenText = forbiddenInput.value.trim() !== '';

    if (specChanged && hasForbiddenText) {
      showModal(
        'Verbotene Punkte werden zurückgesetzt',
        'Die Rastergröße hat sich geändert. Die aktuell eingetragenen verbotenen Punkte beziehen sich auf das vorherige Raster und werden gelöscht.',
        () => {
          forbiddenInput.value = '';
          performRebuild(spec);
        }
      );
      return;
    }

    performRebuild(spec);
  }

  /* Wird bei Änderungen an den verbotenen Punkten selbst aufgerufen
     (Checkbox, Eingabefeld) — die Rastergröße bleibt dabei gleich,
     daher ist kein Warnfenster nötig. */
  function refreshForbiddenOnly() {
    performRebuild(specFromGrid(currentGrid));
  }

  function showModal(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-card">
      <h3></h3>
      <p></p>
      <button class="btn btn-blue" type="button">Verstanden</button>
    </div>`;
    overlay.querySelector('h3').textContent = title;
    overlay.querySelector('p').textContent = message;
    document.body.appendChild(overlay);
    overlay.querySelector('button').addEventListener('click', () => {
      document.body.removeChild(overlay);
      onConfirm();
    });
  }

  function handleGridSelectChange() {
    customGridGroup.style.display = gridSelect.value === 'custom' ? 'block' : 'none';
    hexGridGroup.style.display = gridSelect.value === 'hexagon' ? 'block' : 'none';
    circleGridGroup.style.display = gridSelect.value === 'circle' ? 'block' : 'none';
    ellipseGridGroup.style.display = gridSelect.value === 'ellipse' ? 'block' : 'none';
    triangleGridGroup.style.display = gridSelect.value === 'triangle' ? 'block' : 'none';
    rhombusGridGroup.style.display = gridSelect.value === 'rhombus' ? 'block' : 'none';
    trapezoidGridGroup.style.display = gridSelect.value === 'trapezoid' ? 'block' : 'none';
    parallelogramGridGroup.style.display = gridSelect.value === 'parallelogram' ? 'block' : 'none';
    rebuildGridAndRefresh();
  }

  function handleForbiddenEnabledChange() {
    forbiddenFieldWrap.style.display = forbiddenEnabled.checked ? 'block' : 'none';
    refreshForbiddenOnly();
  }

  // Ast-Generierung impliziert "Punktbelastung vermeiden" (ein Baum kann
  // keinen Punkt doppelt enthalten) — die Checkbox wird entsprechend
  // zwangsweise aktiviert und gesperrt, solange Ast-Generierung läuft.
  // Da sich Ast-Generierung und "Mehrere Elemente" gegenseitig
  // ausschließen, wird zusätzlich die jeweils andere Checkbox gesperrt.
  function handleTreeModeChange() {
    syncModeExclusivity();
    refreshForbiddenOnly();
  }

  // "Mehrere Elemente" blendet die Schritte-Felder aus und stattdessen
  // die eigenen Punkte-/Element-Felder ein; wie Ast-Generierung
  // impliziert der Modus zwangsläufig "Punktbelastung vermeiden" und
  // schließt sich mit Ast-Generierung gegenseitig aus.
  function handleMultiModeChange() {
    const on = multiModeBox.checked;
    stepsGroup.style.display = on ? 'none' : 'block';
    multiFieldsGroup.style.display = on ? 'block' : 'none';
    syncModeExclusivity();
    refreshForbiddenOnly();
  }

  generateBtn.addEventListener('click', runGeneration);
  enumerateBtn.addEventListener('click', runEnumeration);
  regenerateBtn.addEventListener('click', runGeneration);
  gridSelect.addEventListener('change', handleGridSelectChange);
  customWidth.addEventListener('change', rebuildGridAndRefresh);
  customHeight.addEventListener('change', rebuildGridAndRefresh);
  customWidth.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  customHeight.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  hexDiag.addEventListener('change', rebuildGridAndRefresh);
  hexVert.addEventListener('change', rebuildGridAndRefresh);
  hexDiag.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  hexVert.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  circleRings.addEventListener('change', rebuildGridAndRefresh);
  circleRings.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  ellipseWidth.addEventListener('change', rebuildGridAndRefresh);
  ellipseHeight.addEventListener('change', rebuildGridAndRefresh);
  ellipseWidth.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  ellipseHeight.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  triangleWidth.addEventListener('change', rebuildGridAndRefresh);
  triangleHeight.addEventListener('change', rebuildGridAndRefresh);
  triangleWidth.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  triangleHeight.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  rhombusWidth.addEventListener('change', rebuildGridAndRefresh);
  rhombusHeight.addEventListener('change', rebuildGridAndRefresh);
  rhombusWidth.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  rhombusHeight.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  trapezoidTop.addEventListener('change', rebuildGridAndRefresh);
  trapezoidHeight.addEventListener('change', rebuildGridAndRefresh);
  trapezoidTop.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  trapezoidHeight.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  parallelogramSide.addEventListener('change', rebuildGridAndRefresh);
  parallelogramHeight.addEventListener('change', rebuildGridAndRefresh);
  parallelogramOffset.addEventListener('change', rebuildGridAndRefresh);
  parallelogramSide.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  parallelogramHeight.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  parallelogramOffset.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
  forbiddenEnabled.addEventListener('change', handleForbiddenEnabledChange);
  forbiddenInput.addEventListener('change', refreshForbiddenOnly);
  forbiddenInput.addEventListener('keydown', e => { if (e.key === 'Enter') refreshForbiddenOnly(); });
  avoidCrossingBox.addEventListener('change', refreshForbiddenOnly);
  avoidPointReuseBox.addEventListener('change', refreshForbiddenOnly);
  avoidConcentrationBox.addEventListener('change', refreshForbiddenOnly);
  treeModeBox.addEventListener('change', handleTreeModeChange);
  multiModeBox.addEventListener('change', handleMultiModeChange);
  stepsInput.addEventListener('keydown', e => { if (e.key === 'Enter') runGeneration(); });
  [multiTotalPoints, multiElementCount, multiMinPoints, multiMaxPoints].forEach(el => {
    el.addEventListener('input', () => { if (multiModeBox.checked) refreshMultiReadiness(); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') runGeneration(); });
  });

  regenerateBtn.dataset.armed = '0';
  forbiddenRangeHint.textContent = `1–${Object.keys(currentGrid.points).length}`;
  refreshMaxSteps();
})();
