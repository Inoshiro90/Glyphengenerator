// /* =====================================================
//    RENDERING DER ERGEBNISSE (Einzelglyphe / Mehrere Elemente / Leerzustand)
//    ===================================================== */
// import {outputCanvas, sequenceChain, sequenceFooter, outputTitle, statusBadge, exportRow} from './dom-refs.js';
// import {state, invalidateEnumSession} from './state.js';
// import {glyphSVG} from './render.js';
// import {pathToEdges} from './path-utils.js';


// export function renderSingle(grid, graph, result) {
// 	invalidateEnumSession();
// 	outputCanvas.classList.remove('combos-mode');
// 	outputCanvas.classList.add('single-mode');
// 	const isTree = result.mode === 'tree';
// 	const edges = isTree ? result.edges : pathToEdges(result.path);
// 	const rootVertex = isTree ? result.root : result.path[0];

// 	outputCanvas.innerHTML = glyphSVG(grid, graph, edges, {
// 		animate: true,
// 		showStartRing: true,
// 		mainClass: 'glyph-main',
// 		rootVertex,
// 	});

// 	sequenceChain.innerHTML = isTree
// 		? edges.map((e) => `<span class="badge">${e.from}→${e.to}</span>`).join('')
// 		: result.path
// 				.map((v) => `<span class="badge">${v}</span>`)
// 				.join('<span class="arrow">→</span>');
// 	sequenceFooter.style.display = 'block';
// 	outputTitle.textContent = isTree ? 'Ast-Glyphe' : 'Glyphe';
// 	statusBadge.textContent = `${edges.length} Schritte`;

// 	state.currentSingleResult = {grid, graph, edges, rootVertex, isTree};
// 	sequenceFooter.style.display = 'block';
// 	setComboExportVisibility(false);
// }

// // Rendering für den "Mehrere Elemente"-Modus: mehrere getrennte,
// // unverbundene Teilgraphen werden als eine gemeinsame Kantenliste
// // gezeichnet (jedes Element bekommt einen eigenen Startring) und in
// // der Punktreihenfolge-Leiste nach Element gruppiert aufgelistet.
// // Ist Ast-Generierung zusätzlich aktiv, ist jedes Element selbst ein
// // Baum — die Sequenz wird dann wie im reinen Ast-Modus als
// // Kantenliste (von→nach) statt als durchgehende Punktkette angezeigt.
// export function renderMulti(grid, graph, multi, isTreeElements) {
// 	invalidateEnumSession();
// 	outputCanvas.classList.remove('combos-mode');
// 	outputCanvas.classList.add('single-mode');
// 	const elements = multi.elements;
// 	const edges = elements.reduce((acc, el) => acc.concat(el.edges), []);
// 	const rootVertices = elements.map((el) => el.root);

// 	outputCanvas.innerHTML = glyphSVG(grid, graph, edges, {
// 		animate: true,
// 		showStartRing: true,
// 		mainClass: 'glyph-main',
// 		rootVertices,
// 	});

// 	sequenceChain.innerHTML = elements
// 		.map((el, i) => {
// 			const chain = isTreeElements
// 				? el.edges.map((e) => `<span class="badge">${e.from}→${e.to}</span>`).join('')
// 				: el.points
// 						.map((v) => `<span class="badge">${v}</span>`)
// 						.join('<span class="arrow">→</span>');
// 			return `<div style="width:100%;display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-1);margin-bottom:var(--space-1)">
//       <span class="badge badge-orange">Element ${i + 1}</span>${chain}
//     </div>`;
// 		})
// 		.join('');
// 	sequenceFooter.style.display = 'block';
// 	outputTitle.textContent = isTreeElements ? 'Mehrere Ast-Elemente' : 'Mehrere-Elemente-Glyphe';
// 	const totalPoints = elements.reduce((sum, el) => sum + el.points.length, 0);
// 	statusBadge.textContent = `${elements.length} Elemente · ${totalPoints} Punkte`;

// 	state.currentSingleResult = {
// 		grid,
// 		graph,
// 		edges,
// 		rootVertex: rootVertices.length ? rootVertices[0] : null,
// 		rootVertices,
// 		isTree: false,
// 		isMulti: true,
// 		elements,
// 	};

// 	sequenceFooter.style.display = 'block';
// 	setComboExportVisibility(false);
// }

// export function renderEmpty(message) {
// 	invalidateEnumSession();
// 	state.currentSingleResult = null;
// 	outputCanvas.classList.remove('combos-mode');
// 	outputCanvas.classList.add('single-mode');
// 	sequenceFooter.style.display = 'none';
// 	outputCanvas.innerHTML = `<div class="empty-state">
//     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"></circle><circle cx="18" cy="6" r="2"></circle><circle cx="6" cy="18" r="2"></circle><circle cx="18" cy="18" r="2"></circle><circle cx="12" cy="12" r="2"></circle></svg>
//     <div>${message}</div>
//   </div>`;
// 	outputTitle.textContent = 'Glyphe';
//   sequenceFooter.style.display = 'none';
// setComboExportVisibility(false);
// }

// function setComboExportVisibility(visible) {
// 	exportRow.style.display = visible ? 'flex' : 'none';
// }

/* =====================================================
   RENDERING DER ERGEBNISSE
   ===================================================== */

import {
  outputCanvas,
  sequenceChain,
  sequenceFooter,
  outputTitle,
  statusBadge,
  exportRow
} from './dom-refs.js';

import { state, invalidateEnumSession } from './state.js';
import { glyphSVG } from './render.js';
import { pathToEdges } from './path-utils.js';

export function setComboExportVisibility(visible) {
  exportRow.style.display = visible ? 'flex' : 'none';
}

function removeCombosToolbar() {
  document.querySelector('.combos-toolbar')?.remove();
}

export function renderSingle(grid, graph, result) {
  invalidateEnumSession();
  removeCombosToolbar();

  outputCanvas.classList.remove('combos-mode');
  outputCanvas.classList.add('single-mode');

  const isTree = result.mode === 'tree';
  const edges = isTree ? result.edges : pathToEdges(result.path);
  const rootVertex = isTree ? result.root : result.path[0];

  outputCanvas.innerHTML = glyphSVG(grid, graph, edges, {
    animate: true,
    showStartRing: true,
    mainClass: 'glyph-main',
    rootVertex
  });

  sequenceChain.innerHTML = isTree
    ? edges.map(e => `<span class="badge">${e.from}→${e.to}</span>`).join('')
    : result.path
        .map(v => `<span class="badge">${v}</span>`)
        .join('<span class="arrow">→</span>');

  sequenceFooter.style.display = 'block';
  outputTitle.textContent = isTree ? 'Ast-Glyphe' : 'Glyphe';
  statusBadge.textContent = `${edges.length} Schritte`;

  state.currentSingleResult = { grid, graph, edges, rootVertex, isTree };

  // Zeigt die Einzelglyphen-Export-Buttons (SVG/PNG) neben der Glyphe —
  // dieselbe .export-row wird auch für den "Mehrere Elemente"-Modus
  // genutzt; im Kombinationen-Modus bleibt sie ausgeblendet (dort gibt
  // es die eigene Karten-/ZIP-Export-Toolbar).
  setComboExportVisibility(true);
}

export function renderMulti(grid, graph, multi, isTreeElements) {
  invalidateEnumSession();
  removeCombosToolbar();

  outputCanvas.classList.remove('combos-mode');
  outputCanvas.classList.add('single-mode');

  const elements = multi.elements;
  const edges = elements.flatMap(el => el.edges);
  const rootVertices = elements.map(el => el.root);

  outputCanvas.innerHTML = glyphSVG(grid, graph, edges, {
    animate: true,
    showStartRing: true,
    mainClass: 'glyph-main',
    rootVertices
  });

  sequenceChain.innerHTML = elements.map((el, i) => {
    const chain = isTreeElements
      ? el.edges.map(e => `<span class="badge">${e.from}→${e.to}</span>`).join('')
      : el.points
          .map(v => `<span class="badge">${v}</span>`)
          .join('<span class="arrow">→</span>');

    return `
      <div style="width:100%;display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-1);margin-bottom:var(--space-1)">
        <span class="badge badge-orange">Element ${i + 1}</span>
        ${chain}
      </div>`;
  }).join('');

  sequenceFooter.style.display = 'block';
  outputTitle.textContent = isTreeElements
    ? 'Mehrere Ast-Elemente'
    : 'Mehrere-Elemente-Glyphe';

  const totalPoints = elements.reduce((sum, el) => sum + el.points.length, 0);
  statusBadge.textContent = `${elements.length} Elemente · ${totalPoints} Punkte`;

  state.currentSingleResult = {
    grid,
    graph,
    edges,
    rootVertex: rootVertices[0] ?? null,
    rootVertices,
    isTree: false,
    isMulti: true,
    elements
  };

  setComboExportVisibility(true);
}

export function renderEmpty(message) {
  invalidateEnumSession();
  removeCombosToolbar();

  state.currentSingleResult = null;

  outputCanvas.classList.remove('combos-mode');
  outputCanvas.classList.add('single-mode');

  outputCanvas.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="6" cy="6" r="2"/>
        <circle cx="18" cy="6" r="2"/>
        <circle cx="6" cy="18" r="2"/>
        <circle cx="18" cy="18" r="2"/>
        <circle cx="12" cy="12" r="2"/>
      </svg>
      <div>${message}</div>
    </div>`;

  sequenceFooter.style.display = 'none';
  outputTitle.textContent = 'Glyphe';

  setComboExportVisibility(false);
}