import { state, TREND_COLOR, DIFF_COLOR } from '../state.js';
import { PATTERNS } from '../data/patterns.js';
import { scaledLength } from '../lib/geometry.js';
import { svgDiagram, constructionIcon, assemblyPieceSvg, miniJellySvg, thumbGradient } from '../lib/diagrams.js';
import { syncPatternToCloud } from '../services/cloud-sync.js';
import { downloadPanelHtml, renderDownloadPanel } from '../services/pattern-downloads.js';
import { guideStepHtml } from '../components/figure-viewer.js';
import { fabricEstimate } from '../lib/fabric.js';
import { mountSewingAnimations } from '../components/sewing-player.js';

/* ============================================================
   PATTERN DETAIL
   ============================================================ */
export function renderDetail(){
  const p = PATTERNS.find(x=>x.id===state.currentPatternId);
  const el = document.getElementById('detailContent');
  if(!p){ el.innerHTML = '<p>Pattern not found.</p>'; return; }
  if(!state.progress[p.id]) state.progress[p.id] = new Set();

  const done = state.progress[p.id].size;
  const pct = Math.round((done/p.steps.length)*100);

  const customer = (window.getCustomerBodyMeasurements ? window.getCustomerBodyMeasurements().fields : {}) || {};
  const hasCustomerFit = customer.waistGirth != null || customer.hipGirth != null;
  const fit = {
    waist: customer.waistGirth ?? p.base.waist,
    hip: customer.hipGirth ?? p.base.hip,
    length: scaledLength(p, customer.crotchHeight) ?? p.base.length
  };
  const layoutEstimate = p.fabricLayout ? fabricEstimate(p, customer.hipGirth, customer.chestGirth) : null;
  const yardage = layoutEstimate ? layoutEstimate.metres.toFixed(1) : calcYardage(p, fit);
  const waistDiff = fit.waist - p.base.waist;
  const hipDiff = fit.hip - p.base.hip;

  el.innerHTML = `
    <div class="detail-head">
      <div class="detail-thumb" style="background:${p.image?'#f9f5ef':thumbGradient(TREND_COLOR[p.trend])};overflow:hidden;">${p.image?`<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;object-position:${p.imagePosition||'center'};"/>`:p.emoji}</div>
      <div class="detail-info">
        <div class="detail-meta">
          ${p.trend || !p.personalized ? `<span class="pill pill-${TREND_COLOR[p.trend]}">${p.trend}</span>` : ''}
          ${p.difficulty || !p.personalized ? `<span class="pill pill-${DIFF_COLOR[p.difficulty]}">${p.difficulty}</span>` : ''}
          ${p.personalized ? `<span class="pill pill-lime">Made to measure</span>` : ''}
        </div>
        <h1>${p.name}</h1>
        <div class="detail-facts">
          <div class="detail-fact ${p.pieces && p.pieces.length ? 'detail-fact-clickable' : ''}" ${p.pieces && p.pieces.length ? `onclick="openConstructionModal('${p.id}')"` : ''}>
            <span>Construction</span><b>${p.construction || (p.pieces && p.pieces.length ? `${p.pieces.length} pieces ${constructionIcon()}` : '—')}</b>
          </div>
          <div class="detail-fact"><span>Fabric</span><b>${p.fabric}</b></div>
          <div class="detail-fact"><span>Steps</span><b>${p.steps.length}</b></div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-primary btn-sm" onclick="toggleSave('${p.id}');renderDetail();">${state.saved.has(p.id)?'♥ Saved':'♡ Save pattern'}</button>
          <button class="btn btn-ghost btn-sm" onclick="resetProgress('${p.id}')">↺ Reset progress</button>
        </div>
        ${p.files && p.files.length ? `
        <div class="detail-actions" style="margin-top:12px;flex-wrap:wrap;">
          ${p.files.map(f => `<a class="btn btn-ghost btn-sm" href="${f.url}" download>⬇ ${f.label}</a>`).join('')}
        </div>` : ''}
      </div>
    </div>

    <div class="layout-split">
      <div>
        <div class="progress-wrap">
          <div class="progress-top"><span>Your progress</span><span>${done}/${p.steps.length} steps · ${pct}%</span></div>
          <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        </div>
        ${p.steps.map((s,i)=>`
          <div class="step-card ${state.progress[p.id].has(i)?'done':''}" onclick="toggleStep('${p.id}',${i})">
            <div class="step-check">${state.progress[p.id].has(i)?'✓':''}</div>
            <div class="step-main">
              <h3><span class="step-num">STEP ${i+1}</span> ${s.title}</h3>
              ${s.tutorial ? '' : `<p>${s.text}</p>`}
              ${s.figures ? guideStepHtml(p, s, i) : `<div class="diagram">${svgDiagram(s.diagram)}</div>`}
            </div>
          </div>`).join('')}
      </div>

      <div>
        ${p.personalized ? downloadPanelHtml(p) : ''}
        <div class="sidebar-card">
          <h3>🧵 Fabric estimate</h3>
          <div class="yardage-box"><span>You'll need about</span><b>${yardage} m</b></div>
          ${layoutEstimate ? fabricLayoutHtml(layoutEstimate, customer.hipGirth != null || customer.chestGirth != null) : ''}
          ${p.personalized ? `
          <p style="font-size:0.82rem;color:var(--text-dim);margin-top:10px;line-height:1.55;">
            ${p.fabricNote || 'This pattern is drafted to your saved measurements, so no fit adjustments are needed. Estimate based on fabric 53" (135 cm) wide.'}
          </p>` : hasCustomerFit ? `
          <p style="font-size:0.82rem;color:var(--text-dim);margin-top:10px;line-height:1.55;">
            Based on your saved measurements: your waist is ${Math.abs(waistDiff).toFixed(1)}cm ${waistDiff>=0?'bigger':'smaller'} and your hip is ${Math.abs(hipDiff).toFixed(1)}cm ${hipDiff>=0?'bigger':'smaller'} than this draft.
            Try ${waistDiff>=0?'adding':'removing'} about ${Math.abs(waistDiff/4).toFixed(1)}cm at the waist and ${hipDiff>=0?'adding':'removing'} about ${Math.abs(hipDiff/4).toFixed(1)}cm at the hip, on each side seam, tapering between the two.
          </p>` : `
          <p style="font-size:0.82rem;color:var(--text-dimmer);margin-top:10px;">
            Enter your measurements in your Profile (top right) to see a personalized estimate and fit adjustment tips here.
          </p>`}
        </div>
        ${p.pieces && p.pieces.length ? assemblyGuideHtml(p) : ''}
      </div>
    </div>
  `;

  mountSewingAnimations(el);
  if(p.personalized) renderDownloadPanel(p);

  // Let the main Jelly bubble finish its own pop-up first (she auto-hides
  // after 9s), then have the assembly-guide's mini-Jelly take a turn once
  // per pattern \u2014 never repeats on later re-renders of the same pattern.
  if(p.pieces && p.pieces.length && !state.miniJellyShownFor[p.id]){
    state.miniJellyShownFor[p.id] = true;
    const miniId = 'miniJelly-'+p.id;
    setTimeout(() => {
      showMiniJelly(miniId);
      setTimeout(() => hideMiniJelly(miniId), 6000);
    }, 9500);
  }
}

// How the layout-based estimate was reached, in inches, for patterns with a fabricLayout.
function fabricLayoutHtml(e, personal){
  const q = v => { const e = Math.round(v * 8), w = Math.floor(e / 8), r = e % 8; return (w || !r ? String(w) : '') + ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'][r]; };
  return `
          <p style="font-size:0.82rem;color:var(--text-dim);margin-top:10px;line-height:1.55;">
            ${e.twoFolds
              ? `Selvages folded to the centre, front and back side by side on the two folds: ${q(e.piecesIn)}".`
              : `Your pieces are too wide to sit side by side, so fold the fabric in half lengthwise and cut the front and back one after the other on the fold: ${q(e.piecesIn)}".`}
            Two bias strips at 45°: ${q(e.biasIn)}". Cutting allowances: ${q(e.allowIn)}" (1" at each end to straighten the grain, 1" between sections).
            ${personal ? '' : `Shown for the reference size; it changes with your bust and hip measurements.`}
          </p>`;
}

export function calcYardage(p, fit){
  const ratio = ((fit.waist/p.base.waist) + (fit.hip/p.base.hip) + (fit.length/p.base.length)) / 3;
  return (Math.round(p.yardageBase * ratio * 10) / 10).toFixed(1);
}

export function toggleStep(patternId, index){
  const set = state.progress[patternId];
  if(set.has(index)) set.delete(index); else set.add(index);
  if(set.size>0) state.saved.add(patternId);
  renderDetail();
  syncPatternToCloud(patternId);
}

export function resetProgress(patternId){
  state.progress[patternId] = new Set();
  renderDetail();
  syncPatternToCloud(patternId);
}

// Shows/hides the small tooltip bubble next to the mini-Jelly icon inside
// the assembly-guide card. Kept separate from the main fixed jellyfish's
// showTip/hideTip so the two never interfere with each other.
export function showMiniJelly(id){
  const el = document.getElementById(id+'-bubble');
  if(el){ el.style.opacity='1'; el.style.transform='translateY(0) scale(1)'; el.style.pointerEvents='auto'; }
}
export function hideMiniJelly(id){
  const el = document.getElementById(id+'-bubble');
  if(el){ el.style.opacity='0'; el.style.transform='translateY(6px) scale(.94)'; el.style.pointerEvents='none'; }
}

export function assemblyGuideHtml(p){
  if(!p.pieces || !p.pieces.length) return '';
  const miniId = 'miniJelly-'+p.id;
  return `
    <div class="sidebar-card" style="position:relative;">
      <h3>🧩 How the pages tape together</h3>
      <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;">
        ${p.pieces.map(piece => assemblyPieceSvg(piece)).join('')}
      </div>
      <p style="font-size:0.78rem;color:var(--text-dimmer);margin-top:10px;">True to scale \u2014 circles mark where page corners line up, dashed borders show the overlap. Blank areas on some pages are normal; the shape doesn't fill every page evenly.</p>
      <p style="font-size:0.78rem;color:var(--text-dim);margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">🪡 <b>Before you cut:</b> fold your fabric in half, line the pattern's fold edge up with your fabric's fold, and cut through both layers at once \u2014 this half-piece becomes a full front (or back) once cut on the fold.</p>
      <div style="position:absolute;bottom:-16px;right:-8px;cursor:pointer;z-index:3;" onmouseenter="showMiniJelly('${miniId}')" onmouseleave="hideMiniJelly('${miniId}')">
        <div id="${miniId}-bubble" style="position:absolute;bottom:44px;right:0;width:180px;background:#faf8f4;border:1px solid rgba(18,49,77,0.12);border-radius:14px;padding:10px 14px;font-size:0.76rem;line-height:1.4;color:#12314d;box-shadow:0 8px 20px rgba(18,49,77,0.18);opacity:0;transform:translateY(6px) scale(.94);pointer-events:none;transition:opacity .2s ease, transform .2s ease;">
          <b style="display:block;font-family:'Unbounded',sans-serif;font-size:0.7rem;margin-bottom:3px;">Jelly says:</b>
          Don't forget \u2014 fold your fabric first, then cut through both layers so you get a whole piece, not just half! ✂️
        </div>
        ${miniJellySvg()}
      </div>
    </div>`;
}
