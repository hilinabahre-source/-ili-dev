import { state, TREND_COLOR } from '../state.js';
import { PATTERNS } from '../data/patterns.js';
import { thumbGradient } from '../lib/diagrams.js';
import { renderDownloadHistory } from '../services/pattern-downloads.js';

/* ============================================================
   MY PATTERNS
   ============================================================ */
export function renderMyPatterns(){
  renderDownloadHistory();
  const grid = document.getElementById('mpGrid');
  const ids = new Set([...state.saved, ...Object.keys(state.progress).filter(id=>state.progress[id].size>0)]);
  const list = [...ids].map(id=>PATTERNS.find(p=>p.id===id)).filter(Boolean);

  if(list.length===0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="emoji-lg">🫶</div><p>Nothing saved yet — heart a pattern in Discover or start checking off steps.</p></div>`;
    return;
  }
  grid.innerHTML = list.map(p=>{
    const done = state.progress[p.id] ? state.progress[p.id].size : 0;
    const pct = Math.round((done/p.steps.length)*100);
    const statusText = done===0 ? 'Saved · not started' : (done===p.steps.length ? 'Complete! 🎉' : `In progress · ${pct}%`);
    return `<div class="mp-card" onclick="navigate('detail','${p.id}')">
      <div class="mp-thumb" style="background:${p.image?'#f9f5ef':thumbGradient(TREND_COLOR[p.trend])};overflow:hidden;">${p.image?`<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;object-position:${p.imagePosition||'center'};"/>`:p.emoji}</div>
      <div class="mp-info">
        <h3>${p.name}</h3>
        <div class="mp-status">${statusText}</div>
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      </div>
    </div>`;
  }).join('');
}
