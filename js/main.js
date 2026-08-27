/* =====================================================
   EINSTIEGSPUNKT
   Initialisiert Theme-Toggle, verdrahtet alle Event-Listener
   und stößt den ersten Rebuild des Rasters an.
   ===================================================== */
import { initTheme } from './theme.js';
import { PNG_EXPORT_SIZE, PNG_EXPORT_SIZE_CARD } from './config.js';
import { buildStandaloneSVG, downloadSVGString, downloadSVGAsPNG, buildExportFilename } from './export.js';
import { state } from './state.js';
import {
  gridSelect, customWidth, customHeight, hexDiag, hexVert,
  circleRings, ellipseWidth, ellipseHeight,
  triangleWidth, triangleHeight, rhombusWidth, rhombusHeight,
  trapezoidTop, trapezoidHeight, parallelogramSide, parallelogramHeight, parallelogramOffset,
  forbiddenEnabled, forbiddenInput,
  avoidCrossingBox, avoidPointReuseBox, avoidConcentrationBox, treeModeBox, multiModeBox,
  stepsInput, multiTotalPoints, multiElementCount, multiMinPoints, multiMaxPoints,
  generateBtn, enumerateBtn, regenerateBtn, exportSvgBtn, exportPngBtn, outputCanvas
} from './dom-refs.js';
import {
  runGeneration, runEnumeration, rebuildGridAndRefresh, refreshForbiddenOnly,
  handleGridSelectChange, handleForbiddenEnabledChange, handleTreeModeChange, handleMultiModeChange,
  updateMultiFieldBoundAttributes, updateMultiFieldBounds, refreshMultiReadiness, getExportOptions
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

regenerateBtn.dataset.armed = '0';
// Synchronisiert einmalig die sichtbare Feldgruppe mit der tatsächlich
// ausgewählten Raster-Option (jetzt standardmäßig "Rechteck") und stößt
// darüber den ersten Rebuild + refreshMaxSteps() an — robuster als eine
// Annahme über die Standardauswahl fest zu verdrahten.
handleGridSelectChange();
