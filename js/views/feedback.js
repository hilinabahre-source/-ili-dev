import { state, FEEDBACK_LEVELS } from '../state.js';
import { toast } from '../router.js';

/* ============================================================
   CREATE
   ============================================================ */
export function renderFeedbackView(){
  const wrap = document.getElementById('fbLevelChips');
  wrap.innerHTML = FEEDBACK_LEVELS.map(l=>
    `<button type="button" class="chip ${state.feedbackLevel===l?'active':''}" onclick="setFeedbackLevel('${l}')">${l}</button>`).join('');
}

export function setFeedbackLevel(l){ state.feedbackLevel=l; renderFeedbackView(); }

export function submitFeedback(){
  const trouble = document.getElementById('fbTrouble').value.trim();
  const better = document.getElementById('fbBetter').value.trim();

  if(!state.feedbackLevel){ toast('Let us know your experience level first 🙂'); return; }
  if(!trouble && !better){ toast('Share at least one thought before sending'); return; }

  document.getElementById('fbTrouble').value = '';
  document.getElementById('fbBetter').value = '';
  state.feedbackLevel = null;
  renderFeedbackView();

  toast('💛 Thank you for being honest with us.');
}
