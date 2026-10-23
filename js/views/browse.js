import { state, TREND_COLOR, DIFF_COLOR } from '../state.js';
import { PATTERNS } from '../data/patterns.js';
import { render, toast } from '../router.js';
import { printPagePreview, thumbGradient } from '../lib/diagrams.js';
import { syncPatternToCloud } from '../services/cloud-sync.js';

/* ============================================================
   BROWSE
   ============================================================ */
export function renderBrowse(){
  const q = (document.getElementById('searchInput')?.value||'').toLowerCase();
  let list = PATTERNS.filter(p=>
    p.name.toLowerCase().includes(q)
  );

  const grid = document.getElementById('patternGrid');
  if(list.length===0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="emoji-lg">🔎</div><p>No patterns match.</p></div>`;
    return;
  }
  grid.innerHTML = list.map((p,idx)=>`
    <div class="pattern-card reel" onclick="navigate('detail','${p.id}')">  
      <button class="save-btn ${state.saved.has(p.id)?'saved':''}" onclick="event.stopPropagation();toggleSave('${p.id}')">${state.saved.has(p.id)?'♥':'♡'}</button>
      <div class="pattern-thumb" style="background:${p.image?'#f9f5ef':thumbGradient(TREND_COLOR[p.trend]||'pink')};overflow:hidden;display:flex;align-items:center;justify-content:center;">${p.image?`<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;object-position:${p.imagePosition||'center'};"/>`:p.emoji}</div>
      <div class="pattern-body">
        <h3>${p.name}</h3>
        <div class="pattern-meta">
          ${p.comingSoon ? `<span class="pill pill-purple">Coming soon</span>` : `
          ${p.trend?`<span class="pill pill-${TREND_COLOR[p.trend]}">${p.trend}</span>`:''}
          ${p.difficulty?`<span class="pill pill-${DIFF_COLOR[p.difficulty]}">${p.difficulty}</span>`:''}
          `}
        </div>
        <div class="pattern-foot">
          <span>${p.time?`⏱ ${p.time}`:''}${p.time?' ':''}${stepProgressLabel(p.id)}</span>
          ${p.files && p.files.length ? `<span style="display:flex;align-items:center;">${printPagePreview()}</span>` : ''}
        </div>
      </div>
    </div>`).join('');
}

export function stepProgressLabel(id){
  const done = state.progress[id] ? state.progress[id].size : 0;
  const pattern = PATTERNS.find(p=>p.id===id);
  if(!pattern) return '';
  return done>0 ? `${done}/${pattern.steps.length} steps` : `${pattern.steps.length} steps`;
}

export function setTrendFilter(t){ state.activeTrend=t; renderBrowse(); }
export function setDiffFilter(d){ state.activeDifficulty=d; renderBrowse(); }

export function toggleSave(id){
  if(state.saved.has(id)) state.saved.delete(id); else { state.saved.add(id); toast('Saved to My Patterns 💜'); }
  render();
  syncPatternToCloud(id);
}
