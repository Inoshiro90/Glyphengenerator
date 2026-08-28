/* =====================================================
   SAMMEL-EXPORT: "Alle Kombinationen" als ZIP (SVG oder PNG)

   WICHTIGER PUNKT (siehe Diskussion): Die Kombinationskarten im DOM
   werden per Lazy-Loading nachgeladen (nur beim Scrollen bzw. per
   "Weitere laden"-Button) — im DOM liegen zu jedem Zeitpunkt also
   nur die BISHER angezeigten Kombinationen, nie alle. Ein ZIP-Export,
   der die Kombinationen aus dem DOM ausliest, würde deshalb je nach
   Scroll-Stand unvollständige oder inkonsistente Ergebnisse liefern.

   Die Lösung: der Sammel-Export liest NICHT aus dem DOM, sondern
   erzeugt eine komplett EIGENE, frische Enumerations-Sitzung direkt
   aus derselben Suchlogik (createEnumerationSession /
   createTreeEnumerationSession) — unabhängig von der gerade
   angezeigten Sitzung (state.currentEnumSession bleibt unangetastet,
   der Scroll-Fortschritt der Anzeige wird also nicht gestört). Die
   Suche ist deterministisch (keine Zufallskomponente wie bei der
   Einzelglyphen-Generierung), daher liefert die frische Sitzung exakt
   dieselbe Reihenfolge wie die Anzeige — Kombination #1 im ZIP ist
   immer dieselbe wie Kombination #1 in der Ansicht.
   ===================================================== */
import {
  ENUM_BATCH_TIME_SLICE_MS, PNG_EXPORT_SIZE_CARD,
  ZIP_EXPORT_MAX_COMBOS, ZIP_EXPORT_BATCH_SIZE, ZIP_EXPORT_PNG_CONCURRENCY
} from './config.js';
import { state } from './state.js';
import { createEnumerationSession } from './generation/enumeration-trail.js';
import { createTreeEnumerationSession } from './generation/enumeration-tree.js';
import { pathToEdges } from './path-utils.js';
import { buildStandaloneSVG, buildExportFilename, svgStringToPngBlob, downloadBlob } from './export.js';

// Sammelt bis zu ZIP_EXPORT_MAX_COMBOS Kombinationen aus einer frischen,
// eigenständigen Enumerations-Sitzung ein (zeitgescheibelt, damit der
// Hauptthread währenddessen nicht blockiert).
function collectAllCombos(graph, grid, constraints, target, isTree, onProgress) {
  return new Promise(resolve => {
    const session = isTree
      ? createTreeEnumerationSession(graph, grid, constraints, target)
      : createEnumerationSession(graph, grid, constraints, target);
    const all = [];
    let stoppedBySafety = false;
    let cappedByExportLimit = false;

    function pull() {
      const remaining = ZIP_EXPORT_MAX_COMBOS - all.length;
      if (remaining <= 0) { cappedByExportLimit = true; resolve({ all, stoppedBySafety, cappedByExportLimit }); return; }
      session.pullBatch(Math.min(ZIP_EXPORT_BATCH_SIZE, remaining), ENUM_BATCH_TIME_SLICE_MS, (results, meta) => {
        all.push(...results);
        if (onProgress) onProgress(all.length, null);
        if (meta.stoppedBySafety) stoppedBySafety = true;
        if (meta.done || all.length >= ZIP_EXPORT_MAX_COMBOS) {
          resolve({ all, stoppedBySafety, cappedByExportLimit: all.length >= ZIP_EXPORT_MAX_COMBOS && !meta.done });
        } else {
          pull();
        }
      });
    }
    pull();
  });
}

// Verarbeitet ein Array mit begrenzter Parallelität (statt alles auf
// einmal loszuschicken) — hält den Speicherbedarf und die Zahl
// gleichzeitig offener Image-Ladevorgänge beim PNG-Export in Grenzen.
async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array(Math.min(concurrency, items.length)).fill(0).map(runWorker));
  return results;
}

function padIndex(i, total) {
  return String(i).padStart(String(total).length, '0');
}

/**
 * Exportiert ALLE Kombinationen (nicht nur die im DOM geladenen) als
 * ZIP-Datei. format: 'svg' | 'png'. onProgress(status) wird mit
 * Zwischenständen aufgerufen, z. B. { phase: 'collecting'|'rendering'|'zipping', count, total }.
 */
export async function exportAllCombosAsZip(format, constraints, target, onProgress) {
  if (typeof window.JSZip === 'undefined') {
    throw new Error('JSZip ist nicht geladen. Bitte Internetverbindung prüfen (wird von einem CDN geladen).');
  }
  const grid = state.currentGrid;
  const graph = state.currentGraph;
  const isTree = constraints.treeMode;

  onProgress && onProgress({ phase: 'collecting', count: 0, total: null });
  const { all, stoppedBySafety, cappedByExportLimit } = await collectAllCombos(
    graph, grid, constraints, target, isTree,
    count => onProgress && onProgress({ phase: 'collecting', count, total: null })
  );

  if (all.length === 0) {
    return { fileCount: 0, truncated: false };
  }

  const zip = new window.JSZip();
  const ext = format === 'png' ? 'png' : 'svg';

  if (format === 'svg') {
    // SVG braucht keine Rasterisierung — einfache, schnelle Schleife,
    // trotzdem zeitgescheibelt für sehr große Mengen.
    for (let i = 0; i < all.length; i++) {
      const item = all[i];
      const edges = isTree ? item : pathToEdges(item);
      const rootVertex = edges.length ? edges[0].from : null;
      const svgString = buildStandaloneSVG(grid, graph, edges, { rootVertex });
      zip.file(`kombination-${padIndex(i + 1, all.length)}.svg`, svgString);
      if (i % ZIP_EXPORT_BATCH_SIZE === 0) {
        onProgress && onProgress({ phase: 'rendering', count: i + 1, total: all.length });
        await new Promise(r => setTimeout(r, 0)); // Hauptthread zwischendurch freigeben
      }
    }
  } else {
    let done = 0;
    await mapWithConcurrency(all, ZIP_EXPORT_PNG_CONCURRENCY, async (item, i) => {
      const edges = isTree ? item : pathToEdges(item);
      const rootVertex = edges.length ? edges[0].from : null;
      const svgString = buildStandaloneSVG(grid, graph, edges, { rootVertex });
      try {
        const pngBlob = await svgStringToPngBlob(svgString, PNG_EXPORT_SIZE_CARD);
        zip.file(`kombination-${padIndex(i + 1, all.length)}.png`, pngBlob);
      } catch (e) {
        // Einzelne fehlgeschlagene Rasterisierung überspringen, Rest fortsetzen.
      }
      done++;
      if (done % ZIP_EXPORT_BATCH_SIZE === 0 || done === all.length) {
        onProgress && onProgress({ phase: 'rendering', count: done, total: all.length });
      }
    });
  }

  onProgress && onProgress({ phase: 'zipping', count: all.length, total: all.length });
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: format === 'svg' ? 'DEFLATE' : 'STORE' });
  const filename = buildExportFilename('alle-kombinationen', 'zip', grid, null, target);
  downloadBlob(zipBlob, filename);

  return { fileCount: all.length, truncated: stoppedBySafety || cappedByExportLimit };
}
