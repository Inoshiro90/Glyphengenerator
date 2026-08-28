/* =====================================================
   DOM-REFERENZEN
   Zentrale Sammelstelle aller per ID abgefragten Elemente.
   Wird von main.js beim Start importiert (Modul-Top-Level-
   Code läuft dabei automatisch), alle anderen Module lesen
   die hier einmalig aufgelösten Referenzen.
   ===================================================== */

// ---------- Ausgabe-/Ergebnisbereich ----------
export const outputCanvas   = document.getElementById('outputCanvas');
export const sequenceFooter = document.getElementById('sequenceFooter');
export const sequenceChain  = document.getElementById('sequenceChain');
// Das Status-Pillen-Element neben dem Titel wurde entfernt. Die vielen
// Stellen im Code, die weiterhin einen Statustext zuweisen (Fortschritt,
// Fehler, "Bereit" etc.), bleiben unverändert bestehen — sie schreiben
// einfach ins Leere, statt jede einzelne Zuweisung entfernen zu müssen.
export const statusBadge    = { textContent: '' };
export const outputTitle    = document.getElementById('outputTitle');

// ---------- Export-Buttons ----------
export const exportSvgBtn = document.getElementById('exportSvgBtn');
export const exportPngBtn = document.getElementById('exportPngBtn');
export const exportRow    = document.querySelector('.export-row');

// ---------- Export-Optionen ----------
export const exportShowNumbers      = document.getElementById('exportShowNumbers');
export const exportShowPoints       = document.getElementById('exportShowPoints');
export const exportHollowPoints     = document.getElementById('exportHollowPoints');
export const exportShowStartRing    = document.getElementById('exportShowStartRing');
export const exportShowUnusedPoints = document.getElementById('exportShowUnusedPoints');
export const exportColor            = document.getElementById('exportColor');

// ---------- Raster-Auswahl ----------
export const gridSelect         = document.getElementById('gridSelect');
export const customGridGroup    = document.getElementById('customGridGroup');
export const customWidth        = document.getElementById('customWidth');
export const customHeight       = document.getElementById('customHeight');
export const customGridError    = document.getElementById('customGridError');
export const hexGridGroup       = document.getElementById('hexGridGroup');
export const hexDiag            = document.getElementById('hexDiag');
export const hexVert            = document.getElementById('hexVert');
export const hexGridError       = document.getElementById('hexGridError');
export const circleGridGroup    = document.getElementById('circleGridGroup');
export const circleRings        = document.getElementById('circleRings');
export const circleGridError    = document.getElementById('circleGridError');
export const ellipseGridGroup   = document.getElementById('ellipseGridGroup');
export const ellipseWidth       = document.getElementById('ellipseWidth');
export const ellipseHeight      = document.getElementById('ellipseHeight');
export const ellipseGridError   = document.getElementById('ellipseGridError');
export const triangleGridGroup  = document.getElementById('triangleGridGroup');
export const triangleWidth      = document.getElementById('triangleWidth');
export const triangleHeight     = document.getElementById('triangleHeight');
export const triangleGridError  = document.getElementById('triangleGridError');
export const rhombusGridGroup   = document.getElementById('rhombusGridGroup');
export const rhombusWidth       = document.getElementById('rhombusWidth');
export const rhombusHeight      = document.getElementById('rhombusHeight');
export const rhombusGridError   = document.getElementById('rhombusGridError');
export const trapezoidGridGroup = document.getElementById('trapezoidGridGroup');
export const trapezoidTop       = document.getElementById('trapezoidTop');
export const trapezoidHeight    = document.getElementById('trapezoidHeight');
export const trapezoidGridError = document.getElementById('trapezoidGridError');
export const parallelogramGridGroup = document.getElementById('parallelogramGridGroup');
export const parallelogramSide      = document.getElementById('parallelogramSide');
export const parallelogramHeight    = document.getElementById('parallelogramHeight');
export const parallelogramOffset    = document.getElementById('parallelogramOffset');
export const parallelogramGridError = document.getElementById('parallelogramGridError');
export const kiteGridGroup   = document.getElementById('kiteGridGroup');
export const kiteHeight      = document.getElementById('kiteHeight');
export const kiteGridError   = document.getElementById('kiteGridError');
export const pentagonGridGroup     = document.getElementById('pentagonGridGroup');
export const pentagonMode          = document.getElementById('pentagonMode');
export const pentagonDiamondFields = document.getElementById('pentagonDiamondFields');
export const pentagonDiamondSize   = document.getElementById('pentagonDiamondSize');
export const pentagonRadialFields  = document.getElementById('pentagonRadialFields');
export const pentagonRings         = document.getElementById('pentagonRings');
export const pentagonSquareFields  = document.getElementById('pentagonSquareFields');
export const pentagonSquareSize    = document.getElementById('pentagonSquareSize');
export const pentagonGridError     = document.getElementById('pentagonGridError');

export const heptagonGridGroup       = document.getElementById('heptagonGridGroup');
export const heptagonMode            = document.getElementById('heptagonMode');
export const heptagonRadialFields    = document.getElementById('heptagonRadialFields');
export const heptagonRings           = document.getElementById('heptagonRings');
export const heptagonRectangleFields = document.getElementById('heptagonRectangleFields');
export const heptagonWidth           = document.getElementById('heptagonWidth');
export const heptagonHeight          = document.getElementById('heptagonHeight');
export const heptagonGridError       = document.getElementById('heptagonGridError');

export const octagonGridGroup    = document.getElementById('octagonGridGroup');
export const octagonMode         = document.getElementById('octagonMode');
export const octagonRadialFields = document.getElementById('octagonRadialFields');
export const octagonRings        = document.getElementById('octagonRings');
export const octagonSquareFields = document.getElementById('octagonSquareFields');
export const octagonSize         = document.getElementById('octagonSize');
export const octagonGridError    = document.getElementById('octagonGridError');

export const nonagonGridGroup    = document.getElementById('nonagonGridGroup');
export const nonagonMode         = document.getElementById('nonagonMode');
export const nonagonRadialFields = document.getElementById('nonagonRadialFields');
export const nonagonRings        = document.getElementById('nonagonRings');
export const nonagonSquareFields = document.getElementById('nonagonSquareFields');
export const nonagonSize         = document.getElementById('nonagonSize');
export const nonagonGridError    = document.getElementById('nonagonGridError');

export const decagonGridGroup       = document.getElementById('decagonGridGroup');
export const decagonMode            = document.getElementById('decagonMode');
export const decagonRadialFields    = document.getElementById('decagonRadialFields');
export const decagonRings           = document.getElementById('decagonRings');
export const decagonRectangleFields = document.getElementById('decagonRectangleFields');
export const decagonWidth           = document.getElementById('decagonWidth');
export const decagonHeight          = document.getElementById('decagonHeight');
export const decagonGridError       = document.getElementById('decagonGridError');

export const semicircleGridGroup = document.getElementById('semicircleGridGroup');
export const semicircleRings     = document.getElementById('semicircleRings');
export const semicircleGridError = document.getElementById('semicircleGridError');

// ---------- Verbotene Punkte ----------
export const forbiddenEnabled   = document.getElementById('forbiddenEnabled');
export const forbiddenFieldWrap = document.getElementById('forbiddenFieldWrap');
export const forbiddenInput     = document.getElementById('forbiddenInput');
export const forbiddenError     = document.getElementById('forbiddenError');
export const forbiddenRangeHint = document.getElementById('forbiddenRangeHint');

// ---------- Erweiterte Optionen ----------
export const avoidCrossingBox      = document.getElementById('avoidCrossing');
export const avoidPointReuseBox    = document.getElementById('avoidPointReuse');
export const avoidConcentrationBox = document.getElementById('avoidConcentration');
export const treeModeBox           = document.getElementById('treeMode');
export const multiModeBox          = document.getElementById('multiMode');

// ---------- Schritte / Mehrere Elemente ----------
export const stepsGroup        = document.getElementById('stepsGroup');
export const stepsInput        = document.getElementById('stepsInput');
export const maxStepsLabel     = document.getElementById('maxSteps');
export const maxStepsQualifier = document.getElementById('maxStepsQualifier');
export const stepsError        = document.getElementById('stepsError');
export const multiFieldsGroup  = document.getElementById('multiFieldsGroup');
export const multiTotalPoints  = document.getElementById('multiTotalPoints');
export const multiElementCount = document.getElementById('multiElementCount');
export const multiMinPoints    = document.getElementById('multiMinPoints');
export const multiMaxPoints    = document.getElementById('multiMaxPoints');
export const multiFieldsError  = document.getElementById('multiFieldsError');
export const multiBalancedBox  = document.getElementById('multiBalanced');
export const multiFieldsErrorDefaultText = multiFieldsError.textContent;

// ---------- Aktions-Buttons ----------
export const generateBtn   = document.getElementById('generateBtn');
export const enumerateBtn  = document.getElementById('enumerateBtn');
