/* =====================================================
   "ALLE KOMBINATIONEN" — Lazy-Loading-Ansicht
   ===================================================== */
import { ENUM_BATCH_SIZE, ENUM_BATCH_TIME_SLICE_MS, ENUM_AUTO_LOAD_SOFT_LIMIT } from './config.js';
import { outputCanvas, outputTitle, statusBadge, sequenceFooter } from './dom-refs.js';
import { state } from './state.js';
import { glyphSVG } from './render.js';
import { pathToEdges } from './path-utils.js';
import { renderEmpty } from './render-results.js';

export function initCombosView() {
  outputCanvas.classList.remove('single-mode');
  outputCanvas.classList.add('combos-mode');
  sequenceFooter.style.display = 'none';
  outputCanvas.innerHTML =
    `<div class="combos-grid" id="combosGrid"></div>
     <div class="combos-status" id="combosStatus"></div>
     <div class="combos-sentinel" id="combosSentinel"></div>`;
  outputTitle.textContent = 'Alle Kombinationen';
}

export function appendComboCards(grid, graph, results, startIndex, isTree) {
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

export function updateCombosStatus(loadedCount, statusState) {
  const statusEl = document.getElementById('combosStatus');
  if (!statusEl) return;
  if (statusState === 'loading') {
    statusEl.innerHTML = `<div class="combos-loading">Lade weitere Kombinationen… (${loadedCount} geladen)</div>`;
  } else if (statusState === 'done') {
    statusEl.innerHTML = `<div class="combos-done">Alle ${loadedCount} möglichen Kombinationen geladen.</div>`;
  } else if (statusState === 'safety') {
    statusEl.innerHTML = `<div class="truncation-note">Sicherheitslimit erreicht — ${loadedCount} Kombinationen geladen. Die tatsächliche
      Gesamtzahl ist bei dieser Schrittzahl/diesem Raster deutlich höher; weiteres Laden würde den Browser zu stark belasten.
      Reduziere die Schrittzahl für eine vollständige Übersicht.</div>`;
  } else if (statusState === 'manual') {
    statusEl.innerHTML = `<button class="btn btn-secondary" id="loadMoreBtn" type="button">Weitere Kombinationen laden (${loadedCount} bisher)</button>`;
    document.getElementById('loadMoreBtn').addEventListener('click', () => loadMoreCombos());
  } else {
    statusEl.innerHTML = `<div class="combos-count-hint">${loadedCount} geladen — scrolle für mehr</div>`;
  }
}

export function setupSentinelObserver() {
  const sentinel = document.getElementById('combosSentinel');
  if (!sentinel) return;
  if (state.combosObserver) state.combosObserver.disconnect();
  state.combosObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadMoreCombos();
  }, { root: outputCanvas, rootMargin: '200px' });
  state.combosObserver.observe(sentinel);
}

export function loadMoreCombos() {
  if (!state.currentEnumSession || state.currentEnumSession.done || state.currentEnumSession.loading) return;
  state.currentEnumSession.loading = true;
  const sessionId = state.currentEnumSession.id;
  updateCombosStatus(state.currentEnumSession.loadedCount, 'loading');

  state.currentEnumSession.session.pullBatch(ENUM_BATCH_SIZE, ENUM_BATCH_TIME_SLICE_MS, (results, meta) => {
    if (!state.currentEnumSession || state.currentEnumSession.id !== sessionId) return; // Sitzung inzwischen verworfen
    state.currentEnumSession.loading = false;

    if (results.length > 0) {
      appendComboCards(state.currentGrid, state.currentGraph, results, state.currentEnumSession.loadedCount, state.currentEnumSession.isTree);
      state.currentEnumSession.loadedCount += results.length;
    }

    if (meta.done) {
      state.currentEnumSession.done = true;
      if (state.combosObserver) { state.combosObserver.disconnect(); state.combosObserver = null; }
      if (state.currentEnumSession.loadedCount === 0) {
        renderEmpty('Für diese Schrittzahl existiert keine gültige Kombination.');
        statusBadge.textContent = 'Keine Treffer';
        return;
      }
      updateCombosStatus(state.currentEnumSession.loadedCount, meta.stoppedBySafety ? 'safety' : 'done');
      statusBadge.textContent = meta.stoppedBySafety
        ? `${state.currentEnumSession.loadedCount}+ Kombinationen`
        : `${state.currentEnumSession.loadedCount} Kombinationen`;
    } else if (state.currentEnumSession.loadedCount >= ENUM_AUTO_LOAD_SOFT_LIMIT) {
      if (state.combosObserver) { state.combosObserver.disconnect(); state.combosObserver = null; }
      updateCombosStatus(state.currentEnumSession.loadedCount, 'manual');
      statusBadge.textContent = `${state.currentEnumSession.loadedCount}+ Kombinationen`;
    } else {
      updateCombosStatus(state.currentEnumSession.loadedCount, 'idle');
      statusBadge.textContent = `${state.currentEnumSession.loadedCount}+ Kombinationen`;
    }
  });
}
