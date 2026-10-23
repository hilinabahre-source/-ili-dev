import { PATTERNS } from '../data/patterns.js';
import { state } from '../state.js';
import { toast } from '../router.js';

/* ============================================================
   MADE-TO-MEASURE PATTERN DOWNLOADS
   The PDF is generated server-side (Supabase Edge Function
   "generate-pattern") from the customer's saved profile measurements.
   The browser only sends the pattern id and paper size.
   ============================================================ */

const CM_PER_IN = 2.54;
const PAPER_LABELS = { A0: 'A0 (one sheet, print shop)', A4: 'A4 (home printer)', Letter: 'US Letter (home printer)' };
// Saved columns a pattern uses, in the order shown to the customer (patterns can list their own in
// personalized.measurements). Values are stored in cm and always shown in inches.
const DEFAULT_MEASUREMENTS = [
  ['chest_girth', 'Bust'], ['waist_girth', 'Waist'], ['hip_girth', 'Hip'], ['shoulder_width', 'Shoulder width']
];
const COLUMN_NAMES = { chest_girth: 'bust', waist_girth: 'waist', hip_girth: 'hip', shoulder_width: 'shoulder' };
const measurementsFor = (p) => p.personalized.measurements || DEFAULT_MEASUREMENTS;

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtIn = (n) => String(Number(Number(n).toFixed(2)));   // 14.75, 36, 29.5

let busy = false;

function rememberedPaper(papers) {
  try {
    const p = localStorage.getItem('ili_paper');
    if (papers.includes(p)) return p;
  } catch (e) { /* storage unavailable */ }
  return papers.includes('A4') ? 'A4' : papers[0];
}

// supabase.js is loaded lazily from main.js; wait briefly for it.
function whenSupabaseReady() {
  if (window.supabaseClient) return Promise.resolve(window.supabaseClient);
  return new Promise(resolve => {
    const done = () => resolve(window.supabaseClient || null);
    window.addEventListener('ili-supabase-ready', done, { once: true });
    setTimeout(done, 8000);
  });
}

// Opens the existing BodyDouble profile modal (same as the top-right profile button).
export function openProfile() {
  document.getElementById('profileIconBtn')?.click();
}

async function currentSession() {
  const client = await whenSupabaseReady();
  if (!client) return { client: null, session: null };
  const { data } = await client.auth.getSession();
  return { client, session: data.session };
}

// POST to the generate-pattern Edge Function with the customer's session.
function callGenerator(session, body) {
  return fetch(`${window.iliSupabaseUrl}/functions/v1/generate-pattern`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': window.iliSupabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

// Server-side check of the saved measurements against the pattern's supported ranges.
// Returns null when everything is fine (or the check could not run: the download re-checks anyway).
async function rangeIssues(session, patternId) {
  try {
    const res = await callGenerator(session, { pattern: patternId, check: true });
    if (res.status !== 422) return null;
    const info = await res.json();
    return info.error === 'measurements_out_of_range' ? info : null;
  } catch (e) {
    return null;
  }
}

function issuesHtml(info, list) {
  const items = (info.issues || []).map(i => `<li>${esc(i.message)}</li>`).join('') || `<li>${esc(info.message || '')}</li>`;
  return `
      <p class="dl-note"><b>Please review your measurements.</b> Some of them are outside the sizes this pattern currently supports, so we haven't generated it, to avoid a distorted fit:</p>
      <ul class="dl-issues">${items}</ul>
      ${list ? `<p class="dl-note dl-small">Your saved measurements:</p><ul class="dl-measurements">${list}</ul>` : ''}
      <button class="btn btn-primary btn-sm dl-wide" onclick="iliOpenProfile()">Review my measurements</button>
      <p class="dl-note dl-small">If your measurements are correct, please contact us. We're expanding the supported sizes.</p>`;
}

/* ---------- Pattern detail: the download panel ---------- */

export function downloadPanelHtml(p) {
  return `
    <div class="sidebar-card dl-card" id="dlPanel" data-pattern="${esc(p.id)}">
      <h3>📐 Your made-to-measure pattern</h3>
      <div id="dlPanelBody"><p class="dl-note">Loading your profile…</p></div>
    </div>`;
}

export async function renderDownloadPanel(p) {
  const body = document.getElementById('dlPanelBody');
  if (!body || !p.personalized) return;
  const { client, session } = await currentSession();
  if (document.getElementById('dlPanel')?.dataset.pattern !== p.id) return;   // navigated away meanwhile

  if (!client) {
    body.innerHTML = `<p class="dl-note dl-error">Accounts are unavailable right now. Please try again later.</p>`;
    return;
  }
  if (!session) {
    body.innerHTML = `
      <p class="dl-note">This pattern is generated from the measurements in your profile. Sign in or create a free account in your profile to download it.</p>
      <button class="btn btn-primary btn-sm dl-wide" onclick="iliOpenProfile()">Sign in from my profile</button>`;
    return;
  }

  const { data: row, error } = await client.from('measurements').select('*').eq('user_id', session.user.id).maybeSingle();
  if (document.getElementById('dlPanel')?.dataset.pattern !== p.id) return;
  if (error) {
    body.innerHTML = `<p class="dl-note dl-error">Could not load your saved measurements. Please try again.</p>`;
    return;
  }
  const used = measurementsFor(p);
  const missing = used.filter(([col]) => !(Number(row?.[col]) > 0)).map(([, label]) => label);
  const list = used.filter(([col]) => Number(row?.[col]) > 0).map(([col, label]) =>
    `<li><span>${label}</span><b>${fmtIn(row[col] / CM_PER_IN)} in</b></li>`).join('');

  if (missing.length) {
    body.innerHTML = `
      <p class="dl-note">To make your pattern we need these measurements in your profile: <b>${esc(missing.join(', '))}</b>.</p>
      ${list ? `<ul class="dl-measurements">${list}</ul>` : ''}
      <button class="btn btn-primary btn-sm dl-wide" onclick="iliOpenProfile()">Complete my profile</button>
      <p class="dl-note dl-small">Enter them in your profile and press Save while signed in.</p>`;
    return;
  }

  const issues = await rangeIssues(session, p.personalized.patternId);
  if (document.getElementById('dlPanel')?.dataset.pattern !== p.id) return;
  if (issues) {
    body.innerHTML = issuesHtml(issues, list);
    return;
  }

  const papers = p.personalized.papers;
  const chosen = rememberedPaper(papers);
  body.innerHTML = `
    <p class="dl-note">Generated from your saved profile measurements:</p>
    <ul class="dl-measurements">${list}</ul>
    <p class="dl-note dl-small">Not right? <button class="dl-link" onclick="iliOpenProfile()">Update my profile</button></p>
    <div class="dl-papers" role="radiogroup" aria-label="Paper size">
      ${papers.map(code => `<button type="button" class="chip ${code === chosen ? 'active' : ''}" role="radio"
          aria-checked="${code === chosen}" data-paper="${code}" onclick="iliChoosePaper('${code}')">${esc(PAPER_LABELS[code] || code)}</button>`).join('')}
    </div>
    <button class="btn btn-primary btn-sm dl-wide" id="dlButton" onclick="iliDownloadPattern('${esc(p.id)}')">⬇ Download My Pattern</button>
    <p class="dl-note dl-small" id="dlStatus" role="status" aria-live="polite"></p>`;
}

export function choosePaper(code) {
  try { localStorage.setItem('ili_paper', code); } catch (e) { /* storage unavailable */ }
  document.querySelectorAll('.dl-papers .chip').forEach(b => {
    const on = b.dataset.paper === code;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
}

export async function downloadPattern(patternId) {
  if (busy) return;
  const p = PATTERNS.find(x => x.id === patternId);
  if (!p || !p.personalized) return;
  const paper = document.querySelector('.dl-papers .chip.active')?.dataset.paper || rememberedPaper(p.personalized.papers);
  const button = document.getElementById('dlButton');
  const status = document.getElementById('dlStatus');
  const setStatus = (text, isError) => { if (status) { status.textContent = text; status.classList.toggle('dl-error', !!isError); } };

  const { session } = await currentSession();
  if (!session) { toast('Please sign in from your profile first'); openProfile(); return; }

  busy = true;
  if (button) { button.disabled = true; button.textContent = 'Making your pattern…'; }
  setStatus('This takes a few seconds.');
  try {
    const res = await callGenerator(session, { pattern: p.personalized.patternId, paper });

    if (!res.ok) {
      let info = {};
      try { info = await res.json(); } catch (e) { /* not JSON */ }
      if (info.error === 'measurements_missing' || info.error === 'measurements_out_of_range') {
        setStatus(info.message, true);
        renderDownloadPanel(p);
        return;
      }
      if (res.status === 401) { setStatus(info.message || 'Please sign in again.', true); openProfile(); return; }
      setStatus(info.message || 'Something went wrong. Please try again.', true);
      return;
    }

    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || `ILI-${patternId}-${paper}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setStatus(`Downloaded ${name}. Print at 100% and check the test squares.`);
    toast('📄 Your pattern is ready!');
  } catch (e) {
    console.error('Pattern download failed:', e);
    setStatus('Could not reach the pattern service. Check your connection and try again.', true);
  } finally {
    busy = false;
    if (button) { button.disabled = false; button.textContent = '⬇ Download My Pattern'; }
  }
}

/* ---------- My Patterns: download history ---------- */

export async function renderDownloadHistory() {
  const el = document.getElementById('mpHistory');
  if (!el) return;
  const { client, session } = await currentSession();
  if (!client || !session) {
    el.innerHTML = `<h2>📄 Your pattern downloads</h2>
      <p class="dl-note">Sign in from your profile to see the patterns you've downloaded.</p>`;
    return;
  }
  const { data, error } = await client.from('pattern_downloads')
    .select('pattern_id, paper, measurements_cm, created_at')
    .order('created_at', { ascending: false }).limit(25);
  if (error) {
    el.innerHTML = `<h2>📄 Your pattern downloads</h2><p class="dl-note dl-error">Could not load your download history.</p>`;
    return;
  }
  if (!data.length) {
    el.innerHTML = `<h2>📄 Your pattern downloads</h2>
      <p class="dl-note">No downloads yet. Made-to-measure patterns you download will appear here.</p>`;
    return;
  }
  el.innerHTML = `<h2>📄 Your pattern downloads</h2>
    <div class="dl-history">${data.map(d => {
      const p = PATTERNS.find(x => x.id === d.pattern_id);
      const when = new Date(d.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      const m = d.measurements_cm || {};
      const sizes = Object.keys(COLUMN_NAMES).filter(k => m[k] != null)
        .map(k => `${COLUMN_NAMES[k]} ${fmtIn(m[k] / CM_PER_IN)}"`).join(' · ');
      return `<div class="dl-history-row" ${p ? `onclick="navigate('detail','${esc(p.id)}')"` : ''}>
        <div><b>${esc(p ? p.name : d.pattern_id)}</b><span>${esc(when)} · ${esc(d.paper === 'Letter' ? 'US Letter' : d.paper)}</span></div>
        <small>${esc(sizes)}</small>
      </div>`;
    }).join('')}</div>`;
}

/* ---------- Keep the panel and history in sync with sign-in and profile saves ---------- */

function refreshVisible() {
  if (state.view === 'detail') {
    const p = PATTERNS.find(x => x.id === state.currentPatternId);
    if (p && p.personalized) renderDownloadPanel(p);
  }
  if (state.view === 'mypatterns') renderDownloadHistory();
}

whenSupabaseReady().then(client => {
  client?.auth.onAuthStateChange(() => setTimeout(refreshVisible, 0));
});
// Fired by services/supabase.js once the profile's Save has written measurements to Supabase.
window.addEventListener('ili-measurements-saved', refreshVisible);
