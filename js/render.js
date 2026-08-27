/* =====================================================
   RENDERING
   Einheitliches Rendering für Trail- UND Ast-Modus: beide werden als
   einfache Kantenliste { from, to } beschrieben. Im Trail-Modus bilden
   die Kanten eine durchgehende Kette, im Ast-Modus verzweigen sie sich.
   ===================================================== */
import { dist } from './path-utils.js';

export function glyphSVG(grid, graph, edges, opts) {
  opts = opts || {};
  const { points, style } = grid;
  const usedVertexSet = new Set();
  edges.forEach(e => { usedVertexSet.add(e.from); usedVertexSet.add(e.to); });
  const forbiddenSet = graph.forbiddenSet || new Set();
  const allVertices = graph.allVertices || graph.vertices;
  const animate = !!opts.animate;
  const showStartRing = !!opts.showStartRing;
  // Vier zusätzliche Darstellungs-Optionen, hauptsächlich für den Export
  // gedacht (siehe export.js). Defaults entsprechen exakt dem bisherigen,
  // fest verdrahteten Verhalten — bestehende Aufrufer ohne diese Optionen
  // (interaktive Anzeige, Kombinationskarten) sehen dadurch keine Änderung.
  const showNumbers = opts.showNumbers !== undefined ? !!opts.showNumbers : true;
  const showPoints = opts.showPoints !== undefined ? !!opts.showPoints : true;
  const hollowPoints = !!opts.hollowPoints;
  const showUnusedPoints = opts.showUnusedPoints !== undefined ? !!opts.showUnusedPoints : true;
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
    // Punkte, die nicht Teil der Glyphe sind (egal ob verboten oder
    // schlicht unbenutzt), werden bei deaktivierter Option komplett
    // ausgelassen — sonst unverändert sichtbar.
    if (!active && !showUnusedPoints) return;

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

    if (!showPoints) {
      if (showNumbers) {
        svg += `<text class="glyph-point-label" x="${p.x}" y="${p.y + 0.5}" style="font-size:${style.font}px">${v}</text>`;
      }
      return;
    }

    const hollowStyle = hollowPoints ? 'fill:none;' : '';
    const activeStyle = active ? `stroke:var(--color-accent);stroke-width:1.5;${hollowStyle}` : hollowStyle;
    const label = showNumbers
      ? `<text class="glyph-point-label" x="${p.x}" y="${p.y + 0.5}" style="font-size:${style.font}px">${v}</text>`
      : '';
    if (animate) {
      const delay = active ? 30 : 0;
      svg += `<g style="animation:popPoint var(--dur-base) var(--ease-spring) ${delay}ms backwards;transform-origin:${p.x}px ${p.y}px">
        <circle class="glyph-point-bg" cx="${p.x}" cy="${p.y}" r="${radius}" style="${activeStyle}"/>
        ${label}
      </g>`;
    } else {
      svg += `<circle class="glyph-point-bg" cx="${p.x}" cy="${p.y}" r="${radius}" style="${activeStyle}"/>${label}`;
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
