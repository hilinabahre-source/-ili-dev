// Turns SeamScape REST API pattern JSON into a true-scale PDF.
// A0: pieces on as few sheets as possible (a piece longer than a sheet is printed in parts with
// join lines). A4 / Letter: tiled pages to tape together.
// Pieces arrive unfolded; pieces cut on the fold are drawn as half pieces. Each pattern can describe
// its pieces (label, cutting quantity, seam allowance, fold direction, whether to print) through
// PdfOptions.pieces; without it every piece is "cut 1 on fold" with a vertical fold (the A-line dress).
// Geometry is in mm; PDF units are points (1 pt = 1/72 in). No dependencies.

export type Paper = 'A0' | 'A4' | 'Letter';
type Pt = [number, number];
type Polyline = Pt[];

export interface SeamScapePiece {
  name: string;
  boundary: Polyline[];
  sewLines: Polyline[];
  notches?: Polyline[];      // absent when the pattern has none
  grain?: [number, number];   // grain direction in pattern coordinates (y up)
}

export interface PieceOptions {
  label?: string;             // printed name, default the SeamScape piece name
  cut?: string;               // e.g. "Cut 2 on fold"
  seamAllowance?: string;     // e.g. "1 cm seam allowance included"
  fold?: 'vertical' | 'horizontal' | 'none';   // where the piece is cut on the fold; default vertical
  print?: boolean;            // false: not printed (e.g. a second, identical piece)
}

export interface PdfOptions {
  patternTitle: string;      // e.g. "ILI A-line Silk Dress"
  infoLine: string;          // e.g. measurements used
  footer: string;            // e.g. generated date and version
  pieces?: Record<string, PieceOptions>;   // keyed by SeamScape piece name
  order?: string[];          // print order of the pieces (database JSON objects don't keep key order)
}

const PT = 72 / 25.4;
const PAPER_MM: Record<Paper, [number, number]> = { A0: [841, 1189], A4: [210, 297], Letter: [215.9, 279.4] };
const MARGIN = 10;   // mm unprinted border on tiled pages
const GAP = 30;      // mm between pieces in the layout
const LEGACY: Required<Omit<PieceOptions, 'label'>> = {
  cut: 'Cut 1 on fold (outer silk)', seamAllowance: '0.5 in seam allowance included', fold: 'vertical', print: true,
};

interface LayoutItem {
  name: string; cut: Polyline[]; sew: Polyline[]; notch: Polyline[];
  x0: number; w: number; h: number;
  fold: [Pt, Pt] | null; foldAxis: 'vertical' | 'horizontal' | 'none';
  grain: [Pt, Pt]; grainAxis: 'vertical' | 'horizontal';
  label: string; cutText: string; saText: string;
}

/** Keep the part of a polyline with x >= fx, clipping segments that cross the fold. */
function clipRight(poly: Polyline, fx: number): Polyline[] {
  const out: Polyline[] = [];
  let cur: Polyline = [];
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1];
    const ina = a[0] >= fx - 1e-6, inb = b[0] >= fx - 1e-6;
    if (ina && cur.length === 0) cur = [a];
    if (ina && inb) {
      cur.push(b);
    } else if (ina !== inb) {
      const t = (fx - a[0]) / (b[0] - a[0]);
      const m: Pt = [fx, a[1] + t * (b[1] - a[1])];
      if (ina) { cur.push(m); out.push(cur); cur = []; } else { cur = [m, b]; }
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

const swap = (pl: Polyline): Polyline => pl.map(q => [q[1], q[0]] as Pt);
/** Keep the part of a polyline with y >= fy (the upper half of a piece folded along a horizontal line). */
const clipAbove = (poly: Polyline, fy: number): Polyline[] => clipRight(swap(poly), fy).map(swap);

/** Pieces in print order, with their options. */
function printable(pieces: SeamScapePiece[], opts: PdfOptions): { p: SeamScapePiece; o: PieceOptions }[] {
  if (!opts.pieces) return pieces.map(p => ({ p, o: {} }));
  const order = opts.order ?? Object.keys(opts.pieces);
  return pieces
    .filter(p => opts.pieces![p.name] && opts.pieces![p.name].print !== false)
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
    .map(p => ({ p, o: opts.pieces![p.name] }));
}

/** Lay the (half) pieces side by side, top-left origin, y pointing down (mm). */
function buildLayout(pieces: SeamScapePiece[], opts: PdfOptions): { items: LayoutItem[]; size: [number, number] } {
  const items: LayoutItem[] = [];
  let x0 = 0;
  for (const { p, o } of printable(pieces, opts)) {
    const foldAxis = o.fold ?? LEGACY.fold;
    const all = p.boundary.flat();
    const xs = all.map(q => q[0]), ys = all.map(q => q[1]);
    const top = Math.max(...ys);
    let cut: Polyline[], sew: Polyline[], notch: Polyline[], T: (q: Pt) => Pt, fold: [Pt, Pt] | null = null;
    if (foldAxis === 'vertical') {
      const fx = (Math.min(...xs) + Math.max(...xs)) / 2;   // fold = centre of the unfolded piece
      T = (q: Pt): Pt => [x0 + q[0] - fx, top - q[1]];
      cut = p.boundary.flatMap(pl => clipRight(pl, fx)).map(s => s.map(T));
      sew = p.sewLines.flatMap(pl => clipRight(pl, fx)).map(s => s.map(T));
      notch = (p.notches ?? []).filter(n => Math.min(...n.map(q => q[0])) >= fx - 1e-6).map(n => n.map(T));
      const foldYs = cut.flat().filter(q => Math.abs(q[0] - x0) < 0.05).map(q => q[1]).sort((a, b) => a - b);
      fold = [[x0, foldYs[0]], [x0, foldYs[foldYs.length - 1]]];
    } else if (foldAxis === 'horizontal') {
      const fy = (Math.min(...ys) + Math.max(...ys)) / 2;   // fold = centre of the unfolded piece; keep the upper half
      const left = Math.min(...xs);
      T = (q: Pt): Pt => [x0 + q[0] - left, top - q[1]];
      cut = p.boundary.flatMap(pl => clipAbove(pl, fy)).map(s => s.map(T));
      sew = p.sewLines.flatMap(pl => clipAbove(pl, fy)).map(s => s.map(T));
      notch = (p.notches ?? []).filter(n => Math.min(...n.map(q => q[1])) >= fy - 1e-6).map(n => n.map(T));
      const yf = top - fy;
      const foldXs = cut.flat().filter(q => Math.abs(q[1] - yf) < 0.05).map(q => q[0]).sort((a, b) => a - b);
      fold = [[foldXs[0], yf], [foldXs[foldXs.length - 1], yf]];
    } else {
      const left = Math.min(...xs);
      T = (q: Pt): Pt => [x0 + q[0] - left, top - q[1]];
      cut = p.boundary.map(s => s.map(T));
      sew = p.sewLines.map(s => s.map(T));
      notch = (p.notches ?? []).map(n => n.map(T));
    }
    const cutPts = cut.flat();
    const w = Math.max(...cutPts.map(q => q[0])) - x0;
    const h = Math.max(...cutPts.map(q => q[1]));
    const g = p.grain ?? [0, 1];
    const grainAxis = Math.abs(g[0]) > Math.abs(g[1]) ? 'horizontal' : 'vertical';
    let grain: [Pt, Pt];
    if (grainAxis === 'vertical') {
      if (foldAxis === 'vertical') {
        // Beside the fold, as the A-line always had (shortened on short pieces).
        const yTop = fold![0][1], yEnd = fold![1][1];
        grain = yTop + 650 <= yEnd - 30
          ? [[x0 + 60, yTop + 250], [x0 + 60, yTop + 650]]
          : [[x0 + 60, yTop + 0.2 * (yEnd - yTop)], [x0 + 60, yTop + 0.8 * (yEnd - yTop)]];
      } else {
        // Near the right edge, clear of the labels on the left, along most of the piece's length.
        grain = [[x0 + w - 30, 0.1 * h], [x0 + w - 30, 0.9 * h]];
      }
    } else {
      const gy = 0.3 * h;
      grain = [[x0 + 0.2 * w, gy], [x0 + 0.8 * w, gy]];
    }
    items.push({
      name: p.name, cut, sew, notch, x0, w, h, fold, foldAxis, grain, grainAxis,
      label: o.label ?? p.name, cutText: o.cut ?? LEGACY.cut, saText: o.seamAllowance ?? LEGACY.seamAllowance,
    });
    x0 += w + GAP;
  }
  const height = Math.max(...items.flatMap(it => it.cut.flat().map(q => q[1])));
  return { items, size: [x0 - GAP, height] };
}

/** PDF strings are Latin-1; keep only printable ASCII so no text can break the file. */
function pdfText(s: string): string {
  return s.replace(/[^\x20-\x7e]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

class Canvas {
  ops: string[] = [];
  lineWidth(w: number) { this.ops.push(`${w.toFixed(2)} w`); }
  dash(on?: number) { this.ops.push(on ? `[${on.toFixed(1)} ${on.toFixed(1)}] 0 d` : '[] 0 d'); }
  poly(pts: Pt[]) {
    this.ops.push(pts.map((q, i) => `${q[0].toFixed(3)} ${q[1].toFixed(3)} ${i === 0 ? 'm' : 'l'}`).join(' ') + ' S');
  }
  rect(x: number, y: number, w: number, h: number) { this.ops.push(`${x.toFixed(3)} ${y.toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)} re S`); }
  clip(x: number, y: number, w: number, h: number) { this.ops.push(`q ${x.toFixed(3)} ${y.toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)} re W n`); }
  unclip() { this.ops.push('Q'); }
  text(x: number, y: number, s: string, size = 10) { this.ops.push(`BT /F1 ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfText(s)}) Tj ET`); }
  verticalText(x: number, y: number, s: string, size: number) {
    this.ops.push(`BT /F1 ${size} Tf 0 1 -1 0 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfText(s)}) Tj ET`);
  }
}

function drawLayout(c: Canvas, items: LayoutItem[], opts: PdfOptions, toPdf: (q: Pt) => Pt) {
  const P = (pts: Pt[]) => pts.map(toPdf);
  for (const it of items) {
    c.lineWidth(1.0); c.dash();
    for (const s of it.cut) c.poly(P(s));
    c.lineWidth(0.5); c.dash(2.5);
    for (const s of it.sew) c.poly(P(s));
    c.dash(); c.lineWidth(1.0);
    for (const n of it.notch) c.poly(P(n));
    c.lineWidth(0.8); c.dash(6);
    if (it.fold) c.poly(P(it.fold));
    c.dash();
    const [[gx1, gy1], [gx2, gy2]] = it.grain;
    c.poly(P([[gx1, gy1], [gx2, gy2]]));
    if (it.grainAxis === 'vertical') {
      c.poly(P([[gx1 - 4, gy1 + 8], [gx1, gy1], [gx1 + 4, gy1 + 8]]));
      c.poly(P([[gx2 - 4, gy2 - 8], [gx2, gy2], [gx2 + 4, gy2 - 8]]));
    } else {
      c.poly(P([[gx1 + 8, gy1 - 4], [gx1, gy1], [gx1 + 8, gy1 + 4]]));
      c.poly(P([[gx2 - 8, gy2 - 4], [gx2, gy2], [gx2 - 8, gy2 + 4]]));
    }
    // Labels: beside the fold for vertical folds (as before), in the body of the piece otherwise.
    let lx: number, ly: number;
    if (it.foldAxis === 'vertical') { lx = it.x0 + 70; ly = (it.fold![0][1] + it.fold![1][1]) / 2 + 30; }
    else { lx = it.x0 + 12; ly = 0.55 * it.h; }
    const lines = [`${opts.patternTitle} - ${it.label.toUpperCase()}`, it.cutText, it.saText, opts.infoLine, opts.footer];
    lines.forEach((t, i) => { const [x, y] = toPdf([lx, ly + i * 9]); c.text(x, y, t, i === 0 ? 11 : 8); });
    if (it.foldAxis === 'vertical') {
      const fy = (it.fold![0][1] + it.fold![1][1]) / 2;
      const foldLength = it.fold![1][1] - it.fold![0][1];
      const [x, y] = toPdf([it.x0 + 6, foldLength >= 300 ? fy - 120 : fy + 12]);
      c.verticalText(x, y, 'PLACE ON FOLD', 9);
    } else if (it.foldAxis === 'horizontal') {
      const [[fx1, fyy], [fx2]] = it.fold!;
      const [x, y] = toPdf([(fx1 + fx2) / 2 - 12, fyy - 4]);
      c.text(x, y, 'PLACE ON FOLD', 9);
    }
    if (it.grainAxis === 'vertical') {
      const [x, y] = toPdf([gx1 + 5, (gy1 + gy2) / 2]);
      c.verticalText(x, y, 'GRAINLINE', 8);
    } else {
      const [x, y] = toPdf([(gx1 + gx2) / 2 - 10, gy1 - 3]);
      c.text(x, y, 'GRAINLINE', 8);
    }
  }
}

/** 2 in square and 5 cm square with the bottom-left corner at (x, y) in points. */
function testSquares(c: Canvas, x: number, y: number) {
  c.lineWidth(0.8); c.dash();
  c.rect(x, y, 144, 144);
  c.text(x + 6, y + 128, 'TEST: 2 in x 2 in', 8);
  c.rect(x + 160, y, 50 * PT, 50 * PT);
  c.text(x + 166, y + 50 * PT - 16, 'TEST: 5 cm', 8);
  c.text(x, y - 14, 'Print at 100% / Actual size. Measure both squares before cutting.', 8);
}

/** Minimal PDF 1.4 writer: one Helvetica font, uncompressed content streams. */
function writePdf(pages: { w: number; h: number; content: string }[]): Uint8Array {
  const enc = new TextEncoder();   // content is ASCII only (see pdfText)
  const objs: Uint8Array[] = [];
  const kids: number[] = [];
  objs.push(enc.encode('<< /Type /Catalog /Pages 2 0 R >>'));
  objs.push(new Uint8Array());     // pages object, filled in below
  objs.push(enc.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));
  for (const pg of pages) {
    const data = enc.encode(pg.content);
    objs.push(new Uint8Array([...enc.encode(`<< /Length ${data.length} >>\nstream\n`), ...data, ...enc.encode('\nendstream')]));
    const contentId = objs.length;
    objs.push(enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pg.w.toFixed(3)} ${pg.h.toFixed(3)}] ` +
                         `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`));
    kids.push(objs.length);
  }
  objs[1] = enc.encode(`<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);

  const chunks: Uint8Array[] = [enc.encode('%PDF-1.4\n')];
  let offset = chunks[0].length;
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(offset);
    const head = enc.encode(`${i + 1} 0 obj\n`), tail = enc.encode('\nendobj\n');
    chunks.push(head, body, tail);
    offset += head.length + body.length + tail.length;
  });
  const xref = [`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`,
                ...offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`),
                `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`].join('');
  chunks.push(enc.encode(xref));
  const total = chunks.reduce((n, ch) => n + ch.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const ch of chunks) { out.set(ch, pos); pos += ch.length; }
  return out;
}

const SHEET_TOP = 25, SHEET_BOTTOM = 10, SHEET_SIDES = 20;   // mm kept clear on A0 sheets

function singleSheet(items: LayoutItem[], size: [number, number], opts: PdfOptions, paper: Paper) {
  const [W, H] = PAPER_MM[paper];
  const oy = SHEET_TOP;
  if (items.some(it => it.w + SHEET_SIDES > W || it.h + oy + SHEET_BOTTOM > H)) return packedSheets(items, opts, paper);
  if (size[1] + oy + 10 > H) throw new Error(`pattern is too long for a ${paper} sheet`);
  // Both pieces side by side when they fit; otherwise (very large sizes) one piece per sheet.
  const sheets = size[0] + 20 <= W
    ? [{ items, width: size[0], shift: 0 }]
    : items.map(it => ({ items: [it], width: Math.max(...it.cut.flat().map(q => q[0])) - it.x0, shift: it.x0 }));
  return sheets.map((sheet, i) => {
    if (sheet.width + 20 > W) throw new Error(`pattern piece does not fit on a ${paper} sheet`);
    const ox = (W - sheet.width) / 2 - sheet.shift;
    const c = new Canvas();
    drawLayout(c, sheet.items, opts, q => [(ox + q[0]) * PT, (H - oy - q[1]) * PT]);
    if (i === 0) testSquares(c, (W - 120) * PT, H > 1150 ? (H - oy - 1100) * PT : 30);
    if (sheets.length > 1) c.text(10 * PT, (H - 12) * PT, `Sheet ${i + 1} of ${sheets.length}`, 9);
    return { w: W * PT, h: H * PT, content: c.ops.join('\n') };
  });
}

/** A part of a layout item: the band [x1, x2] x [y1, y2] of its layout, in layout mm. */
interface Unit { it: LayoutItem; x1: number; x2: number; y1: number; y2: number; part: number; parts: number; split: 'x' | 'y' | null }

/** A0 with pieces longer or wider than a sheet: split them into parts with join lines, then fill sheets row by row. */
function packedSheets(items: LayoutItem[], opts: PdfOptions, paper: Paper) {
  const [W, H] = PAPER_MM[paper];
  const maxW = W - SHEET_SIDES, maxH = H - SHEET_TOP - SHEET_BOTTOM;
  const units: Unit[] = [];
  for (const it of items) {
    const nY = it.h > maxH ? Math.ceil(it.h / maxH) : 1;
    const nX = it.w > maxW ? Math.ceil(it.w / maxW) : 1;
    if (nY > 1 && nX > 1) throw new Error(`pattern piece ${it.name} is too large for ${paper}`);
    const n = Math.max(nX, nY);
    for (let k = 0; k < n; k++) {
      const u: Unit = { it, x1: it.x0, x2: it.x0 + it.w, y1: 0, y2: it.h, part: k + 1, parts: n, split: n > 1 ? (nY > 1 ? 'y' : 'x') : null };
      if (u.split === 'y') { u.y1 = (it.h * k) / n; u.y2 = (it.h * (k + 1)) / n; }
      if (u.split === 'x') { u.x1 = it.x0 + (it.w * k) / n; u.x2 = it.x0 + (it.w * (k + 1)) / n; }
      units.push(u);
    }
  }
  // Shelf packing: rows left to right, rows top to bottom, a new sheet when the next row does not fit.
  type Placed = { u: Unit; x: number; y: number };
  const sheets: Placed[][][] = [[]];
  let rowW = 0, rowH = 0, y = SHEET_TOP;
  for (const u of units) {
    const w = u.x2 - u.x1, h = u.y2 - u.y1;
    let rows = sheets[sheets.length - 1];
    if (rows.length && rowW + GAP + w <= maxW) {
      rows[rows.length - 1].push({ u, x: rowW + GAP, y });
      rowW += GAP + w; rowH = Math.max(rowH, h);
      continue;
    }
    if (rows.length) y += rowH + GAP;
    if (rows.length && y + h > H - SHEET_BOTTOM) { sheets.push([]); rows = sheets[sheets.length - 1]; y = SHEET_TOP; }
    rows.push([{ u, x: 0, y }]);
    rowW = w; rowH = h;
  }
  return sheets.map((rows, i) => {
    const c = new Canvas();
    for (const row of rows) {
      const last = row[row.length - 1];
      const width = last.x + (last.u.x2 - last.u.x1);
      const ox = (W - width) / 2;
      for (const { u, x, y: uy } of row) {
        const sx = ox + x;   // sheet position of the unit's top-left corner (mm)
        const map = (q: Pt): Pt => [(sx + q[0] - u.x1) * PT, (H - uy - (q[1] - u.y1)) * PT];
        const [cx, cy] = map([u.x1, u.y2]);
        c.clip(cx - 1, cy - 1, (u.x2 - u.x1) * PT + 2, (u.y2 - u.y1) * PT + 2);
        drawLayout(c, [u.it], opts, map);
        c.unclip();
        if (u.split) {
          // Part label inside the top-left corner of the part.
          const label = `${u.it.label.toUpperCase()} - PART ${u.part} OF ${u.parts}`;
          const [tx, ty] = map([u.x1, u.y1]);
          c.text(tx + 8, ty - 16, label, 10);
          // Join lines on the inner edges of the part, lettered A, B, ... between consecutive parts.
          const joins: { a: Pt; b: Pt; letter: string; other: number }[] = [];
          if (u.part > 1) joins.push(u.split === 'y'
            ? { a: [u.x1, u.y1], b: [u.x2, u.y1], letter: String.fromCharCode(64 + u.part - 1), other: u.part - 1 }
            : { a: [u.x1, u.y1], b: [u.x1, u.y2], letter: String.fromCharCode(64 + u.part - 1), other: u.part - 1 });
          if (u.part < u.parts) joins.push(u.split === 'y'
            ? { a: [u.x1, u.y2], b: [u.x2, u.y2], letter: String.fromCharCode(64 + u.part), other: u.part + 1 }
            : { a: [u.x2, u.y1], b: [u.x2, u.y2], letter: String.fromCharCode(64 + u.part), other: u.part + 1 });
          for (const j of joins) {
            c.lineWidth(1.2); c.dash(4);
            c.poly([map(j.a), map(j.b)]);
            c.dash();
            const [jx, jy] = map(j.a);
            const below = u.split === 'y' && j.a[1] === u.y1;
            c.text(jx + 8, below ? jy - 30 : jy + 5, `JOIN ${j.letter}: butt this edge to part ${j.other} and tape`, 8);
          }
        }
      }
    }
    if (i === 0) testSquares(c, (W - 120) * PT, 30 * PT);
    if (sheets.length > 1) c.text(10 * PT, (H - 12) * PT, `Sheet ${i + 1} of ${sheets.length}`, 9);
    return { w: W * PT, h: H * PT, content: c.ops.join('\n') };
  });
}

function tiled(items: LayoutItem[], size: [number, number], opts: PdfOptions, paper: Paper) {
  const [W, H] = PAPER_MM[paper];
  const cw = W - 2 * MARGIN, ch = H - 2 * MARGIN;
  const cols = Math.ceil((size[0] + 20) / cw), rows = Math.ceil((size[1] + 60) / ch);
  const pages = [];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const c = new Canvas();
      const ox = col * cw - 10, oy = r * ch - 50;
      c.ops.push(`q ${(MARGIN * PT).toFixed(3)} ${(MARGIN * PT).toFixed(3)} ${(cw * PT).toFixed(3)} ${(ch * PT).toFixed(3)} re W n`);
      drawLayout(c, items, opts, q => [(MARGIN + q[0] - ox) * PT, (H - MARGIN - (q[1] - oy)) * PT]);
      c.ops.push('Q');
      c.lineWidth(0.3); c.dash(); c.rect(MARGIN * PT, MARGIN * PT, cw * PT, ch * PT);
      const label = `${String.fromCharCode(65 + r)}${col + 1}`;
      c.text(MARGIN * PT + 4, (H - MARGIN) * PT - 12, `Page ${label}  (row ${String.fromCharCode(65 + r)}, column ${col + 1} of ${cols})`, 8);
      c.text(MARGIN * PT + 4, 3 * PT, `Trim on the border and butt edges to the neighbouring pages. ${paper}, 100% scale.`, 7);
      if (r === 0 && col === 0) testSquares(c, (MARGIN + 8) * PT, (H - MARGIN - 58) * PT - 60);
      pages.push({ w: W * PT, h: H * PT, content: c.ops.join('\n') });
    }
  }
  return pages;
}

export function buildPatternPdf(pieces: SeamScapePiece[], paper: Paper, opts: PdfOptions): { bytes: Uint8Array; pageCount: number } {
  if (!pieces.length) throw new Error('pattern has no pieces');
  const { items, size } = buildLayout(pieces, opts);
  if (!items.length) throw new Error('pattern has no printable pieces');
  const pages = paper === 'A0' ? singleSheet(items, size, opts, paper) : tiled(items, size, opts, paper);
  return { bytes: writePdf(pages), pageCount: pages.length };
}
