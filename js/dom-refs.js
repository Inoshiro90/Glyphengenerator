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
export const customMode          = document.getElementById('customMode');
export const customStandardFields = document.getElementById('customStandardFields');
export const customRadialFields   = document.getElementById('customRadialFields');
export const customWidth        = document.getElementById('customWidth');
export const customHeight       = document.getElementById('customHeight');
export const customRings        = document.getElementById('customRings');
export const customGridError    = document.getElementById('customGridError');
export const hexGridGroup       = document.getElementById('hexGridGroup');
export const hexMode             = document.getElementById('hexMode');
export const hexStandardFields   = document.getElementById('hexStandardFields');
export const hexRadialFields     = document.getElementById('hexRadialFields');
export const hexDiag            = document.getElementById('hexDiag');
export const hexVert            = document.getElementById('hexVert');
export const hexRings           = document.getElementById('hexRings');
export const hexGridError       = document.getElementById('hexGridError');
export const circleGridGroup    = document.getElementById('circleGridGroup');
export const circleMode         = document.getElementById('circleMode');
export const circleStandardHint = document.getElementById('circleStandardHint');
export const circleRadialFields = document.getElementById('circleRadialFields');
export const circleRings        = document.getElementById('circleRings');
export const circleResolution   = document.getElementById('circleResolution');
export const circleGridError    = document.getElementById('circleGridError');
export const ellipseGridGroup   = document.getElementById('ellipseGridGroup');
export const ellipseWidth       = document.getElementById('ellipseWidth');
export const ellipseHeight      = document.getElementById('ellipseHeight');
export const ellipseGridError   = document.getElementById('ellipseGridError');
export const triangleGridGroup  = document.getElementById('triangleGridGroup');
export const triangleMode          = document.getElementById('triangleMode');
export const triangleStandardFields = document.getElementById('triangleStandardFields');
export const triangleRadialFields   = document.getElementById('triangleRadialFields');
export const triangleWidth      = document.getElementById('triangleWidth');
export const triangleHeight     = document.getElementById('triangleHeight');
export const triangleRings      = document.getElementById('triangleRings');
export const triangleGridError  = document.getElementById('triangleGridError');
export const rhombusGridGroup   = document.getElementById('rhombusGridGroup');
export const rhombusMode          = document.getElementById('rhombusMode');
export const rhombusStandardFields = document.getElementById('rhombusStandardFields');
export const rhombusRadialFields   = document.getElementById('rhombusRadialFields');
export const rhombusWidth       = document.getElementById('rhombusWidth');
export const rhombusHeight      = document.getElementById('rhombusHeight');
export const rhombusRadialRings  = document.getElementById('rhombusRadialRings');
export const rhombusRadialWidth  = document.getElementById('rhombusRadialWidth');
export const rhombusRadialHeight = document.getElementById('rhombusRadialHeight');
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
export const kiteMode           = document.getElementById('kiteMode');
export const kiteStandardFields = document.getElementById('kiteStandardFields');
export const kiteRadialFields   = document.getElementById('kiteRadialFields');
export const kiteHeight      = document.getElementById('kiteHeight');
export const kiteRadialRings = document.getElementById('kiteRadialRings');
export const kiteRadialTail  = document.getElementById('kiteRadialTail');
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
export const semicircleMode         = document.getElementById('semicircleMode');
export const semicircleStandardHint = document.getElementById('semicircleStandardHint');
export const semicircleRadialFields = document.getElementById('semicircleRadialFields');
export const semicircleRings     = document.getElementById('semicircleRings');
export const semicircleResolution = document.getElementById('semicircleResolution');
export const semicircleGridError = document.getElementById('semicircleGridError');

export const starGridGroup      = document.getElementById('starGridGroup');
export const starTips           = document.getElementById('starTips');
export const starMode           = document.getElementById('starMode');
export const starStandardFields = document.getElementById('starStandardFields');
export const starRadialFields   = document.getElementById('starRadialFields');
export const starWidth          = document.getElementById('starWidth');
export const starHeight         = document.getElementById('starHeight');
export const starRings          = document.getElementById('starRings');
export const starGridError      = document.getElementById('starGridError');

export const annulusGridGroup   = document.getElementById('annulusGridGroup');
export const annulusRings       = document.getElementById('annulusRings');
export const annulusHollow      = document.getElementById('annulusHollow');
export const annulusGridError   = document.getElementById('annulusGridError');

export const compassGridGroup      = document.getElementById('compassGridGroup');
export const compassMode           = document.getElementById('compassMode');
export const compassStandardFields = document.getElementById('compassStandardFields');
export const compassRadialFields   = document.getElementById('compassRadialFields');
export const compassWidth       = document.getElementById('compassWidth');
export const compassHeight      = document.getElementById('compassHeight');
export const compassRings       = document.getElementById('compassRings');
export const compassGridError   = document.getElementById('compassGridError');

export const crossGridGroup      = document.getElementById('crossGridGroup');
export const crossArmWidth       = document.getElementById('crossArmWidth');
export const crossMode           = document.getElementById('crossMode');
export const crossStandardFields = document.getElementById('crossStandardFields');
export const crossRadialFields   = document.getElementById('crossRadialFields');
export const crossWidth         = document.getElementById('crossWidth');
export const crossHeight        = document.getElementById('crossHeight');
export const crossRings         = document.getElementById('crossRings');
export const crossGridError     = document.getElementById('crossGridError');

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
