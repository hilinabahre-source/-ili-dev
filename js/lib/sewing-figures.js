import { ALINE_OUTLINE } from '../data/aline-dress-outline.js';
import { PATTERNS } from '../data/patterns.js';
import { fabricEstimate } from './fabric.js';

/* ============================================================
   SEWING-GUIDE ILLUSTRATIONS (A-line Silk Dress)
   Every figure is an SVG string. Visual key (from the pattern maker's instructions):
   white = fabric right side, grey = fabric wrong side, red dashed = stitching in this step,
   grey dashed = earlier stitching, blue dash-dot = trim line.
   Overviews use the real reference-size outline; cross-sections are drawn at 1 in = 220 px
   with the fabric thickness exaggerated so every layer is visible.
   ============================================================ */

export const C = {
  rs: '#ffffff', ws: '#cfcfcf', edge: '#3b3b3b', stitch: '#e0302a', prev: '#7b8794',
  trim: '#3a7ab7', dim: '#12314d', note: '#38506c', ghost: 'rgba(59,59,59,0.22)', bg: '#faf8f4', accent: '#f39b5b'
};
// Finished length (neck point to hem at the fold) and side-seam helpers, from the outline data.
const LENGTH = ALINE_OUTLINE.front.hem[ALINE_OUTLINE.front.hem.length - 1][1];
const fmtIn = v => String(Math.round(v * 8) / 8).replace('.5', '½').replace('.25', '¼').replace('.75', '¾');
function sideX(name, y) {
  const s = ALINE_OUTLINE[name].side;
  for (let i = 1; i < s.length; i++) if (s[i][1] >= y) return s[i - 1][0] + (s[i][0] - s[i - 1][0]) * (y - s[i - 1][1]) / (s[i][1] - s[i - 1][1]);
  return s[s.length - 1][0];
}
const IN = 220;                // px per inch in cross-sections
const T = 12;                  // drawn fabric thickness (px)
const f = n => Number(n.toFixed(2));

/* ---------- primitives ---------- */

function svg(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">
    <title>${title}</title>
    <defs>
      <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${C.dim}"/></marker>
    </defs>
    <rect width="${w}" height="${h}" fill="${C.bg}"/>${body}</svg>`;
}

const text = (x, y, s, o = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family="Space Grotesk, Poppins, sans-serif" font-size="${o.size || 12}"
     font-weight="${o.bold ? 700 : 500}" fill="${o.color || C.dim}" text-anchor="${o.anchor || 'start'}"
     ${o.rotate ? `transform="rotate(${o.rotate} ${f(x)} ${f(y)})"` : ''}>${s}</text>`;

// Figure heading, wrapped to the figure width (about 7.2 px per character at 13 px bold).
function heading(s, width, y = 26) {
  const max = Math.floor((width - 40) / 7.2), lines = [];
  let cur = '';
  for (const w of s.split(' ')) {
    if ((cur + ' ' + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.map((l, i) => text(20, y + i * 17, l, { size: 13, bold: true })).join('');
}
// Body copy lines under a figure.
const notes = (x, y, lines, size = 11) => lines.map((l, i) => text(x, y + i * (size + 6), l, { size, color: C.note })).join('');

const line = (x1, y1, x2, y2, o = {}) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${o.color || C.edge}" stroke-width="${o.w || 1.2}"
     ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} ${o.cap ? 'stroke-linecap="round"' : ''} ${o.marker || ''}/>`;

const polyline = (pts, o = {}) =>
  `<polyline points="${pts.map(p => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="${o.fill || 'none'}" stroke="${o.color || C.edge}"
     stroke-width="${o.w || 1.2}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} stroke-linejoin="round" ${o.opacity ? `opacity="${o.opacity}"` : ''}/>`;

const stitch = (x1, y1, x2, y2, current = true) =>
  line(x1, y1, x2, y2, { color: current ? C.stitch : C.prev, w: current ? 2.4 : 1.6, dash: current ? '6 4' : '4 4', cap: true });
const stitchPath = (pts, current = true) =>
  polyline(pts, { color: current ? C.stitch : C.prev, w: current ? 2.2 : 1.4, dash: current ? '6 4' : '4 4' });
const trimLine = (x1, y1, x2, y2) =>
  line(x1, y1, x2, y2, { color: C.trim, w: 1.6, dash: '8 3 2 3' }) + text(x1 + 5, y1 + 4, '✂', { size: 14, color: C.trim });

function dim(x1, y1, x2, y2, label, side = -1) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const horizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const lx = horizontal ? mx : mx + side * 8, ly = horizontal ? my + (side < 0 ? -7 : 16) : my + 4;
  return line(x1, y1, x2, y2, { color: C.dim, w: 1.1, marker: 'marker-start="url(#arr)" marker-end="url(#arr)"' }) +
    text(lx, ly, label, { size: 12, bold: true, anchor: horizontal ? 'middle' : (side < 0 ? 'end' : 'start') });
}
const ext = (x, y1, y2) => line(x, y1, x, y2, { color: C.dim, w: 0.7, dash: '2 2' });
const leader = (x1, y1, x2, y2, label, anchor = 'start') =>
  line(x1, y1, x2, y2, { color: C.note, w: 0.9 }) + `<circle cx="${f(x1)}" cy="${f(y1)}" r="2.2" fill="${C.note}"/>` +
  text(x2 + (anchor === 'end' ? -4 : 4), y2 + 4, label, { size: 11.5, anchor, color: C.note });

function legend(x, y, items = ['rs', 'ws', 'stitch']) {
  let out = '', cx = x;
  const swatch = (fill, label) => {
    out += `<rect x="${cx}" y="${y - 9}" width="16" height="11" fill="${fill}" stroke="${C.edge}" stroke-width="0.8"/>` + text(cx + 21, y, label, { size: 10.5, color: C.note });
    cx += 90;
  };
  const stroke = (o, label, adv) => {
    out += line(cx, y - 4, cx + 18, y - 4, o) + text(cx + 23, y, label, { size: 10.5, color: C.note });
    cx += adv;
  };
  for (const k of items) {
    if (k === 'rs') swatch(C.rs, 'Right side');
    if (k === 'ws') swatch(C.ws, 'Wrong side');
    if (k === 'stitch') stroke({ color: C.stitch, w: 2.2, dash: '6 4' }, 'Stitch now', 92);
    if (k === 'prev') stroke({ color: C.prev, w: 1.6, dash: '4 4' }, 'Earlier stitching', 118);
    if (k === 'line') stroke({ color: C.prev, w: 1.6, dash: '4 4' }, 'Stitching line', 106);
    if (k === 'trim') stroke({ color: C.trim, w: 1.6, dash: '8 3 2 3' }, 'Trim', 64);
  }
  return out;
}

/* ---------- fabric layers: two-tone bands (right side white, wrong side grey) ---------- */

class Path {
  constructor(x, y) { this.p = [[x, y]]; }
  to(x, y) { this.p.push([x, y]); return this; }
  // Round fold: sweep `deg` degrees around (cx, cy) from the current point.
  fold(cx, cy, deg, steps = 16) {
    const [sx, sy] = this.p[this.p.length - 1];
    const r = Math.hypot(sx - cx, sy - cy), a0 = Math.atan2(sy - cy, sx - cx), da = deg * Math.PI / 180;
    for (let i = 1; i <= steps; i++) { const a = a0 + da * i / steps; this.p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return this;
  }
}

// rsSide = +1: the right side faces the left-hand normal of the travel direction (up when travelling right).
// One value describes a whole folded layer correctly, because the band's faces stay consistent through folds.
function band(pts, rsSide, o = {}) {
  const h = (o.t || T) / 2;
  const normals = pts.map((p, i) => {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return [dy / L, -dx / L];
  });
  const off = s => pts.map((p, i) => [p[0] + normals[i][0] * h * s, p[1] + normals[i][1] * h * s]);
  const left = off(1), right = off(-1);
  const rsEdge = rsSide > 0 ? left : right, wsEdge = rsSide > 0 ? right : left;
  const poly = (a, b, fill) => `<polygon points="${[...a, ...b.slice().reverse()].map(p => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="${fill}"/>`;
  return poly(rsEdge, pts, C.rs) + poly(pts, wsEdge, C.ws) +
    `<polygon points="${[...left, ...right.slice().reverse()].map(p => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="none" stroke="${C.edge}" stroke-width="1"/>`;
}
const ghostBand = pts => polyline(pts, { color: C.ghost, w: T + 1 });

/* ---------- real dress outline (reference size) ---------- */

export function halfOutline(name) {
  const o = ALINE_OUTLINE[name];
  return [...o.neckline, ...o.strap.slice(1), ...o.armhole.slice(1), ...o.side.slice(1), ...o.hem.slice(1)];
}
export function fullOutline(name) {
  const half = halfOutline(name);
  return [...half, ...half.slice().reverse().map(([x, y]) => [-x, y])];
}
export const toPx = (pts, k, ox, oy, flipY = false) => pts.map(([x, y]) => [ox + x * k, oy + (flipY ? -y : y) * k]);
export const edge = (name, part, k, ox, oy, mirror = false, flipY = false) =>
  toPx(ALINE_OUTLINE[name][part].map(([x, y]) => [mirror ? -x : x, y]), k, ox, oy, flipY);
// Offset a polyline by d px along its left-hand normal.
export function offsetLine(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return [p[0] + dy / L * d, p[1] - dx / L * d];
  });
}
function piece(name, k, ox, oy, o = {}) {
  const pts = toPx(fullOutline(name), k, ox, oy, o.flipY);
  return `<polygon points="${pts.map(p => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="${o.fill || C.rs}" stroke="${C.edge}" stroke-width="1.3"/>`;
}
const notchTick = (x, y, dir, len = 7) => line(x, y, x + dir * len, y, { w: 2 });
const cross = (x, y) => line(x - 4, y - 4, x + 4, y + 4, { color: C.stitch, w: 1.7 }) + line(x - 4, y + 4, x + 4, y - 4, { color: C.stitch, w: 1.7 });

/* ============================================================
   STEP 1: cut, mark and staystitch
   ============================================================ */

function cuttingLayout() {
  // Same layout and section lengths as the fabric estimate (js/lib/fabric.js), at the reference size.
  const L = PATTERNS.find(p => p.id === 'aline-silk-dress').fabricLayout, est = fabricEstimate({ fabricLayout: L }, null, null);
  const W = 470, k = 6, x0 = 76, yTop = 104;
  const fullW = L.widthIn * k, foldW = L.widthIn / 2 * k, xa = x0 + L.widthIn / 4 * k, xb = xa + foldW;   // folded part is half the width
  const topH = (L.endsIn + est.piecesIn + L.gapIn / 2) * k, botH = (L.gapIn / 2 + est.biasIn + L.endsIn) * k, yBot = yTop + topH;
  const cutTop = -Math.min(...offsetLine(halfOutline('front'), 0.5).map(([, y]) => y)), py = yTop + (L.endsIn + cutTop) * k;
  const q = v => { const e = Math.round(v * 8), w = Math.floor(e / 8), r = e % 8; return (w || !r ? String(w) : '') + ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'][r]; };
  // half pieces: front on the left fold, back on the right fold; cutting line = stitching line + 1/2 in, outward
  const front = toPx(halfOutline('front'), k, xa, py);
  const back = toPx(halfOutline('back').map(([x, y]) => [-x, y]), k, xb, py);
  const pieceSvg = (pts, outward, label, lx) => {
    const cut = offsetLine(pts, outward * 0.5 * k);
    return `<polygon points="${cut.map(p => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="${C.rs}" stroke="none"/>` +
      polyline(cut, { color: C.edge, w: 1.4 }) + polyline(pts, { color: C.prev, w: 0.9, dash: '3 3' }) +
      text(lx, py + 24 * k, label, { size: 11, bold: true, anchor: 'middle' });
  };
  const strip = (cx, cy) => {
    const L = 22 * k / 2, w = 1.75 * k / 2, c = Math.SQRT1_2;
    const p = [[-L, -w], [L, -w], [L, w], [-L, w]].map(([u, v]) => [cx + (u - v) * c, cy + (u + v) * c]);
    return `<polygon points="${p.map(q => `${f(q[0])},${f(q[1])}`).join(' ')}" fill="${C.rs}" stroke="${C.edge}" stroke-width="1.2"/>`;
  };
  const body = heading('Cutting layout (reference size)', W) +
    `<rect x="${f(xa)}" y="${yTop}" width="${f(foldW)}" height="${f(topH)}" fill="#efe9df" stroke="${C.edge}" stroke-width="1.2"/>` +
    `<rect x="${x0}" y="${f(yBot)}" width="${f(fullW)}" height="${f(botH)}" fill="#efe9df" stroke="${C.edge}" stroke-width="1.2"/>` +
    line(xa + foldW / 2, yTop, xa + foldW / 2, yBot, { color: C.note, w: 1, dash: '5 3' }) +
    text(xa + foldW / 2, yTop - 7, 'selvages meet here ↓', { size: 10.5, anchor: 'middle', color: C.note }) +
    text(xa - 8, py + 21 * k, 'FOLD', { size: 11, bold: true, anchor: 'middle', rotate: -90 }) +
    text(xb + 14, py + 21 * k, 'FOLD', { size: 11, bold: true, anchor: 'middle', rotate: 90 }) +
    pieceSvg(front, 1, 'FRONT', xa + 5 * k) + pieceSvg(back, -1, 'BACK', xb - 5 * k) +
    dim(xa, yTop - 30, xb, yTop - 30, `${q(L.widthIn / 2)} in, folded`) +
    strip(x0 + 14 * k, yBot + (L.gapIn / 2 + est.biasIn / 2) * k) + strip(x0 + 32 * k, yBot + (L.gapIn / 2 + est.biasIn / 2) * k) +
    dim(x0, yBot + botH + 14, x0 + fullW, yBot + botH + 14, `${q(L.widthIn)} in (${Math.round(L.widthIn * 2.54)} cm), unfolded for the bias strips`, 1) +
    line(x0 + fullW + 16, yTop, x0 + fullW + 16, yBot + botH, { color: C.dim, w: 1.1, marker: 'marker-start="url(#arr)" marker-end="url(#arr)"' }) +
    text(x0 + fullW + 30, yTop + (topH + botH) / 2, `${q(est.totalIn)} in ≈ ${est.metres.toFixed(1)} m`, { size: 11.5, bold: true, anchor: 'middle', rotate: 90 }) +
    notes(20, yBot + botH + 58, ['Fold both selvages to the centre: front on one fold, back on the other.',
      'Unfold the rest and cut 2 bias strips, 1¾ in × 22 in, at 45° to the selvage.',
      `Length: pieces ${q(est.piecesIn)} in + strips ${q(est.biasIn)} in + ${q(est.allowIn)} in to straighten the ends and separate the sections.`]) +
    legend(20, yBot + botH + 118, ['rs', 'line']);
  return svg(W, yBot + botH + 132, body, 'Cutting layout: selvages folded to the centre, front and back on the two folds, bias strips at 45 degrees');
}

function markAndStaystitch() {
  const W = 640, k = 7, oy = 70, oxF = 120, oxB = 320, lx = oxB + 12 * k;
  const draw = (name, ox) => {
    const o = ALINE_OUTLINE[name];
    let s = piece(name, k, ox, oy);
    for (const mirror of [false, true]) {
      const sgn = mirror ? -1 : 1;
      // staystitching 3/8 in from the cut edge = 1/8 in outside the stitching line, into the allowance
      s += stitchPath(offsetLine(edge(name, 'neckline', k, ox, oy, mirror), sgn * 0.125 * k)) +
        stitchPath(offsetLine(edge(name, 'armhole', k, ox, oy, mirror), sgn * 0.125 * k));
      for (const [x, y] of o.notches.side) s += notchTick(ox + sgn * x * k, oy + y * k, sgn);
      for (const [x, y] of o.notches.armhole) s += notchTick(ox + sgn * x * k, oy + y * k, sgn, 6);
      for (const [x, y] of o.notches.neckline) s += cross(ox + sgn * x * k, oy + y * k);
    }
    return s + text(ox, oy + 26 * k, name === 'front' ? 'FRONT' : 'BACK', { size: 12, bold: true, anchor: 'middle' });
  };
  const b = ALINE_OUTLINE.back;
  const body = heading('Mark the notches and staystitch the neckline and armholes', W) +
    draw('front', oxF) + draw('back', oxB) +
    leader(oxB + 6.75 * k, oy + 2.2 * k, lx, oy - 0.8 * k, 'staystitch ⅜ in from the edge') +
    leader(oxB + b.notches.neckline[0][0] * k, oy + b.notches.neckline[0][1] * k, lx, oy + 2.4 * k, '✕ neckline notches: not used') +
    text(lx + 4, oy + 2.4 * k + 16, '(they belong to the lined version)', { size: 10.5, color: C.stitch }) +
    leader(oxB + b.notches.armhole[1][0] * k + 2, oy + b.notches.armhole[1][1] * k, lx, oy + 6.6 * k, 'armhole notches (back 2, front 1)') +
    b.notches.side.map(([x, y], i) => leader(oxB + x * k + 7, oy + y * k, lx, oy + y * k, ['waist notch', 'hip notch', 'lower notch'][i])).join('') +
    legend(20, oy + 44.5 * k, ['rs', 'stitch']);
  return svg(W, oy + 46.5 * k, body, 'Marking notches and staystitching the neckline and armholes');
}

function biasStrips() {
  const IN = 150, W = 580, x0 = 54, y0 = 64, s = 160, bx = 280;
  const body = heading('Prepare the bias strips', W) +
    `<rect x="${x0}" y="${y0}" width="${s}" height="${s}" fill="${C.rs}" stroke="${C.edge}"/>` +
    line(x0 + 10, y0 + s + 18, x0 + s - 10, y0 + s + 18, { color: C.note, w: 1, marker: 'marker-start="url(#arr)" marker-end="url(#arr)"' }) +
    text(x0 + s / 2, y0 + s + 34, 'crosswise grain', { size: 10.5, anchor: 'middle', color: C.note }) +
    line(x0 - 18, y0 + 10, x0 - 18, y0 + s - 10, { color: C.note, w: 1, marker: 'marker-start="url(#arr)" marker-end="url(#arr)"' }) +
    text(x0 - 26, y0 + s / 2, 'lengthwise grain', { size: 10.5, anchor: 'middle', color: C.note, rotate: -90 }) +
    `<polygon points="${x0 + 10},${y0 + s - 38} ${x0 + s - 38},${y0 + 10} ${x0 + s - 10},${y0 + 10} ${x0 + 38},${y0 + s - 10}" fill="#f3ead8" stroke="${C.trim}" stroke-width="1.6" stroke-dasharray="8 3 2 3"/>` +
    text(x0 + s / 2 + 8, y0 + s / 2 + 14, 'true bias, 45°', { size: 10.5, color: C.dim, anchor: 'middle', rotate: -45 }) +
    text(bx, y0 + 6, 'Cut flat, 1¾ in wide', { size: 12, bold: true }) +
    band([[bx, y0 + 34], [bx + 1.75 * IN, y0 + 34]], 1) + dim(bx, y0 + 52, bx + 1.75 * IN, y0 + 52, '1¾ in', 1) +
    text(bx, y0 + 110, 'Fold in half, wrong sides together;', { size: 12, bold: true }) +
    text(bx, y0 + 127, 'press without stretching', { size: 12, bold: true }) +
    band(new Path(bx + 0.875 * IN, y0 + 150).to(bx + 6, y0 + 150).fold(bx + 6, y0 + 156, -180).to(bx + 0.875 * IN, y0 + 162).p, -1) +
    dim(bx - 1, y0 + 182, bx + 0.875 * IN, y0 + 182, '⅞ in', 1) + leader(bx + 1, y0 + 155, bx - 24, y0 + 155, 'fold', 'end') +
    notes(20, y0 + s + 66, ['Cut 2 strips, each 22 in long: one per armhole. Bias lets the strip follow the tight underarm curve.']) +
    legend(20, y0 + s + 96, ['rs', 'ws', 'trim']);
  return svg(W, y0 + s + 108, body, 'Preparing the bias strips: cut 1 3/4 inches wide on the true bias, fold in half to 7/8 inch');
}

/* ============================================================
   STEPS 2 & 5: French seams (shared cross-sections)
   ============================================================ */

function frenchPass1(seam) {
  const W = 580, y = 110, x0 = 40, E = x0 + 1.4 * IN;
  const body = heading(`Pass 1 · ${seam}: wrong sides together, stitch ¼ in`, W) +
    band([[x0, y - T], [E, y - T]], 1) + band([[x0, y + 1], [E, y + 1]], -1) +
    text(x0, y - 28, 'front, right side up', { size: 11, color: C.note }) + text(x0, y + 26, 'back, right side down', { size: 11, color: C.note }) +
    stitch(E - 0.25 * IN, y - 24, E - 0.25 * IN, y + 16) +
    ext(E, y - 36, y - 10) + dim(E - 0.25 * IN, y - 40, E, y - 40, '¼ in') +
    leader(E, y - 3, E + 20, y + 30, 'raw edges together') +
    legend(20, y + 76, ['rs', 'ws', 'stitch']);
  return svg(W, y + 90, body, `French seam pass 1 for the ${seam}: wrong sides together, stitch a quarter inch`);
}

function frenchPass2(seam) {
  const W = 580, y = 110, x0 = 40, S = x0 + 1.4 * IN - 0.25 * IN, cut = S + 0.125 * IN;
  const body = heading(`Trim the ${seam} allowance to ⅛ in`, W) +
    ghostBand([[cut, y - T], [S + 0.25 * IN, y - T]]) + ghostBand([[cut, y + 1], [S + 0.25 * IN, y + 1]]) +
    band([[x0, y - T], [cut, y - T]], 1) + band([[x0, y + 1], [cut, y + 1]], -1) +
    stitch(S, y - 20, S, y + 12, false) + trimLine(cut, y - 34, cut, y + 22) +
    ext(S, y + 14, y + 34) + dim(S, y + 34, cut, y + 34, '⅛ in', 1) +
    notes(20, y + 74, ['Trimming keeps the frayed raw edge narrow enough to hide completely inside pass 2.',
      'Press the allowance to one side, then fold right sides together along the seam.']) +
    legend(20, y + 122, ['rs', 'ws', 'prev', 'trim']);
  return svg(W, y + 136, body, `French seam: trim the first pass to one eighth of an inch`);
}

function frenchPass3(seam, pressTo) {
  const W = 580, yT = 98, yB = 140, x0 = 40, F = x0 + 1.4 * IN, cy = (yT + yB) / 2, r = (yB - yT) / 2;
  const top = new Path(x0, yT).to(F - r, yT).fold(F - r, cy, 90, 10).p;
  const bottom = new Path(x0, yB).to(F - r, yB).fold(F - r, cy, -90, 10).p;
  const body = heading(`Pass 2 · ${seam}: right sides together, stitch ¼ in from the fold`, W) +
    band(top, -1) + band(bottom, 1) +
    band([[F - 2, cy - 4], [F - 0.125 * IN, cy - 4]], 1, { t: 6 }) + band([[F - 2, cy + 4], [F - 0.125 * IN, cy + 4]], -1, { t: 6 }) +
    stitch(F - 0.25 * IN, yT - 18, F - 0.25 * IN, yB + 18) +
    ext(F, yT - 30, yT - 8) + dim(F - 0.25 * IN, yT - 34, F, yT - 34, '¼ in') +
    leader(F - 0.08 * IN, cy, F + 30, cy + 44, '⅛ in raw edges enclosed') +
    text(x0, yT - 16, 'front, wrong side up', { size: 11, color: C.note }) +
    notes(20, yB + 64, ['¼ in + ¼ in = ½ in, the pattern’s seam allowance: the seam lands on the stitching line.',
      `Press the finished seam toward ${pressTo}.`]) +
    legend(20, yB + 112, ['rs', 'ws', 'stitch']);
  return svg(W, yB + 126, body, `French seam pass 2 for the ${seam}: right sides together, stitch a quarter inch, raw edges enclosed`);
}

function shoulderOverview() {
  const W = 560, k = 12, ox = 240, oy = 190, clipTop = 48, clipBot = 335;
  let seams = '';
  for (const mirror of [false, true]) {
    const s = edge('front', 'strap', k, ox, oy, mirror);
    seams += line(s[0][0], s[0][1], s[1][0], s[1][1], { color: C.stitch, w: 3.2, dash: '6 4' });
  }
  const st = ALINE_OUTLINE.front.strap;
  const body = heading('Match the strap tops, wrong sides together', W) +
    `<clipPath id="shclip"><rect x="0" y="${clipTop}" width="${W}" height="${clipBot - clipTop}"/></clipPath>` +
    `<g clip-path="url(#shclip)">${piece('front', k, ox, oy)}${piece('back', k, ox, oy, { flipY: true, fill: C.ws })}</g>` + seams +
    text(ox, oy - 10 * k, 'BACK · wrong side up', { size: 12, bold: true, anchor: 'middle' }) +
    text(ox, oy + 11.5 * k, 'FRONT · right side up', { size: 12, bold: true, anchor: 'middle' }) +
    leader(ox + st[1][0] * k, oy + st[1][1] * k - 2, ox + 11 * k, oy - 3.2 * k, 'strap tops: 1½ in seams') +
    notes(20, clipBot + 24, ['Lay the back over the front so each strap top meets its partner, wrong sides together.']) +
    legend(20, clipBot + 54, ['rs', 'ws', 'stitch']);
  return svg(W, clipBot + 68, body, 'Shoulder straps: front and back strap tops matched wrong sides together');
}

/* ============================================================
   STEPS 3 & 6: baby hem (shared cross-sections)
   ============================================================ */

function babyHem1(where) {
  const W = 600, y = 110, x0 = 40, E = x0 + 1.5 * IN, s = E - 0.375 * IN, fin = E - 0.5 * IN, y2 = y + 104;
  const body = heading(`${where}: stitch ⅜ in from the raw edge, then press the allowance to the wrong side along it`, W) +
    band([[x0, y], [E, y]], 1) + stitch(s, y - 18, s, y + 14) +
    ext(E, y - 34, y - 8) + dim(s, y - 38, E, y - 38, '⅜ in') +
    line(fin, y - 14, fin, y + 30, { color: C.trim, w: 1, dash: '1 3' }) + leader(fin, y + 26, fin - 30, y + 46, 'finished edge = the pattern’s stitching line', 'end') +
    band(new Path(x0 + 0.2 * IN, y2).to(s, y2).fold(s, y2 + T * 0.8, 180).to(s - 0.375 * IN, y2 + 1.6 * T).p, 1) +
    stitch(s - 2, y2 - 16, s - 2, y2 + 2 * T + 12, false) +
    text(x0 + 0.2 * IN, y2 - 14, 'pressed under along the stitching', { size: 11, color: C.note }) +
    legend(20, y2 + 66, ['rs', 'ws', 'stitch', 'prev']);
  return svg(W, y2 + 80, body, `Baby hem, ${where}: stitch three eighths of an inch from the edge, press under`);
}

function babyHem2(where) {
  const W = 580, y = 100, x0 = 40, s = x0 + 1.4 * IN, cy = y + T * 0.8;
  const body = heading(`${where}: trim the folded allowance close to the stitching`, W) +
    band(new Path(x0, y).to(s, y).fold(s, cy, 180).to(s - 0.125 * IN, y + 1.6 * T).p, 1) +
    ghostBand([[s - 0.125 * IN, y + 1.6 * T], [s - 0.375 * IN, y + 1.6 * T]]) +
    stitch(s - 2, y - 16, s - 2, y + 30, false) + trimLine(s - 0.125 * IN, y + 44, s - 0.125 * IN, y - 22) +
    dim(s - 0.125 * IN, y + 52, s, y + 52, '⅛ in', 1) +
    notes(20, y + 92, ['Use small sharp scissors and cut parallel to the stitching so the roll stays even.']) +
    legend(20, y + 122, ['rs', 'ws', 'prev', 'trim']);
  return svg(W, y + 136, body, `Baby hem, ${where}: trim to one eighth of an inch`);
}

function babyHem3(where) {
  const W = 600, y = 110, x0 = 40, B = x0 + 1.4 * IN, g = T + 1;
  const outer = new Path(x0, y).to(B, y).fold(B, y + g, 180).to(B - 0.125 * IN, y + 2 * g).fold(B - 0.125 * IN, y + 1.5 * g, 180).to(B - 0.03 * IN, y + g).p;
  const body = heading(`${where}: roll under once more by ⅛ in, along the stitching line, and stitch through all layers`, W) +
    band(outer, 1) +
    stitch(B - 0.1 * IN, y - 18, B - 0.1 * IN, y + 2 * g + 16) +
    ext(B + T / 2, y - 34, y - 8) + ext(B - 0.125 * IN, y - 34, y - 18) + dim(B - 0.125 * IN, y - 38, B + T / 2, y - 38, '⅛ in') +
    leader(B + 6, y + g, B + 34, y + g + 38, 'finished edge on the stitching line') +
    notes(20, y + 2 * g + 78, ['⅜ in + ⅛ in = ½ in, the pattern’s allowance. Stitch slightly inside the inner fold; press lightly.']) +
    legend(20, y + 2 * g + 108, ['rs', 'ws', 'stitch']);
  return svg(W, y + 2 * g + 122, body, `Baby hem, ${where}: roll one eighth of an inch and stitch`);
}

function necklineOverview() {
  const W = 560, k = 11, ox = 250, oy = 180, clipTop = 48, clipBot = 318;
  let lines = '';
  for (const mirror of [false, true]) {
    lines += stitchPath(offsetLine(edge('front', 'neckline', k, ox, oy, mirror), (mirror ? -1 : 1) * 0.125 * k));
    lines += stitchPath(offsetLine(edge('back', 'neckline', k, ox, oy, mirror, true), (mirror ? 1 : -1) * 0.125 * k));
  }
  const fy = oy + ALINE_OUTLINE.front.neckline[0][1] * k, by = oy - ALINE_OUTLINE.back.neckline[0][1] * k;
  const body = heading('The neckline is one continuous edge around both straps', W) +
    `<clipPath id="nclip"><rect x="0" y="${clipTop}" width="${W}" height="${clipBot - clipTop}"/></clipPath>` +
    `<g clip-path="url(#nclip)">${piece('front', k, ox, oy)}${piece('back', k, ox, oy, { flipY: true })}</g>` + lines +
    `<circle cx="${ox}" cy="${f(fy)}" r="12" fill="none" stroke="${C.accent}" stroke-width="2.2"/>` +
    `<circle cx="${ox}" cy="${f(by)}" r="12" fill="none" stroke="${C.accent}" stroke-width="2.2"/>` +
    leader(ox + 10, fy + 6, ox + 96, fy + 26, 'centre-front V (109°)') +
    leader(ox + 10, by - 6, ox + 96, by - 26, 'centre-back V (130°)') +
    leader(ox + ALINE_OUTLINE.front.strap[1][0] * k + 2, oy, ox + 11.6 * k, oy + 4, 'strap seams (step 2)') +
    notes(20, clipBot + 24, ['Back neckline → strap → front neckline → strap → back. Red: the ⅜ in staystitching.']) +
    legend(20, clipBot + 54, ['rs', 'stitch']);
  return svg(W, clipBot + 68, body, 'Neckline: one continuous edge around both straps, with V points at centre front and back');
}

function vPoint() {
  const W = 560, cx = 260, cy = 210, a = 54.5 * Math.PI / 180;   // half of the 109 degree front V, from vertical
  const L = 0.9 * IN, sa = Math.sin(a), ca = Math.cos(a);
  const V = d => { const dy = d / sa; return [[cx - sa * L, cy - ca * L + dy], [cx, cy + dy], [cx + sa * L, cy - ca * L + dy]]; };
  const on = (d, t, side) => { const v = V(d), end = v[side < 0 ? 0 : 2]; return [v[1][0] + (end[0] - v[1][0]) * t, v[1][1] + (end[1] - v[1][1]) * t]; };
  const c1 = on(0, 0.8, -1), c2 = on(0.375 * IN, 0.7, -1), f1 = on(0.5 * IN, 0.65, 1);
  const body = heading('At each V point: clip, then hem each side up to the point', W) +
    polyline(V(0), { color: C.edge, w: 1.7 }) + stitchPath(V(0.375 * IN), false) +
    polyline(V(0.5 * IN), { color: C.trim, w: 1.1, dash: '1 3' }) +
    line(cx, cy, cx, cy + 0.375 * IN / sa - 4, { color: C.stitch, w: 2.6 }) +
    text(cx, cy + 0.5 * IN / sa + 22, '✂ clip to the staystitching, not through it', { size: 11.5, color: C.stitch, anchor: 'middle' }) +
    leader(c1[0], c1[1], c1[0] - 30, c1[1] - 20, 'cut edge', 'end') +
    leader(c2[0], c2[1], c2[0] - 30, c2[1] + 40, 'staystitching, ⅜ in', 'end') +
    leader(f1[0], f1[1], f1[0] + 36, f1[1] + 40, 'finished edge, ½ in') +
    notes(20, cy + 0.5 * IN / sa + 56, ['Hem one side right up to the clip, then the other. At the point, fold the second side over the',
      'first and secure with three hand stitches. The front V (109°) is sharper than the back (130°).']) +
    legend(20, cy + 0.5 * IN / sa + 104, ['prev', 'trim']);
  return svg(W, cy + 0.5 * IN / sa + 118, body, 'Baby hem at a V point: clip to the staystitching and hem each side to the point');
}

/* ============================================================
   STEP 4: bias-faced armholes
   ============================================================ */

function armholeOverview() {
  const W = 560, k = 11, ox = 250, oy = 186, clipTop = 56, clipBot = 324;
  let lines = '';
  for (const mirror of [false, true]) {
    lines += stitchPath(edge('front', 'armhole', k, ox, oy, mirror)) + stitchPath(edge('back', 'armhole', k, ox, oy, mirror, true));
  }
  const ua = ALINE_OUTLINE.front.armhole.at(-1), ub = ALINE_OUTLINE.back.armhole.at(-1), sp = ALINE_OUTLINE.front.strap[0];
  const body = heading('Each armhole is one edge: back underarm, over the strap, to front underarm', W) +
    `<clipPath id="aclip"><rect x="0" y="${clipTop}" width="${W}" height="${clipBot - clipTop}"/></clipPath>` +
    `<g clip-path="url(#aclip)">${piece('front', k, ox, oy)}${piece('back', k, ox, oy, { flipY: true })}</g>` + lines +
    leader(ox + ua[0] * k, oy + ua[1] * k, ox + ua[0] * k + 26, oy + ua[1] * k + 24, 'front underarm') +
    leader(ox + ub[0] * k, oy - ub[1] * k, ox + ub[0] * k + 26, oy - ub[1] * k - 24, 'back underarm') +
    leader(ox + sp[0] * k, oy + sp[1] * k, ox + 12.6 * k, oy + 1.2 * k, 'over the strap') +
    notes(20, clipBot + 24, ['About 16–19 in long depending on size (red: the seamline).',
      'Let the strip run ½ in past each underarm; the ends go into the side seam.']) +
    legend(20, clipBot + 72, ['rs', 'stitch']);
  return svg(W, clipBot + 86, body, 'Armhole edge from back underarm over the strap to front underarm, faced with one bias strip');
}

function biasSew() {
  const W = 600, y = 124, x0 = 30, E = x0 + 1.5 * IN, seam = E - 0.5 * IN, fx = E - 0.875 * IN + 5;
  const strip = new Path(E, y - T - 1).to(fx, y - T - 1).fold(fx, y - 1.5 * T - 1, 180).to(E, y - 2 * T - 1).p;
  const body = heading('Pin the folded strip to the right side, raw edges together; stitch ½ in from the edge', W) +
    band([[x0, y], [E, y]], 1) + band(strip, 1) +
    text(x0, y + 26, 'dress, right side up', { size: 11, color: C.note }) +
    leader(fx - 2, y - 1.5 * T - 1, fx - 50, y - 46, 'folded bias strip', 'end') +
    stitch(seam, y - 2 * T - 20, seam, y + 14) +
    ext(E, y - 2 * T - 34, y - 2 * T - 6) + dim(seam, y - 2 * T - 38, E, y - 2 * T - 38, '½ in') +
    ext(fx - 4, y + 4, y + 40) + dim(fx - 4, y + 40, E, y + 40, '⅞ in strip', 1) +
    notes(20, y + 92, ['Start ½ in beyond the back underarm and ease the strip around the curve without stretching',
      'the dress; continue over the strap and stop ½ in beyond the front underarm.']) +
    legend(20, y + 140, ['rs', 'ws', 'stitch']);
  return svg(W, y + 154, body, 'Bias facing: folded strip on the right side, stitched half an inch from the edge');
}

function biasTrimClip() {
  const W = 520, k = 80, ox = 60 - 6.56 * 80, oy = 92 - 4.18 * 80;
  const arm = edge('front', 'armhole', k, ox, oy).filter(([, y]) => y > 80);
  const cut = offsetLine(arm, 0.25 * k), orig = offsetLine(arm, 0.5 * k);
  let clips = '';
  for (let i = 2; i < arm.length - 1; i++) {
    const [x, y] = arm[i], [cx, cy] = cut[i];
    clips += line(x + (cx - x) * 0.35, y + (cy - y) * 0.35, cx, cy, { color: C.stitch, w: 2 });
  }
  const m = Math.floor(arm.length / 2);
  const body = heading('Trim the allowance to ¼ in and clip around the underarm curve', W) +
    polyline(orig, { color: C.ghost, w: 1.4, dash: '3 3' }) + polyline(cut, { color: C.trim, w: 1.8, dash: '8 3 2 3' }) +
    stitchPath(arm, false) + clips +
    leader(arm[2][0], arm[2][1], 290, 96, 'seam, ½ in from the original edge') +
    leader(cut[m][0], cut[m][1], 300, 210, 'allowance trimmed to ¼ in') +
    leader(orig[m + 2][0], orig[m + 2][1], 300, 330, 'original cut edge (trimmed away)') +
    notes(20, 420, ['Clip every ¼–½ in where the curve is tightest, stopping ⅛ in short of the stitching,',
      'so the allowance can spread when the facing turns inside.']) +
    legend(20, 468, ['prev', 'trim']);
  return svg(W, 482, body, 'Bias facing: allowance trimmed to a quarter inch and clipped around the underarm curve');
}

function biasUnderstitch() {
  const W = 580, y = 124, x0 = 30, seam = x0 + 1.2 * IN, fw = 0.375 * IN;
  const facing = new Path(seam, y - T - 1).to(seam + fw, y - T - 1).fold(seam + fw, y - 1.5 * T - 1, -180).to(seam, y - 2 * T - 1).p;
  const body = heading('Press the facing and allowances away from the dress; understitch', W) +
    band([[x0, y], [seam + 0.25 * IN, y]], 1) + band(facing, -1) +
    stitch(seam, y - 2 * T - 14, seam, y + 12, false) + stitch(seam + 0.125 * IN, y - 2 * T - 18, seam + 0.125 * IN, y + 14) +
    ext(seam, y + 14, y + 36) + dim(seam, y + 36, seam + 0.125 * IN, y + 36, '⅛ in', 1) +
    leader(seam + fw - 2, y - 1.5 * T - 1, seam + fw + 40, y - 52, 'facing (both layers)') +
    leader(seam + 0.21 * IN, y, seam + 0.75 * IN, y + 30, 'allowances, ¼ in') +
    leader(seam - 2, y - T, seam - 80, y - 50, 'seam', 'end') +
    notes(20, y + 90, ['Stitch through the facing and the allowances only, ⅛ in from the seam. This keeps the',
      'facing rolling to the inside so it never peeks out at the armhole edge.']) +
    legend(20, y + 138, ['rs', 'ws', 'stitch', 'prev']);
  return svg(W, y + 152, body, 'Bias facing: understitching the facing to the seam allowances');
}

function biasTurn() {
  const W = 620, y = 116, x0 = 30, edgeX = x0 + 1.4 * IN, foldX = edgeX - 0.375 * IN;
  const facing = new Path(edgeX - 2, y + T + 1).to(foldX + 4, y + T + 1).fold(foldX + 4, y + 1.5 * T + 1, -180).to(edgeX - 2, y + 2 * T + 1).p;
  const body = heading('Turn the facing fully to the inside, press, and stitch it down ⅜ in from the edge', W) +
    band([[x0, y], [edgeX, y]], 1) + band(facing, -1) +
    stitch(foldX + 0.07 * IN, y - 18, foldX + 0.07 * IN, y + 2 * T + 16) +
    ext(edgeX, y - 34, y - 8) + ext(foldX, y - 34, y - 8) + dim(foldX, y - 38, edgeX, y - 38, '⅜ in facing') +
    leader(edgeX, y, edgeX + 26, y + 40, 'armhole edge, seam rolled inside') +
    text(x0, y + 60, 'dress right side up: the facing is invisible from outside', { size: 11, color: C.note }) +
    notes(20, y + 92, ['Edgestitch next to the facing’s folded edge (a line ⅜ in from the armhole shows outside),',
      'or slipstitch by hand for an invisible finish.']) +
    legend(20, y + 140, ['rs', 'ws', 'stitch']);
  return svg(W, y + 154, body, 'Bias facing: turned inside, three eighths of an inch wide, stitched down');
}

/* ============================================================
   STEP 5: side seams
   ============================================================ */

function sideOverview() {
  const W = 440, k = 6.4, ox = 170, oy = 52;
  const body = heading('Front over back, wrong sides together', W) +
    piece('front', k, ox, oy) +
    stitchPath(offsetLine(edge('front', 'side', k, ox, oy), 0.25 * k)) +
    stitchPath(offsetLine(edge('front', 'side', k, ox, oy, true), -0.25 * k)) +
    ALINE_OUTLINE.front.notches.side.map(([x, y], i) =>
      notchTick(ox + x * k, oy + y * k, 1) + text(ox + x * k + 14, oy + y * k + 4, ['waist', 'hip', 'lower'][i] + ' notch', { size: 11, color: C.note })).join('') +
    text(ox, oy + 30 * k, 'FRONT,', { size: 11.5, bold: true, anchor: 'middle' }) +
    text(ox, oy + 30 * k + 15, 'right side up', { size: 11, bold: true, anchor: 'middle' }) +
    text(ox, oy + 30 * k + 30, '(back underneath)', { size: 10.5, anchor: 'middle', color: C.note }) +
    notes(20, oy + 46 * k, ['Match the faced underarm edges, then the waist, hip and lower notches.', 'Pass 1 runs ¼ in from the edge.']) +
    legend(20, oy + 51.5 * k, ['rs', 'stitch']);
  return svg(W, oy + 53.5 * k, body, 'Side seams: front over back, wrong sides together, notches matched');
}

function underarmJunction() {
  const W = 520, x = 240, y = 80, fh = 0.375 * IN, pw = 200;
  const body = heading('At the underarm the faced armhole edges meet exactly', W) +
    `<rect x="${x - pw}" y="${y}" width="${pw}" height="190" fill="${C.ws}" stroke="${C.edge}"/>` +
    `<rect x="${x}" y="${y}" width="${pw}" height="190" fill="${C.ws}" stroke="${C.edge}"/>` +
    `<rect x="${x - pw}" y="${y}" width="${pw}" height="${fh}" fill="${C.rs}" stroke="${C.edge}"/>` +
    `<rect x="${x}" y="${y}" width="${pw}" height="${fh}" fill="${C.rs}" stroke="${C.edge}"/>` +
    stitch(x - 0.25 * IN, y - 12, x - 0.25 * IN, y + 202) + line(x, y - 16, x, y + 206, { color: C.edge, w: 2 }) +
    text(x - pw / 2 - 20, y + fh / 2 + 4, 'back facing', { size: 10.5, anchor: 'middle', color: C.note }) +
    text(x + pw / 2, y + fh / 2 + 4, 'front facing', { size: 10.5, anchor: 'middle', color: C.note }) +
    text(x - pw / 2 - 20, y + 130, 'back (inside)', { size: 11, anchor: 'middle' }) + text(x + pw / 2, y + 130, 'front (inside)', { size: 11, anchor: 'middle' }) +
    dim(x + pw + 16, y, x + pw + 16, y + fh, '⅜ in', 1) +
    notes(20, y + 236, ['Seen from inside. The ½ in strip tails go into the side seam: trim them at an angle',
      'after pass 1 to reduce bulk, and pass 2 encloses them completely.']) +
    legend(20, y + 284, ['rs', 'ws', 'stitch']);
  return svg(W, y + 298, body, 'Underarm junction: facing ends meet and are enclosed in the side French seam');
}

/* ============================================================
   STEP 6: hem    STEP 7: press and finish
   ============================================================ */

function hemOverview() {
  const W = 380, k = 6.6, ox = 200, oy = 52;
  const body = heading('Baby hem all round the bottom edge', W) +
    piece('front', k, ox, oy) +
    stitchPath(offsetLine(edge('front', 'hem', k, ox, oy), 0.125 * k)) + stitchPath(offsetLine(edge('front', 'hem', k, ox, oy, true), -0.125 * k)) +
    line(ox - 11.8 * k, oy, ox - 11.8 * k, oy + LENGTH * k, { color: C.dim, w: 1.1, marker: 'marker-start="url(#arr)" marker-end="url(#arr)"' }) +
    line(ox - 12.2 * k, oy, ox - 5.4 * k, oy, { color: C.dim, w: 0.7, dash: '2 2' }) +
    text(ox - 12.8 * k, oy + LENGTH / 2 * k, `finished length ${fmtIn(LENGTH)} in`, { size: 12, bold: true, anchor: 'middle', rotate: -90 }) +
    leader(ox + 3 * k, oy + LENGTH * k, ox + 6 * k, oy + (LENGTH + 4) * k, 'baby hem: ⅜ in + ⅛ in') +
    notes(20, oy + (LENGTH + 8) * k, ['Hem front and back in one round, after the side seams.']) +
    legend(20, oy + (LENGTH + 12) * k, ['rs', 'stitch']);
  return svg(W, oy + (LENGTH + 14) * k, body, `Bottom hem: baby hem all around, finished length ${fmtIn(LENGTH)} inches from the neck point`);
}

function pressing() {
  const W = 600;
  const body = heading('Press with care: duchess silk can water-mark and shine', W) +
    band([[40, 180], [440, 180]], 1, { t: 9 }) +
    `<rect x="60" y="160" width="360" height="12" rx="3" fill="#f6f1e6" stroke="${C.edge}" stroke-dasharray="3 2"/>` +
    `<path d="M150 156 L330 156 Q350 156 352 138 L360 102 Q362 94 352 94 L180 94 Q160 94 154 110 Z" fill="#e7e3dc" stroke="${C.edge}" stroke-width="1.4"/>` +
    `<path d="M210 94 Q215 60 260 62 L300 62 Q312 64 310 76 L306 94" fill="none" stroke="${C.edge}" stroke-width="5" stroke-linecap="round"/>` +
    leader(418, 166, 446, 132, 'silk organza press cloth') +
    leader(70, 186, 70, 216, 'dress, wrong side up where possible') +
    notes(20, 252, ['• Silk setting, dry iron. Test on a scrap of the same fabric first.',
      '• Press with a lifting motion; don’t slide the iron.',
      '• French seams toward the back; armhole facings flat to the inside.'], 11.5);
  return svg(W, 310, body, 'Pressing: silk setting, dry iron, organza press cloth');
}

function finishedDress() {
  const W = 640, k = 6, oxF = 210, oxB = 420, oy = 52, rx = oxB + 11.5 * k;
  const body = heading('The finished dress', W) +
    piece('front', k, oxF, oy) + piece('back', k, oxB, oy) +
    text(oxF, oy + (LENGTH + 3.5) * k, 'FRONT', { size: 12, bold: true, anchor: 'middle' }) + text(oxB, oy + (LENGTH + 3.5) * k, 'BACK', { size: 12, bold: true, anchor: 'middle' }) +
    leader(oxF - 2.6 * k, oy + 6 * k, 148, oy + 2.4 * k, 'baby-hemmed neckline', 'end') +
    leader(oxF - 4 * k, oy + (LENGTH - 0.05) * k, 148, oy + (LENGTH + 5.6) * k, `baby hem, ${fmtIn(LENGTH)} in long`, 'end') +
    leader(oxB + 6.3 * k, oy + 0.25 * k, rx, oy - 1 * k, 'French seam (strap)') +
    leader(oxB + 7.8 * k, oy + 6 * k, rx, oy + 8 * k, 'bias-faced armhole') +
    leader(oxB + (sideX('back', 28) - 0.3) * k, oy + 28 * k, rx, oy + 28 * k, 'French side seam');
  return svg(W, oy + (LENGTH + 8) * k, body, 'The finished dress: where each finish sits');
}

/* ---------- registry ---------- */

const BUILDERS = {
  'cutting-layout': cuttingLayout, 'mark-staystitch': markAndStaystitch, 'bias-strips': biasStrips,
  'shoulder-overview': shoulderOverview,
  'french-shoulder-1': () => frenchPass1('shoulder straps'), 'french-shoulder-2': () => frenchPass2('strap'),
  'french-shoulder-3': () => frenchPass3('shoulder straps', 'the back'),
  'neckline-overview': necklineOverview, 'babyhem-neck-1': () => babyHem1('Neckline'), 'babyhem-neck-2': () => babyHem2('Neckline'),
  'babyhem-neck-3': () => babyHem3('Neckline'), 'v-point': vPoint,
  'armhole-overview': armholeOverview, 'bias-1': biasSew, 'bias-2': biasTrimClip, 'bias-3': biasUnderstitch, 'bias-4': biasTurn,
  'side-overview': sideOverview, 'french-side-1': () => frenchPass1('side seams'), 'french-side-2': () => frenchPass2('side seam'),
  'french-side-3': () => frenchPass3('side seams', 'the back'), 'underarm-junction': underarmJunction,
  'hem-overview': hemOverview, 'babyhem-hem-1': () => babyHem1('Hem'), 'babyhem-hem-2': () => babyHem2('Hem'),
  'babyhem-hem-3': () => babyHem3('Hem'),
  'pressing': pressing, 'finished-dress': finishedDress
};
const cache = {};
export function figureSvg(id) {
  if (!BUILDERS[id]) return '';
  return cache[id] || (cache[id] = BUILDERS[id]());
}
export const FIGURE_IDS = Object.keys(BUILDERS);
