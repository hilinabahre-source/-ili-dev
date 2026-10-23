import { sampleSideCurve, pointsToPath } from './geometry.js';

/* ============================================================
   SVG DIAGRAM TEMPLATES
   ============================================================ */
export function svgDiagram(type){
  const common = 'width="100%" height="110" viewBox="0 0 240 110" xmlns="http://www.w3.org/2000/svg"';
  const stroke = '#c6ff3e';
  const fabric = '#342847';
  const fabric2 = '#291f38';
  switch(type){
    case 'seam': return `<svg ${common}>
      <rect x="20" y="25" width="90" height="60" rx="6" fill="${fabric}"/>
      <rect x="130" y="25" width="90" height="60" rx="6" fill="${fabric2}"/>
      <line x1="110" y1="30" x2="110" y2="80" stroke="${stroke}" stroke-width="2" stroke-dasharray="6 5" class="anim-dash"/>
      <circle r="4" fill="#ff3ea5" class="anim-dot"><animateMotion dur="1.6s" repeatCount="indefinite" path="M110,30 L110,80"/></circle>
    </svg>`;
    case 'fold': return `<svg ${common}>
      <rect x="40" y="55" width="160" height="35" rx="6" fill="${fabric}"/>
      <path d="M40,55 L120,15 L200,55" fill="none" stroke="${stroke}" stroke-width="2" stroke-dasharray="5 4"/>
      <g class="anim-arrow"><path d="M120,15 L120,45" stroke="#ff9d4d" stroke-width="3" fill="none" marker-end="url(#arrow)"/></g>
      <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ff9d4d"/></marker></defs>
    </svg>`;
    case 'pin': return `<svg ${common}>
      <rect x="30" y="20" width="180" height="70" rx="8" fill="${fabric}"/>
      <g class="anim-pins">
        <circle cx="55" cy="30" r="4" fill="#ff3ea5"/><line x1="55" y1="30" x2="55" y2="10" stroke="#ff3ea5" stroke-width="2"/>
        <circle cx="120" cy="30" r="4" fill="#8b5cf6" style="animation-delay:.3s"/><line x1="120" y1="30" x2="120" y2="10" stroke="#8b5cf6" stroke-width="2"/>
        <circle cx="185" cy="30" r="4" fill="#c6ff3e" style="animation-delay:.6s"/><line x1="185" y1="30" x2="185" y2="10" stroke="#c6ff3e" stroke-width="2"/>
      </g>
    </svg>`;
    case 'gather': return `<svg ${common}>
      <path d="M20,55 Q40,35 60,55 T100,55 T140,55 T180,55 T220,55" fill="none" stroke="${stroke}" stroke-width="3" class="anim-wave"/>
      <rect x="20" y="60" width="200" height="26" rx="6" fill="${fabric}"/>
    </svg>`;
    case 'attach': return `<svg ${common}>
      <rect x="20" y="30" width="80" height="55" rx="6" fill="${fabric}"/>
      <rect x="140" y="30" width="80" height="55" rx="6" fill="${fabric2}" class="anim-slide"/>
    </svg>`;
    case 'hem': return `<svg ${common}>
      <rect x="30" y="20" width="180" height="30" rx="4" fill="${fabric}"/>
      <rect x="30" y="50" width="180" height="14" rx="3" fill="${fabric2}" class="anim-foldup"/>
      <line x1="30" y1="50" x2="210" y2="50" stroke="${stroke}" stroke-width="2" stroke-dasharray="5 4"/>
    </svg>`;
    case 'notch': return `<svg ${common}>
      <rect x="30" y="25" width="180" height="60" rx="6" fill="${fabric}"/>
      <g class="anim-snip">
        <polygon points="70,25 80,25 75,40" fill="#ff9d4d"/>
        <polygon points="120,25 130,25 125,40" fill="#ff9d4d"/>
        <polygon points="170,25 180,25 175,40" fill="#ff9d4d"/>
      </g>
    </svg>`;
    default: return `<svg ${common}><rect x="30" y="25" width="180" height="60" rx="6" fill="${fabric}"/></svg>`;
  }
}

export function constructionIcon(){
  return `<svg viewBox="0 0 120 90" width="20" height="15" style="vertical-align:-3px;display:inline-block;margin-left:5px;">
    <g fill="none" stroke="#102d44" stroke-width="1.4">
      <path d="M22,10 L38,10 L44,34 L16,34 Z"/>
      <line x1="22" y1="10" x2="38" y2="10" stroke-width="2.2"/>
      <line x1="30" y1="10" x2="30" y2="34" stroke-width="0.8" stroke-dasharray="2 2"/>
      <path d="M78,10 L94,10 L100,34 L72,34 Z"/>
      <line x1="78" y1="10" x2="94" y2="10" stroke-width="2.2"/>
      <line x1="86" y1="10" x2="86" y2="34" stroke-width="0.8"/>
    </g>
  </svg>`;
}

export function printPagePreview(){
  return `<svg width="26" height="34" viewBox="0 0 60 78" style="flex-shrink:0;">
    <title>Print-ready pattern pages with alignment marks</title>
    <rect x="4" y="4" width="52" height="70" rx="2" fill="none" stroke="#8fa9c2" stroke-width="1.5"/>
    <rect x="4" y="4" width="52" height="70" rx="2" fill="none" stroke="#f4d86b" stroke-width="1" stroke-dasharray="3 2"/>
    <circle cx="4" cy="4" r="2.5" fill="none" stroke="#f4d86b" stroke-width="1"/>
    <circle cx="56" cy="4" r="2.5" fill="none" stroke="#f4d86b" stroke-width="1"/>
    <circle cx="4" cy="74" r="2.5" fill="none" stroke="#f4d86b" stroke-width="1"/>
    <circle cx="56" cy="74" r="2.5" fill="none" stroke="#f4d86b" stroke-width="1"/>
    <rect x="14" y="14" width="12" height="12" fill="none" stroke="#8fa9c2" stroke-width="1"/>
  </svg>`;
}

// Draws the REAL, unmirrored half-piece exactly as it will print, laid out
// inside a true-to-scale grid of physical print pages (tileW x tileH inches,
// the real per-piece overlap, rows x cols tiles). This intentionally shows
// blank paper where the printed page has no pattern content on it, rather
// than stretching the piece to fill every tile evenly.
export function assemblyPieceSvg(piece, tileW=7.5, tileH=10, rows=2, cols=2){
  const overlap = piece.tileOverlap ?? 0.5;

  const { seam: curveSeam } = sampleSideCurve(piece.curves, 0, 12);
  const halfSeam = [piece.topFold, piece.topSide, ...curveSeam, piece.hemFold];

  // Canvas size = the true full tiled-page assembly area, independent of
  // how big the piece itself is — this is what makes the blank space show.
  const canvasW = tileW*cols - overlap*(cols-1);
  const canvasH = tileH*rows - overlap*(rows-1);

  const dispW = 140;
  const scale = dispW / canvasW;
  const dispH = canvasH * scale;
  const labelMargin = 42;
  const totalW = dispW + labelMargin;

  function toSvg(p){ return {x:p.x*scale, y:p.y*scale}; }
  const seamPath = pointsToPath(halfSeam.map(toSvg)) + ' Z';

  let tiles = '';
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const tx = c*(tileW-overlap)*scale, ty = r*(tileH-overlap)*scale;
      const tw = tileW*scale, th = tileH*scale;
      tiles += `
        <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" fill="none" stroke="#8fa9c2" stroke-width="0.75"/>
        <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" fill="none" stroke="#f4d86b" stroke-width="0.6" stroke-dasharray="3 2"/>
        <circle cx="${tx}" cy="${ty}" r="2" fill="none" stroke="#f4d86b" stroke-width="0.8"/>
        <circle cx="${tx+tw}" cy="${ty}" r="2" fill="none" stroke="#f4d86b" stroke-width="0.8"/>
        <circle cx="${tx}" cy="${ty+th}" r="2" fill="none" stroke="#f4d86b" stroke-width="0.8"/>
        <circle cx="${tx+tw}" cy="${ty+th}" r="2" fill="none" stroke="#f4d86b" stroke-width="0.8"/>`;
    }
  }

  const foldTop = toSvg(piece.topFold), foldBot = toSvg(piece.hemFold);

  // Waist label points at the midpoint of the flat top edge (fold to side).
  const waistAnchor = toSvg({x:(piece.topFold.x+piece.topSide.x)/2, y:piece.topFold.y});
  // Hem label points at the midpoint of the flat bottom edge (fold to hem-side corner).
  const hemEndPoint = curveSeam[curveSeam.length-1];
  const hemAnchor = toSvg({x:(piece.hemFold.x+hemEndPoint.x)/2, y:piece.hemFold.y});

  return `
    <div style="text-align:center;">
      <svg width="${totalW}" height="${dispH}" viewBox="0 0 ${totalW} ${dispH}">
        ${tiles}
        <path d="${seamPath}" fill="rgba(244,216,107,0.15)" stroke="#f4d86b" stroke-width="1.6"/>
        <line x1="${foldTop.x}" y1="${foldTop.y}" x2="${foldBot.x}" y2="${foldBot.y}" stroke="#b9d7f0" stroke-width="1" stroke-dasharray="1 5" opacity="0.7"/>
        <line x1="${waistAnchor.x}" y1="${waistAnchor.y}" x2="${dispW+6}" y2="10" stroke="#38506c" stroke-width="0.6" stroke-dasharray="1 3"/>
        <text x="${dispW+8}" y="12" font-size="8" fill="#38506c" font-family="Space Grotesk, sans-serif">Waist</text>
        <line x1="${hemAnchor.x}" y1="${hemAnchor.y}" x2="${dispW+6}" y2="${dispH-8}" stroke="#38506c" stroke-width="0.6" stroke-dasharray="1 3"/>
        <text x="${dispW+8}" y="${dispH-6}" font-size="8" fill="#38506c" font-family="Space Grotesk, sans-serif">Hem</text>
      </svg>
      <div style="font-size:0.75rem;color:var(--text-dim);margin-top:4px;">${piece.label} \u2014 ${rows*cols} pages</div>
    </div>`;
}

// A compact jellyfish icon for the mini-Jelly that lives inside the
// assembly-guide card, visually matching the main jellyfish helper.
export function miniJellySvg(){
  return `<svg viewBox="0 0 100 120" width="36" height="43" style="filter:drop-shadow(0 6px 12px rgba(18,49,77,0.25));">
    <defs>
      <linearGradient id="miniJellyGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ff9fd6"/>
        <stop offset="100%" stop-color="#8b5cf6"/>
      </linearGradient>
    </defs>
    <path d="M20,55 C20,18 80,18 80,55 C80,66 70,60 65,54 C65,66 55,60 50,54 C50,66 40,60 35,54 C35,66 25,60 20,55 Z" fill="url(#miniJellyGrad)"/>
    <circle cx="38" cy="40" r="4" fill="#102d44"/>
    <circle cx="62" cy="40" r="4" fill="#102d44"/>
    <path d="M42,49 Q50,55 58,49" stroke="#102d44" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M30,58 Q25,76 30,94 Q35,76 30,58" fill="#ff9fd6" opacity="0.85"/>
    <path d="M44,58 Q39,80 44,102 Q49,80 44,58" fill="#c4b0fb" opacity="0.85"/>
    <path d="M56,58 Q51,80 56,102 Q61,80 56,58" fill="#ff9fd6" opacity="0.85"/>
    <path d="M70,58 Q65,76 70,94 Q75,76 70,58" fill="#c4b0fb" opacity="0.85"/>
  </svg>`;
}

export function thumbGradient(colorKey){
  const map = {
    pink:'linear-gradient(135deg,#ff3ea5,#8b5cf6)',
    purple:'linear-gradient(135deg,#8b5cf6,#291f38)',
    lime:'linear-gradient(135deg,#c6ff3e,#4ade80)',
    orange:'linear-gradient(135deg,#ff9d4d,#ff3ea5)'
  };
  return map[colorKey] || map.pink;
}
