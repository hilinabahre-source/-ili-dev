import { state } from '../state.js';
import { toast } from '../router.js';

export function renderRequest(){
  const feed = document.getElementById('requestFeed');
  if(state.requests.length === 0){
    feed.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="emoji-lg">💬</div><p>No requests yet. Be the first to submit one!</p></div>`;
    return;
  }
  feed.innerHTML = state.requests.map((req, idx) => `
    <div class="request-item">
      <div class="req-meta">
        <span class="req-timestamp">${new Date(req.date).toLocaleDateString()}</span>
      </div>
      <h3>${req.name}</h3>
      <p class="req-desc">${req.desc.replace(/\n/g, '<br>')}</p>
    </div>
  `).reverse().join('');
}

// Opens Pinterest's own real search results in a new tab, pre-filled with
// whatever the person has typed so far in the Details & inspiration field.
// No API, no approval needed — just Pinterest's normal public search URL.
export function searchPinterest(){
  const text = document.getElementById('reqDesc').value.trim();
  if(!text){ toast('Type a bit of what you\'re looking for first ✨'); return; }
  const url = 'https://www.pinterest.com/search/pins/?q=' + encodeURIComponent(text);
  window.open(url, '_blank', 'noopener');
}

export function submitRequest(){
  const name = document.getElementById('reqName').value.trim();
  const desc = document.getElementById('reqDesc').value.trim();

  if(!name || !desc){
    toast('Please fill in both fields');
    return;
  }

  state.requests.push({
    name: name,
    desc: desc,
    date: new Date().toISOString()
  });

  document.getElementById('reqName').value = '';
  document.getElementById('reqDesc').value = '';
  renderRequest();
  toast('✨ Request submitted! Thanks for sharing your design idea.');
}
