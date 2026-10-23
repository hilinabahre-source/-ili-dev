import { PATTERNS } from '../data/patterns.js';
import { sampleSideCurve, pointsToPath, mirrorPoints, scaledLength } from '../lib/geometry.js';

const modal = document.getElementById('constructionModal');
const closeBtn = document.getElementById('closeConstructionModal');
const subtitle = document.getElementById('constructionSubtitle');
const diagramWrap = document.getElementById('constructionDiagram');
const measurementsWrap = document.getElementById('constructionMeasurements');

function measurementsHtml(p){
  const customer = (window.getCustomerBodyMeasurements ? window.getCustomerBodyMeasurements().fields : {}) || {};
  const rows = [
    {label:'Waist', drafted:p.base.waist, yours:customer.waistGirth},
    {label:'Hip', drafted:p.base.hip, yours:customer.hipGirth},
    {label:'Length', drafted:p.base.length, yours: scaledLength(p, customer.crotchHeight)}
  ];
  return `
        <div style="width:100%;margin-bottom:20px;">
          <div style="font-size:0.78rem;color:#b9d7f0;text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;">This pattern was drafted for</div>
          <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
            <thead>
              <tr style="color:#8fa9c2;text-align:left;">
                <th style="padding:4px 0;font-weight:500;"></th>
                <th style="padding:4px 0;font-weight:500;">Drafted</th>
                <th style="padding:4px 0;font-weight:500;">Yours</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr style="border-top:1px solid rgba(244,216,107,0.15);">
                  <td style="padding:6px 0;color:#f9f5ef;">${r.label}</td>
                  <td style="padding:6px 0;color:#f9f5ef;">${r.drafted} cm</td>
                  <td style="padding:6px 0;color:${r.yours!=null ? '#f4d86b' : '#58718a'};">${r.yours!=null ? r.yours.toFixed(1)+' cm' : 'not entered'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
}

function pieceSvg(piece){
  const { seam: curveSeam, allowance: curveAllow } = sampleSideCurve(piece.curves, piece.sideSA, 12);

  // Half-piece seamline: waist edge -> side curve -> hem edge -> fold edge (implicit close)
  const halfSeam = [piece.topFold, piece.topSide, ...curveSeam, piece.hemFold];
  // Half-piece seam allowance: waist shifted up, curve offset out, hem shifted down,
  // fold edge stays at x=0 (no allowance on the fold).
  const allowTopFold = {x:0, y:piece.topFold.y - piece.sideSA};
  const allowTopSide = {x:piece.topSide.x, y:piece.topSide.y - piece.sideSA};
  const allowHemFold = {x:0, y:piece.hemFold.y + piece.hemSA};
  const halfAllow = [allowTopFold, allowTopSide, ...curveAllow, allowHemFold];

  const fullSeam = [...mirrorPoints(halfSeam).reverse(), ...halfSeam];
  const fullAllow = [...mirrorPoints(halfAllow).reverse(), ...halfAllow];

  const allX = fullAllow.map(p=>p.x), allY = fullAllow.map(p=>p.y);
  const minX=Math.min(...allX), maxX=Math.max(...allX), minY=Math.min(...allY), maxY=Math.max(...allY);
  const w = maxX-minX, h = maxY-minY;
  const pad = 16;
  const targetH = 220;
  const scale = targetH / h;
  const svgW = w*scale + pad*2, svgH = h*scale + pad*2;

  function toSvg(p){ return {x:(p.x-minX)*scale+pad, y:(p.y-minY)*scale+pad}; }
  const seamPath = pointsToPath(fullSeam.map(toSvg)) + ' Z';
  const allowPath = pointsToPath(fullAllow.map(toSvg)) + ' Z';

  const foldTop = toSvg({x:0, y:piece.topFold.y});
  const foldBot = toSvg({x:0, y:piece.hemFold.y});
  const grainTop = toSvg({x:0, y:piece.topFold.y + (piece.hemFold.y-piece.topFold.y)*0.08});
  const grainBot = toSvg({x:0, y:piece.topFold.y + (piece.hemFold.y-piece.topFold.y)*0.92});

  return `
        <div style="text-align:center;">
          <svg width="${Math.min(svgW,260)}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
            <path d="${allowPath}" fill="none" stroke="#f4d86b" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.85"/>
            <path d="${seamPath}" fill="rgba(244,216,107,0.12)" stroke="#f4d86b" stroke-width="2.2"/>
            <line x1="${foldTop.x}" y1="${foldTop.y}" x2="${foldBot.x}" y2="${foldBot.y}" stroke="#b9d7f0" stroke-width="1" stroke-dasharray="1 6" opacity="0.6"/>
            <line x1="${grainTop.x+10}" y1="${grainTop.y}" x2="${grainBot.x+10}" y2="${grainBot.y}" stroke="#f9f5ef" stroke-width="1.4"/>
            <path d="M${grainTop.x+6},${grainTop.y+8} L${grainTop.x+10},${grainTop.y} L${grainTop.x+14},${grainTop.y+8}" fill="none" stroke="#f9f5ef" stroke-width="1.4"/>
            <path d="M${grainBot.x+6},${grainBot.y-8} L${grainBot.x+10},${grainBot.y} L${grainBot.x+14},${grainBot.y-8}" fill="none" stroke="#f9f5ef" stroke-width="1.4"/>
          </svg>
          <div style="font-family:'Unbounded',sans-serif; font-size:0.95rem; color:#f9f5ef; margin-top:4px;">${piece.label}</div>
          <div style="font-size:0.78rem; color:#b9d7f0; margin-top:2px;">${piece.cut}</div>
          <div style="font-size:0.72rem; color:#8fa9c2; margin-top:2px;">Dashed gold = seam allowance</div>
        </div>`;
}

export function openConstructionModal(patternId){
  const p = PATTERNS.find(x => x.id === patternId);
  if (!p || !p.pieces) return;
  subtitle.textContent = `${p.pieces.length} pattern piece${p.pieces.length === 1 ? '' : 's'} \u2014 fold line shown as center dashed line`;
  measurementsWrap.innerHTML = measurementsHtml(p);
  diagramWrap.innerHTML = p.pieces.map(pieceSvg).join('');
  modal.style.display = 'flex';
}

closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
