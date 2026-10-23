import { ALINE_OUTLINE } from '../data/aline-dress-outline.js';
import { C, fullOutline, halfOutline, toPx, edge, offsetLine } from './sewing-figures.js';
import { PATTERNS } from '../data/patterns.js';
import { fabricEstimate } from './fabric.js';

/* ============================================================
   ANIMATED SEWING TUTORIALS (A-line Silk Dress)
   A tutorial is a list of actions. Each action has one short instruction, a duration and an
   apply(state, p) that moves the scene from its start (p = 0) to its end (p = 1). The state at
   any moment is every earlier action applied at p = 1, then the current action at p.
   Two views are drawn from that state on every frame:
   - plan: the real reference-size front and back outline (js/data/aline-dress-outline.js);
   - section: a magnified cut across the side seam. Each fabric layer is a strip whose path is
     rebuilt from hinge angles every frame, so it physically flips, folds and tucks in.
   Same visual key as the static figures: white = right side, grey = wrong side, red dashed =
   stitching in this action, grey dashed = earlier stitching, blue dash-dot = trim line.
   ============================================================ */

const f = n => Number(n.toFixed(2));
// Finished length at the fold and the side seam's points, from the outline data (version 9).
const LENGTH = ALINE_OUTLINE.front.hem[ALINE_OUTLINE.front.hem.length - 1][1];
const sideFrom = (y0, y1) => ALINE_OUTLINE.front.side.filter(([, y]) => y >= y0 && y <= y1);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const seg = (p, a, b) => clamp((p - a) / (b - a));
const rad = d => d * Math.PI / 180;
// Unit vector for an angle measured counter-clockwise with y up, in screen coordinates (y down).
const u = d => [Math.cos(rad(d)), -Math.sin(rad(d))];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s];
const pts = list => list.map(p => `${f(p[0])},${f(p[1])}`).join(' ');

const text = (x, y, s, o = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family="Space Grotesk, Poppins, sans-serif" font-size="${o.size || 12}"
     font-weight="${o.bold ? 700 : 500}" fill="${o.color || C.dim}" text-anchor="${o.anchor || 'start'}"
     ${o.opacity != null ? `opacity="${f(o.opacity)}"` : ''}>${s}</text>`;
const line = (a, b, o = {}) =>
  `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${o.color || C.edge}" stroke-width="${o.w || 1.2}"
     ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} stroke-linecap="round" ${o.opacity != null ? `opacity="${f(o.opacity)}"` : ''} ${o.marker || ''}/>`;
const stitchColor = current => current ? C.stitch : C.prev;

// Leading part of a polyline, `t` of its length.
function partial(list, t) {
  if (t >= 1) return list;
  const lens = [0];
  for (let i = 1; i < list.length; i++) lens.push(lens[i - 1] + Math.hypot(list[i][0] - list[i - 1][0], list[i][1] - list[i - 1][1]));
  const target = lens[lens.length - 1] * clamp(t), out = [list[0]];
  for (let i = 1; i < list.length; i++) {
    if (lens[i] <= target) { out.push(list[i]); continue; }
    const r = (target - lens[i - 1]) / (lens[i] - lens[i - 1]);
    out.push([list[i - 1][0] + (list[i][0] - list[i - 1][0]) * r, list[i - 1][1] + (list[i][1] - list[i - 1][1]) * r]);
    break;
  }
  return out;
}
const tip = list => list[list.length - 1];

/* ---------- small props ---------- */

function scissors(x, y, rot = 0, size = 20) {
  return `<text x="${f(x)}" y="${f(y)}" font-size="${size}" fill="${C.trim}" text-anchor="middle" dominant-baseline="central"
    transform="rotate(${f(rot)} ${f(x)} ${f(y)})">✂</text>`;
}
// Iron seen from the side, sole on the y line, toe pointing right.
function iron(x, y, scale = 1, rot = 0) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${scale})">
    <path d="M-46,0 L34,0 Q46,0 50,-8 Q40,-22 18,-24 L-46,-24 Z" fill="${C.dim}" />
    <path d="M-46,-1 L36,-1" stroke="${C.accent}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M-30,-24 Q-30,-44 -10,-44 L16,-44 Q22,-44 22,-38 L14,-24" fill="none" stroke="${C.dim}" stroke-width="5" stroke-linejoin="round"/>
  </g>`;
}
function needle(x, tipY) {
  return `<g>
    <line x1="${f(x)}" y1="${f(tipY - 92)}" x2="${f(x)}" y2="${f(tipY - 6)}" stroke="#8b96a3" stroke-width="3" stroke-linecap="round"/>
    <path d="M${f(x - 1.5)},${f(tipY - 6)} L${f(x)},${f(tipY)} L${f(x + 1.5)},${f(tipY - 6)} Z" fill="#8b96a3"/>
    <ellipse cx="${f(x)}" cy="${f(tipY - 14)}" rx="0.9" ry="2.6" fill="${C.bg}"/>
    <line x1="${f(x)}" y1="${f(tipY - 14)}" x2="${f(x + 10)}" y2="${f(tipY - 96)}" stroke="${C.stitch}" stroke-width="1"/>
  </g>`;
}
function dimH(x1, x2, y, label, opacity) {
  const m = 'marker-start="url(#sa-arr)" marker-end="url(#sa-arr)"';
  return `<g opacity="${f(opacity)}">${line([x1, y], [x2, y], { color: C.dim, w: 1.1, marker: m })}` +
    text((x1 + x2) / 2, y - 6, label, { size: 12, bold: true, anchor: 'middle' }) + '</g>';
}

/* ============================================================
   PLAN VIEW: the real dress outline
   ============================================================ */

const PK = 8, POX = 130, POY = 22, PW = 260, PH = 380;
const PLAN = (() => {
  const outline = name => toPx(fullOutline(name), PK, POX, POY);
  const sides = d => [offsetLine(edge('front', 'side', PK, POX, POY), d * PK), offsetLine(edge('front', 'side', PK, POX, POY, true), -d * PK)];
  const notches = [ALINE_OUTLINE.front.side[0], ...ALINE_OUTLINE.front.notches.side]
    .flatMap(([x, y]) => [[POX + x * PK, POY + y * PK], [POX - x * PK, POY + y * PK]]);
  const underarms = [1, -1].map(s => [POX + s * ALINE_OUTLINE.front.side[0][0] * PK, POY + ALINE_OUTLINE.front.side[0][1] * PK]);
  const hip = ALINE_OUTLINE.front.notches.side[1];
  return {
    front: outline('front'), back: outline('back'),
    edges: sides(0), pass1: sides(0.25), pass2: sides(0.5), notches, underarms,
    lens: [POX + hip[0] * PK, POY + hip[1] * PK]
  };
})();

// Turning a piece over about its centre fold: the outline narrows to nothing and opens out again
// showing the other face. `turn` 0 = right side up, 1 = wrong side up.
function flatPiece(outline, turn, o = {}) {
  const c = Math.cos(Math.PI * clamp(turn));
  const sx = Math.abs(c) < 0.02 ? 0.02 : Math.abs(c);
  const fill = c >= 0 ? C.rs : C.ws;
  const lift = Math.sin(Math.PI * clamp(turn));
  const shadow = lift > 0.01 ? `<polygon points="${pts(outline)}" fill="${C.dim}" opacity="${f(0.1 * lift)}" transform="translate(${f(5 * lift)} ${f(8 * lift)})"/>` : '';
  return `<g transform="translate(${o.dx || 0} ${o.dy || 0}) rotate(${f(o.rot || 0)} ${POX} ${POY + 20 * PK})">
    <g transform="translate(${POX} 0) scale(${f(sx)} 1) translate(${-POX} 0)">${shadow}
      <polygon points="${pts(outline)}" fill="${fill}" stroke="${C.edge}" stroke-width="1.3" stroke-linejoin="round"/></g></g>`;
}

function plan(s, step) {
  let body = `<rect width="${PW}" height="${PH}" fill="${C.bg}"/>`;
  body += flatPiece(PLAN.back, s.backFlip);
  if (s.frontIn > 0) {
    const m = 1 - s.frontIn, lift = Math.sin(Math.PI * Math.min(s.frontIn, 0.999)) * 0.6 + m * 0.4;
    const shadow = `<polygon points="${pts(PLAN.front)}" fill="${C.dim}" opacity="${f(0.12 * lift)}" transform="translate(${f(-230 * m + 6 * lift)} ${f(9 * lift)})"/>`;
    body += (s.turn > 0 ? '' : shadow) + flatPiece(PLAN.front, s.turn, { dx: f(-230 * m), rot: -12 * m });
  }
  // Notches: matched marks pulse while the front settles, then stay as ticks.
  if (s.frontIn >= 1 && s.turn < 0.5) {
    body += PLAN.notches.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="2.2" fill="${C.edge}"/>`).join('');
    if (s.notch > 0 && s.notch < 1) {
      const r = 3 + 12 * ((s.notch * 2.5) % 1), op = 1 - ((s.notch * 2.5) % 1);
      body += PLAN.notches.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="none" stroke="${C.accent}" stroke-width="2" opacity="${f(op)}"/>`).join('');
    }
  }
  // Pass 1, ¼ in from the raw edge: right side seam, then left. Hidden inside once the dress is turned.
  if (s.st1 > 0 && s.turn < 0.5) {
    PLAN.pass1.forEach((pl, i) => {
      const t = clamp(s.st1 - i);
      if (t <= 0) return;
      const part = partial(pl, t), cur = step === 2;
      body += `<polyline points="${pts(part)}" fill="none" stroke="${stitchColor(cur)}" stroke-width="${cur ? 2 : 1.4}" stroke-dasharray="${cur ? '5 3' : '3 3'}"/>`;
      if (cur && t < 1) body += `<circle cx="${f(tip(part)[0])}" cy="${f(tip(part)[1])}" r="3.4" fill="${C.stitch}"/>`;
    });
  }
  // Trim: the scissors follow each side edge; the trim line is left behind them.
  if (s.trimPlan > 0 && step === 3) {
    PLAN.edges.forEach((pl, i) => {
      const t = clamp(s.trimPlan - i);
      if (t <= 0) return;
      const part = partial(offsetLine(pl, (i ? -1 : 1) * 0.125 * PK), t);
      body += `<polyline points="${pts(part)}" fill="none" stroke="${C.trim}" stroke-width="1.4" stroke-dasharray="7 3 2 3"/>`;
      if (t < 1) body += scissors(tip(part)[0] + (i ? -9 : 9), tip(part)[1], i ? -90 : 90, 15);
    });
  }
  if (s.snip > 0 && s.turn < 0.5) {
    body += PLAN.underarms.map(([x, y], i) => {
      const d = i ? -1 : 1;
      return line([x - d * 5, y - 7], [x + d * 6, y + 4], { color: C.trim, w: 1.6, dash: '4 2', opacity: s.snip }) +
        (s.snip < 1 ? scissors(x + d * 14, y - 6, d * 45, 14) : '');
    }).join('');
  }
  // Pass 2 lands ½ in from the original edge: ¼ in used by pass 1 plus ¼ in from the new fold.
  if (s.st2 > 0) {
    PLAN.pass2.forEach((pl, i) => {
      const t = clamp(s.st2 - i);
      if (t <= 0) return;
      const part = partial(pl, t), cur = step === 6;
      body += `<polyline points="${pts(part)}" fill="none" stroke="${stitchColor(cur)}" stroke-width="${cur ? 2 : 1.4}" stroke-dasharray="${cur ? '5 3' : '3 3'}"/>`;
      if (cur && t < 1) body += `<circle cx="${f(tip(part)[0])}" cy="${f(tip(part)[1])}" r="3.4" fill="${C.stitch}"/>`;
    });
  }
  if (s.press > 0 && s.press < 1) {
    const i = s.press < 0.5 ? 0 : 1, part = partial(PLAN.pass2[i], clamp(s.press * 2 - i));
    const [x, y] = tip(part);
    body += iron(x + (i ? 8 : -8), y + 6, 0.32, i ? 90 : -90);
  }
  // Where the close-up is cut.
  const [lx, ly] = PLAN.lens;
  body += `<circle cx="${f(lx)}" cy="${f(ly)}" r="13" fill="none" stroke="${C.dim}" stroke-width="1.3" stroke-dasharray="3 2"/>` +
    text(lx + 2, ly + 28, 'close-up', { size: 10.5, anchor: 'middle', color: C.note });
  body += text(POX, PH - 8, s.turn >= 0.5 ? 'wrong side out' : s.frontIn >= 1 ? 'front over back' : s.backFlip >= 0.5 ? 'back, wrong side up' : 'back, right side up',
    { size: 11, anchor: 'middle', color: C.note });
  return `<svg viewBox="0 0 ${PW} ${PH}" role="img" aria-label="The whole dress, front and back pieces"><title>The whole dress</title>${body}</svg>`;
}

/* ============================================================
   SECTION VIEW: a cut across the side seam, magnified
   Each layer is a body strip, a bend of radius RHO and the seam allowance ("stub").
   Q is the seam point (the pass-1 stitch). Front: body fixed, bend `beta` grows 0 -> 180,
   so its allowance swings up and lies back over the body. Back: its body swings a full turn
   around Q (under, out flat, over the top) while its allowance turns with the front's.
   ============================================================ */

const SW = 460, SH = 300, PX = 200;        // px per inch in the close-up
const T = 10, RHO = T * 0.55, LB = 300;    // drawn thickness, bend radius, visible body length
const SX = 292, YF = 176;                  // pass-1 stitch position and the front layer's height

// Strip path from body end, through the bend, to the allowance tip. h = body heading (degrees,
// y up), beta = bend (positive turns left), a = allowance length. Positioned so the bend ends at Q.
function layerPath(Q, h, beta, a) {
  const out = [], B = [0, 0];
  out.push(add(B, u(h), -LB), add(B, u(h), -LB * 0.5), B);
  let q = B;
  if (Math.abs(beta) > 0.5) {
    const s = Math.sign(beta), c = add(B, u(h + 90 * s), RHO), n = Math.max(4, Math.ceil(Math.abs(beta) / 12));
    for (let i = 1; i <= n; i++) out.push(q = add(c, u(h + beta * i / n - 90 * s), RHO));
  }
  out.push(add(q, u(h + beta), a * 0.5), add(q, u(h + beta), a));
  const d = [Q[0] - q[0], Q[1] - q[1]];
  return { pts: out.map(p => [p[0] + d[0], p[1] + d[1]]), body: add(Q, u(h), 0) };
}
function rotateAbout(list, c, deg) {
  const a = rad(deg), cs = Math.cos(a), sn = Math.sin(a);
  return list.map(([x, y]) => [c[0] + (x - c[0]) * cs + (y - c[1]) * sn, c[1] - (x - c[0]) * sn + (y - c[1]) * cs]);
}
// rs = +1: the right side faces the left-hand normal of the path direction (up when travelling right).
function strip(list, rs, o = {}) {
  const h = (o.t || T) / 2;
  const normals = list.map((p, i) => {
    const a = list[Math.max(i - 1, 0)], b = list[Math.min(i + 1, list.length - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return [dy / L, -dx / L];
  });
  const off = s => list.map((p, i) => [p[0] + normals[i][0] * h * s, p[1] + normals[i][1] * h * s]);
  const left = off(1), right = off(-1);
  const rsEdge = rs > 0 ? left : right, wsEdge = rs > 0 ? right : left;
  const poly = (a, b, fill) => `<polygon points="${pts([...a, ...b.slice().reverse()])}" fill="${fill}"/>`;
  return `<g ${o.opacity != null ? `opacity="${f(o.opacity)}"` : ''} ${o.transform ? `transform="${o.transform}"` : ''}>` +
    poly(rsEdge, list, C.rs) + poly(list, wsEdge, C.ws) +
    `<polygon points="${pts([...left, ...right.slice().reverse()])}" fill="none" stroke="${C.edge}" stroke-width="1" stroke-linejoin="round"/></g>`;
}

function section(s, step) {
  const th = s.fold;                                  // 0 stacked, 0.5 opened out, 1 right sides together
  const a = s.trim >= 0.5 ? 0.125 * PX : 0.25 * PX;   // allowance beyond the pass-1 stitch
  // Keep the front body still: its bend starts at (SX, YF), so Q follows the bend.
  const Bf = [SX, YF], Qf = (() => {
    const beta = 180 * th;
    if (beta < 0.5) return Bf;
    return add(add(Bf, u(90), RHO), u(beta - 90), RHO);
  })();
  const F = layerPath(Qf, 0, 180 * th, a);
  const delta = 270 + 180 * th;                       // where the back's seam point sits relative to the front's
  const Qb = add(Qf, u(delta), T);
  let Bk = layerPath(Qb, 360 * th, -180 * th, a);

  let layers = '';
  // Action 1: the back turns over, wrong side up. It is drawn as the stacked back rotated in the plane.
  if (s.backFlip < 1) {
    const mid = [Qb[0] - (LB - a) / 2, Qb[1]], lift = 46 * Math.sin(Math.PI * s.backFlip);
    const turned = rotateAbout(Bk.pts, mid, (1 - ease(s.backFlip)) * 180).map(([x, y]) => [x, y - lift]);
    layers += strip(turned, -1);
  } else layers += strip(Bk.pts, -1);
  if (s.frontIn > 0) {
    const m = 1 - s.frontIn, moved = rotateAbout(F.pts, [SX - 120, YF], -6 * m).map(([x, y]) => [x - 40 * m, y - 210 * m]);
    layers += strip(moved, 1);
  }
  // Action 4: the trimmed-off ⅛ in of both layers falls away.
  let falling = '';
  if (s.trim > 0.5 && s.trim < 1) {
    const p = (s.trim - 0.5) / 0.5, dx = 30 * p, dy = 150 * p * p;
    [[Qf, 1], [add(Qf, [0, T]), -1]].forEach(([q, rs]) => {
      const piece = [[q[0] + 0.125 * PX + 2, q[1]], [q[0] + 0.25 * PX, q[1]]];
      falling += strip(rotateAbout(piece, piece[0], -35 * p).map(([x, y]) => [x + dx, y + dy]), rs, { opacity: 1 - p });
    });
  }

  // Pass-1 stitch: a thread through both layers at Q, travelling with the seam as it folds.
  let threads = '';
  const showPass1 = s.st1Sec > 0 && s.frontIn >= 1;
  if (showPass1) {
    const dirIn = u(delta);
    threads += line(add(Qf, dirIn, -T / 2 - 3), add(Qb, dirIn, T / 2 + 3), { color: stitchColor(step === 2), w: 2.4, dash: step === 2 ? null : '3 2' });
  }
  // Pass 2: ¼ in from the fold, through all four layers.
  const foldX = Math.max(...F.pts.map(p => p[0])) + T / 2;
  const x2 = foldX - 0.25 * PX;
  const top = YF - 3 * T - T / 2 - 5, bottom = YF + T / 2 + 5;
  if (s.st2Sec > 0) threads += line([x2, top], [x2, bottom], { color: stitchColor(step === 6), w: 2.4, dash: step === 6 ? null : '3 2' });

  // Props and labels.
  let props = '';
  if (step === 2 && s.needle1 > 0 && s.needle1 < 1) props += needle(SX, needleTip(s.needle1, YF - T / 2, YF + T * 1.5));
  if (step === 6 && s.needle2 > 0 && s.needle2 < 1) props += needle(x2, needleTip(s.needle2, top + 5, bottom));
  if (step === 3 && s.trim > 0 && s.trim < 0.6) {
    const cx = SX + 0.125 * PX, y = YF - 60 + 110 * clamp(s.trim / 0.5);
    props += line([cx, YF - 34], [cx, YF + T + 22], { color: C.trim, w: 1.5, dash: '7 3 2 3' }) + scissors(cx + 1, y, 90, 24);
  }
  if (s.ironSec > 0 && s.ironSec < 1) {
    const p = s.ironSec, x = 40 + 330 * p, down = Math.sin(Math.PI * p) * 2;
    props += iron(x, (th >= 1 ? top + 3 : YF - T / 2 - 1) + down, 0.9);
    if (p > 0.15 && p < 0.85) props += [0, 1, 2].map(i => `<circle cx="${f(x - 20 + i * 14)}" cy="${f(top - 52 - ((p * 400 + i * 9) % 26))}" r="${f(3 + i)}" fill="none" stroke="${C.prev}" stroke-width="1" opacity="0.5"/>`).join('');
  }

  // Dimensions once each action has settled.
  let dims = '';
  if (step === 1 && s.frontIn >= 1) dims += text(SX + 0.25 * PX + 8, YF + T / 2 + 4, 'raw edges together', { size: 11.5, color: C.note, opacity: s.notch });
  if (step === 2) dims += dimH(SX, SX + 0.25 * PX, YF - 34, '¼ in', seg(s.needle1, 0.75, 1));
  if (step === 3) dims += dimH(SX, SX + 0.125 * PX, YF - 34, '⅛ in', seg(s.trim, 0.8, 1));
  if (step === 4) dims += text(SX - 16, YF - 44, 'allowance on the right side', { size: 11.5, color: C.note, anchor: 'end', opacity: seg(s.fold, 0.4, 0.5) });
  if (step === 5 && th >= 1) dims += text(foldX + 10, YF - T * 1.5 + 4, 'fold = pass-1 stitching', { size: 11.5, color: C.note, opacity: 1 });
  if (step === 6) dims += dimH(x2, foldX, top - 10, '¼ in', seg(s.needle2, 0.75, 1)) +
    text(foldX + 10, YF - T * 1.5 + 4, '⅛ in raw edges enclosed', { size: 11.5, color: C.note, opacity: seg(s.needle2, 0.75, 1) });
  if (step === 7) dims += text(foldX - 4, top - 22, 'press toward the back', { size: 11.5, color: C.note, anchor: 'end', opacity: seg(s.ironSec, 0.6, 1) });

  // Layer names, kept beside each body as it moves.
  const labelAt = (lay, h, side, name, rs) => {
    const p = add(add(lay.body, u(h), -210), u(side), 18);
    return text(p[0], p[1] + 4, `${name} · ${rs}`, { size: 11, color: C.note, anchor: 'middle' });
  };
  let labels = '';
  if (s.frontIn >= 1 && step !== 3) {
    labels += labelAt({ body: Bf }, 0, th < 0.5 ? 90 : 270, 'front', th <= 0.5 ? 'right side up' : 'right side in');
    if (th === 0 || th >= 1) labels += labelAt({ body: Qb }, 360 * th, th < 0.5 ? 270 : 90, 'back', th < 0.5 ? 'wrong side up' : 'right side in');
  } else if (s.frontIn === 0) labels += text(SX - 150, YF + 32, s.backFlip < 0.5 ? 'back · right side up' : 'back · wrong side up', { size: 11, color: C.note, anchor: 'middle', opacity: Math.abs(1 - 2 * s.backFlip) });

  const defs = `<defs>
    <marker id="sa-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.dim}"/></marker>
    <radialGradient id="sa-fade" cx="${SX}" cy="${YF - 10}" r="300" gradientUnits="userSpaceOnUse">
      <stop offset="0.62" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
    <mask id="sa-mask"><rect width="${SW}" height="${SH}" fill="url(#sa-fade)"/></mask></defs>`;
  return `<svg viewBox="0 0 ${SW} ${SH}" role="img" aria-label="Close-up cut across the side seam"><title>Close-up through the side seam</title>${defs}
    <rect width="${SW}" height="${SH}" fill="${C.bg}"/>
    <g mask="url(#sa-mask)">${layers}${falling}</g>${threads}${props}${labels}${dims}</svg>`;
}
// The needle goes down through the layers three times over the action.
function needleTip(p, above, below) {
  const cyc = (p * 3) % 1, d = 0.5 - 0.5 * Math.cos(2 * Math.PI * cyc);
  return above - 46 + (below - above + 46) * d;
}

/* ============================================================
   FRENCH SEAM, SIDE SEAMS (step 5 of the dress guide)
   ============================================================ */

const START = { backFlip: 0, frontIn: 0, notch: 0, st1: 0, st1Sec: 0, needle1: 0, trim: 0, trimPlan: 0, snip: 0,
  fold: 0, turn: 0, st2: 0, st2Sec: 0, needle2: 0, press: 0, ironSec: 0 };

const FRENCH_SIDE = {
  title: 'French seam: side seams',
  actions: [
    { text: 'Lay the back flat, wrong side up.', dur: 2800,
      apply(s, p) { s.backFlip = ease(p); } },
    { text: 'Place the front on top, right side up, so the wrong sides are together. Match the faced armhole edges exactly at the underarm, then the waist, hip and lower notches.', dur: 4200,
      apply(s, p) { s.frontIn = ease(seg(p, 0, 0.62)); s.notch = seg(p, 0.62, 1); } },
    { text: 'Pass 1: stitch ¼ in from the edge, down both side seams.', dur: 5200,
      apply(s, p) { s.st1 = 2 * p; s.needle1 = p; s.st1Sec = seg(p, 0.12, 0.2); } },
    { text: 'Trim the allowance to ⅛ in. Trim the bias strip ends at an angle to reduce bulk at the underarm.', dur: 4400,
      apply(s, p) { s.trim = p; s.trimPlan = 2 * seg(p, 0, 0.82); s.snip = seg(p, 0.82, 1); } },
    { text: 'Open the pieces out. The trimmed allowance stands on the right side of the fabric.', dur: 3200,
      apply(s, p) { s.fold = 0.5 * ease(p); } },
    { text: 'Fold right sides together along the seam, so the first stitching sits right on the fold, and press.', dur: 4600,
      apply(s, p) { s.fold = 0.5 + 0.5 * ease(seg(p, 0, 0.7)); s.turn = ease(seg(p, 0, 0.7)); s.ironSec = seg(p, 0.72, 1); } },
    { text: 'Pass 2: stitch ¼ in from the fold, enclosing all raw edges and the strip ends.', dur: 5200,
      apply(s, p) { s.ironSec = 0; s.st2 = 2 * p; s.needle2 = p; s.st2Sec = seg(p, 0.12, 0.2); } },
    { text: 'Press the finished seams toward the back.', dur: 3600,
      apply(s, p) { s.press = p; s.ironSec = p; } }
  ]
};
// Earlier actions' props (needle, scissors, iron) are finished, not frozen mid-way.
FRENCH_SIDE.actions.forEach(a => {
  const apply = a.apply;
  a.apply = (s, p) => { apply(s, p); if (p >= 1) { s.needle1 = s.needle1 && 1; s.needle2 = s.needle2 && 1; } };
});

/* ============================================================
   CUT, MARK AND STAYSTITCH (step 1 of the dress guide)
   One view: the cutting table, at the reference size, in the same layout as the static
   cutting figure: 53 in wide fabric, the top 45 in folded selvages-to-centre for the front
   and back, the last 18 in left single for the two bias strips.
   ============================================================ */

// Section lengths come from the same layout as the fabric estimate (js/lib/fabric.js), at the reference size.
const LAYOUT = PATTERNS.find(p => p.id === 'aline-silk-dress').fabricLayout;
const EST = fabricEstimate({ fabricLayout: LAYOUT }, null, null);
const K = 6, CW = 420;                               // px per inch on the table, view width
const FX = 51, FY = 30, FW = LAYOUT.widthIn * K;     // fabric left edge, top, full width
const TOP_H = (LAYOUT.endsIn + EST.piecesIn + LAYOUT.gapIn / 2) * K, BOT_H = (LAYOUT.gapIn / 2 + EST.biasIn + LAYOUT.endsIn) * K, BOT_Y = FY + TOP_H;
const CH = Math.ceil(BOT_Y + BOT_H + 14);
const FLAP = LAYOUT.widthIn / 4 * K, XA = FX + FLAP, XB = FX + FW - FLAP;   // the two folds
const CUT_TOP = -Math.min(...offsetLine(halfOutline('front'), 0.5).map(([, y]) => y));   // cut edge above the neck point
const PY = FY + (LAYOUT.endsIn + CUT_TOP) * K;       // neck-point level of the pieces on the table
const TARGET = { front: 124, back: 296 };            // centre folds once the pieces are opened out
const FABRIC = '#efe9df', UNDER = '#e0d3bf', PAPER = '#fffdf7', CHALK = '#f39b5b';

// Half pieces in inches (x from the fold, y down from the neck point). Cut line = stitching line + ½ in.
const CUT = (() => {
  const make = name => {
    const c = offsetLine(halfOutline(name), 0.5);
    c[0] = [0, c[0][1]]; c[c.length - 1] = [0, c[c.length - 1][1]];
    return c;
  };
  return { front: make('front'), back: make('back') };
})();
const place = (list, fx, fy, sx = 1) => list.map(([x, y]) => [fx + sx * x * K, fy + y * K]);
const mirror = list => list.map(([x, y]) => [-x, y]);
// Staystitching ⅜ in from the cut edge = ⅛ in outside the stitching line.
const STAY = (() => {
  const out = {};
  for (const name of ['front', 'back']) {
    const o = ALINE_OUTLINE[name];
    const neck = offsetLine(o.neckline, 0.125), arm = offsetLine(o.armhole, 0.125);
    out[name] = [[...mirror(neck).reverse(), ...neck], arm, mirror(arm)];
  }
  return out;
})();
const MARKS = (() => {
  const list = [];
  for (const name of ['front', 'back']) {
    const n = ALINE_OUTLINE[name].notches;
    for (const sgn of [1, -1]) for (const [x, y] of [...n.side, ...n.armhole]) list.push({ name, x: sgn * x, y, sgn });
  }
  return list;
})();

function polygon(list, fill, o = {}) {
  return `<polygon points="${pts(list)}" fill="${fill}" stroke="${o.stroke || C.edge}" stroke-width="${o.w || 1.2}" stroke-linejoin="round"
    ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} ${o.opacity != null ? `opacity="${f(o.opacity)}"` : ''}/>`;
}
const rect = (x, y, w, h, fill, o = {}) => polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, o);
const vtext = (x, y, s, rot, o = {}) => `<g transform="rotate(${rot} ${f(x)} ${f(y)})">${text(x, y, s, { anchor: 'middle', ...o })}</g>`;
const angleOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;

// A strip folding in half lengthwise, seen end-on (for the bias-strip close-up).
function foldingStrip(x0, y, half, beta, rs) {
  const r = 3.2, B = [x0 + half, y], out = [[x0, y], B];
  let q = B;
  if (beta > 0.5) {
    const c = add(B, u(90), r), n = Math.max(4, Math.ceil(beta / 12));
    for (let i = 1; i <= n; i++) out.push(q = add(c, u(beta * i / n - 90), r));
  }
  out.push(add(q, u(beta), half));
  return strip(out, rs, { t: 5 });
}

function cuttingTable(s, step) {
  let body = `<rect width="${CW}" height="${CH}" fill="${C.bg}"/>`;
  const rem = 1 - s.lift;                             // remnants fade once the pieces are lifted off

  // Fabric: the centre of the folded part, the two flaps, and the single-layer end.
  const c = Math.cos(Math.PI * s.fold), flapW = -FLAP * c, flapFill = c >= 0 ? FABRIC : UNDER;
  const flap = (fx, dir) => {
    const w = flapW * dir, x = w < 0 ? fx + w : fx;
    const shadow = s.fold > 0 && s.fold < 1 ? rect(x + 4, FY + 6, Math.abs(w), TOP_H, C.dim, { stroke: 'none', opacity: 0.1 * Math.sin(Math.PI * s.fold) }) : '';
    return shadow + rect(x, FY, Math.max(Math.abs(w), 0.5), TOP_H, flapFill);
  };
  body += `<g opacity="${f(rem)}">` + rect(XA, FY, XB - XA, TOP_H, FABRIC) + flap(XA, 1) + flap(XB, -1) + '</g>';
  body += `<g opacity="${f(1 - 0.85 * s.lift)}">` + rect(FX, BOT_Y, FW, BOT_H, FABRIC) + '</g>';
  if (s.fold < 0.5) {
    body += vtext(FX - 9, FY + TOP_H / 2, 'selvage', -90, { size: 10.5, color: C.note, opacity: 1 - 2 * s.fold }) +
      vtext(FX + FW + 9, FY + TOP_H / 2, 'selvage', 90, { size: 10.5, color: C.note, opacity: 1 - 2 * s.fold });
  } else if (rem > 0) {
    const o = Math.min(1, (s.fold - 0.5) * 4) * rem;
    body += vtext(XA - 9, FY + TOP_H / 2, 'FOLD', -90, { size: 10.5, bold: true, opacity: o }) +
      vtext(XB + 9, FY + TOP_H / 2, 'FOLD', 90, { size: 10.5, bold: true, opacity: o }) +
      line([(XA + XB) / 2, FY + 4], [(XA + XB) / 2, FY + TOP_H - 4], { color: C.note, w: 0.8, dash: '4 3', opacity: o }) +
      text((XA + XB) / 2, FY - 7, 'selvages meet', { size: 10, anchor: 'middle', color: C.note, opacity: o });
  }

  // Pieces. On the table: front on the left fold, back (mirrored) on the right fold.
  // Lifted off, they travel to the middle and open out about their folds.
  const pieceAt = (name, sxStatic) => {
    const home = name === 'front' ? XA : XB, fx = home + (TARGET[name] - home) * s.move;
    const rise = 6 * Math.sin(Math.PI * s.move);
    const halfStatic = place(CUT[name], fx, PY - rise, sxStatic);
    let g = '';
    if (s.cut >= 1) {
      if (rise > 0.2) g += polygon(halfStatic.map(([x, y]) => [x + 4, y + 7]), C.dim, { stroke: 'none', opacity: 0.12 });
      g += polygon(halfStatic, FABRIC, { w: 1.4 });
      if (s.unfold > 0) {
        const sx = sxStatic * Math.cos(Math.PI * s.unfold), open = place(CUT[name], fx, PY - rise, sx);
        g += polygon(open, s.unfold < 0.5 ? UNDER : FABRIC, { w: 1.4 });
      }
    }
    return { g, fx: fx, fy: PY - rise };
  };
  const F = pieceAt('front', 1), Bk = pieceAt('back', -1);
  body += F.g + Bk.g;

  // Pattern paper slides on, the scissors follow its edge, then it lifts away.
  const paper = (name, sx, fx, p, cutP) => {
    if (p <= 0 || s.lift >= 1) return '';
    const m = 1 - p, dx = -sx * 60 * m, dy = -150 * m, rot = sx * -8 * m, op = 1 - s.lift;
    const outline = place(CUT[name], fx, PY, sx), stitchLine = place(halfOutline(name), fx, PY, sx);
    let g = `<g transform="translate(${f(dx)} ${f(dy - 20 * s.lift)}) rotate(${f(rot)} ${f(fx)} ${f(PY + 20 * K)})" opacity="${f(op)}">` +
      polygon(outline, PAPER, { stroke: '#9aa7b4', w: 1 }) +
      `<polyline points="${pts(stitchLine)}" fill="none" stroke="${C.prev}" stroke-width="0.8" stroke-dasharray="3 3"/>` +
      text(fx + sx * 4.6 * K, PY + 22 * K, name.toUpperCase(), { size: 11, bold: true, anchor: 'middle' }) +
      text(fx + sx * 4.6 * K, PY + 22 * K + 14, 'cut 1 on fold', { size: 9.5, anchor: 'middle', color: C.note }) + '</g>';
    if (cutP > 0) {
      const part = partial(outline, cutP);
      g += `<polyline points="${pts(part)}" fill="none" stroke="${C.edge}" stroke-width="1.6" opacity="${f(op)}"/>`;
      if (cutP < 1) {
        const a = part[part.length - 2] || part[0], b = tip(part);
        g += scissors(b[0], b[1], angleOf(a, b), 18);
      }
    }
    return g;
  };
  if (s.cut < 1 || s.lift < 1) {
    body += paper('front', 1, XA, s.paperF, s.cut >= 1 ? 1 : clamp(s.cutF)) + paper('back', -1, XB, s.paperB, s.cut >= 1 ? 1 : clamp(s.cutB));
  }

  // Bias strips: 1¾ × 22 in at 45°, cut along both long edges, then folded in half and pressed.
  const sy = BOT_Y + (LAYOUT.gapIn / 2 + EST.biasIn / 2) * K;
  const STRIPS = [[FX + 14 * K, sy], [FX + 32 * K, sy]];
  const L = 11 * K, w = 0.875 * K;
  STRIPS.forEach(([cx, cy], i) => {
    const cutP = clamp(s.bias * 2 - i);
    if (cutP <= 0) return;
    let g = '';
    const folded = s.biasFold;
    // Lying strip; when folding, the far half swings over the near half about the centre line.
    if (cutP >= 1) {
      if (folded <= 0) g += rect(-L, -w, 2 * L, 2 * w, FABRIC);
      else {
        const cf = Math.cos(Math.PI * folded), h = -w * cf;
        g += rect(-L, 0, 2 * L, w, FABRIC) + rect(-L, Math.min(0, h), 2 * L, Math.max(Math.abs(h), 0.4), cf >= 0 ? FABRIC : UNDER);
      }
    }
    // Cut lines along the long edges, with the scissors.
    if (cutP < 1 || step === 2) {
      const e1 = partial([[-L, -w], [L, -w]], Math.min(1, cutP * 2)), e2 = partial([[L, w], [-L, w]], clamp(cutP * 2 - 1));
      g += `<polyline points="${pts(e1)}" fill="none" stroke="${C.trim}" stroke-width="1.4" stroke-dasharray="6 3 2 3" opacity="${f(1 - folded)}"/>`;
      if (cutP > 0.5) g += `<polyline points="${pts(e2)}" fill="none" stroke="${C.trim}" stroke-width="1.4" stroke-dasharray="6 3 2 3" opacity="${f(1 - folded)}"/>`;
      if (cutP < 1) { const [x, y] = cutP < 0.5 ? tip(e1) : tip(e2); g += scissors(x, y - 7, cutP < 0.5 ? 0 : 180, 14); }
    }
    body += `<g transform="translate(${f(cx)} ${f(cy)}) rotate(45)">${g}</g>`;
  });
  if (s.bias > 0) {
    body += text(FX + FW - 4, BOT_Y + BOT_H - 8, '2 bias strips · 1¾ × 22 in · 45°', { size: 10, anchor: 'end', color: C.note, opacity: Math.min(1, s.bias * 2) });
  }
  // Close-up of a strip folding in half, wrong sides together, to ⅞ in.
  if (step === 2 && s.bias >= 1) {
    const bx = FX + FW - 76, by = BOT_Y + 14, o = Math.min(1, (s.biasFold + 0.2) * 3);
    body += `<g opacity="${f(o)}"><rect x="${bx}" y="${by}" width="72" height="54" rx="8" fill="${C.bg}" stroke="${C.edge}" stroke-width="0.8"/>` +
      foldingStrip(bx + 10, by + 34, 26, 180 * ease(clamp(s.biasFold)), -1) +
      text(bx + 36, by + 13, s.biasFold >= 1 ? '⅞ in, pressed' : 'fold in half', { size: 9, anchor: 'middle', color: C.note }) + '</g>';
  }
  if (s.biasPress > 0 && s.biasPress < 1) {
    const i = s.biasPress < 0.5 ? 0 : 1, t2 = clamp(s.biasPress * 2 - i), [cx, cy] = STRIPS[i];
    const d = (t2 - 0.5) * 2 * L;
    body += iron(cx + d * Math.SQRT1_2, cy + d * Math.SQRT1_2 - 2, 0.3, 45);
  }

  // Notches, marked one by one with chalk; the neckline notches are crossed out (not used).
  const at = (name, x, y) => {
    const P = name === 'front' ? F : Bk;
    return [P.fx + x * K, P.fy + y * K];
  };
  if (s.marks > 0) {
    const shown = Math.floor(s.marks * MARKS.length + 1e-6);
    MARKS.slice(0, shown).forEach(m => {
      const [x, y] = at(m.name, m.x, m.y);
      body += line([x, y], [x + m.sgn * 7, y], { color: CHALK, w: 2.6 });
    });
    if (s.marks < 1) {
      const m = MARKS[Math.min(shown, MARKS.length - 1)], [x, y] = at(m.name, m.x, m.y), ph = (s.marks * MARKS.length) % 1;
      body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(3 + 9 * ph)}" fill="none" stroke="${CHALK}" stroke-width="1.6" opacity="${f(1 - ph)}"/>` +
        `<rect x="${f(x + m.sgn * 9 - 3)}" y="${f(y - 14)}" width="6" height="12" rx="1.5" fill="${CHALK}" transform="rotate(${m.sgn * 25} ${f(x + m.sgn * 9)} ${f(y - 8)})"/>`;
    }
  }
  if (s.marks >= 1 || s.unused > 0) {
    const o = s.unused;
    for (const name of ['front', 'back']) for (const sgn of [1, -1]) for (const [x, y] of ALINE_OUTLINE[name].notches.neckline) {
      const [px, py] = at(name, sgn * x, y);
      body += `<g opacity="${f(o)}">` + line([px - 3.5, py - 3.5], [px + 3.5, py + 3.5], { color: C.stitch, w: 1.6 }) + line([px - 3.5, py + 3.5], [px + 3.5, py - 3.5], { color: C.stitch, w: 1.6 }) + '</g>';
    }
    body += text(TARGET.back, PY - 22, '✕ neckline notches:', { size: 10, color: C.stitch, anchor: 'middle', opacity: o }) +
      text(TARGET.back, PY - 10, 'not used, don’t clip', { size: 10, color: C.stitch, anchor: 'middle', opacity: o });
  }

  // Staystitching, ⅜ in from the cut edge through a single layer: neckline, then each armhole.
  if (s.stay > 0) {
    const runs = ['front', 'back'].flatMap(name => STAY[name].map(r => r.map(([x, y]) => at(name, x, y))));
    runs.forEach((r, i) => {
      const t2 = clamp(s.stay * runs.length - i);
      if (t2 <= 0) return;
      const part = partial(r, t2), cur = step === 4;
      body += `<polyline points="${pts(part)}" fill="none" stroke="${stitchColor(cur)}" stroke-width="1.8" stroke-dasharray="4 2.5"/>`;
      if (cur && t2 < 1) body += `<circle cx="${f(tip(part)[0])}" cy="${f(tip(part)[1])}" r="3" fill="${C.stitch}"/>`;
    });
    const o = Math.min(1, s.stay * 3);
    body += text(TARGET.front, PY - 22, 'staystitch ⅜ in from the edge,', { size: 10, anchor: 'middle', color: C.stitch, opacity: o }) +
      text(TARGET.front, PY - 10, 'single layer', { size: 10, anchor: 'middle', color: C.stitch, opacity: o });
  }
  if (s.unfold >= 1) {
    body += text(TARGET.front, PY + 25 * K, 'FRONT', { size: 11, bold: true, anchor: 'middle' }) +
      text(TARGET.back, PY + 25 * K, 'BACK', { size: 11, bold: true, anchor: 'middle' });
  }
  return `<svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="Cutting table: fabric, pattern pieces and bias strips"><title>Cutting table</title>${body}</svg>`;
}

const CUT_START = { fold: 0, paperF: 0, paperB: 0, cutF: 0, cutB: 0, cut: 0, bias: 0, biasFold: 0, biasPress: 0,
  lift: 0, move: 0, unfold: 0, marks: 0, unused: 0, stay: 0 };

const CUT_MARK = {
  title: 'Cut, mark and staystitch',
  actions: [
    { text: 'Fold both selvages to the centre, so the fabric has two folds.', dur: 3600,
      apply(s, p) { s.fold = ease(p); } },
    { text: 'Front on one fold, back on the other. Cut 1 of each.', dur: 7000,
      apply(s, p) { s.paperF = ease(seg(p, 0, 0.22)); s.paperB = ease(seg(p, 0.1, 0.32)); s.cutF = seg(p, 0.36, 0.66); s.cutB = seg(p, 0.66, 0.96); s.cut = p >= 1 ? 1 : 0; } },
    { text: 'Cut 2 bias strips at 45°. Fold each in half and press.', dur: 7000,
      apply(s, p) { s.bias = seg(p, 0, 0.5); s.biasFold = ease(seg(p, 0.55, 0.78)); s.biasPress = seg(p, 0.8, 1); if (p >= 1) s.biasPress = 1; } },
    { text: 'Mark the side and armhole notches. Skip the neckline notches.', dur: 7600,
      apply(s, p) { s.lift = ease(seg(p, 0, 0.22)); s.move = ease(seg(p, 0.05, 0.3)); s.unfold = ease(seg(p, 0.3, 0.48)); s.marks = seg(p, 0.5, 0.9); s.unused = seg(p, 0.9, 1); } },
    { text: 'Staystitch the neckline and armholes, ⅜ in from the edge.', dur: 7000,
      apply(s, p) { s.stay = p; } }
  ]
};


/* ============================================================
   SHARED GEOMETRY FOR STEPS 2, 3, 4, 6, 7
   Piece outlines are rebuilt from the real stitching lines with a chosen offset per edge
   (½ in = cut edge, 0 = the pattern's stitching line), so an edge can be shown folding under
   or rolling to its finished position.
   ============================================================ */

const EDGE_PARTS = ['neckline', 'strap', 'armhole', 'side', 'hem'];
function halfWith(name, d = {}) {
  const o = ALINE_OUTLINE[name], out = [];
  EDGE_PARTS.forEach(part => {
    const off = d[part] ?? 0.5, seg2 = off ? offsetLine(o[part], off) : o[part];
    out.push(...seg2);
  });
  out[0] = [0, out[0][1]]; out[out.length - 1] = [0, out[out.length - 1][1]];
  return out;
}
const fullWith = (name, d) => { const h = halfWith(name, d); return [...h, ...mirror(h).reverse()]; };
const offsetPart = (name, part, d) => d ? offsetLine(ALINE_OUTLINE[name][part], d) : ALINE_OUTLINE[name][part];
function extendLine(list, e) {
  const a = list[0], b = list[1], y = list[list.length - 2], z = list[list.length - 1];
  const da = Math.hypot(b[0] - a[0], b[1] - a[1]), dz = Math.hypot(z[0] - y[0], z[1] - y[1]);
  return [[a[0] - (b[0] - a[0]) / da * e, a[1] - (b[1] - a[1]) / da * e], ...list, [z[0] + (z[0] - y[0]) / dz * e, z[1] + (z[1] - y[1]) / dz * e]];
}
// Turning a piece over about a vertical axis at cx (same idea as flatPiece, any position).
function turnPiece(list, turn, cx, o = {}) {
  const c = Math.cos(Math.PI * clamp(turn)), sx = Math.max(Math.abs(c), 0.02);
  const fill = o.fill || (c >= 0 ? C.rs : C.ws), lift = Math.sin(Math.PI * clamp(turn));
  const shadow = lift > 0.01 ? polygon(list.map(([x, y]) => [x + 5 * lift, y + 8 * lift]), C.dim, { stroke: 'none', opacity: 0.1 * lift }) : '';
  return `<g transform="translate(${f(o.dx || 0)} ${f(o.dy || 0)})"><g transform="translate(${f(cx)} 0) scale(${f(sx)} 1) translate(${f(-cx)} 0)">${shadow}${polygon(list, fill, { w: 1.3 })}</g></g>`;
}
const runLine = (list, t, cur, o = {}) => {
  if (t <= 0) return '';
  const part = partial(list, t);
  let g = `<polyline points="${pts(part)}" fill="none" stroke="${o.color || stitchColor(cur)}" stroke-width="${o.w || (cur ? 2 : 1.4)}" stroke-dasharray="${o.dash || (cur ? '5 3' : '3 3')}" stroke-linecap="round"/>`;
  if (cur && t < 1 && !o.noDot) g += `<circle cx="${f(tip(part)[0])}" cy="${f(tip(part)[1])}" r="${o.r || 3.4}" fill="${o.color || C.stitch}"/>`;
  return g;
};
const lens = (x, y, label = 'close-up') => `<circle cx="${f(x)}" cy="${f(y)}" r="13" fill="none" stroke="${C.dim}" stroke-width="1.3" stroke-dasharray="3 2"/>` +
  text(x, y + 27, label, { size: 10.5, anchor: 'middle', color: C.note });
const caption = (x, y, s, o = {}) => text(x, y, s, { size: 11, anchor: 'middle', color: C.note, ...o });
// Run along several polylines one after another (t from 0 to runs.length).
const runs = (lists, t, cur, o) => lists.map((l, i) => runLine(l, clamp(t - i), cur, o)).join('');
const toolAt = (lists, t) => { const i = Math.min(Math.floor(t), lists.length - 1); return tip(partial(lists[i], clamp(t - i))); };

/* ============================================================
   STEP 2: SHOULDER STRAPS, FRENCH SEAMS
   Upper dress, front over back, strap tops matched. The close-up is the French seam
   cross-section from step 5, cut across a strap.
   ============================================================ */

const SHK = 20, SHX = 200, SHY = 46, SHW = 400, SHH = 250;
const SHOULDER = (() => {
  const P = l => place(l, SHX, SHY);
  const both = l => [P(l), P(mirror(l))];
  const strap = ALINE_OUTLINE.front.strap, along = d => extendLine(d ? offsetLine(strap, d) : strap, 0.55);
  return {
    front: P(fullWith('front')), back: P(fullWith('back')),
    pass1: both(along(0.25)), trim: both(along(0.375)), pass2: both(along(0)),
    corners: [strap[0], strap[1]].flatMap(([x, y]) => [P([[x, y - 0.5]])[0], P([[-x, y - 0.5]])[0]]),
    lens: P([[6.35, 0.1]])[0]
  };
})();
const placeK = (list, ox, oy, k) => list.map(([x, y]) => [ox + x * k, oy + y * k]);
function shoulderPlan(s, step) {
  const Sx = SHOULDER;
  let body = `<rect width="${SHW}" height="${SHH}" fill="${C.bg}"/>`;
  body += turnPiece(Sx.back, s.backFlip, SHX);
  if (s.frontIn > 0) {
    const m = 1 - s.frontIn;
    body += turnPiece(Sx.front, s.turn, SHX, { dy: -260 * m });
  }
  if (s.frontIn >= 1 && s.turn < 0.5 && s.notch > 0 && s.notch < 1) {
    const ph = (s.notch * 2.5) % 1;
    body += Sx.corners.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(3 + 11 * ph)}" fill="none" stroke="${C.accent}" stroke-width="2" opacity="${f(1 - ph)}"/>`).join('');
  }
  if (s.st1 > 0 && s.turn < 0.5) body += runs(Sx.pass1, s.st1, step === 2);
  if (step === 3 && s.trimPlan > 0) {
    body += runs(Sx.trim, s.trimPlan, false, { color: C.trim, dash: '7 3 2 3', w: 1.4, noDot: true });
    if (s.trimPlan < 2) { const [x, y] = toolAt(Sx.trim, s.trimPlan); body += scissors(x, y - 10, 0, 16); }
  }
  if (s.st2 > 0) body += runs(Sx.pass2, s.st2, step === 6);
  if (s.press > 0 && s.press < 1) { const [x, y] = toolAt(Sx.pass2, s.press * 2); body += iron(x, y - 4, 0.4); }
  body += lens(Sx.lens[0], Sx.lens[1]) +
    caption(SHX, SHH - 10, s.turn >= 0.5 ? 'wrong side out' : s.frontIn >= 1 ? 'front over back, strap tops matched' : s.backFlip >= 0.5 ? 'back, wrong side up' : 'back, right side up');
  return `<svg viewBox="0 0 ${SHW} ${SHH}" role="img" aria-label="The upper dress and both shoulder straps"><title>Shoulder straps</title>${body}</svg>`;
}

/* ============================================================
   BABY HEM CROSS-SECTION (steps 3 and 6)
   One fabric layer, right side up, raw edge on the right. The edge is pressed under along the
   ⅜ in stitching, the folded allowance is trimmed to ⅛ in, then the edge is rolled under once
   more by ⅛ in, so the fold lands on the pattern's stitching line, and stitched through all layers.
   ============================================================ */

const BW = 460, BH = 270, BY = 140, BE = 400;          // view, layer height, raw edge x
// Fabric strip made of straight segments and bends (degrees, negative = turn under).
function chain(start, segs) {
  let p = start, h = 0;
  const out = [start], marks = [];
  for (const sg of segs) {
    if (sg.len != null) { p = add(p, u(h), sg.len); out.push(p); marks.push(p); continue; }
    if (Math.abs(sg.bend) < 0.5) continue;
    const s2 = Math.sign(sg.bend), c = add(p, u(h + 90 * s2), sg.r), n = Math.max(4, Math.ceil(Math.abs(sg.bend) / 12));
    for (let i = 1; i <= n; i++) out.push(p = add(c, u(h + sg.bend * i / n - 90 * s2), sg.r));
    h += sg.bend;
  }
  return { pts: out, marks, heading: h };
}
function babySection(s, step, o) {
  const fold1 = -180 * s.bhFold, roll = -180 * s.bhRoll;
  const flap = (s.bhTrim >= 0.5 ? 0.125 : 0.375) * PX;
  const start = [BE - 0.5 * PX - 360, BY];
  const geo = chain(start, [{ len: 360 }, { bend: roll, r: T * 1.05 }, { len: 0.125 * PX }, { bend: fold1, r: T * 0.55 }, { len: flap }]);
  let body = `<rect width="${BW}" height="${BH}" fill="${C.bg}"/>`;
  const defs = `<defs><marker id="sa-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.dim}"/></marker>
    <linearGradient id="bh-fade" x1="0" x2="1"><stop offset="0" stop-color="#000"/><stop offset="0.22" stop-color="#fff"/></linearGradient>
    <mask id="bh-mask"><rect width="${BW}" height="${BH}" fill="url(#bh-fade)"/></mask></defs>`;
  body += `<g mask="url(#bh-mask)">${strip(geo.pts, 1)}</g>`;
  // The trimmed-off ¼ in falls away from under the fold.
  if (s.bhTrim > 0.5 && s.bhTrim < 1) {
    const p = (s.bhTrim - 0.5) / 0.5, y = BY + 2 * T * 0.55;
    const xs = BE - 0.375 * PX, lost = [[xs - 0.125 * PX - 2, y], [xs - 0.375 * PX, y]];
    body += strip(lost.map(([x, yy]) => [x - 20 * p, yy + 130 * p * p]), -1, { opacity: 1 - p });
  }
  // The ⅜ in stitching: sewn now (step 6) or already there from step 1 (step 3).
  const stay = geo.marks[1] || [BE - 0.375 * PX, BY];
  const stayAt = s.bhFold > 0 ? [stay[0], stay[1] + T * 0.55] : [BE - 0.375 * PX, BY];
  if (s.bhStay > 0.15) {
    const cur = step === o.stayStep, half = s.bhFold > 0 ? T * 1.6 : T / 2 + 4;
    body += line([stayAt[0], stayAt[1] - half], [stayAt[0], stayAt[1] + half], { color: stitchColor(cur), w: 2.4, dash: cur ? null : '3 2' });
  }
  if (step === o.stayStep && s.bhStay > 0 && s.bhStay < 1) body += needle(BE - 0.375 * PX, needleTip(s.bhStay, BY - T / 2, BY + T));
  // Final stitching, just inside the inner fold of the roll, through all layers.
  const rollX = Math.max(...geo.pts.map(p => p[0])) + T / 2, sx = rollX - 0.1 * PX - T / 2;
  if (s.bhNeedle > 0) {
    const top = BY - T / 2 - 4, bottom = BY + 3.2 * T * 1.05 + 4;
    if (s.bhNeedle > 0.15) body += line([sx, top], [sx, bottom], { color: stitchColor(step === o.rollStep), w: 2.4, dash: step === o.rollStep ? null : '3 2' });
    if (s.bhNeedle < 1) body += needle(sx, needleTip(s.bhNeedle, top + 4, bottom));
  }
  // Tools.
  if (s.bhPress > 0 && s.bhPress < 1) body += iron(60 + 300 * s.bhPress, BY - T / 2 - 1 + Math.sin(Math.PI * s.bhPress) * 2, 0.85);
  if (step === o.trimStep && s.bhTrim > 0 && s.bhTrim < 0.6) {
    const cx = BE - 0.375 * PX - 0.125 * PX;
    body += line([cx, BY - 26], [cx, BY + 3 * T + 18], { color: C.trim, w: 1.5, dash: '7 3 2 3' }) + scissors(cx, BY + 70 - 90 * clamp(s.bhTrim / 0.5), -90, 24);
  }
  // Measurements once each action settles.
  if (step === o.stayStep || (o.stayStep < 0 && s.bhFold === 0)) body += dimH(BE - 0.375 * PX, BE, BY - 34, '⅜ in', step === o.stayStep ? seg(s.bhStay, 0.75, 1) : 1);
  if (step === o.foldStep) body += text(BE - 0.375 * PX, BY + 3 * T + 30, 'pressed under along the stitching', { size: 11.5, anchor: 'end', color: C.note, opacity: seg(s.bhFold, 0.8, 1) });
  if (step === o.trimStep) body += dimH(BE - 0.5 * PX, BE - 0.375 * PX, BY + 3 * T + 36, '⅛ in', seg(s.bhTrim, 0.8, 1));
  if (step === o.rollStep) body += dimH(rollX - 0.125 * PX - T / 2, rollX, BY - 34, '⅛ in', seg(s.bhNeedle, 0.75, 1)) +
    text(rollX, BY + 4 * T + 30, 'finished edge on the stitching line', { size: 11.5, color: C.note, opacity: seg(s.bhNeedle, 0.75, 1), anchor: 'end' });
  body += text(70, BY + 34, o.label, { size: 11, color: C.note });
  return `<svg viewBox="0 0 ${BW} ${BH}" role="img" aria-label="Close-up of the baby hem"><title>Baby hem close-up</title>${defs}${body}</svg>`;
}

/* ---------- step 3: V point close-up ---------- */
const VK = 70, VW = 460, VH = 270, VX = 230, VY = 18 - 7.6 * VK;   // front V point at the middle
function vClose(s, step) {
  const o = ALINE_OUTLINE.front;
  const at = l => l.map(([x, y]) => [VX + x * VK, VY + y * VK]);
  const both = l => [...mirror(l).reverse(), ...l];
  const hemmed = s.vHemmed;                        // after the roll the edge sits on the stitching line
  const neckEdge = both(hemmed ? o.neckline : offsetLine(o.neckline, 0.5));
  const shape = at([...neckEdge, [9, 13], [-9, 13]]);
  let body = `<rect width="${VW}" height="${VH}" fill="${C.bg}"/>` + polygon(shape, C.rs, { w: 1.4 });
  if (!hemmed) {
    body += `<polyline points="${pts(at(both(offsetLine(o.neckline, 0.125))))}" fill="none" stroke="${C.prev}" stroke-width="1.6" stroke-dasharray="4 3"/>` +
      `<polyline points="${pts(at(both(o.neckline)))}" fill="none" stroke="${C.prev}" stroke-width="0.8" stroke-dasharray="1 3"/>`;
    // The clip: straight into the allowance at the point, stopping at the staystitching.
    const top = at([offsetLine(o.neckline, 0.5)[0]])[0], stop = at([offsetLine(o.neckline, 0.125)[0]])[0];
    const t2 = s.vClip, cut = [top, [top[0], top[1] + (stop[1] - top[1] - 3) * t2]];
    if (t2 > 0) body += line(cut[0], cut[1], { color: C.trim, w: 2.2 });
    if (t2 > 0 && t2 < 1) body += scissors(cut[1][0], cut[1][1] - 16, 90, 24);
    if (step === 1) body += text(VW / 2, stop[1] + 40, 'clip up to, not through, the staystitching', { size: 11.5, color: C.note, anchor: 'middle', opacity: seg(t2, 0.6, 1) });
  } else {
    // Rolled hem stitched up to the point from each side, then three hand stitches at the point.
    const run = d => at(offsetLine(o.neckline, d)).reverse();
    body += `<polyline points="${pts(run(-0.1))}" fill="none" stroke="${C.prev}" stroke-width="1.4" stroke-dasharray="3 3"/>` +
      `<polyline points="${pts(mirror(offsetLine(o.neckline, -0.1)).map(([x, y]) => [VX + x * VK, VY + y * VK]).reverse())}" fill="none" stroke="${C.prev}" stroke-width="1.4" stroke-dasharray="3 3"/>`;
    const V = at([o.neckline[0]])[0], n = Math.floor(s.vHand * 3 + 1e-6);
    for (let i = 0; i < Math.min(n, 3); i++) {
      const y = V[1] + 5 + i * 5;
      body += `<path d="M${f(V[0] - 7)},${f(y)} q7,-6 14,0" fill="none" stroke="${C.stitch}" stroke-width="2"/>`;
    }
    if (s.vHand > 0 && s.vHand < 1) {
      const y = V[1] + 5 + Math.min(n, 2) * 5;
      body += `<g transform="rotate(-35 ${f(V[0] + 10)} ${f(y)})"><line x1="${f(V[0] + 10)}" y1="${f(y)}" x2="${f(V[0] + 60)}" y2="${f(y)}" stroke="#8b96a3" stroke-width="2.4" stroke-linecap="round"/></g>`;
    }
    body += text(VW / 2, V[1] + 50, 'three small hand stitches hold the point', { size: 11.5, color: C.note, anchor: 'middle', opacity: seg(s.vHand, 0.7, 1) });
  }
  body += text(16, VH - 12, 'front V, close-up (the back V is the same)', { size: 11, color: C.note });
  return `<svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Close-up of the front V point"><title>V point close-up</title>${body}</svg>`;
}

/* ============================================================
   STEP 3: NECKLINE BABY HEM
   ============================================================ */

const NKK = 20, NKX = 200, NKY = 30, NKW = 400, NKH = 250;
const NECK = (() => {
  const at = l => l.map(([x, y]) => [NKX + x * NKK, NKY + y * NKK]);
  // Hemming runs end at the V points: strap to V on each side, front then back.
  const runsAt = (d) => ['front', 'back'].flatMap(name => {
    const line2 = offsetPart(name, 'neckline', d);
    return [at(line2.slice().reverse()), at(mirror(line2).reverse())];
  });
  return {
    at, cut: d => ({ front: at(fullWith('front', { neckline: d, strap: 0 })), back: at(fullWith('back', { neckline: d, strap: 0 })) }),
    stay: runsAt(0.125), finish: runsAt(-0.1),
    straps: [1, -1].map(sg => at(ALINE_OUTLINE.front.strap.map(([x, y]) => [sg * x, y]))),
    vs: ['front', 'back'].map(name => ({ top: at([offsetLine(ALINE_OUTLINE[name].neckline, 0.5)[0]])[0], stay: at([offsetLine(ALINE_OUTLINE[name].neckline, 0.125)[0]])[0], v: at([ALINE_OUTLINE[name].neckline[0]])[0] })),
    lens: at([[2.6, 6.2]])[0]
  };
})();
function neckPlan(s, step) {
  const d = s.bhRoll > 0 ? 0.125 * (1 - s.bhRoll) : s.bhFold > 0 ? 0.5 - 0.375 * s.bhFold : 0.5;
  const out = NECK.cut(d);
  let body = `<rect width="${NKW}" height="${NKH}" fill="${C.bg}"/>` + polygon(out.back, C.rs, { w: 1.3 }) + polygon(out.front, C.rs, { w: 1.3 });
  // Strap seams (the French seams from step 2), pressed toward the back.
  NECK.straps.forEach((l, i) => {
    body += `<polyline points="${pts(l)}" fill="none" stroke="${C.prev}" stroke-width="1.4" stroke-dasharray="3 3"/>`;
    if (s.strapPress > 0) {
      const t2 = clamp(s.strapPress * 2 - i);
      if (t2 > 0 && t2 < 1) body += iron(l[0][0] + (l[1][0] - l[0][0]) * t2, l[0][1] + (l[1][1] - l[0][1]) * t2 - 3, 0.36);
      if (t2 >= 1) body += line([(l[0][0] + l[1][0]) / 2, (l[0][1] + l[1][1]) / 2 - 2], [(l[0][0] + l[1][0]) / 2, (l[0][1] + l[1][1]) / 2 - 18],
        { color: C.dim, w: 1.2, marker: 'marker-end="url(#nk-arr)"', opacity: step === 0 ? 1 : 0.5 });
    }
  });
  if (step === 0) body += caption(NKX, NKY + 5.8 * NKK, 'strap seams pressed toward the back', { opacity: seg(s.strapPress, 0.9, 1) });
  // Staystitching from step 1 is the first row of the hem.
  if (s.bhRoll < 1) body += NECK.stay.map(l => `<polyline points="${pts(l)}" fill="none" stroke="${C.prev}" stroke-width="1.3" stroke-dasharray="3 3"/>`).join('');
  // Clips at the V points.
  NECK.vs.forEach((v, i) => {
    const t2 = clamp(s.vClip * 2 - i);
    if (t2 > 0 && d >= 0.45) body += line(v.top, [v.top[0], v.top[1] + (v.stay[1] - v.top[1]) * t2], { color: C.trim, w: 2 });
    if (t2 > 0 && t2 < 1 && step === 1) body += scissors(v.top[0], v.top[1] - 14, 90, 18);
  });
  // Pressing under and trimming follow the edge round, strap to V on each side.
  if (step === 2 && s.bhPress > 0 && s.bhPress < 1) { const [x, y] = toolAt(NECK.stay, s.bhPress * 4); body += iron(x, y - 2, 0.32); }
  if (step === 3 && s.bhTrimPlan > 0) {
    body += runs(NECK.stay, s.bhTrimPlan * 4, false, { color: C.trim, dash: '6 3 2 3', w: 1.3, noDot: true });
    if (s.bhTrimPlan < 1) { const [x, y] = toolAt(NECK.stay, s.bhTrimPlan * 4); body += scissors(x, y - 9, 0, 15); }
  }
  // Roll and stitch, one side up to each V point, then the other.
  if (s.bhNeedle > 0) body += runs(NECK.finish, s.bhNeedle * 4, step === 4);
  if (s.vHand > 0) NECK.vs.forEach(v => {
    const ph = (s.vHand * 3) % 1;
    for (let i = 0; i < Math.min(3, Math.floor(s.vHand * 3 + 1e-6)); i++) body += `<path d="M${f(v.v[0] - 4)},${f(v.v[1] + 3 + i * 3)} q4,-3 8,0" fill="none" stroke="${C.stitch}" stroke-width="1.5"/>`;
    if (s.vHand < 1) body += `<circle cx="${f(v.v[0])}" cy="${f(v.v[1] + 4)}" r="${f(3 + 10 * ph)}" fill="none" stroke="${C.accent}" stroke-width="1.6" opacity="${f(1 - ph)}"/>`;
  });
  body += lens(NECK.lens[0], NECK.lens[1]) + caption(NKX, NKH - 10, 'front over back, joined at the straps');
  const defs = `<defs><marker id="nk-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C.dim}"/></marker></defs>`;
  return `<svg viewBox="0 0 ${NKW} ${NKH}" role="img" aria-label="The neckline, front over back"><title>Neckline</title>${defs}${body}</svg>`;
}
const NECK_START = { strapPress: 0, vClip: 0, bhStay: 1, bhFold: 0, bhPress: 0, bhTrim: 0, bhTrimPlan: 0, bhRoll: 0, bhNeedle: 0, vHemmed: 0, vHand: 0 };
const NECK_TUT = {
  actions: [
    { text: 'Press each strap seam toward the back, so it lies flat under the hem.', dur: 3800,
      apply(s, p) { s.strapPress = p; } },
    { text: 'At both V points, clip into the allowance up to the staystitching, not through it.', dur: 4200,
      apply(s, p) { s.vClip = ease(p); } },
    { text: 'Press the edge to the wrong side, right along the staystitching.', dur: 5000,
      apply(s, p) { s.bhFold = ease(seg(p, 0, 0.55)); s.bhPress = seg(p, 0.55, 1); if (p >= 1) s.bhPress = 1; } },
    { text: 'Trim the folded allowance to about ⅛ in.', dur: 4600,
      apply(s, p) { s.bhTrim = p; s.bhTrimPlan = p; } },
    { text: 'Roll under once more by ⅛ in and stitch: hem one side up to each V point, then the other.', dur: 7000,
      apply(s, p) { s.bhRoll = ease(seg(p, 0, 0.3)); s.bhNeedle = seg(p, 0.3, 1); } },
    { text: 'Secure each V point with three small hand stitches.', dur: 4200,
      apply(s, p) { s.vHemmed = 1; s.vHand = p; } }
  ]
};
const neckSection = (s, step) => (step === 1 || step === 5) ? vClose(s, step) :
  babySection(s, step, { stayStep: -1, foldStep: 2, trimStep: 3, rollStep: 4, label: 'neckline edge, right side up' });

/* ============================================================
   STEP 4: ARMHOLE BIAS FACING
   Plan: one armhole with the dress still flat, front below and back above, joined at the strap
   seam (the back is reflected across the strap line). Offsets are from the stitching line.
   ============================================================ */

const AW = 300, AH = 400;
const ARM = (() => {
  const f0 = ALINE_OUTLINE.front, b0 = ALINE_OUTLINE.back;
  const N = f0.strap[0], Sh = f0.strap[1], nb = b0.strap[0], sb = b0.strap[1];
  const dx = sb[0] - nb[0], dy = sb[1] - nb[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  const reflect = ([x, y]) => {           // across the back strap line, then onto the front strap
    const rx = x - nb[0], ry = y - nb[1], d = rx * ux + ry * uy;
    const px = 2 * d * ux - rx, py = 2 * d * uy - ry;
    return [px + N[0], py + N[1]];
  };
  const frontArm = d => offsetPart('front', 'armhole', d);
  const backArm = d => offsetPart('back', 'armhole', d).map(reflect);
  const path = d => [...backArm(d).slice().reverse(), ...frontArm(d)];       // back underarm -> strap -> front underarm
  // Fit the armhole region into the view.
  const region = [...path(0.5), ...path(-0.9)];
  const xs = region.map(p => p[0]), ys = region.map(p => p[1]);
  const k = Math.min((AW - 60) / (Math.max(...xs) - Math.min(...xs) + 2), (AH - 70) / (Math.max(...ys) - Math.min(...ys) + 1.2));
  const ox = AW / 2 - k * (Math.max(...xs) + Math.min(...xs)) / 2, oy = AH / 2 - 12 - k * (Math.max(...ys) + Math.min(...ys)) / 2;
  const at = l => l.map(([x, y]) => [ox + x * k, oy + y * k]);
  const n = path(0).length;
  const ext = (list, e) => extendLine(list, e);
  return {
    k, at, n,
    line: d => at(ext(path(d), 0.5)),
    band: (a, b) => { const A = at(ext(path(a), 0.5)), B = at(ext(path(b), 0.5)); return [...A, ...B.reverse()]; },
    // Clips around the two underarm curves, from the trimmed edge to ⅛ in short of the seam.
    clipMarks: (() => {
      const outer = path(0.25), inner = path(0.125);
      return [1, 2, 3, 4, n - 2, n - 3, n - 4, n - 5].map(i => at([outer[i], inner[i]]));
    })(),
    lens: at([path(0)[Math.floor(n * 0.78)]])[0],
    labelFront: at([[5.2, 6.4]])[0], labelBack: at([reflect([5.2, 6.4])])[0]
  };
})();
const STRIP_FILL = '#f6eedf';
function armPlan(s, step) {
  // Dress edge: cut (½), trimmed (¼), then the seam once the facing is turned inside (0).
  const edgeD = s.armTurn > 0 ? 0.25 * (1 - s.armTurn) : s.armTrim >= 1 ? 0.25 : 0.5 - (step === 2 ? 0.25 * seg(s.armTrim, 0.85, 1) : 0);
  let body = `<rect width="${AW}" height="${AH}" fill="${C.bg}"/>` +
    polygon(ARM.at(halfWith('back', { neckline: 0, strap: 0, armhole: edgeD }).map(reflectBack)), C.rs, { w: 1.3 }) +
    polygon(ARM.at(halfWith('front', { neckline: 0, strap: 0, armhole: edgeD })), C.rs, { w: 1.3 });
  body += `<polyline points="${pts(ARM.at([ALINE_OUTLINE.front.strap[0], ALINE_OUTLINE.front.strap[1]]))}" fill="none" stroke="${C.prev}" stroke-width="1.3" stroke-dasharray="3 3"/>`;
  // The folded strip: laid on the right side (raw edges at the cut edge, fold ⅞ in inside),
  // later pressed away past the seam, then turned under (shown dashed: it is on the inside).
  if (s.armLay > 0 && s.armTurn < 1) {
    let a, b;
    if (s.armAway <= 0) { a = -0.375; b = s.armTrim >= 1 ? 0.25 : 0.5; }
    else { const e = -0.375 * Math.cos(Math.PI * s.armAway); a = Math.min(0, e); b = Math.max(e, 0.25); }
    if (s.armTurn > 0) { a = 0; b = 0.375 * (1 - s.armTurn); }
    const band = ARM.band(b, a);
    const n = band.length / 2, shown = Math.max(2, Math.round(n * clamp(s.armLay)));
    const partBand = [...band.slice(0, shown), ...band.slice(band.length - shown)];
    body += polygon(partBand, STRIP_FILL, { w: 1.1 });
    if (s.armLay < 1) { const [x, y] = band[shown - 1]; body += `<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="${C.accent}" opacity="0.8"/>`; }
  }
  if (s.armTurn >= 1) body += polygon(ARM.band(0, -0.375), 'none', { stroke: C.note, w: 1, dash: '3 3' });
  // Seam ½ in from the cut edge = the pattern's stitching line.
  if (s.armSt > 0) body += runLine(ARM.line(0), s.armSt, step === 1);
  if (step === 2 && s.armTrim > 0 && s.armTrim < 1) {
    body += runLine(ARM.line(0.25), s.armTrim, false, { color: C.trim, dash: '6 3 2 3', w: 1.4, noDot: true });
    const [x, y] = tip(partial(ARM.line(0.25), s.armTrim)); body += scissors(x + 10, y, 0, 15);
  }
  if (s.armClips > 0 && s.armTurn < 0.5) {
    const shown = Math.floor(s.armClips * ARM.clipMarks.length + 1e-6);
    ARM.clipMarks.slice(0, shown).forEach(([a, b]) => { body += line(a, b, { color: C.trim, w: 1.8 }); });
    if (s.armClips < 1 && shown < ARM.clipMarks.length) { const [a] = ARM.clipMarks[shown]; body += scissors(a[0] + 9, a[1] - 6, 0, 13); }
  }
  if (s.armUnder > 0 && s.armTurn < 0.5) body += runLine(ARM.line(0.125), s.armUnder, step === 5);
  if (s.armDown > 0) body += runLine(ARM.line(-0.375), s.armDown, step === 7);
  const ironT = step === 4 ? seg(s.armAway, 0.6, 1) : step === 6 ? seg(s.armTurn, 0.7, 1) : 0;
  if (ironT > 0 && ironT < 1) { const [x, y] = tip(partial(ARM.line(0.1), ironT)); body += iron(x, y - 3, 0.34); }
  body += text(ARM.labelFront[0], ARM.labelFront[1], 'FRONT', { size: 11, bold: true, anchor: 'middle' }) +
    text(ARM.labelBack[0], ARM.labelBack[1], 'BACK', { size: 11, bold: true, anchor: 'middle' }) +
    lens(ARM.lens[0], ARM.lens[1]) + caption(AW / 2, AH - 10, 'dress flat, right side up');
  return `<svg viewBox="0 0 ${AW} ${AH}" role="img" aria-label="One armhole, back over the strap to the front"><title>Armhole</title>${body}</svg>`;
}
function reflectBack([x, y]) {
  const b0 = ALINE_OUTLINE.back, f0 = ALINE_OUTLINE.front, nb = b0.strap[0], sb = b0.strap[1], N = f0.strap[0];
  const dx = sb[0] - nb[0], dy = sb[1] - nb[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  const rx = x - nb[0], ry = y - nb[1], d = rx * ux + ry * uy;
  return [2 * d * ux - rx + N[0], 2 * d * uy - ry + N[1]];
}

/* ---------- step 4: cross-section through the armhole edge ---------- */
// The folded strip is a hairpin (two layers joined at its fold) plus its two raw-edge allowances.
function hairpin(P, phi, len, half) {
  const dir = u(phi), nl = [dir[1], -dir[0]];        // left of travel, on screen
  const eS = add(P, nl, -half), eE = add(P, nl, half), c = add(P, dir, len);
  const out = [eS, add(eS, dir, len)];
  const a0 = Math.atan2(out[1][1] - c[1], out[1][0] - c[0]);
  for (let i = 1; i <= 10; i++) { const a = a0 - Math.PI * i / 10; out.push([c[0] + half * Math.cos(a), c[1] + half * Math.sin(a)]); }
  out.push(eE);
  return { pts: out, eS, eE };
}
const rotPt = ([x, y], c, deg) => { const a = rad(deg), cs = Math.cos(a), sn = Math.sin(a); return [c[0] + (x - c[0]) * cs - (y - c[1]) * sn, c[1] + (x - c[0]) * sn + (y - c[1]) * cs]; };
function armSection(s, step) {
  const W2 = 460, H2 = 300, Y0 = 130, QX = 300, a = (s.armTrim >= 0.5 ? 0.25 : 0.5) * PX, R = T * 0.7;
  const C0 = [QX, Y0 + R];                             // centre of the turn-under at the armhole edge
  const psi = 180 * s.armTurn;                         // allowances + strip roll under the dress
  const drop = (1 - s.armLay) * 170;
  // Dress: body to the seam, then its allowance, bending under round C0 when turned.
  const dress = [[QX - 300, Y0], [QX, Y0]];
  const nArc = Math.max(1, Math.ceil(psi / 15));
  for (let i = 1; i <= nArc && psi > 0.5; i++) { const ang = -90 + psi * i / nArc; dress.push([C0[0] + R * Math.cos(rad(ang)), C0[1] + R * Math.sin(rad(ang))]); }
  const endD = dress[dress.length - 1], tdir = [Math.cos(rad(psi)), Math.sin(rad(psi))];
  dress.push(add(endD, tdir, a));
  // Strip (in the pressed-away frame before turning), then turned with the allowances.
  const phi = 180 - 180 * s.armAway;                   // fold side: inside the dress (180) -> past the edge (0)
  const lift = T * 1.15 * (1 - Math.cos(Math.PI * s.armAway)) / 2;
  const P = [QX, Y0 - 1.5 * T - lift - drop];
  const hp = hairpin(P, phi, 0.375 * PX, T / 2);
  // Allowances of the strip run from the seam out to the raw edges (pointing right, like the dress's).
  const sTop = [QX, Y0 - 2 * T - drop], sBot = [QX, Y0 - T - drop];
  const nearTop = Math.hypot(hp.eS[0] - sTop[0], hp.eS[1] - sTop[1]) < Math.hypot(hp.eE[0] - sTop[0], hp.eE[1] - sTop[1]);
  const [eTop, eBot] = nearTop ? [hp.eS, hp.eE] : [hp.eE, hp.eS];
  let loop = [add(sTop, [1, 0], a), sTop, eTop, ...(nearTop ? hp.pts.slice(1, -1) : hp.pts.slice(1, -1).reverse()), eBot, sBot, add(sBot, [1, 0], a)];
  if (psi > 0) loop = loop.map(p => rotPt(p, C0, psi));
  let body = `<rect width="${W2}" height="${H2}" fill="${C.bg}"/>`;
  const defs = `<defs><marker id="sa-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.dim}"/></marker>
    <linearGradient id="as-fade" x1="0" x2="1"><stop offset="0" stop-color="#000"/><stop offset="0.2" stop-color="#fff"/></linearGradient>
    <mask id="as-mask"><rect width="${W2}" height="${H2}" fill="url(#as-fade)"/></mask></defs>`;
  body += `<g mask="url(#as-mask)">${strip(dress, 1)}</g>`;
  if (s.armLay > 0) body += strip(loop, nearTop ? -1 : 1);
  // The trimmed ¼ in of all three layers falls away.
  if (s.armTrim > 0.5 && s.armTrim < 1) {
    const p = (s.armTrim - 0.5) / 0.5;
    [[Y0, 1], [Y0 - T, -1], [Y0 - 2 * T, 1]].forEach(([y, rs]) => {
      const piece = [[QX + a + 2, y], [QX + 0.5 * PX, y]];
      body += strip(piece.map(([x, yy]) => [x + 25 * p, yy + 140 * p * p]), rs, { opacity: 1 - p });
    });
  }
  // Seam thread through all layers at the seam point (it travels with the turn).
  if (s.armSt > 0.15 && s.armLay >= 1) {
    const top = rotPt([QX, Y0 - 2.5 * T - 2 - lift], C0, psi), bot = rotPt([QX, Y0 + T / 2 + 2], C0, psi);
    body += line(top, bot, { color: stitchColor(step === 1), w: 2.4, dash: step === 1 ? null : '3 2' });
  }
  if (step === 1 && s.armSt > 0 && s.armSt < 1) body += needle(QX, needleTip(s.armSt, Y0 - 2.5 * T, Y0 + T));
  // Understitching: through the strip and the allowances only, ⅛ in from the seam.
  const ux2 = QX + 0.125 * PX;
  if (s.armUnder > 0.15) {
    const top = rotPt([ux2, Y0 - 2.5 * T - lift - 2], C0, psi), bot = rotPt([ux2, Y0 - T / 2 - 1], C0, psi);
    body += line(top, bot, { color: stitchColor(step === 5), w: 2.4, dash: step === 5 ? null : '3 2' });
  }
  if (step === 5 && s.armUnder > 0 && s.armUnder < 1) body += needle(ux2, needleTip(s.armUnder, Y0 - 2.5 * T - lift, Y0 - T / 2));
  // Stitching the facing down, ⅜ in from the finished edge.
  const sx = QX - 0.34 * PX;
  if (s.armDown > 0.15) body += line([sx, Y0 - T / 2 - 4], [sx, Y0 + 2 * R + 3.2 * T], { color: stitchColor(step === 7), w: 2.4, dash: step === 7 ? null : '3 2' });
  if (step === 7 && s.armDown > 0 && s.armDown < 1) body += needle(sx, needleTip(s.armDown, Y0 - T / 2, Y0 + 2 * R + 3 * T));
  // Pressing.
  const ironT = step === 4 ? seg(s.armAway, 0.6, 1) : step === 6 ? seg(s.armTurn, 0.7, 1) : 0;
  if (ironT > 0 && ironT < 1) body += iron(40 + 330 * ironT, (step === 4 ? Y0 - 3 * T - 2 : Y0 - T / 2 - 1), 0.85);
  // Labels and measurements.
  const o1 = op => ({ size: 11, color: C.note, opacity: op });
  body += text(70, Y0 + 26 + (psi > 90 ? 3 * T : 0), 'dress, right side up', o1(1));
  if (s.armLay > 0.6 && s.armAway === 0 && psi === 0) body += text(QX - 0.375 * PX - 8, Y0 - 1.5 * T - drop + 4, 'folded bias strip', { ...o1(1), anchor: 'end' });
  if (step === 0) body += text(QX + a / 2, Y0 - 2.5 * T - 14, 'raw edges together', { ...o1(seg(s.armLay, 0.85, 1)), anchor: 'middle' });
  if (step === 1) body += dimH(QX, QX + 0.5 * PX, Y0 - 2.5 * T - 18, '½ in', seg(s.armSt, 0.75, 1));
  if (step === 2) body += dimH(QX, QX + 0.25 * PX, Y0 + T + 20, '¼ in', seg(s.armTrim, 0.8, 1));
  if (step === 3) body += text(W2 / 2, H2 - 40, 'clip only around the underarm curves (see the armhole view)', { size: 11.5, color: C.note, anchor: 'middle' });
  if (step === 4) body += text(QX + 30, Y0 - 5 * T - 8, 'pressed away from the dress', { ...o1(seg(s.armAway, 0.6, 1)), anchor: 'middle' });
  if (step === 5) body += dimH(QX, ux2, Y0 - 4 * T - 10, '⅛ in', seg(s.armUnder, 0.75, 1));
  if (step === 6) body += text(QX + 30, Y0 - 22, 'seam rolls just inside the edge', { ...o1(seg(s.armTurn, 0.8, 1)), anchor: 'end' });
  if (step === 7) body += dimH(sx, QX + R, Y0 - T / 2 - 18, '⅜ in facing', seg(s.armDown, 0.75, 1));
  return `<svg viewBox="0 0 ${W2} ${H2}" role="img" aria-label="Close-up through the armhole edge"><title>Armhole close-up</title>${defs}${body}</svg>`;
}
const ARM_START = { armLay: 0, armSt: 0, armTrim: 0, armClips: 0, armAway: 0, armUnder: 0, armTurn: 0, armDown: 0 };
const ARM_TUT = {
  actions: [
    { text: 'Lay a folded bias strip on the right side of the armhole, raw edges together, from ½ in past the back underarm to ½ in past the front.', dur: 5200,
      apply(s, p) { s.armLay = ease(p); } },
    { text: 'Stitch ½ in from the edge, easing the strip round the curve without stretching the dress.', dur: 5200,
      apply(s, p) { s.armSt = p; } },
    { text: 'Trim the allowances to ¼ in.', dur: 4200,
      apply(s, p) { s.armTrim = p; } },
    { text: 'Clip around the underarm curves every ¼–½ in, stopping ⅛ in short of the stitching.', dur: 4400,
      apply(s, p) { s.armClips = p; } },
    { text: 'Press the strip and the allowances away from the dress.', dur: 4400,
      apply(s, p) { s.armAway = ease(seg(p, 0, 0.6)); } },
    { text: 'Understitch ⅛ in from the seam, through the strip and allowances only.', dur: 4800,
      apply(s, p) { s.armUnder = p; } },
    { text: 'Turn the strip completely to the inside, so the seam rolls just inside the edge, and press.', dur: 5000,
      apply(s, p) { s.armTurn = ease(seg(p, 0, 0.7)); } },
    { text: 'Stitch the facing down ⅜ in from the edge. Repeat for the other armhole.', dur: 5200,
      apply(s, p) { s.armDown = p; } }
  ]
};

/* ============================================================
   STEP 6: BOTTOM BABY HEM
   ============================================================ */

const HK = 15, HW = 360, HH = 210, HX = 180, HY = 20 - (LENGTH - 9.6) * HK;
const HEM = (() => {
  const at = l => l.map(([x, y]) => [HX + x * HK, HY + y * HK]);
  const hemLine = d => { const h = offsetPart('front', 'hem', d); return at([...mirror(h).reverse().slice(0, -1), ...h.slice().reverse()]); };
  return {
    at, piece: d => at(fullWith('front', { neckline: 0, strap: 0, armhole: 0, side: 0, hem: d })), line: hemLine,
    sides: [1, -1].map(sg => at(sideFrom(LENGTH - 6, LENGTH).map(([x, y]) => [sg * x, y]))), lens: at([[5, LENGTH]])[0]
  };
})();
function hemPlan(s, step) {
  const d = s.bhRoll > 0 ? 0.125 * (1 - s.bhRoll) : s.bhFold > 0 ? 0.5 - 0.375 * s.bhFold : 0.5;
  let body = `<rect width="${HW}" height="${HH}" fill="${C.bg}"/>` + polygon(HEM.piece(d), C.rs, { w: 1.3 });
  // French side seams from step 5, pressed toward the back where the hem crosses them.
  HEM.sides.forEach((l, i) => {
    body += `<polyline points="${pts(l)}" fill="none" stroke="${C.prev}" stroke-width="1.3" stroke-dasharray="3 3"/>`;
    const t2 = clamp(s.sidePress * 2 - i);
    if (step === 3 && t2 > 0 && t2 < 1) { const e = l[l.length - 1]; body += iron(e[0], e[1] - 26 + 18 * t2, 0.34, 90); }
  });
  if (step === 3) body += caption(HX, HY + (LENGTH - 3.6) * HK, 'side seams pressed toward the back', { opacity: seg(s.sidePress, 0.9, 1) });
  if (s.bhStay > 0 && s.bhRoll < 1) body += runLine(HEM.line(0.125), s.bhStay, step === 0);
  if (step === 1 && s.bhPress > 0 && s.bhPress < 1) { const [x, y] = tip(partial(HEM.line(0.125), s.bhPress)); body += iron(x, y - 3, 0.36); }
  if (step === 2 && s.bhTrimPlan > 0) {
    body += runLine(HEM.line(0.16), s.bhTrimPlan, false, { color: C.trim, dash: '6 3 2 3', w: 1.3, noDot: true });
    if (s.bhTrimPlan < 1) { const [x, y] = tip(partial(HEM.line(0.16), s.bhTrimPlan)); body += scissors(x, y - 10, 0, 15); }
  }
  if (s.bhNeedle > 0) body += runLine(HEM.line(-0.1), s.bhNeedle, step === 4);
  body += lens(HEM.lens[0], HEM.lens[1] - 16) + caption(HX, HH - 8, 'front shown; the hem runs round the back too');
  return `<svg viewBox="0 0 ${HW} ${HH}" role="img" aria-label="The bottom of the dress"><title>Hem</title>${body}</svg>`;
}
const HEM_START = { bhStay: 0, bhFold: 0, bhPress: 0, bhTrim: 0, bhTrimPlan: 0, sidePress: 0, bhRoll: 0, bhNeedle: 0 };
const HEM_TUT = {
  actions: [
    { text: 'Stitch ⅜ in from the bottom edge, all the way round.', dur: 5000,
      apply(s, p) { s.bhStay = p; } },
    { text: 'Press the edge to the wrong side along that stitching.', dur: 5000,
      apply(s, p) { s.bhFold = ease(seg(p, 0, 0.55)); s.bhPress = seg(p, 0.55, 1); if (p >= 1) s.bhPress = 1; } },
    { text: 'Trim the folded allowance to about ⅛ in.', dur: 4600,
      apply(s, p) { s.bhTrim = p; s.bhTrimPlan = p; } },
    { text: 'Where the hem crosses the side seams, press the French seams toward the back.', dur: 3800,
      apply(s, p) { s.sidePress = p; } },
    { text: 'Roll under once more by ⅛ in and stitch through all layers.', dur: 6400,
      apply(s, p) { s.bhRoll = ease(seg(p, 0, 0.3)); s.bhNeedle = seg(p, 0.3, 1); } }
  ]
};
const hemSection = (s, step) => babySection(s, step, { stayStep: 0, foldStep: 1, trimStep: 2, rollStep: 4, label: 'hem edge, right side up' });

/* ============================================================
   STEP 7: PRESS AND FINISH
   ============================================================ */

const PW7 = 420, PH7 = 330;
const DRESS7 = (() => {
  const k = 6.6, ox = 210, oy = 24;
  return { k, ox, oy, front: place(fullOutline('front'), 0, 0).map(([x, y]) => [ox + (x / K) * k, oy + (y / K) * k]) };
})();
function pressScene(s, step) {
  let body = `<rect width="${PW7}" height="${PH7}" fill="${C.bg}"/>`;
  if (step <= 1) {
    // The iron's dial turns to silk; the steam switch goes off.
    const dial = -70 + 110 * (step === 0 ? ease(s.dial) : 1), steamOff = step === 0 ? seg(s.dial, 0.6, 1) : 1;
    if (step === 0) {
      body += iron(200, 230, 2.6) + `<circle cx="196" cy="186" r="20" fill="${C.bg}" stroke="${C.edge}" stroke-width="1.4"/>` +
        `<line x1="196" y1="186" x2="${f(196 + 15 * Math.cos(rad(dial)))}" y2="${f(186 + 15 * Math.sin(rad(dial)))}" stroke="${C.stitch}" stroke-width="2.4" stroke-linecap="round"/>` +
        text(140, 150, 'cotton', { size: 10, color: C.note }) + text(236, 150, 'silk', { size: 11, bold: true, color: C.dim, opacity: 0.4 + 0.6 * ease(s.dial) }) +
        text(300, 120, steamOff >= 1 ? 'steam: off' : 'steam: on', { size: 12, bold: true, color: steamOff >= 1 ? C.dim : C.note }) +
        `<rect x="300" y="128" width="40" height="16" rx="8" fill="${steamOff >= 1 ? '#cfcfcf' : '#3a7ab7'}"/>` +
        `<circle cx="${f(308 + 24 * (1 - steamOff))}" cy="136" r="7" fill="#fff" stroke="${C.edge}"/>` +
        [0, 1, 2].map(i => `<circle cx="${f(110 + i * 22)}" cy="${f(244 - ((s.dial * 300 + i * 13) % 40))}" r="${f(4 + i)}" fill="none" stroke="${C.prev}" opacity="${f(0.6 * (1 - steamOff))}"/>`).join('');
    } else {
      // Test on a scrap, under the press cloth: press, lift, check.
      const hop = Math.sin(Math.PI * seg(s.test, 0, 0.6)), lifted = seg(s.test, 0.6, 0.8);
      body += `<rect x="110" y="200" width="200" height="70" fill="${C.rs}" stroke="${C.edge}" stroke-width="1.2"/>` +
        `<rect x="100" y="194" width="220" height="70" fill="#f3efe6" opacity="${f(0.75 * (1 - lifted))}" stroke="${C.edge}" stroke-dasharray="3 2"/>` +
        text(210, 290, 'scrap of the same silk', { size: 11, anchor: 'middle', color: C.note }) +
        iron(205, 192 - 26 * hop - 40 * lifted, 1.4) +
        text(210, 64, '✓ no shine, no water marks', { size: 14, bold: true, anchor: 'middle', color: '#2f7d4a', opacity: seg(s.test, 0.85, 1) });
    }
  } else {
    // The dress, inside out; the organza cloth settles over it; the iron presses by lifting.
    const turned = step === 5 ? ease(s.rsOut) : 0;
    body += turnPiece(DRESS7.front, 1 - turned, DRESS7.ox, { fill: turned >= 0.5 ? C.rs : C.ws });
    if (step === 2 || step === 3) {
      const drop = step === 2 ? ease(s.cloth) : 1;
      body += `<rect x="${f(DRESS7.ox - 80)}" y="${f(60 - 140 * (1 - drop))}" width="160" height="120" rx="4" fill="#f3efe6" opacity="${f(0.7 * drop + 0.1)}" stroke="${C.edge}" stroke-dasharray="3 2"/>` +
        text(DRESS7.ox + 88, f(76 - 140 * (1 - drop)), 'silk organza', { size: 11, color: C.note, opacity: drop }) + text(DRESS7.ox + 88, f(90 - 140 * (1 - drop)), 'press cloth', { size: 11, color: C.note, opacity: drop });
    }
    if (step === 3) {
      const t2 = s.lifting * 3, hopIdx = Math.min(2, Math.floor(t2)), ph = t2 - hopIdx;
      const x = DRESS7.ox - 50 + hopIdx * 50 + 50 * seg(ph, 0.4, 0.8), up = Math.sin(Math.PI * seg(ph, 0.3, 0.9)) * 30;
      body += iron(x, 150 - up, 0.9) +
        `<path d="M${f(DRESS7.ox - 60)},210 l120,0" stroke="${C.stitch}" stroke-width="2" marker-end="url(#pr-arr)" opacity="${f(seg(s.lifting, 0.7, 1))}"/>` +
        text(DRESS7.ox, 232, '✕ don’t slide the iron', { size: 11.5, bold: true, anchor: 'middle', color: C.stitch, opacity: seg(s.lifting, 0.7, 1) });
    }
    if (step === 4) {
      const o = seg(s.seamsBack, 0, 0.5), o2 = seg(s.seamsBack, 0.5, 1);
      const k = DRESS7.k, ox = DRESS7.ox, oy = DRESS7.oy;
      [1, -1].forEach(sg => {
        body += `<polyline points="${pts(sideFrom(12, LENGTH - 1).map(([x, y]) => [ox + sg * (x - 0.15) * k, oy + y * k]))}" fill="none" stroke="${C.dim}" stroke-width="4" opacity="${f(0.5 * o)}"/>` +
          `<path d="M${f(ox + sg * 6.6 * k)},${f(oy + 2.5 * k)} q${f(sg * 1.6 * k)},${f(3 * k)} ${f(sg * 2.4 * k)},${f(5 * k)}" fill="none" stroke="${STRIP_FILL}" stroke-width="5" opacity="${f(o2)}"/>`;
      });
      body += text(ox + 10.5 * k, oy + 25 * k, 'French seams', { size: 11, color: C.note, opacity: o }) +
        text(ox + 10.5 * k, oy + 25 * k + 14, 'toward the back', { size: 11, color: C.note, opacity: o }) +
        text(ox + 9 * k, oy + 4 * k, 'facings flat inside', { size: 11, color: C.note, opacity: o2 });
    }
    if (step === 5) {
      const o = seg(s.rsOut, 0.7, 1), k = DRESS7.k, ox = DRESS7.ox, oy = DRESS7.oy;
      body += text(ox - 11 * k, oy + 6 * k, 'baby-hemmed neckline', { size: 11, color: C.note, anchor: 'end', opacity: o }) +
        text(ox + 10 * k, oy + 4 * k, 'bias-faced armholes', { size: 11, color: C.note, opacity: o }) +
        text(ox + 11 * k, oy + 26 * k, 'French side seams', { size: 11, color: C.note, opacity: o }) +
        text(ox - 11 * k, oy + (LENGTH - 1) * k, 'baby-hemmed hem', { size: 11, color: C.note, anchor: 'end', opacity: o }) +
        text(ox + 9 * k, oy + 0.4 * k, 'French strap seams', { size: 11, color: C.note, opacity: o });
    }
  }
  const defs = `<defs><marker id="pr-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C.stitch}"/></marker></defs>`;
  return `<svg viewBox="0 0 ${PW7} ${PH7}" role="img" aria-label="Pressing the dress"><title>Pressing</title>${defs}${body}</svg>`;
}
const PRESS_START = { dial: 0, test: 0, cloth: 0, lifting: 0, seamsBack: 0, rsOut: 0 };
const PRESS_TUT = {
  actions: [
    { text: 'Set the iron to silk, with no steam: a dry iron.', dur: 3600, apply(s, p) { s.dial = p; } },
    { text: 'Test on a scrap of the same fabric first: duchess silk can water-mark and shine.', dur: 4400, apply(s, p) { s.test = p; } },
    { text: 'Lay a silk organza press cloth over the dress.', dur: 3200, apply(s, p) { s.cloth = p; } },
    { text: 'Press with a lifting motion: press, lift, move. Don’t slide the iron.', dur: 5200, apply(s, p) { s.lifting = p; } },
    { text: 'French seams go toward the back; the armhole facings lie flat to the inside.', dur: 4200, apply(s, p) { s.seamsBack = p; } },
    { text: 'Turn the dress right side out. It’s finished.', dur: 4000, apply(s, p) { s.rsOut = p; } }
  ]
};

/* ---------- step 2 reuses the French seam actions with shoulder wording ---------- */
const SHOULDER_TEXTS = [
  'Lay the back flat, wrong side up.',
  'Place the front on top, right side up, so the wrong sides are together. Match the strap tops.',
  'Pass 1: stitch ¼ in from the edge, across each 1½ in strap.',
  'Trim the allowance to ⅛ in and press it to one side.',
  'Open the pieces out. The trimmed allowance stands on the right side of the fabric.',
  'Fold right sides together along the seam, so the first stitching sits right on the fold, and press.',
  'Pass 2: stitch ¼ in from the fold, enclosing the raw edges.',
  'Press the finished seams toward the back.'
];
const FRENCH_SHOULDER = { actions: FRENCH_SIDE.actions.map((a, i) => ({ ...a, text: SHOULDER_TEXTS[i] })) };

export const SEWING_TUTORIALS = {
  'french-side': { ...FRENCH_SIDE, start: START, legend: ['rs', 'ws', 'stitch', 'prev', 'trim'],
    views: [{ caption: 'Whole dress', cls: 'sew-anim-plan', render: plan }, { caption: 'Close-up through the side seam', cls: 'sew-anim-section', render: section }] },
  'cut-mark': { ...CUT_MARK, start: CUT_START, legend: ['fabric', 'under', 'trim', 'chalk', 'stitch', 'rs', 'ws'],
    views: [{ caption: 'Cutting table', render: cuttingTable }] },
  'french-shoulder': { ...FRENCH_SHOULDER, start: START, layout: 'even', legend: ['rs', 'ws', 'stitch', 'prev', 'trim'],
    views: [{ caption: 'Shoulder straps', render: shoulderPlan }, { caption: 'Close-up through a strap seam', render: section }] },
  'neck-hem': { ...NECK_TUT, start: NECK_START, layout: 'even', legend: ['rs', 'ws', 'stitch', 'prev', 'trim'],
    views: [{ caption: 'Neckline', render: neckPlan }, { caption: 'Close-up', render: neckSection }] },
  'arm-facing': { ...ARM_TUT, start: ARM_START, legend: ['rs', 'ws', 'bias', 'stitch', 'prev', 'trim'],
    views: [{ caption: 'Armhole', cls: 'sew-anim-plan', render: armPlan }, { caption: 'Close-up through the armhole edge', render: armSection }] },
  'bottom-hem': { ...HEM_TUT, start: HEM_START, layout: 'even', legend: ['rs', 'ws', 'stitch', 'prev', 'trim'],
    views: [{ caption: 'Hem', render: hemPlan }, { caption: 'Close-up through the hem edge', render: hemSection }] },
  'press-finish': { ...PRESS_TUT, start: PRESS_START, legend: ['rs', 'ws', 'stitch'],
    views: [{ caption: 'Pressing', render: pressScene }] }
};
