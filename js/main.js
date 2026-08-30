/* =====================================================
   EINSTIEGSPUNKT
   Initialisiert Theme-Toggle, verdrahtet alle Event-Listener
   und stößt den ersten Rebuild des Rasters an.
   ===================================================== */
import { initTheme } from './theme.js';
import { PNG_EXPORT_SIZE, PNG_EXPORT_SIZE_CARD } from './config.js';
import { buildStandaloneSVG, downloadSVGString, downloadSVGAsPNG, buildExportFilename } from './export.js';
import { exportAllCombosAsZip } from './bulk-export.js';
import { state } from './state.js';
import {
  gridSelect, customMode, customWidth, customHeight, customRings, hexMode, hexDiag, hexVert, hexRings,
  circleMode, circleRings, circleResolution, ellipseWidth, ellipseHeight,
  triangleMode, triangleWidth, triangleHeight, triangleRings,
  rhombusMode, rhombusWidth, rhombusHeight, rhombusRadialRings, rhombusRadialWidth, rhombusRadialHeight,
  trapezoidTop, trapezoidHeight, parallelogramSide, parallelogramHeight, parallelogramOffset,
  kiteMode, kiteHeight, kiteRadialRings, kiteRadialTail,
  pentagonMode, pentagonDiamondSize, pentagonRings, pentagonSquareSize,
  heptagonMode, heptagonRings, heptagonWidth, heptagonHeight,
  octagonMode, octagonRings, octagonSize,
  nonagonMode, nonagonRings, nonagonSize,
  decagonMode, decagonRings, decagonWidth, decagonHeight,
  semicircleMode, semicircleRings, semicircleResolution,
  starTips, starMode, starWidth, starHeight, starRings,
  annulusRings, annulusHollow,
  compassMode, compassWidth, compassHeight, compassRings,
  crossArmWidth, crossMode, crossWidth, crossHeight, crossRings,
  forbiddenEnabled, forbiddenInput,
  avoidCrossingBox, avoidPointReuseBox, avoidConcentrationBox, treeModeBox, multiModeBox,
  stepsInput, multiTotalPoints, multiElementCount, multiMinPoints, multiMaxPoints,
  generateBtn, enumerateBtn, exportSvgBtn, exportPngBtn, outputCanvas
} from './dom-refs.js';
import {
  runGeneration, runEnumeration, rebuildGridAndRefresh, refreshForbiddenOnly,
  handleGridSelectChange, handleForbiddenEnabledChange, handleTreeModeChange, handleMultiModeChange,
  handleCustomModeChange, handleHexModeChange, handleTriangleModeChange, handleRhombusModeChange, handleKiteModeChange,
  handleStarModeChange, handleCompassModeChange, handleCrossModeChange, handleCircleModeChange, handleSemicircleModeChange,
  handlePentagonModeChange, handleHeptagonModeChange, handleOctagonModeChange,
  handleNonagonModeChange, handleDecagonModeChange,
  updateMultiFieldBoundAttributes, updateMultiFieldBounds, refreshMultiReadiness, getExportOptions,
  getConstraints
} from './ui-controllers.js';

initTheme();

exportSvgBtn.addEventListener('click', () => {
  if (!state.currentSingleResult) return;
  const { grid, graph, edges, rootVertex, rootVertices } = state.currentSingleResult;
  const svgString = buildStandaloneSVG(grid, graph, edges, { rootVertex, rootVertices, ...getExportOptions() });
  downloadSVGString(svgString, buildExportFilename('glyphe', 'svg', grid, state.currentSingleResult, stepsInput.value));
});

exportPngBtn.addEventListener('click', () => {
  if (!state.currentSingleResult) return;
  const { grid, graph, edges, rootVertex, rootVertices } = state.currentSingleResult;
  const svgString = buildStandaloneSVG(grid, graph, edges, { rootVertex, rootVertices, ...getExportOptions() });
  downloadSVGAsPNG(svgString, buildExportFilename('glyphe', 'png', grid, state.currentSingleResult, stepsInput.value), PNG_EXPORT_SIZE);
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
  const svgString = buildStandaloneSVG(state.currentGrid, state.currentGraph, edges, { rootVertex, ...getExportOptions() });
  if (btn.dataset.action === 'svg') {
    downloadSVGString(svgString, buildExportFilename(`kombination-${idx}`, 'svg', state.currentGrid, null, stepsInput.value));
  } else {
    downloadSVGAsPNG(svgString, buildExportFilename(`kombination-${idx}`, 'png', state.currentGrid, null, stepsInput.value), PNG_EXPORT_SIZE_CARD);
  }
});

// Delegierter Klick-Handler für den ZIP-Sammelexport ("Alle als
// SVG/PNG (ZIP)"), analog zu den Einzelkarten-Buttons oben — auch
// diese Buttons werden bei jedem "Alle Kombinationen"-Aufruf neu
// erzeugt (initCombosView() ersetzt outputCanvas.innerHTML), daher
// Delegation statt direkter Listener.
let zipExportInProgress = false;
outputCanvas.addEventListener('click', async (e) => {
  const btn = e.target.closest('#comboZipSvgBtn, #comboZipPngBtn');
  if (!btn || zipExportInProgress) return;
  const format = btn.id === 'comboZipPngBtn' ? 'png' : 'svg';
  const statusEl = document.getElementById('comboZipStatus');
  const svgBtn = document.getElementById('comboZipSvgBtn');
  const pngBtn = document.getElementById('comboZipPngBtn');

  const constraints = getConstraints();
  const target = Number(stepsInput.value);
  if (!Number.isInteger(target) || target < 1) return;

  zipExportInProgress = true;
  if (svgBtn) svgBtn.disabled = true;
  if (pngBtn) pngBtn.disabled = true;

  try {
    const result = await exportAllCombosAsZip(format, constraints, target, (progress) => {
      if (!statusEl) return;
      if (progress.phase === 'collecting') {
        statusEl.textContent = `Sammle Kombinationen… (${progress.count})`;
      } else if (progress.phase === 'rendering') {
        statusEl.textContent = `Erzeuge ${format.toUpperCase()}-Dateien… (${progress.count}/${progress.total})`;
      } else if (progress.phase === 'zipping') {
        statusEl.textContent = 'Packe ZIP-Datei…';
      }
    });
    if (statusEl) {
      statusEl.textContent = result.fileCount === 0
        ? 'Keine Kombinationen gefunden.'
        : `${result.fileCount} Datei${result.fileCount === 1 ? '' : 'en'} exportiert${result.truncated ? ' (Sicherheitslimit erreicht, nicht alle Kombinationen enthalten)' : ''}.`;
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || 'Export fehlgeschlagen.';
  } finally {
    zipExportInProgress = false;
    if (svgBtn) svgBtn.disabled = false;
    if (pngBtn) pngBtn.disabled = false;
  }
});

generateBtn.addEventListener('click', runGeneration);
enumerateBtn.addEventListener('click', runEnumeration);
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
circleResolution.addEventListener('change', rebuildGridAndRefresh);
circleResolution.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
circleMode.addEventListener('change', handleCircleModeChange);
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
// Drachenviereck (Standard-Feld) und Kreisring: einfache Einzelfelder
// (keine Modus-Umschaltung nötig).
[kiteHeight, annulusRings, annulusHollow].forEach(el => {
  el.addEventListener('change', rebuildGridAndRefresh);
  el.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
});
semicircleRings.addEventListener('change', rebuildGridAndRefresh);
semicircleRings.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
semicircleResolution.addEventListener('change', rebuildGridAndRefresh);
semicircleResolution.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
semicircleMode.addEventListener('change', handleSemicircleModeChange);

// Rechteck/Quadrat, Hexagon, Dreieck, Raute, Drachenviereck, Sternpolygon,
// Kompassstern, Kreis, Halbkreis haben je einen Modus-Select
// ("Standard"/"Raster" vs. "Radial") plus die zugehörigen Unterfelder.
customMode.addEventListener('change', handleCustomModeChange);
hexMode.addEventListener('change', handleHexModeChange);
triangleMode.addEventListener('change', handleTriangleModeChange);
rhombusMode.addEventListener('change', handleRhombusModeChange);
kiteMode.addEventListener('change', handleKiteModeChange);
starMode.addEventListener('change', handleStarModeChange);
compassMode.addEventListener('change', handleCompassModeChange);
crossMode.addEventListener('change', handleCrossModeChange);

[
  customRings, hexRings, triangleRings,
  rhombusRadialRings, rhombusRadialWidth, rhombusRadialHeight,
  kiteRadialRings, kiteRadialTail,
  starTips, starWidth, starHeight, starRings,
  compassWidth, compassHeight, compassRings,
  crossArmWidth, crossWidth, crossHeight, crossRings
].forEach(el => {
  el.addEventListener('change', rebuildGridAndRefresh);
  el.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
});

// Die fünf regelmäßigen Vielecke: je ein Modus-Select (löst beim Wechsel
// die passende Unterfeldgruppen-Sichtbarkeit + Rebuild aus) plus die
// Unterfelder selbst (lösen nur einen Rebuild aus, ohne Sichtbarkeit zu
// ändern — sie sind ja bereits die gerade sichtbare Gruppe).
pentagonMode.addEventListener('change', handlePentagonModeChange);
heptagonMode.addEventListener('change', handleHeptagonModeChange);
octagonMode.addEventListener('change', handleOctagonModeChange);
nonagonMode.addEventListener('change', handleNonagonModeChange);
decagonMode.addEventListener('change', handleDecagonModeChange);

[
  pentagonDiamondSize, pentagonRings, pentagonSquareSize,
  heptagonRings, heptagonWidth, heptagonHeight,
  octagonRings, octagonSize,
  nonagonRings, nonagonSize,
  decagonRings, decagonWidth, decagonHeight
].forEach(el => {
  el.addEventListener('change', rebuildGridAndRefresh);
  el.addEventListener('keydown', e => { if (e.key === 'Enter') rebuildGridAndRefresh(); });
});

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
  el.addEventListener('input', () => {
    updateMultiFieldBoundAttributes();
    if (multiModeBox.checked) refreshMultiReadiness();
  });
  el.addEventListener('change', () => {
    updateMultiFieldBounds();
    if (multiModeBox.checked) refreshMultiReadiness();
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter') runGeneration(); });
});

// Synchronisiert einmalig die sichtbare Feldgruppe mit der tatsächlich
// ausgewählten Raster-Option (jetzt standardmäßig "Rechteck") und stößt
// darüber den ersten Rebuild + refreshMaxSteps() an — robuster als eine
// Annahme über die Standardauswahl fest zu verdrahten.
handleGridSelectChange();
