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
import { glyphSVG } from './render.js';

const EXPORT_THEME_COLORS = {
  light: { accent: '#0075de', surface: '#ffffff', border: 'rgba(0,0,0,0.1)', muted: '#a39e98', teal: '#2a9d99', warm: '#f6f5f4', gray300: '#a39e98', orange: '#dd5b00' },
  dark:  { accent: '#4d9de0', surface: '#202020', border: 'rgba(255,255,255,0.09)', muted: '#6b6b69', teal: '#2a9d99', warm: '#252525', gray300: '#6b6b69', orange: '#dd5b00' }
};

export function getActiveThemeColors() {
  return EXPORT_THEME_COLORS[document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'];
}

export function buildStandaloneSVG(grid, graph, edges, opts) {
  opts = opts || {};
  const themeColors = getActiveThemeColors();
  // Eine vom Nutzer gewählte Farbe überschreibt nur den Akzent (Kanten +
  // Ring aktiver Punkte) — alle übrigen Farben (Punkt-Hintergrund, Text,
  // Startmarkierung, Verboten-Markierung) bleiben themenabhängig.
  const c = opts.color ? { ...themeColors, accent: opts.color } : themeColors;
  const rootVertex = opts.rootVertex !== undefined ? opts.rootVertex : (edges.length ? edges[0].from : null);
  const rootVertices = Array.isArray(opts.rootVertices) ? opts.rootVertices : undefined;
  const showStartRing = opts.showStartRing !== undefined ? !!opts.showStartRing : true;
  const showNumbers = opts.showNumbers !== undefined ? !!opts.showNumbers : true;
  const showPoints = opts.showPoints !== undefined ? !!opts.showPoints : true;
  const hollowPoints = !!opts.hollowPoints;
  const showUnusedPoints = opts.showUnusedPoints !== undefined ? !!opts.showUnusedPoints : true;
  const inner = glyphSVG(grid, graph, edges, {
    animate: false, showStartRing, rootVertex, rootVertices,
    showNumbers, showPoints, hollowPoints, showUnusedPoints
  });
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

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSVGString(svgString, filename) {
  downloadBlob(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

export function downloadSVGAsPNG(svgString, filename, pixelSize) {
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

// Baut einen sprechenden Dateinamen aus Rasterform/-größe, Schrittzahl
// (bzw. bei "Mehrere Elemente" der Elementanzahl) und Zeitstempel-freiem
// Präfix zusammen.
export function buildExportFilename(prefix, ext, grid, singleResult, stepsValue) {
  const dims = grid.shape === 'hex'
    ? `hex${grid.d}x${grid.v}`
    : grid.shape === 'circle'
    ? `kreis${grid.n}`
    : grid.shape === 'ellipse'
    ? `ellipse${grid.rx}x${grid.ry}`
    : grid.shape === 'triangle'
    ? `dreieck${grid.width}x${grid.height}`
    : grid.shape === 'rhombus'
    ? `raute${grid.width}x${grid.height}`
    : grid.shape === 'trapezoid'
    ? `trapez${grid.top}x${grid.height}`
    : grid.shape === 'parallelogram'
    ? `parallelogramm${grid.sideLength}x${grid.height}_versatz${grid.offset}`
    : `${grid.cols}x${grid.rows}`;
  if (singleResult && singleResult.isMulti) {
    return `${prefix}_${dims}_${singleResult.elements.length}elemente.${ext}`;
  }
  const steps = stepsValue || '0';
  return `${prefix}_${dims}_${steps}schritte.${ext}`;
}
