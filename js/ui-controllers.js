/* =====================================================
   UI-STEUERUNG
   Constraint-Auslesung, Feld-Validierung/-Grenzen, Rebuild
   der Raster/Graphen bei Auswahländerung, sowie die
   öffentlichen Handler für Generieren/Enumerieren.
   ===================================================== */
import { CUSTOM_MIN_DIM, CUSTOM_MAX_DIM, KITE_MAX_H } from './config.js';
import {
  gridSelect, customGridGroup, customWidth, customHeight, customGridError,
  hexGridGroup, hexDiag, hexVert, hexGridError,
  circleGridGroup, circleRings, circleGridError,
  ellipseGridGroup, ellipseWidth, ellipseHeight, ellipseGridError,
  triangleGridGroup, triangleWidth, triangleHeight, triangleGridError,
  rhombusGridGroup, rhombusWidth, rhombusHeight, rhombusGridError,
  trapezoidGridGroup, trapezoidTop, trapezoidHeight, trapezoidGridError,
  parallelogramGridGroup, parallelogramSide, parallelogramHeight, parallelogramOffset, parallelogramGridError,
  kiteGridGroup, kiteHeight, kiteGridError,
  pentagonGridGroup, pentagonMode, pentagonDiamondFields, pentagonDiamondSize,
  pentagonRadialFields, pentagonRings, pentagonSquareFields, pentagonSquareSize, pentagonGridError,
  heptagonGridGroup, heptagonMode, heptagonRadialFields, heptagonRings,
  heptagonRectangleFields, heptagonWidth, heptagonHeight, heptagonGridError,
  octagonGridGroup, octagonMode, octagonRadialFields, octagonRings,
  octagonSquareFields, octagonSize, octagonGridError,
  nonagonGridGroup, nonagonMode, nonagonRadialFields, nonagonRings,
  nonagonSquareFields, nonagonSize, nonagonGridError,
  decagonGridGroup, decagonMode, decagonRadialFields, decagonRings,
  decagonRectangleFields, decagonWidth, decagonHeight, decagonGridError,
  semicircleGridGroup, semicircleRings, semicircleGridError,
  forbiddenEnabled, forbiddenFieldWrap, forbiddenInput, forbiddenError, forbiddenRangeHint,
  avoidCrossingBox, avoidPointReuseBox, avoidConcentrationBox, treeModeBox, multiModeBox,
  stepsGroup, stepsInput, maxStepsLabel, maxStepsQualifier, stepsError,
  multiFieldsGroup, multiTotalPoints, multiElementCount, multiMinPoints, multiMaxPoints,
  multiFieldsError, multiFieldsErrorDefaultText, multiBalancedBox,
  generateBtn, enumerateBtn, statusBadge,
  exportShowNumbers, exportShowPoints, exportHollowPoints, exportShowStartRing, exportShowUnusedPoints, exportColor
} from './dom-refs.js';
import { state, invalidateEnumSession } from './state.js';
import {
  buildGridDefinition, buildHexGridDefinition, buildCircleGridDefinition, buildEllipseGridDefinition,
  buildTriangleGridDefinition, buildRhombusGridDefinition, buildTrapezoidGridDefinition, buildParallelogramGridDefinition,
  buildKiteGridDefinition, buildSemicircleGridDefinition,
  buildPentagonDiamondGridDefinition, buildPentagonSquareGridDefinition, buildPentagonRadialGridDefinition,
  buildHeptagonRectangleGridDefinition, buildHeptagonRadialGridDefinition,
  buildOctagonSquareGridDefinition, buildOctagonRadialGridDefinition,
  buildNonagonSquareGridDefinition, buildNonagonRadialGridDefinition,
  buildDecagonRectangleGridDefinition, buildDecagonRadialGridDefinition
} from './grids/index.js';
import { buildGraph } from './graph.js';
import { computeMaxSteps } from './generation/max-steps.js';
import { generateWithRetries } from './generation/trail-single.js';
import { generateTreeWithRetries } from './generation/trail-tree.js';
import { generateMultiWithRetries } from './generation/trail-multi.js';
import { createEnumerationSession } from './generation/enumeration-trail.js';
import { createTreeEnumerationSession } from './generation/enumeration-tree.js';
import { renderSingle, renderMulti, renderEmpty } from './render-results.js';
import { initCombosView, loadMoreCombos, setupSentinelObserver } from './combos-view.js';

// Liest die sechs Export-Darstellungsoptionen aus (wirken nur auf den
// SVG-/PNG-Export, nicht auf die interaktive Anzeige im Tool).
export function getExportOptions() {
  return {
    showNumbers: exportShowNumbers.checked,
    showPoints: exportShowPoints.checked,
    hollowPoints: exportHollowPoints.checked,
    showStartRing: exportShowStartRing.checked,
    showUnusedPoints: exportShowUnusedPoints.checked,
    color: exportColor.value
  };
}

// Liest die fünf erweiterten Optionen aus. Ast-Generierung UND
// "Mehrere Elemente" schließen "Punktbelastung vermeiden" zwangsläufig
// mit ein (ein Baum kann per Konstruktion keinen Punkt doppelt
// enthalten; die einzelnen Linien mehrerer Elemente ebenso wenig, da
// sich sonst ihre Punktzahl nicht exakt der geplanten Aufteilung
// zuordnen ließe).
export function getConstraints() {
  const treeMode = treeModeBox.checked;
  const multiMode = multiModeBox.checked;
  return {
    avoidCrossing: avoidCrossingBox.checked,
    avoidPointReuse: (treeMode || multiMode) ? true : avoidPointReuseBox.checked,
    avoidConcentration: avoidConcentrationBox.checked,
    treeMode,
    multiMode,
    multiBalanced: multiBalancedBox.checked
  };
}

// Zentrale Quelle der Wahrheit dafür, ob Generieren/Enumerieren gerade
// erlaubt sind. Wird sowohl nach der Maximalschritt-Berechnung als auch
// nach jedem setBusy(false) aufgerufen — vorher wurde enumerateBtn im
// Ast-Modus fälschlich wieder aktiviert, sobald irgendeine andere
// Aktion (z. B. "Zufällige Glyphe") den Busy-Zustand zurücksetzte.
export function updateActionButtonsEnabled() {
  if (multiModeBox.checked) {
    const config = validateMultiFields();
    const readyOk = !!config && config.total <= state.currentGraph.vertices.length;
    generateBtn.disabled = !readyOk;
    enumerateBtn.disabled = true; // "Alle Kombinationen" gibt es im Mehrere-Elemente-Modus nicht
  } else {
    const hasValidMax = state.currentMaxInfo.value >= 1;
    generateBtn.disabled = !hasValidMax;
    enumerateBtn.disabled = !hasValidMax;
  }
}

// Ast-Generierung und "Mehrere Elemente" implizieren beide
// "Punktbelastung vermeiden" (ein Baum bzw. eine einzelne Linie kann
// per Konstruktion keinen Punkt doppelt enthalten) — die Checkbox
// wird entsprechend zwangsweise aktiviert und gesperrt, solange
// mindestens einer der beiden Modi läuft. Die Modi selbst schließen
// sich NICHT gegenseitig aus: sind beide aktiv, ist jedes Element des
// Mehrere-Elemente-Modus selbst ein Baum statt einer einfachen Linie.
export function syncAdvancedOptionState() {
  const forceReuse = treeModeBox.checked || multiModeBox.checked;
  avoidPointReuseBox.disabled = forceReuse;
  if (forceReuse) avoidPointReuseBox.checked = true;
}

export function setBusy(busy) {
  const controls = [generateBtn, enumerateBtn, gridSelect, stepsInput,
    customWidth, customHeight, forbiddenEnabled, forbiddenInput,
    avoidCrossingBox, avoidPointReuseBox, avoidConcentrationBox, treeModeBox, multiModeBox,
    multiTotalPoints, multiElementCount, multiMinPoints, multiMaxPoints, multiBalancedBox];
  controls.forEach(el => (el.disabled = busy));
  if (!busy) {
    updateActionButtonsEnabled();
    syncAdvancedOptionState();
  }
}

export function refreshMaxSteps() {
  statusBadge.textContent = 'Berechne Maximum…';
  generateBtn.disabled = true;
  enumerateBtn.disabled = true;

  // Kurz verzögern, damit der Status sichtbar wird, bevor die
  // (bei größeren Rastern spürbare) Berechnung synchron läuft. Läuft
  // IMMER, auch im Mehrere-Elemente-Modus: die "Gesamtzahl Punkte"
  // leitet ihre Obergrenze direkt von diesem Wert ab (siehe
  // updateMultiFieldBounds), daher muss er auch dort aktuell sein.
  setTimeout(() => {
    const constraints = getConstraints();
    state.currentMaxInfo = computeMaxSteps(state.currentGraph, state.currentGrid, constraints);
    maxStepsLabel.textContent = state.currentMaxInfo.value;
    maxStepsQualifier.textContent = state.currentMaxInfo.exact
      ? '(exakt)'
      : '(größter gefundener Wert – ggf. minimal höher möglich)';
    stepsInput.max = state.currentMaxInfo.value;
    // Wird bei JEDER Änderung der Rasterparameter neu gesetzt (nicht nur
    // wenn der alte Wert das neue Maximum überschreitet) — abgerundete
    // Hälfte des Maximums, statt eines starren/stehengebliebenen Werts.
    // Bei Maximum < 2 bliebe die Hälfte 0 (ungültig, obwohl z.B. 1
    // Schritt möglich wäre) — dann bleibt der Wert beim Maximum selbst.
    stepsInput.value = state.currentMaxInfo.value < 2
      ? state.currentMaxInfo.value
      : Math.floor(state.currentMaxInfo.value / 2);
    validateSteps();

    updateMultiFieldBounds();
    if (multiModeBox.checked) {
      refreshMultiReadiness();
    } else {
      statusBadge.textContent = state.currentMaxInfo.value < 1 ? 'Kein Pfad möglich' : 'Bereit';
    }
    updateActionButtonsEnabled();
  }, 20);
}

// Berechnet für die vier Mehrere-Elemente-Felder dynamisch min/max
// (HTML-Attribute, wirken u. a. auf die Spinner-Pfeile). Die vier
// Felder hängen kaskadenartig voneinander ab:
//   Gesamtzahl  → hängt nur vom Raster/den Checkboxen ab
//                 (identische Berechnung wie "Maximal möglich" bei
//                 Einzelglyphen, siehe currentMaxInfo).
//   Anzahl      → hängt von der Gesamtzahl ab.
//   Min.        → hängt von Gesamtzahl UND Anzahl ab (⌊Gesamtzahl÷Anzahl⌋
//                 — mehr darf der GARANTIERTE Mindestwert pro Element
//                 nicht sein, sonst würden schon `Anzahl` Elemente an
//                 diesem Minimum allein die Gesamtzahl überschreiten).
//   Max.        → hängt von Gesamtzahl UND Anzahl ab (NICHT vom
//                 aktuellen Min.-Feldwert): Gesamtzahl−(Anzahl−1)×2 —
//                 so viele Punkte könnte EIN Element theoretisch
//                 bekommen, wenn alle übrigen Elemente nur die feste
//                 harte Mindestpunktzahl (2) erhalten. Bewusst NICHT
//                 der eingetragene Min.-Wert (der standardmäßig nahe
//                 am Durchschnitt ⌊Gesamt÷Anzahl⌋ liegt): das würde
//                 die Obergrenze von Max. ebenfalls an den Durchschnitt
//                 drücken und jede Varianz von vornherein unmöglich
//                 machen.
// Wird in dieser Reihenfolge ausgewertet, damit sich eine Änderung an
// einem Feld korrekt auf alle davon abhängigen Felder fortpflanzt —
// unabhängig davon, welches Feld zuletzt bearbeitet wurde.
//
// Liest die aktuellen (ggf. gerade erst getippten, noch nicht
// bestätigten) Werte nur lesend — überschreibt sie NICHT. Dadurch
// kann diese leichte Variante bei jedem Tastenanschlag laufen (live
// sichtbare Spinner-Grenzen), ohne den Nutzer beim Tippen zu stören.
// Endgültig durchgesetzt (Wert in den Bereich geklemmt) wird erst
// durch clampMultiFieldValues() — siehe dort.
export function updateMultiFieldBoundAttributes() {
  // state.currentMaxInfo.value ist die maximale SCHRITTZAHL (Kanten) einer
  // Einzelglyphe. Die Gesamtzahl im Mehrere-Elemente-Modus zählt dagegen
  // PUNKTE, nicht Kanten — ein einzelner Pfad mit n Kanten hat n+1 Punkte.
  // Deshalb hier +1, sonst wäre die Obergrenze um genau einen Punkt zu klein.
  const totalMax = Math.max(2, state.currentMaxInfo.value + 1);
  multiTotalPoints.min = 2;
  multiTotalPoints.max = totalMax;
  const total = Number(multiTotalPoints.value) || totalMax;

  const countMax = Math.max(2, Math.floor(total / 2));
  multiElementCount.min = 2;
  multiElementCount.max = countMax;
  const count = Number(multiElementCount.value) || countMax;

  const minCeil = Math.max(2, Math.floor(total / count));
  multiMinPoints.min = 2;
  multiMinPoints.max = minCeil;

  // Bewusst NICHT der aktuelle Wert des Min.-Feldes (der standardmäßig
  // nahe am Durchschnitt ⌊Gesamt÷Anzahl⌋ liegt) — das würde die
  // Obergrenze von Max. ebenfalls nahe an den Durchschnitt drücken und
  // jede Varianz von vornherein unmöglich machen. Stattdessen die feste
  // harte Mindestpunktzahl (2): so viele Punkte könnte EIN Element
  // maximal bekommen, wenn alle übrigen Elemente nur das Minimum (2)
  // erhalten.
  const maxCeil = Math.max(2, total - (count - 1) * 2);
  multiMaxPoints.min = 2;
  multiMaxPoints.max = maxCeil;
}

// Klemmt `el` hart auf [min, max]. Zusätzlich: war der Wert VORHER
// exakt an der (alten) Obergrenze festgeklemmt, "folgt" er der neuen
// Obergrenze automatisch mit — nach oben wie nach unten. Das löst das
// Problem, dass Felder nach einem Wechsel zu einem kleineren Raster
// dauerhaft klein "hängen bleiben", selbst wenn man danach wieder ein
// größeres Raster wählt: ohne dieses Nachziehen würde z. B.
// "Gesamtzahl Punkte" nach einem Ausflug auf ein 3×3-Raster für immer
// bei 4 verharren, obwohl ein 5×5-Raster längst viel mehr zuließe.
// Ein bewusst tiefer eingestellter Wert (nicht an der Grenze) bleibt
// dagegen unangetastet, solange er weiterhin gültig ist.
export function clampFieldToBounds(el, min, max) {
  const prevMax = el.max === '' ? NaN : Number(el.max);
  const wasPinnedToMax = el.value !== '' && Number(el.value) === prevMax;
  el.min = min;
  el.max = max;
  let val = Number(el.value);
  if (!el.value || !Number.isInteger(val) || wasPinnedToMax || val > max) val = max;
  else if (val < min) val = min;
  el.value = val;
}

// Repariert eine (nach dem reinen Grenzen-Klemmen) ggf. immer noch
// NICHT gemeinsam erfüllbare Kombination automatisch, statt den
// Nutzer nur mit einer Fehlermeldung stehen zu lassen ("bei nicht
// durchführbaren Parametern sollen diese auf das nächstmögliche
// gesetzt werden"). Das kann trotz der Einzelfeld-Grenzen weiterhin
// vorkommen, z. B. wenn sich die Gesamtzahl nicht restlos durch die
// Anzahl Elemente teilen lässt: Min. und Max. sind beide auf
// ⌊Gesamtzahl ÷ Anzahl⌋ gedeckelt, aber genau dieser Wert kann als
// Maximum manchmal zu klein sein, um die Gesamtzahl zu erreichen
// (z. B. 10 Punkte auf 3 Elemente: ⌊10÷3⌋=3, aber 3×3=9 < 10). In so
// einem Fall wird das Maximum minimal über die reguläre Deckelung
// hinaus angehoben (auf ⌈Gesamtzahl ÷ Anzahl⌉) — der kleinstmögliche
// Wert, der die Kombination wieder durchführbar macht. Ebenso wird
// eine (durch unabhängige Änderungen an anderen Feldern entstandene)
// Min. > Max.-Situation aufgelöst.
export function ensureMultiFieldsFeasible() {
  const total = Number(multiTotalPoints.value);
  const count = Number(multiElementCount.value);
  let min = Number(multiMinPoints.value);
  let max = Number(multiMaxPoints.value);

  if (min > max) max = min;
  if (count * max < total) max = Math.ceil(total / count);
  if (count * min > total) min = Math.max(2, Math.floor(total / count));
  min = Math.max(2, min);
  max = Math.max(2, max);
  if (min > max) max = min;

  multiMinPoints.value = min;
  multiMaxPoints.value = max;
  // Die tatsächlich erreichbare Grenze kann durch diese Korrektur über
  // die zuvor berechnete "einfache" Deckelung hinausgehen — Attribut
  // nachziehen, damit das Feld nicht als "außerhalb des erlaubten
  // Bereichs" erscheint.
  if (min > Number(multiMinPoints.max)) multiMinPoints.max = min;
  if (max > Number(multiMaxPoints.max)) multiMaxPoints.max = max;
}

// Wie updateMultiFieldBoundAttributes(), klemmt aber zusätzlich jeden
// aktuellen Wert hart auf den neu berechneten Bereich, falls er (z. B.
// nach Änderung eines abhängigen Feldes, oder nach einer Raster-/
// Checkbox-Änderung) jetzt außerhalb liegt. Wird bewusst NICHT bei
// jedem Tastenanschlag aufgerufen (das würde den Nutzer beim Tippen
// ständig unterbrechen), sondern nur bei strukturellen Änderungen
// (refreshMaxSteps) und beim Verlassen eines Feldes ('change').
export function updateMultiFieldBounds() {
  // Siehe Kommentar in updateMultiFieldBoundAttributes(): +1, um Kanten
  // (currentMaxInfo.value) in Punkte umzurechnen.
  clampFieldToBounds(multiTotalPoints, 2, Math.max(2, state.currentMaxInfo.value + 1));
  const total = Number(multiTotalPoints.value);

  clampFieldToBounds(multiElementCount, 2, Math.max(2, Math.floor(total / 2)));
  const count = Number(multiElementCount.value);

  const minCeil = Math.max(2, Math.floor(total / count));
  clampFieldToBounds(multiMinPoints, 2, minCeil);

  // Siehe Kommentar in updateMultiFieldBoundAttributes(): feste harte
  // Mindestpunktzahl (2) statt des aktuellen Min.-Feldwerts.
  const maxCeil = Math.max(2, total - (count - 1) * 2);
  clampFieldToBounds(multiMaxPoints, 2, maxCeil);

  ensureMultiFieldsFeasible();
}

// Prüft die vier Eingabefelder des "Mehrere Elemente"-Modus rein
// arithmetisch (unabhängig vom aktuellen Raster): Anzahl Elemente ≥ 2,
// Minimum ≥ 2, Minimum ≤ Maximum ≤ Gesamtzahl, und die vom Nutzer geforderte
// Sanity-Check-Regel "Gesamtzahl ÷ Anzahl Elemente darf nie unter 2
// fallen" — zusammen mit der allgemeineren Aufteilbarkeits-Prüfung
// (Anzahl×Minimum ≤ Gesamtzahl ≤ Anzahl×Maximum), die diese Regel für
// ein beliebiges Minimum > 2 mit abdeckt. Dank updateMultiFieldBounds()
// sollte diese Prüfung durch die Feldgrenzen inzwischen praktisch immer
// erfüllbar sein — sie bleibt trotzdem als zweite, unabhängige
// Absicherung bestehen (z. B. falls ein Feld leer gelassen wird).
export function validateMultiFields() {
  const total = Number(multiTotalPoints.value);
  const count = Number(multiElementCount.value);
  const min = Number(multiMinPoints.value);
  const max = Number(multiMaxPoints.value);

  const basicValid =
    Number.isInteger(total) && total >= 2 &&
    Number.isInteger(count) && count >= 2 &&
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
export function refreshMultiReadiness() {
  enumerateBtn.disabled = true;
  const config = validateMultiFields();
  if (!config) {
    generateBtn.disabled = true;
    statusBadge.textContent = 'Ungültige Eingabe';
    return;
  }
  const availablePoints = state.currentGraph.vertices.length;
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

export function validateSteps() {
  const val = Number(stepsInput.value);
  const invalid = !Number.isInteger(val) || val < 1 || val > state.currentMaxInfo.value;
  stepsInput.classList.toggle('error', invalid);
  stepsError.classList.toggle('visible', invalid);
  return invalid ? null : val;
}

export function runGeneration() {
  const constraints = getConstraints();

  if (constraints.multiMode) {
    const config = validateMultiFields();
    if (!config) return;
    setBusy(true);
    statusBadge.textContent = 'Erzeuge Glyphen…';
    setTimeout(() => {
      const multi = generateMultiWithRetries(config, state.currentGraph, state.currentGrid, constraints);
      if (multi) {
        renderMulti(state.currentGrid, state.currentGraph, multi, constraints.treeMode);
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
      const tree = generateTreeWithRetries(steps, state.currentGraph, state.currentGrid, constraints);
      if (tree) result = { mode: 'tree', edges: tree.edges, root: tree.root };
    } else {
      const path = generateWithRetries(steps, state.currentGraph, state.currentGrid, constraints);
      if (path) result = { mode: 'trail', path };
    }
    if (result) {
      renderSingle(state.currentGrid, state.currentGraph, result);
    } else {
      renderEmpty('Für diese Schrittzahl konnte keine gültige Glyphe gefunden werden. Versuche eine kleinere Zahl oder weniger Einschränkungen.');
      statusBadge.textContent = 'Nicht gefunden';
    }
    setBusy(false);
  }, 10);
}

export function runEnumeration() {
  const constraints = getConstraints();
  if (constraints.multiMode) return; // "Alle Kombinationen" gibt es im Mehrere-Elemente-Modus nicht (Button ist gesperrt)
  const steps = validateSteps();
  if (steps === null) return;

  invalidateEnumSession();
  state.enumSessionCounter++;
  const isTree = constraints.treeMode;
  const session = isTree
    ? createTreeEnumerationSession(state.currentGraph, state.currentGrid, constraints, steps)
    : createEnumerationSession(state.currentGraph, state.currentGrid, constraints, steps);
  state.currentEnumSession = { id: state.enumSessionCounter, session, loadedCount: 0, done: false, loading: false, isTree };

  initCombosView();
  document.getElementById('outputTitle').textContent = isTree ? 'Alle Ast-Kombinationen' : 'Alle Kombinationen';
  statusBadge.textContent = 'Suche Kombinationen…';
  loadMoreCombos();
  setupSentinelObserver();
}

/* Ermittelt die aktuelle Raster-Spezifikation aus der Auswahl:
   feste Größe, "Benutzerdefiniert" (Rechteck) oder "Hexagon".
   Gibt ein generisches { shape, ... } Objekt zurück. */
export function getSelectedDimensions() {
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
      width % 2 === 0 || height % 2 === 0 ||
      width > CUSTOM_MAX_DIM || height > CUSTOM_MAX_DIM;
    rhombusWidth.classList.toggle('error', invalid);
    rhombusHeight.classList.toggle('error', invalid);
    rhombusGridError.classList.toggle('visible', invalid);
    rhombusGridError.textContent = (width % 2 === 0 || height % 2 === 0)
      ? 'Breite und Höhe müssen beide ungerade sein, damit die Reihen zentriert bleiben.'
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

  if (gridSelect.value === 'kite') {
    const h = Number(kiteHeight.value);
    const invalid = !Number.isInteger(h) || h < 1 || h > KITE_MAX_H;
    kiteHeight.classList.toggle('error', invalid);
    kiteGridError.classList.toggle('visible', invalid);
    kiteGridError.textContent = `h muss zwischen 1 und ${KITE_MAX_H} liegen.`;
    if (invalid) return null;
    return { shape: 'kite', h };
  }
  kiteGridError.classList.remove('visible');
  kiteHeight.classList.remove('error');

  // Gemeinsame Validierung für "Ringe"-Eingaben (Radial-Modus aller
  // fünf Vielecke): ganzzahlig, zwischen 1 und CUSTOM_MAX_DIM.
  function validateRingsField(input, error) {
    const n = Number(input.value);
    const invalid = !Number.isInteger(n) || n < 1 || n > CUSTOM_MAX_DIM;
    input.classList.toggle('error', invalid);
    error.classList.toggle('visible', invalid);
    error.textContent = `Die Ringzahl muss zwischen 1 und ${CUSTOM_MAX_DIM} liegen.`;
    return invalid ? null : n;
  }

  if (gridSelect.value === 'pentagon') {
    if (pentagonMode.value === 'radial') {
      const n = validateRingsField(pentagonRings, pentagonGridError);
      pentagonDiamondSize.classList.remove('error');
      pentagonSquareSize.classList.remove('error');
      if (n === null) return null;
      return { shape: 'pentagon', mode: 'radial', n };
    }
    const field = pentagonMode.value === 'diamond' ? pentagonDiamondSize : pentagonSquareSize;
    const size = Number(field.value);
    const invalid = !Number.isInteger(size) || size < 3 || size % 2 === 0 || size > CUSTOM_MAX_DIM;
    field.classList.toggle('error', invalid);
    pentagonGridError.classList.toggle('visible', invalid);
    pentagonGridError.textContent = `Die Größe muss ungerade sein, zwischen 3 und ${CUSTOM_MAX_DIM}.`;
    pentagonRings.classList.remove('error');
    if (invalid) return null;
    return { shape: 'pentagon', mode: pentagonMode.value, size };
  }
  pentagonGridError.classList.remove('visible');
  [pentagonDiamondSize, pentagonRings, pentagonSquareSize].forEach(el => el.classList.remove('error'));

  if (gridSelect.value === 'heptagon') {
    if (heptagonMode.value === 'radial') {
      const n = validateRingsField(heptagonRings, heptagonGridError);
      heptagonWidth.classList.remove('error');
      heptagonHeight.classList.remove('error');
      if (n === null) return null;
      return { shape: 'heptagon', mode: 'radial', n };
    }
    const width = Number(heptagonWidth.value);
    const height = Number(heptagonHeight.value);
    const invalid =
      !Number.isInteger(width) || !Number.isInteger(height) ||
      width < 3 || height < 2 ||
      width > CUSTOM_MAX_DIM || height > CUSTOM_MAX_DIM;
    heptagonWidth.classList.toggle('error', invalid);
    heptagonHeight.classList.toggle('error', invalid);
    heptagonGridError.classList.toggle('visible', invalid);
    heptagonGridError.textContent = `Breite muss mindestens 3, Höhe mindestens 2 sein (max. ${CUSTOM_MAX_DIM}).`;
    heptagonRings.classList.remove('error');
    if (invalid) return null;
    return { shape: 'heptagon', mode: 'rectangle', width, height };
  }
  heptagonGridError.classList.remove('visible');
  [heptagonRings, heptagonWidth, heptagonHeight].forEach(el => el.classList.remove('error'));

  if (gridSelect.value === 'octagon') {
    if (octagonMode.value === 'radial') {
      const n = validateRingsField(octagonRings, octagonGridError);
      octagonSize.classList.remove('error');
      if (n === null) return null;
      return { shape: 'octagon', mode: 'radial', n };
    }
    const size = Number(octagonSize.value);
    const invalid = !Number.isInteger(size) || size < 3 || size > CUSTOM_MAX_DIM;
    octagonSize.classList.toggle('error', invalid);
    octagonGridError.classList.toggle('visible', invalid);
    octagonGridError.textContent = `Die Größe muss zwischen 3 und ${CUSTOM_MAX_DIM} liegen.`;
    octagonRings.classList.remove('error');
    if (invalid) return null;
    return { shape: 'octagon', mode: 'square', size };
  }
  octagonGridError.classList.remove('visible');
  [octagonRings, octagonSize].forEach(el => el.classList.remove('error'));

  if (gridSelect.value === 'nonagon') {
    if (nonagonMode.value === 'radial') {
      const n = validateRingsField(nonagonRings, nonagonGridError);
      nonagonSize.classList.remove('error');
      if (n === null) return null;
      return { shape: 'nonagon', mode: 'radial', n };
    }
    const size = Number(nonagonSize.value);
    const invalid = !Number.isInteger(size) || size < 5 || size % 2 === 0 || size > CUSTOM_MAX_DIM;
    nonagonSize.classList.toggle('error', invalid);
    nonagonGridError.classList.toggle('visible', invalid);
    nonagonGridError.textContent = `Die Größe muss ungerade sein, zwischen 5 und ${CUSTOM_MAX_DIM}.`;
    nonagonRings.classList.remove('error');
    if (invalid) return null;
    return { shape: 'nonagon', mode: 'square', size };
  }
  nonagonGridError.classList.remove('visible');
  [nonagonRings, nonagonSize].forEach(el => el.classList.remove('error'));

  if (gridSelect.value === 'decagon') {
    if (decagonMode.value === 'radial') {
      const n = validateRingsField(decagonRings, decagonGridError);
      decagonWidth.classList.remove('error');
      decagonHeight.classList.remove('error');
      if (n === null) return null;
      return { shape: 'decagon', mode: 'radial', n };
    }
    const width = Number(decagonWidth.value);
    const height = Number(decagonHeight.value);
    const invalid =
      !Number.isInteger(width) || !Number.isInteger(height) ||
      width < 5 || height < 3 || height % 2 === 0 ||
      width > CUSTOM_MAX_DIM || height > CUSTOM_MAX_DIM;
    decagonWidth.classList.toggle('error', invalid);
    decagonHeight.classList.toggle('error', invalid);
    decagonGridError.classList.toggle('visible', invalid);
    decagonGridError.textContent = `Breite muss mindestens 5 sein, Höhe muss ungerade und mindestens 3 sein (max. ${CUSTOM_MAX_DIM}).`;
    decagonRings.classList.remove('error');
    if (invalid) return null;
    return { shape: 'decagon', mode: 'rectangle', width, height };
  }
  decagonGridError.classList.remove('visible');
  [decagonRings, decagonWidth, decagonHeight].forEach(el => el.classList.remove('error'));

  if (gridSelect.value === 'semicircle') {
    const n = Number(semicircleRings.value);
    const invalid = !Number.isInteger(n) || n < 1 || n > CUSTOM_MAX_DIM;
    semicircleRings.classList.toggle('error', invalid);
    semicircleGridError.classList.toggle('visible', invalid);
    semicircleGridError.textContent = `Die Ringzahl muss zwischen 1 und ${CUSTOM_MAX_DIM} liegen.`;
    if (invalid) return null;
    return { shape: 'semicircle', n };
  }
  semicircleGridError.classList.remove('visible');
  semicircleRings.classList.remove('error');

  const [cols, rows] = gridSelect.value.split('x').map(Number);
  return { shape: 'rect', cols, rows };
}

/* Liest die Raster-Spezifikation aus einem bereits existierenden
   Grid-Objekt aus (für refreshForbiddenOnly, wo die Größe gleich
   bleiben soll). */
export function specFromGrid(grid) {
  if (grid.shape === 'hex') return { shape: 'hex', d: grid.d, v: grid.v };
  if (grid.shape === 'circle') return { shape: 'circle', n: grid.n };
  if (grid.shape === 'ellipse') return { shape: 'ellipse', rx: grid.rx, ry: grid.ry };
  if (grid.shape === 'triangle') return { shape: 'triangle', width: grid.width, height: grid.height };
  if (grid.shape === 'rhombus') return { shape: 'rhombus', width: grid.width, height: grid.height };
  if (grid.shape === 'trapezoid') return { shape: 'trapezoid', top: grid.top, height: grid.height };
  if (grid.shape === 'parallelogram') return { shape: 'parallelogram', sideLength: grid.sideLength, height: grid.height, offset: grid.offset };
  if (grid.shape === 'kite') return { shape: 'kite', h: grid.h };
  if (grid.shape === 'pentagon' && grid.mode === 'radial') return { shape: 'pentagon', mode: 'radial', n: grid.n };
  if (grid.shape === 'pentagon') return { shape: 'pentagon', mode: grid.mode, size: grid.size };
  if (grid.shape === 'heptagon' && grid.mode === 'radial') return { shape: 'heptagon', mode: 'radial', n: grid.n };
  if (grid.shape === 'heptagon') return { shape: 'heptagon', mode: 'rectangle', width: grid.width, height: grid.height };
  if (grid.shape === 'octagon' && grid.mode === 'radial') return { shape: 'octagon', mode: 'radial', n: grid.n };
  if (grid.shape === 'octagon') return { shape: 'octagon', mode: 'square', size: grid.size };
  if (grid.shape === 'nonagon' && grid.mode === 'radial') return { shape: 'nonagon', mode: 'radial', n: grid.n };
  if (grid.shape === 'nonagon') return { shape: 'nonagon', mode: 'square', size: grid.size };
  if (grid.shape === 'decagon' && grid.mode === 'radial') return { shape: 'decagon', mode: 'radial', n: grid.n };
  if (grid.shape === 'decagon') return { shape: 'decagon', mode: 'rectangle', width: grid.width, height: grid.height };
  if (grid.shape === 'semicircle') return { shape: 'semicircle', n: grid.n };
  return { shape: 'rect', cols: grid.cols, rows: grid.rows };
}

export function specsEqual(a, b) {
  if (a.shape !== b.shape) return false;
  if (a.shape === 'hex') return a.d === b.d && a.v === b.v;
  if (a.shape === 'circle') return a.n === b.n;
  if (a.shape === 'ellipse') return a.rx === b.rx && a.ry === b.ry;
  if (a.shape === 'triangle') return a.width === b.width && a.height === b.height;
  if (a.shape === 'rhombus') return a.width === b.width && a.height === b.height;
  if (a.shape === 'trapezoid') return a.top === b.top && a.height === b.height;
  if (a.shape === 'parallelogram') return a.sideLength === b.sideLength && a.height === b.height && a.offset === b.offset;
  if (a.shape === 'kite') return a.h === b.h;
  if (['pentagon', 'heptagon', 'octagon', 'nonagon', 'decagon'].includes(a.shape)) {
    if (a.mode !== b.mode) return false;
    if (a.mode === 'radial') return a.n === b.n;
    if (a.mode === 'rectangle') return a.width === b.width && a.height === b.height;
    return a.size === b.size; // diamond / square
  }
  if (a.shape === 'semicircle') return a.n === b.n;
  return a.cols === b.cols && a.rows === b.rows;
}

/* Liest & validiert die Liste verbotener Punkte für die aktuelle
   Rastergröße. Verbotene Punkte dürfen weder Start, Ziel noch
   Zwischenstation einer Strecke sein. */
export function parseForbiddenPoints(totalPoints) {
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

// Baut je nach Rasterform aus der Spezifikation das passende Grid-Objekt.
// Als Lookup-Tabelle statt einer langen Ternary-Kette, da inzwischen 13
// Formen unterstützt werden.
const GRID_BUILDERS = {
  hex: spec => buildHexGridDefinition(spec.d, spec.v),
  circle: spec => buildCircleGridDefinition(spec.n),
  ellipse: spec => buildEllipseGridDefinition(spec.rx, spec.ry),
  triangle: spec => buildTriangleGridDefinition(spec.width, spec.height),
  rhombus: spec => buildRhombusGridDefinition(spec.width, spec.height),
  trapezoid: spec => buildTrapezoidGridDefinition(spec.top, spec.height),
  parallelogram: spec => buildParallelogramGridDefinition(spec.sideLength, spec.height, spec.offset),
  kite: spec => buildKiteGridDefinition(spec.h),
  pentagon: spec => spec.mode === 'radial'
    ? buildPentagonRadialGridDefinition(spec.n)
    : spec.mode === 'square'
    ? buildPentagonSquareGridDefinition(spec.size)
    : buildPentagonDiamondGridDefinition(spec.size),
  heptagon: spec => spec.mode === 'radial'
    ? buildHeptagonRadialGridDefinition(spec.n)
    : buildHeptagonRectangleGridDefinition(spec.width, spec.height),
  octagon: spec => spec.mode === 'radial'
    ? buildOctagonRadialGridDefinition(spec.n)
    : buildOctagonSquareGridDefinition(spec.size),
  nonagon: spec => spec.mode === 'radial'
    ? buildNonagonRadialGridDefinition(spec.n)
    : buildNonagonSquareGridDefinition(spec.size),
  decagon: spec => spec.mode === 'radial'
    ? buildDecagonRadialGridDefinition(spec.n)
    : buildDecagonRectangleGridDefinition(spec.width, spec.height),
  semicircle: spec => buildSemicircleGridDefinition(spec.n)
};

/* Baut Raster + Graph für gegebene Dimensionen tatsächlich neu auf
   (ohne Rückfrage) und berücksichtigt dabei verbotene Punkte. */
export function performRebuild(spec) {
  state.currentGrid = (GRID_BUILDERS[spec.shape] || (s => buildGridDefinition(s.cols, s.rows)))(spec);
  const totalPoints = Object.keys(state.currentGrid.points).length;
  forbiddenRangeHint.textContent = `1–${totalPoints}`;

  const { set: forbiddenSet, error: forbiddenErrorMsg } = parseForbiddenPoints(totalPoints);
  forbiddenInput.classList.toggle('error', !!forbiddenErrorMsg);
  forbiddenError.classList.toggle('visible', !!forbiddenErrorMsg);
  if (forbiddenErrorMsg) forbiddenError.textContent = forbiddenErrorMsg;

  if (forbiddenErrorMsg) {
    state.currentGraph = buildGraph(state.currentGrid, new Set());
    renderEmpty('Bitte die verbotenen Punkte korrigieren, um fortzufahren.');
    statusBadge.textContent = 'Ungültige Eingabe';
    generateBtn.disabled = true;
    enumerateBtn.disabled = true;
    return;
  }

  state.currentGraph = buildGraph(state.currentGrid, forbiddenSet);
  const forbiddenNote = forbiddenSet.size > 0
    ? ` (${forbiddenSet.size} Punkt${forbiddenSet.size > 1 ? 'e' : ''} gesperrt)`
    : '';
  renderEmpty(`Noch keine Glyphe erzeugt. Wähle die Schritte und klicke auf „Zufällige Glyphe“ oder „Alle Kombinationen“.${forbiddenNote}`);
  refreshMaxSteps();
}

/* Öffentlicher Einstiegspunkt: prüft, ob sich die Rastergröße/-form
   tatsächlich geändert hat und warnt in diesem Fall, bevor die
   eingetragenen verbotenen Punkte gelöscht werden. */
export function rebuildGridAndRefresh() {
  const spec = getSelectedDimensions();
  if (!spec) {
    renderEmpty('Bitte gültige Werte für die Rastergröße eingeben.');
    statusBadge.textContent = 'Ungültiges Raster';
    generateBtn.disabled = true;
    enumerateBtn.disabled = true;
    return;
  }

  const specChanged = !specsEqual(spec, state.currentGrid);
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
export function refreshForbiddenOnly() {
  performRebuild(specFromGrid(state.currentGrid));
}

export function showModal(title, message, onConfirm) {
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

export function handleGridSelectChange() {
  customGridGroup.style.display = gridSelect.value === 'custom' ? 'block' : 'none';
  hexGridGroup.style.display = gridSelect.value === 'hexagon' ? 'block' : 'none';
  circleGridGroup.style.display = gridSelect.value === 'circle' ? 'block' : 'none';
  ellipseGridGroup.style.display = gridSelect.value === 'ellipse' ? 'block' : 'none';
  triangleGridGroup.style.display = gridSelect.value === 'triangle' ? 'block' : 'none';
  rhombusGridGroup.style.display = gridSelect.value === 'rhombus' ? 'block' : 'none';
  trapezoidGridGroup.style.display = gridSelect.value === 'trapezoid' ? 'block' : 'none';
  parallelogramGridGroup.style.display = gridSelect.value === 'parallelogram' ? 'block' : 'none';
  kiteGridGroup.style.display = gridSelect.value === 'kite' ? 'block' : 'none';
  pentagonGridGroup.style.display = gridSelect.value === 'pentagon' ? 'block' : 'none';
  heptagonGridGroup.style.display = gridSelect.value === 'heptagon' ? 'block' : 'none';
  octagonGridGroup.style.display = gridSelect.value === 'octagon' ? 'block' : 'none';
  nonagonGridGroup.style.display = gridSelect.value === 'nonagon' ? 'block' : 'none';
  decagonGridGroup.style.display = gridSelect.value === 'decagon' ? 'block' : 'none';
  semicircleGridGroup.style.display = gridSelect.value === 'semicircle' ? 'block' : 'none';
  rebuildGridAndRefresh();
}

export function handleForbiddenEnabledChange() {
  forbiddenFieldWrap.style.display = forbiddenEnabled.checked ? 'block' : 'none';
  refreshForbiddenOnly();
}

// Blendet je nach gewähltem Modus die passende Unterfeldgruppe eines
// Vielecks ein und alle anderen aus, dann Rebuild. Gemeinsamer Helfer
// für alle fünf Vielecke, da das Muster (Modus-Select → eine von N
// Unterfeldgruppen sichtbar) überall identisch ist.
function handlePolygonModeChange(modeSelect, fieldGroupsByMode) {
  Object.entries(fieldGroupsByMode).forEach(([mode, group]) => {
    group.style.display = modeSelect.value === mode ? 'block' : 'none';
  });
  rebuildGridAndRefresh();
}

export function handlePentagonModeChange() {
  handlePolygonModeChange(pentagonMode, {
    diamond: pentagonDiamondFields, radial: pentagonRadialFields, square: pentagonSquareFields
  });
}

export function handleHeptagonModeChange() {
  handlePolygonModeChange(heptagonMode, {
    radial: heptagonRadialFields, rectangle: heptagonRectangleFields
  });
}

export function handleOctagonModeChange() {
  handlePolygonModeChange(octagonMode, {
    radial: octagonRadialFields, square: octagonSquareFields
  });
}

export function handleNonagonModeChange() {
  handlePolygonModeChange(nonagonMode, {
    radial: nonagonRadialFields, square: nonagonSquareFields
  });
}

export function handleDecagonModeChange() {
  handlePolygonModeChange(decagonMode, {
    radial: decagonRadialFields, rectangle: decagonRectangleFields
  });
}

// Ast-Generierung impliziert "Punktbelastung vermeiden" (ein Baum kann
// keinen Punkt doppelt enthalten) — die Checkbox wird entsprechend
// zwangsweise aktiviert und gesperrt, solange Ast-Generierung läuft.
// Ast-Generierung und "Mehrere Elemente" lassen sich kombinieren: ist
// zusätzlich "Mehrere Elemente" aktiv, wird dadurch jedes einzelne
// Element selbst zu einem Baum statt einer einfachen Linie.
export function handleTreeModeChange() {
  syncAdvancedOptionState();
  refreshForbiddenOnly();
}

// "Mehrere Elemente" blendet die Schritte-Felder aus und stattdessen
// die eigenen Punkte-/Element-Felder ein; wie Ast-Generierung
// impliziert der Modus zwangsläufig "Punktbelastung vermeiden". Ist
// Ast-Generierung zusätzlich aktiv, wird jedes Element ein Baum statt
// einer einfachen Linie — die Größenfelder (Punktzahl je Element)
// gelten unverändert für beide Varianten.
export function handleMultiModeChange() {
  const on = multiModeBox.checked;
  stepsGroup.style.display = on ? 'none' : 'block';
  multiFieldsGroup.style.display = on ? 'block' : 'none';
  syncAdvancedOptionState();
  refreshForbiddenOnly();
}
