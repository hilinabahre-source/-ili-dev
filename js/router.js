import { state } from './state.js';
import { renderHome } from './views/home.js';
import { renderDonate } from './views/donate.js';
import { renderRequest } from './views/request.js';
import { renderFeedbackView } from './views/feedback.js';
import { renderBrowse } from './views/browse.js';
import { renderDetail } from './views/detail.js';
import { renderMyPatterns } from './views/my-patterns.js';

/* ============================================================
   NAVIGATION
   ============================================================ */
export function navigate(view, param){
  state.view = view;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  document.querySelectorAll('.nav-links button').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  if(view==='detail' && param) state.currentPatternId = param;
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}

export function render(){
  if(state.view==='home') renderHome();
  if(state.view==='browse') renderBrowse();
  if(state.view==='detail') renderDetail();
  if(state.view==='create') renderFeedbackView();
  if(state.view==='request') renderRequest();
  if(state.view==='mypatterns') renderMyPatterns();
  if(state.view==='donate') renderDonate();
}

export function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}
