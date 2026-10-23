import { PATTERNS } from '../data/patterns.js';
import { DONATION_CAUSES } from '../data/donations.js';
import { TREND_COLOR, DIFF_COLOR } from '../state.js';
import { donationCauseHtml } from '../views/donate.js';
import { sewingAnimationHtml, mountSewingAnimations } from './sewing-player.js';

/* ============================================================
   HOME JOURNEY ("follow the thread")
   A scroll-driven walkthrough under the home hero: one embroidered thread runs down the page,
   draws itself as the visitor scrolls and ties five stops together (profile & avatar, Discover,
   My Patterns & sewing, Request Design, Donations). Each stop has a miniature screen built from
   the site's own markup, classes, data and sewing animations; a cursor demonstrates it when the
   screen scrolls into view.
   Everything inside a miniature screen is simulated. It never touches the real state, accounts,
   Supabase, the BodyDouble viewer or the pattern service, and the screens are inert, so visitors
   can't click into them. "Try it yourself" buttons open the real features.
   ============================================================ */

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const CANCEL = Symbol('cancelled');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PICK_ID = 'aline-silk-dress';   // the pattern the demos save and sew

/* ---------- copies of the real page, made safe to show ---------- */

// Copy of a real element with ids, inline handlers and links removed, so nothing in a
// miniature can collide with or trigger the real page.
function cleanCopy(node) {
  const copy = node.cloneNode(true);
  const all = copy.nodeType === 1 ? [copy, ...copy.querySelectorAll('*')] : [...copy.querySelectorAll('*')];
  all.forEach(n => {
    n.removeAttribute('id');
    [...n.attributes].forEach(a => { if (a.name.startsWith('on')) n.removeAttribute(a.name); });
    if (n.tagName === 'A') { n.removeAttribute('href'); n.removeAttribute('target'); }
  });
  return copy;
}
function safeHtml(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  const wrap = document.createElement('div');
  wrap.appendChild(cleanCopy(t.content));
  return wrap.innerHTML;
}
const outer = sel => { const el = document.querySelector(sel); return el ? cleanCopy(el).outerHTML : ''; };

const profileIconSvg = () => document.querySelector('#profileIconBtn svg')?.outerHTML || '';

function pills(p) {
  if (p.comingSoon) return `<span class="pill pill-purple">Coming soon</span>`;
  return `${p.trend ? `<span class="pill pill-${TREND_COLOR[p.trend]}">${p.trend}</span>` : ''}
          ${p.difficulty ? `<span class="pill pill-${DIFF_COLOR[p.difficulty]}">${p.difficulty}</span>` : ''}`;
}
const thumbImg = p => p.image
  ? `<img src="${p.image}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:${p.imagePosition || 'center'};">`
  : p.emoji;

/* ---------- miniature avatar ----------
   An illustration standing in for the live 3D avatar (the demo never loads the real viewer).
   It reshapes from the same four measurements the demo types, like the real profile does. */

const AVATAR_START = { height: 165, chestGirth: 90, waistGirth: 74, hipGirth: 99 };

function smooth(pts) {
  // Closed Catmull-Rom curve through the points.
  const n = pts.length, P = i => pts[(i + n) % n];
  let d = `M${P(0)[0].toFixed(1)},${P(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

function avatarSvg(m, focus) {
  const bust = m.chestGirth * 0.4, waist = m.waistGirth * 0.4, hip = m.hipGirth * 0.4;
  const mix = (a, b, t) => a + (b - a) * t;
  // Right half of the body, from the neck down the outside to the foot and back up the inside leg.
  const half = [
    [7, 50], [9, 61], [22, 67], [37, 73], [bust - 3, 96], [bust, 115], [mix(bust, waist, 0.5), 134],
    [waist, 158], [mix(waist, hip, 0.62), 180], [hip, 199], [hip - 2, 216], [hip * 0.78, 250],
    [hip * 0.52 + 1, 292], [hip * 0.55 + 1, 322], [12, 379], [15, 398], [12, 405], [4, 405],
    [5, 380], [4, 330], [5, 292], [3, 240], [1.5, 218]
  ];
  const body = [...half.map(([x, y]) => [100 + x, y]), [100, 214], ...half.slice().reverse().map(([x, y]) => [100 - x, y])];
  const arm = side => {
    const s = side, base = [100 + s * 33, 79], a = 0.43, len = 142;
    const dir = [s * Math.sin(a), Math.cos(a)], nrm = [Math.cos(a), -s * Math.sin(a)];
    const at = (t, w) => [base[0] + dir[0] * len * t + nrm[0] * w, base[1] + dir[1] * len * t + nrm[1] * w];
    const pts = [at(0, -10), at(0.45, -8), at(0.92, -5.2), at(1.06, -5.6), at(1.2, 0), at(1.06, 5.6), at(0.92, 5.4), at(0.45, 8.5), at(0, 11)];
    return `<path d="${smooth(pts)}" fill="url(#jmSkin)" stroke="rgba(16,45,68,.16)" stroke-width="1"/>`;
  };
  const sy = m.height / 165;
  const ring = (y, hw, label) => `
    <ellipse cx="100" cy="${y}" rx="${(hw + 5).toFixed(1)}" ry="6.5" fill="none" stroke="#f39b5b" stroke-width="2.4" stroke-dasharray="5 4"/>
    <g transform="translate(${(100 + hw + 12).toFixed(1)} ${y - 9})"><rect width="${label.length * 6.4 + 14}" height="18" rx="9" fill="#102d44"/>
    <text x="7" y="12.5" font-size="10.5" font-family="Space Grotesk, sans-serif" fill="#faf8f4">${label}</text></g>`;
  const marks = {
    height: `<line x1="164" y1="10" x2="164" y2="405" stroke="#f39b5b" stroke-width="2.4" stroke-dasharray="5 4"/>
             <path d="M158,18 L164,8 L170,18 M158,397 L164,407 L170,397" fill="none" stroke="#f39b5b" stroke-width="2.4"/>
             <g transform="translate(118 196)"><rect width="40" height="18" rx="9" fill="#102d44"/><text x="7" y="12.5" font-size="10.5" font-family="Space Grotesk, sans-serif" fill="#faf8f4">Height</text></g>`,
    chestGirth: ring(115, bust, 'Bust'), waistGirth: ring(158, waist, 'Waist'), hipGirth: ring(199, hip, 'Hip')
  };
  return `<svg viewBox="0 -70 200 485" class="jm-avatar-svg" aria-hidden="true">
    <defs><linearGradient id="jmSkin" x1="0" x2="1">
      <stop offset="0" stop-color="#9eabc9"/><stop offset=".45" stop-color="#d3dbec"/><stop offset="1" stop-color="#a3b0cd"/>
    </linearGradient></defs>
    <ellipse cx="100" cy="409" rx="46" ry="6" fill="rgba(16,45,68,.08)"/>
    <g transform="translate(0 ${(405 * (1 - sy)).toFixed(1)}) scale(1 ${sy.toFixed(4)})">
      ${arm(1)}${arm(-1)}
      <path d="${smooth(body)}" fill="url(#jmSkin)" stroke="rgba(16,45,68,.16)" stroke-width="1"/>
      <ellipse cx="100" cy="29" rx="15" ry="19.5" fill="url(#jmSkin)" stroke="rgba(16,45,68,.16)" stroke-width="1"/>
      ${focus ? marks[focus] || '' : ''}
    </g>
  </svg>`;
}

// Tweens the avatar between shapes (like the real viewer settling after an edit).
class MiniAvatar {
  constructor(el) { this.el = el; this.cur = { ...AVATAR_START }; this.focus = null; this.draw(); }
  draw() { this.el.innerHTML = avatarSvg(this.cur, this.focus); }
  setFocus(f) { this.focus = f; this.draw(); }
  morph(target, instant) {
    const from = { ...this.cur }, t0 = performance.now(), dur = 650;
    cancelAnimationFrame(this.raf);
    if (instant || reducedMotion()) { Object.assign(this.cur, target); this.draw(); return; }
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      for (const k in target) this.cur[k] = from[k] + (target[k] - from[k]) * e;
      this.draw();
      if (t < 1 && this.el.isConnected) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}

/* ---------- the five stops ---------- */

const STOPS = [
  {
    key: 'profile', label: 'Profile', kicker: 'Profile & Avatar', side: 'right', height: 640,
    title: 'Build your avatar once',
    text: `Open your profile (top right) to enter your measurements, and it's there for every pattern you open — no re-measuring each time.`,
    more: 'Your 3D avatar reshapes as you type each measurement.',
    steps: ['Tap the yellow profile icon', 'Enter your measurements', 'Watch your avatar update', 'Save — it’s there next time'],
    note: 'Illustration. Your real profile shows a live 3D avatar.',
    tryLabel: 'Open my profile', tryIt: () => document.getElementById('profileIconBtn')?.click(),
    build: buildProfile, script: scriptProfile
  },
  {
    key: 'discover', label: 'Discover', kicker: 'Discover', side: 'left', height: 610,
    title: 'Browse the list',
    text: 'More to come — pulled straight from Pinterest finds.',
    more: 'Heart anything you’d like to sew and it’s waiting for you in My Patterns.',
    steps: ['Open Discover', 'Browse the patterns', 'Pick one you love', 'Tap the heart', 'Saved to My Patterns'],
    tryLabel: 'Try it yourself', tryIt: () => window.navigate?.('browse'),
    build: buildNavPage, script: scriptDiscover
  },
  {
    key: 'sew', label: 'My Patterns', kicker: 'My Patterns & Sewing', side: 'right', height: 660,
    title: 'Follow animated, checkable steps',
    text: 'Every step has a mini seam diagram so you always know exactly where the needle goes next.',
    more: 'Press play, watch the stitch, tick the step off and the next one is ready.',
    steps: ['Open My Patterns', 'Open your saved pattern', 'Press Play', 'Check off the step', 'On to the next step'],
    tryLabel: 'Try it yourself', tryIt: () => window.navigate?.('detail', PICK_ID),
    build: buildNavPage, script: scriptSew
  },
  {
    key: 'request', label: 'Request', kicker: 'Request Design', side: 'left', height: 610,
    title: 'Ask for the next pattern',
    text: 'Tell us what you want to sew. We’ll add it to our wishlist and make it if we love it.',
    more: 'Describe it, add your Pinterest inspo, and send.',
    steps: ['Open Request Design', 'Describe your idea', 'Add your inspiration', 'Submit your request'],
    note: 'Demo only. Nothing is sent.',
    tryLabel: 'Try it yourself', tryIt: () => window.navigate?.('request'),
    build: buildNavPage, script: scriptRequest
  },
  {
    key: 'donate', label: 'Donate', kicker: 'Donations', side: 'center', height: 600,
    title: 'Give back, if you’d like',
    text: 'The Donation Bin gathers causes we care about. Each Donate button opens that charity’s own page.',
    more: 'Giving is always optional. Every pattern works the same either way.',
    steps: ['Open the Donation Bin', 'Read about a cause', 'Choose to give — or not'],
    note: 'Demo only. No donation is made.',
    tryLabel: 'Visit the Donation Bin', tryIt: () => window.navigate?.('donate'),
    build: buildNavPage, script: scriptDonate
  }
];

function journeyHtml() {
  const stop = (s, i) => `
    <article class="jstop jstop-${s.side}" id="journey-${s.key}" data-stop="${i}">
      <div class="jcopy">
        <button type="button" class="jknot" data-goto="${i}" aria-label="Chapter ${i + 1}: ${s.kicker}">${String(i + 1).padStart(2, '0')}</button>
        <p class="jkicker">${s.kicker}</p>
        <h3>${s.title}</h3>
        <p class="jtext">${s.text}</p>
        <p class="jtext jtext-more">${s.more}</p>
        <ol class="jsteps">${s.steps.map(t => `<li>${t}</li>`).join('')}</ol>
        <div class="jactions">
          <button type="button" class="btn btn-ghost btn-sm jreplay">↺ Replay</button>
          <button type="button" class="btn btn-primary btn-sm jtry">${s.tryLabel} →</button>
        </div>
      </div>
      <div class="jscreen-wrap">
        <div class="jscreen" inert aria-hidden="true">
          <div class="jscreen-bar"><i></i><i></i><i></i><span>ilipatterns.com</span></div>
          <div class="jscreen-view"><div class="jscreen-inner"></div></div>
        </div>
        ${s.note ? `<p class="jscreen-note">${s.note}</p>` : ''}
      </div>
    </article>`;
  return `
    <svg class="jthread" aria-hidden="true">
      <defs><mask id="jthreadMask" maskUnits="userSpaceOnUse"><path class="jthread-reveal"/></mask></defs>
      <path class="jthread-guide"/>
      <path class="jthread-shadow" mask="url(#jthreadMask)"/>
      <path class="jthread-line" mask="url(#jthreadMask)"/>
      <g class="jneedle"><line x1="-30" y1="0" x2="8" y2="0" stroke="#8b96a3" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M8,-1.3 L15,0 L8,1.3 Z" fill="#8b96a3"/><ellipse cx="-24" cy="0" rx="3.2" ry="0.9" fill="#fdfbf6"/></g>
    </svg>
    <div class="jintro">
      <div>
        <h2>How it works</h2>
        <p>Follow the thread — from your measurements to your first finished seam.</p>
      </div>
      <button type="button" class="jspool" aria-label="Open your profile">${profileIconSvg()}</button>
    </div>
    ${STOPS.map(stop).join('')}
    <div class="jfinale">
      <h2>Made for makers. Supported by makers.</h2>
      <p>“If you believe in what we’re building and feel inclined to support our work, every contribution helps us keep creating. ♡”</p>
      <button type="button" class="btn btn-primary jexplore">Explore ILI →</button>
    </div>`;
}

/* ---------- demo runner ---------- */

class Demo {
  constructor(stopEl, def) {
    this.stopEl = stopEl; this.def = def; this.runId = 0; this.played = false;
    this.view = stopEl.querySelector('.jscreen-view');
    this.inner = stopEl.querySelector('.jscreen-inner');
    this.steps = [...stopEl.querySelectorAll('.jsteps li')];
    new ResizeObserver(() => this.fit()).observe(this.view);
    this.fit();
  }
  fit() {
    const w = this.view.clientWidth;
    if (!w) return;
    this.W = w < 520 ? 620 : 900;
    this.scale = w / this.W;
    this.inner.style.width = this.W + 'px';
    this.inner.style.height = this.def.height + 'px';
    this.inner.style.transform = `scale(${this.scale})`;
    this.view.style.height = Math.round(this.def.height * this.scale) + 'px';
  }
  async play(instant = false) {
    const id = ++this.runId;
    this.played = true;
    this.inner.innerHTML = this.def.build(this) + `<div class="jm-toast"></div>
      <div class="jcursor"><svg viewBox="0 0 24 24"><path d="M4,2 L4,20 L9,15.5 L12.5,22.5 L15.5,21 L12,14 L19,14 Z" fill="#fff" stroke="#102d44" stroke-width="1.6" stroke-linejoin="round"/></svg></div>`;
    this.cursor = this.inner.querySelector('.jcursor');
    this.cursor.classList.toggle('hidden', instant);
    this.setCursor(this.W * 0.62, this.def.height * 0.72, true);
    this.page = this.inner.querySelector('.jm-page');
    this.scrollY = 0;
    this.steps.forEach(li => li.classList.remove('current', 'done'));
    this.stopEl.classList.add('jplaying');
    const api = makeApi(this, id, instant);
    try {
      await this.def.script(api);
      api.step(this.steps.length);       // every step done
    } catch (e) {
      if (e !== CANCEL) console.error('Journey demo failed', e);
    }
    if (id === this.runId) {
      this.stopEl.classList.remove('jplaying');
      this.cursor?.classList.add('resting');
    }
  }
  setCursor(x, y, now) {
    this.cx = x; this.cy = y;
    this.cursor.style.transition = now ? 'none' : '';
    this.cursor.style.transform = `translate(${x}px, ${y}px)`;
  }
  // A point on an element in the unscaled coordinates of the miniature screen.
  pointOn(el, fx = 0.5, fy = 0.5) {
    const r = el.getBoundingClientRect(), ir = this.inner.getBoundingClientRect();
    return [(r.left + r.width * fx - ir.left) / this.scale, (r.top + r.height * fy - ir.top) / this.scale];
  }
}

function makeApi(demo, id, instant) {
  const alive = () => { if (id !== demo.runId) throw CANCEL; };
  const $ = sel => demo.inner.querySelector(sel);
  const api = {
    instant, $, inner: demo.inner,
    async wait(ms) { alive(); if (!instant) await sleep(ms); alive(); },
    step(i) {
      demo.steps.forEach((li, k) => { li.classList.toggle('done', k < i); li.classList.toggle('current', k === i); });
    },
    async move(el, fx, fy, ms = 750) {
      alive();
      if (typeof el === 'string') el = $(el);
      if (!el) return;
      const [x, y] = demo.pointOn(el, fx, fy);
      demo.setCursor(x, y, instant);
      await api.wait(ms);
    },
    async click(el, fx, fy) {
      if (typeof el === 'string') el = $(el);
      await api.move(el, fx, fy);
      if (instant) return;
      demo.cursor.classList.remove('click'); void demo.cursor.offsetWidth; demo.cursor.classList.add('click');
      el?.classList.add('jpress');
      await api.wait(220);
      el?.classList.remove('jpress');
    },
    async hover(el, ms = 900) {
      if (typeof el === 'string') el = $(el);
      el?.classList.add('jhover');
      await api.wait(ms);
    },
    unhover(el) { (typeof el === 'string' ? $(el) : el)?.classList.remove('jhover'); },
    async type(el, text, onInput) {
      if (typeof el === 'string') el = $(el);
      el.classList.add('jfocus');
      if (instant) { el.value = text; onInput?.(); }
      else for (const ch of text) { el.value += ch; onInput?.(); await api.wait(ch === ' ' ? 30 : 48); }
      el.classList.remove('jfocus');
    },
    // Scroll the miniature page so `el` sits `offset` px below the top of the screen.
    async scrollTo(el, offset = 20, ms = 900) {
      alive();
      if (typeof el === 'string') el = $(el);
      const [, y] = demo.pointOn(el, 0, 0);
      const max = Math.max(0, demo.page.scrollHeight - demo.def.height);
      demo.scrollY = Math.min(max, Math.max(0, demo.scrollY + y - offset));
      demo.page.style.transition = instant ? 'none' : '';
      demo.page.style.transform = `translateY(${-demo.scrollY}px)`;
      await api.wait(ms);
    },
    async toast(text, ms = 1800) {
      const t = $('.jm-toast');
      t.textContent = text; t.classList.add('show');
      if (instant) return;
      await api.wait(ms);
      t.classList.remove('show');
    },
    // Switch the miniature site to another page, like the hanging-garment nav does.
    async open(view, html) {
      await api.click(`.jm-nav [data-view="${view}"]`, 0.5, 0.35);
      demo.inner.querySelectorAll('.jm-nav .garment-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
      const c = $('.jm-content');
      c.innerHTML = html;
      c.classList.remove('jm-enter'); void c.offsetWidth; c.classList.add('jm-enter');
      demo.scrollY = 0; demo.page.style.transform = '';
      await api.wait(500);
    }
  };
  return api;
}

/* ---------- miniature pages ---------- */

const navCopy = () => `<div class="jm-nav">${outer('.app-nav')}</div>`;
const homeCopy = () => `<div class="jm-home">${outer('#view-home .hero-copy')}</div>`;

function buildNavPage() {
  return `<div class="jm-page">${navCopy()}<div class="jm-content">${homeCopy()}</div></div>`;
}

const PROFILE_FIELDS = [
  ['height', 'Height', 'cm', 172],
  ['chestGirth', 'Bust / Chest Girth', 'cm', 88],
  ['waistGirth', 'Waist Girth', 'cm', 68],
  ['hipGirth', 'Hip Girth', 'cm', 103]
];

function buildProfile() {
  return `${buildNavPage()}
    <div class="jm-overlay">
      <div class="jm-modal">
        <span class="jm-close">&times;</span>
        <h3>Your Profile</h3>
        <div class="jm-auth">
          <p>Create an account so your measurements follow you across devices — optional, the form below still works without one.</p>
          <div class="jm-auth-row"><span class="jm-input">Email</span><span class="jm-input">Password</span><span class="jm-btn jm-btn-dark">Sign up</span><span class="jm-btn">Log in</span></div>
        </div>
        <div class="jm-avatar-row">
          <div class="jm-body"></div>
          <div class="jm-form">
            <h3 class="avatar-stitch-heading">Build Your Avatar</h3>
            <div class="jm-form-pair"><label>Gender <span class="jm-select">Female</span></label><label>Units <span class="jm-select">Metric (cm / kg)</span></label></div>
            ${PROFILE_FIELDS.map(([k, label, unit]) => `<label>${label} (${unit}) <input type="number" data-field="${k}" tabindex="-1" readonly></label>`).join('')}
            <p class="jm-more">+ weight, shoulders, torso, arms, thigh and leg</p>
            <button type="button" class="avatar-stitch-heading jm-save" tabindex="-1">Save</button>
          </div>
        </div>
      </div>
    </div>`;
}

async function scriptProfile(api) {
  const overlay = api.$('.jm-overlay');
  const avatar = new MiniAvatar(api.$('.jm-body'));
  const icon = api.$('.jm-nav .nav-actions button');
  api.step(0);
  await api.wait(400);
  icon?.classList.add('jm-glow');
  await api.click(icon);
  icon?.classList.remove('jm-glow');
  overlay.classList.add('open');
  await api.wait(700);
  api.step(1);
  const values = { ...AVATAR_START };
  for (const [k, , , v] of PROFILE_FIELDS) {
    const input = api.$(`[data-field="${k}"]`);
    await api.click(input, 0.3, 0.5);
    avatar.setFocus(k);                       // the real viewer highlights the measurement being edited
    let timer;
    await api.type(input, String(v), () => {
      clearTimeout(timer);                    // and reshapes 300 ms after typing stops
      timer = setTimeout(() => { values[k] = v; avatar.morph({ ...values }, api.instant); }, api.instant ? 0 : 300);
    });
    if (api.instant) { clearTimeout(timer); values[k] = v; avatar.morph({ ...values }, true); }
    api.step(2);
    await api.wait(1100);
  }
  avatar.setFocus(null);
  api.step(3);
  await api.click('.jm-save');
  if (api.instant) return;
  overlay.classList.remove('open');           // Save closes the profile, like the real one
  await api.wait(1100);
  await api.click(icon);                      // reopening shows the same measurements
  overlay.classList.add('open');
  await api.wait(600);
}

function browseHtml(savedId) {
  return `<div class="browse-head"><h1>Discover patterns</h1><p>Every pattern here was built (and remixed) by the community.</p></div>
    <div class="pattern-grid">${PATTERNS.map(p => `
      <div class="pattern-card reel" data-id="${p.id}">
        <button type="button" class="save-btn ${p.id === savedId ? 'saved' : ''}" tabindex="-1">${p.id === savedId ? '♥' : '♡'}</button>
        <div class="pattern-thumb" style="background:#f9f5ef;overflow:hidden;">${thumbImg(p)}</div>
        <div class="pattern-body">
          <h3>${esc(p.name)}</h3>
          <div class="pattern-meta">${pills(p)}</div>
          <div class="pattern-foot"><span>${p.time ? `⏱ ${p.time} ` : ''}${p.steps.length} steps</span></div>
        </div>
      </div>`).join('')}</div>`;
}

async function scriptDiscover(api) {
  api.step(0);
  await api.wait(300);
  await api.open('browse', browseHtml());
  api.step(1);
  const cards = [...api.inner.querySelectorAll('.pattern-card')];
  for (const card of cards.slice().reverse()) {
    await api.move(card, 0.5, 0.4, 650);
    await api.hover(card, 550);
    api.unhover(card);
  }
  api.step(2);
  const pick = api.$(`.pattern-card[data-id="${PICK_ID}"]`);
  await api.move(pick, 0.5, 0.5);
  await api.hover(pick, 700);
  api.step(3);
  const heart = pick.querySelector('.save-btn');
  await api.click(heart);
  heart.classList.add('saved', 'jm-pop');
  heart.textContent = '♥';
  api.step(4);
  await api.toast('Saved to My Patterns 💜', 2200);
  api.unhover(pick);
}

function myPatternsHtml(p, done) {
  const pct = Math.round(done / p.steps.length * 100);
  const status = done === 0 ? 'Saved · not started' : `In progress · ${pct}%`;
  return `<div class="mp-head"><h1>My Patterns</h1><p>Saved and in-progress patterns for this session.</p></div>
    <div class="mp-grid"><div class="mp-card">
      <div class="mp-thumb" style="background:#f9f5ef;overflow:hidden;">${thumbImg(p)}</div>
      <div class="mp-info"><h3>${esc(p.name)}</h3><div class="mp-status">${status}</div>
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div></div>
    </div></div>`;
}

function detailHtml(p) {
  return `<div class="detail-head jm-detail-head">
      <div class="detail-thumb" style="background:#f9f5ef;overflow:hidden;">${thumbImg(p)}</div>
      <div class="detail-info">
        <div class="detail-meta">${p.difficulty ? `<span class="pill pill-${DIFF_COLOR[p.difficulty]}">${p.difficulty}</span>` : ''}
          ${p.personalized ? `<span class="pill pill-lime">Made to measure</span>` : ''}</div>
        <h1>${esc(p.name)}</h1>
        <div class="detail-facts">
          <div class="detail-fact"><span>Construction</span><b>${esc(p.construction || '—')}</b></div>
          <div class="detail-fact"><span>Fabric</span><b>${esc(p.fabric)}</b></div>
          <div class="detail-fact"><span>Steps</span><b>${p.steps.length}</b></div>
        </div>
        <div class="detail-actions"><span class="btn btn-primary btn-sm">♥ Saved</span></div>
      </div>
    </div>
    <div class="progress-wrap">
      <div class="progress-top"><span>Your progress</span><span class="jm-progress-label">0/${p.steps.length} steps · 0%</span></div>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:0%"></div></div>
    </div>
    ${p.steps.map((s, i) => `
      <div class="step-card" data-i="${i}">
        <div class="step-check"></div>
        <div class="step-main"><h3><span class="step-num">STEP ${i + 1}</span> ${esc(s.title)}</h3><div class="jm-anim-slot"></div></div>
      </div>`).join('')}`;
}

async function scriptSew(api) {
  const p = PATTERNS.find(x => x.id === PICK_ID);
  api.step(0);
  await api.wait(300);
  await api.open('mypatterns', myPatternsHtml(p, 0));
  await api.hover('.mp-card', 600);
  api.step(1);
  await api.click('.mp-card');
  const c = api.$('.jm-content');
  c.innerHTML = detailHtml(p);
  await api.wait(500);

  const DEMO_STEPS = 3;                         // the first three steps of the real guide
  const openStep = i => {
    api.inner.querySelectorAll('.jm-anim-slot').forEach(s => { s.innerHTML = ''; });
    const slot = api.inner.querySelector(`.step-card[data-i="${i}"] .jm-anim-slot`);
    slot.innerHTML = sewingAnimationHtml(p.steps[i].tutorial);
    mountSewingAnimations(slot);
    return slot.querySelector('[data-sew-anim]')?.sewPlayer;
  };
  for (let i = 0; i < DEMO_STEPS; i++) {
    const card = api.$(`.step-card[data-i="${i}"]`);
    const player = openStep(i);
    api.step(i === 0 ? 2 : 4);
    await api.scrollTo(card, 14);
    if (!player) break;
    if (i > 0) api.step(2);
    await api.click(player.playBtn);
    if (!api.instant) {
      player.play();
      await api.wait(Math.min(player.tut.actions[0].dur, 4400) + 250);
      player.pause();
    }
    api.step(3);
    await api.click(card.querySelector('.step-check'));
    card.classList.add('done');
    card.querySelector('.step-check').textContent = '✓';
    const done = i + 1, pct = Math.round(done / p.steps.length * 100);
    api.$('.jm-progress-label').textContent = `${done}/${p.steps.length} steps · ${pct}%`;
    api.$('.progress-wrap .progress-bar-fill').style.width = pct + '%';
    await api.wait(700);
  }
  api.step(4);
  openStep(DEMO_STEPS);                         // the next step waits, ready to play
  await api.scrollTo(api.$(`.step-card[data-i="${DEMO_STEPS}"]`), 14);
}

const REQUEST = {
  name: 'Puff-sleeve corset top',
  desc: 'Fairy core vibe: square neckline, lace-up back, gathered puff sleeves.\nInspo: my Pinterest board'
};

function requestHtml() {
  return `<div class="browse-head"><h1>Request a Pattern</h1><p>Tell us what you want to sew. We'll add it to our wishlist and make it if we love it.</p></div>
    <div class="request-container">
      <div class="request-form-card">
        <h2>Submit Your Request</h2>
        <div class="field"><label>Pattern name or description</label><input type="text" class="jm-req-name" tabindex="-1" readonly placeholder="e.g. Oversized linen shirt with asymmetrical collar"></div>
        <div class="field"><label>Details &amp; inspiration</label>
          <textarea class="jm-req-desc" tabindex="-1" readonly placeholder="Describe the style, silhouette, any reference images or designers you love..."></textarea>
          <span class="jm-pinterest">🔍 Search on Pinterest<span class="jm-tip">Opens Pinterest search in a new tab</span></span>
        </div>
        <span class="btn-primary jm-req-submit">Submit Request</span>
      </div>
      <div class="request-feed"><div class="empty-state"><div class="emoji-lg">💬</div><p>No requests yet. Be the first to submit one!</p></div></div>
    </div>`;
}

async function scriptRequest(api) {
  api.step(0);
  await api.wait(300);
  await api.open('request', requestHtml());
  await api.scrollTo('.request-form-card', 16, 700);
  api.step(1);
  await api.click('.jm-req-name', 0.3);
  await api.type('.jm-req-name', REQUEST.name);
  await api.click('.jm-req-desc', 0.3, 0.3);
  await api.type('.jm-req-desc', REQUEST.desc);
  api.step(2);
  await api.move('.jm-pinterest', 0.5, 0.5);
  await api.hover('.jm-pinterest', 1300);
  api.unhover('.jm-pinterest');
  api.step(3);
  await api.click('.jm-req-submit');
  api.$('.jm-req-name').value = '';
  api.$('.jm-req-desc').value = '';
  api.$('.request-feed').innerHTML = `
    <div class="request-item jm-enter">
      <div class="req-meta"><span class="req-timestamp">${new Date().toLocaleDateString()}</span></div>
      <h3>${esc(REQUEST.name)}</h3>
      <p class="req-desc">${esc(REQUEST.desc).replace(/\n/g, '<br>')}</p>
    </div>`;
  const toast = api.toast('✨ Request submitted! Thanks for sharing your design idea.', 2400);
  await api.scrollTo('.request-feed', 120, 900);
  await toast;
}

function donateHtml() {
  const banknote = `<span class="jm-banknote">💵<b>Donate</b></span>`;
  const cards = safeHtml(DONATION_CAUSES.slice(0, 3).map(donationCauseHtml).join(''))
    // The site's banknote image doesn't load at the moment (emoji.family returns 404), so the miniature uses the emoji.
    .replace(/<img[^>]*emoji\.family[^>]*>\s*<span[^>]*>Donate<\/span>/g, banknote);
  return `<div class="browse-head jm-donate-head">${banknote}<div><h1>Donation Bin</h1></div></div>
    <div class="pattern-grid">${cards}</div>`;
}

async function scriptDonate(api) {
  api.step(0);
  await api.wait(300);
  await api.open('donate', donateHtml());
  api.step(1);
  const cards = [...api.inner.querySelectorAll('.pattern-grid .pattern-card')];
  for (const card of cards) {
    await api.move(card, 0.5, 0.45, 650);
    await api.hover(card, 450);
    api.unhover(card);
  }
  const card = cards[1] || cards[0];
  await api.scrollTo(card, 10, 800);
  const article = card.querySelector('.pattern-body a');
  if (article) { await api.move(article, 0.4, 0.5); await api.hover(article, 1000); api.unhover(article); }
  api.step(2);
  const give = card.querySelector('.jm-banknote');
  if (give) {
    give.insertAdjacentHTML('beforeend', `<span class="jm-tip">Opens the charity’s own page. Always optional.</span>`);
    await api.move(give, 0.5, 0.5);
    await api.hover(give, 1600);
  }
}

/* ---------- the thread ---------- */

function initThread(j) {
  const svg = j.querySelector('.jthread');
  const paths = [...svg.querySelectorAll('.jthread-reveal, .jthread-guide, .jthread-shadow, .jthread-line')];
  const reveal = svg.querySelector('.jthread-reveal');
  const needle = svg.querySelector('.jneedle');
  const knots = [...j.querySelectorAll('.jknot')];
  const stops = [...j.querySelectorAll('.jstop')];
  const spool = j.querySelector('.jspool');
  let geo = null;

  function build() {
    const box = j.getBoundingClientRect();
    if (!box.height) { geo = null; return; }
    svg.setAttribute('viewBox', `0 0 ${box.width.toFixed(1)} ${box.height.toFixed(1)}`);
    svg.setAttribute('width', box.width); svg.setAttribute('height', box.height);
    const centre = el => { const r = el.getBoundingClientRect(); return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2]; };
    const f = n => n.toFixed(1);
    let prev = centre(spool);
    let d = `M${f(prev[0])},${f(prev[1])}`;
    const knotY = [];
    knots.forEach((knot, i) => {
      const k = centre(knot), g = k[1] - prev[1];
      // Drape across to the next stop's knot...
      d += ` C${f(prev[0])},${f(prev[1] + g * 0.55)} ${f(k[0])},${f(k[1] - g * 0.55)} ${f(k[0])},${f(k[1])}`;
      knotY.push(k[1]);
      if (i === knots.length - 1) return;
      // ...then run down beside its demonstration with a gentle wobble.
      const yb = stops[i].getBoundingClientRect().bottom - box.top - 10, h = yb - k[1], w = i % 2 ? -14 : 14;
      d += ` C${f(k[0] + w)},${f(k[1] + h * 0.35)} ${f(k[0] - w)},${f(k[1] + h * 0.7)} ${f(k[0])},${f(yb)}`;
      prev = [k[0], yb];
    });
    paths.forEach(p => p.setAttribute('d', d));
    const line = svg.querySelector('.jthread-line');
    const total = line.getTotalLength();
    // Length along the thread for each height, so scrolling maps straight to how much is stitched.
    const samples = [], step = 6;
    let maxY = -Infinity;
    for (let s = 0; s <= total; s += step) { maxY = Math.max(maxY, line.getPointAtLength(s).y); samples.push(maxY); }
    reveal.style.strokeDasharray = `${total} ${total}`;
    geo = { total, samples, step, knotY, line };
    update();
  }

  function lengthAtY(y) {
    const { samples, step, total } = geo;
    let lo = 0, hi = samples.length - 1;
    if (y <= samples[0]) return 0;
    if (y >= samples[hi]) return total;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid] < y) lo = mid; else hi = mid; }
    const t = (y - samples[lo]) / Math.max(1e-6, samples[hi] - samples[lo]);
    return Math.min(total, (lo + t) * step);
  }

  function update() {
    if (!geo) return;
    const rm = reducedMotion();
    const top = j.getBoundingClientRect().top;
    const y = window.innerHeight * 0.64 - top;          // the needle sits about two thirds down the screen
    const drawn = rm ? geo.total : lengthAtY(y);
    reveal.style.strokeDashoffset = String(geo.total - drawn);
    knots.forEach((k, i) => k.classList.toggle('reached', rm || geo.knotY[i] <= y + 1));
    spool.classList.toggle('reached', rm || drawn > 0);
    if (rm || drawn <= 0.5 || drawn >= geo.total - 0.5) { needle.style.display = 'none'; return; }
    const a = geo.line.getPointAtLength(drawn), b = geo.line.getPointAtLength(Math.max(0, drawn - 4));
    const angle = Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI;
    needle.style.display = '';
    needle.setAttribute('transform', `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${angle.toFixed(1)})`);
  }

  return { build, update };
}

/* ---------- wiring ---------- */

let started = false;

export function initJourney() {
  const j = document.getElementById('journey');
  if (!j || started) return;
  started = true;
  j.innerHTML = journeyHtml();

  const thread = initThread(j);
  const stops = [...j.querySelectorAll('.jstop')];
  const demos = stops.map((el, i) => new Demo(el, STOPS[i]));

  // Chapter navigation: a small spool of knots fixed at the side while the journey is on screen.
  const chapters = document.createElement('nav');
  chapters.className = 'jchapters';
  chapters.setAttribute('aria-label', 'How it works chapters');
  chapters.innerHTML = STOPS.map((s, i) =>
    `<button type="button" data-goto="${i}"><i>${String(i + 1).padStart(2, '0')}</i><span>${s.label}</span></button>`).join('');
  document.body.appendChild(chapters);

  // Scroll a stop to just under the sticky clothesline nav.
  const goTo = i => {
    if (!stops[i]) return;
    const nav = document.querySelector('.app-nav')?.getBoundingClientRect().height || 0;
    const top = stops[i].getBoundingClientRect().top + window.scrollY - nav - 24;
    window.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  [...chapters.querySelectorAll('[data-goto]'), ...j.querySelectorAll('.jknot')].forEach(b =>
    b.addEventListener('click', () => goTo(Number(b.dataset.goto))));
  j.querySelector('.jspool').addEventListener('click', () => document.getElementById('profileIconBtn')?.click());
  j.querySelector('.jexplore').addEventListener('click', () => window.navigate?.('browse'));
  stops.forEach((el, i) => {
    el.querySelector('.jreplay').addEventListener('click', () => demos[i].play(false));
    el.querySelector('.jtry').addEventListener('click', () => STOPS[i].tryIt());
  });

  // Reduced motion: every stop shows its finished state straight away; Replay still steps through it.
  if (reducedMotion()) demos.forEach(d => d.play(true));

  // Stops fade in as they arrive; each demonstration starts when its screen is mostly in view.
  const seen = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('seen');
  }), { threshold: 0.12 });
  stops.forEach(s => seen.observe(s));
  seen.observe(j.querySelector('.jintro'));
  const start = new IntersectionObserver(entries => entries.forEach(e => {
    const demo = demos[stops.indexOf(e.target.closest('.jstop'))];
    if (e.isIntersecting && demo && !demo.played) demo.play(false);
  }), { threshold: 0.45 });
  stops.forEach(s => start.observe(s.querySelector('.jscreen')));

  // Thread + current chapter follow the scroll position.
  let onScreen = false, queued = false;
  const frame = () => {
    queued = false;
    thread.update();
    const mid = window.innerHeight / 2;
    let current = -1, best = Infinity;
    stops.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const dist = r.top > mid ? r.top - mid : r.bottom < mid ? mid - r.bottom : 0;
      if (dist < best) { best = dist; current = i; }
    });
    stops.forEach((s, i) => s.classList.toggle('current', i === current));
    chapters.querySelectorAll('button').forEach((b, i) => {
      b.classList.toggle('current', i === current);
      b.classList.toggle('passed', i < current);
    });
  };
  const queue = () => { if (onScreen && !queued) { queued = true; requestAnimationFrame(frame); } };
  window.addEventListener('scroll', queue, { passive: true });
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    chapters.classList.toggle('show', onScreen && document.getElementById('view-home')?.classList.contains('active'));
    queue();
  }, { rootMargin: '-35% 0px -35% 0px' }).observe(j);

  // Positions can only be measured while home is showing; the observer also fires when it comes back.
  const rebuild = () => { thread.build(); queue(); };
  new ResizeObserver(rebuild).observe(j);
  window.addEventListener('resize', rebuild);
  document.fonts?.ready.then(rebuild);
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', rebuild);
  rebuild();

}
