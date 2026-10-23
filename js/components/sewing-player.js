import { SEWING_TUTORIALS } from '../lib/sewing-animations.js';

/* ============================================================
   ANIMATED SEWING TUTORIAL PLAYER
   Mounts into every [data-sew-anim] element after a pattern page renders: the animation large,
   one short instruction per action, and Previous / Play-Pause / Next. Plays one action at a time
   and moves on after a short hold; with reduced motion it never moves on by itself. Once an action
   has finished, Play replays it.
   If anything fails, the player hides itself and the step's "More details" opens instead.
   ============================================================ */

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const HOLD = 1100;   // ms on a finished action before the next one starts

const LEGEND = {
  rs: ['sw-rs', 'right side'], ws: ['sw-ws', 'wrong side'], fabric: ['sw-fabric', 'fabric'], under: ['sw-under', 'folded layer'],
  stitch: ['sw-stitch', 'stitching now'], prev: ['sw-prev', 'earlier stitching'], trim: ['sw-trim', 'cut / trim line'], chalk: ['sw-chalk', 'chalk mark'], bias: ['sw-bias', 'bias strip']
};

class Player {
  constructor(el, tut) {
    this.el = el; this.tut = tut; this.n = tut.actions.length;
    this.index = 0; this.p = 0; this.playing = false; this.hold = 0; this.visible = true;
    el.innerHTML = `
      <div class="sew-anim-stage ${tut.views.length === 1 ? 'single' : tut.layout || ''}">
        ${tut.views.map(v => `<figure class="sew-anim-view ${v.cls || ''}"><figcaption>${v.caption}</figcaption><div class="sew-anim-svg"></div></figure>`).join('')}
      </div>
      <div class="sew-anim-progress" aria-hidden="true">${tut.actions.map(() => '<span><i></i></span>').join('')}</div>
      <div class="sew-anim-caption">
        <span class="sew-anim-count"></span>
        <p class="sew-anim-text" aria-live="polite"></p>
      </div>
      <div class="sew-anim-controls">
        <button type="button" class="btn btn-ghost btn-sm" data-act="prev" aria-label="Previous action">← Previous</button>
        <button type="button" class="btn btn-sm sew-anim-play" data-act="play"></button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="next" aria-label="Next action">Next →</button>
      </div>
      <div class="sew-anim-legend" aria-hidden="true">
        ${(tut.legend || ['rs', 'ws', 'stitch', 'prev', 'trim']).map(k => `<span><i class="${LEGEND[k][0]}"></i>${LEGEND[k][1]}</span>`).join('')}
      </div>`;
    this.viewEls = [...el.querySelectorAll('.sew-anim-svg')];
    this.bars = [...el.querySelectorAll('.sew-anim-progress i')];
    this.playBtn = el.querySelector('[data-act="play"]');
    el.querySelector('.sew-anim-controls').addEventListener('click', e => {
      const act = e.target.closest('button')?.dataset.act;
      if (act === 'play') this.playing ? this.pause() : this.play();
      if (act === 'prev') this.go(this.index - 1);
      if (act === 'next') this.go(this.index + 1);
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; }).observe(el);
    }
    el.classList.add('ready'); el.sewPlayer = this;
    this.render();
  }

  go(i) {
    if (i < 0 || i >= this.n) return;
    this.index = i; this.hold = 0;
    if (reducedMotion() && !this.playing) { this.p = 1; this.render(); return; }
    this.p = 0; this.play();
  }
  play() {
    if (this.p >= 1) this.p = 0;            // a finished action replays
    this.playing = true; this.hold = 0; this.last = performance.now();
    if (!this.raf) this.raf = requestAnimationFrame(t => this.tick(t));
    this.render();
  }
  pause() { this.playing = false; this.render(); }

  tick(now) {
    this.raf = null;
    if (!this.el.isConnected) return;             // the page re-rendered; this player is gone
    const dt = Math.min(now - this.last, 100); this.last = now;
    if (this.playing) {
      if (this.p < 1) this.p = Math.min(1, this.p + dt / this.tut.actions[this.index].dur);
      else if (this.index < this.n - 1 && !reducedMotion()) {
        this.hold += dt;
        if (this.hold >= HOLD) { this.hold = 0; this.index++; this.p = 0; }
      } else this.playing = false;
      if (this.visible || !this.playing) this.render();
    }
    if (this.playing) this.raf = requestAnimationFrame(t => this.tick(t));
  }

  state() {
    const s = { ...this.tut.start };
    for (let i = 0; i < this.index; i++) this.tut.actions[i].apply(s, 1);
    this.tut.actions[this.index].apply(s, this.p);
    return s;
  }
  render() {
    const s = this.state();
    this.tut.views.forEach((v, i) => { this.viewEls[i].innerHTML = v.render(s, this.index); });
    this.el.querySelector('.sew-anim-count').textContent = `${this.index + 1} of ${this.n}`;
    const text = this.el.querySelector('.sew-anim-text');
    if (text.textContent !== this.tut.actions[this.index].text) text.textContent = this.tut.actions[this.index].text;
    this.bars.forEach((b, i) => { b.style.width = `${i < this.index ? 100 : i === this.index ? Math.round(this.p * 100) : 0}%`; });
    const finished = this.p >= 1 && !this.playing;
    this.playBtn.textContent = this.playing ? '❚❚ Pause' : finished ? '↺ Replay' : '▶ Play';
    this.playBtn.setAttribute('aria-label', this.playing ? 'Pause' : finished ? 'Replay this action' : 'Play');
    this.el.querySelector('[data-act="prev"]').disabled = this.index === 0;
    this.el.querySelector('[data-act="next"]').disabled = this.index === this.n - 1;
  }
}

export function sewingAnimationHtml(id) {
  return SEWING_TUTORIALS[id] ? `<div class="sew-anim" data-sew-anim="${id}" onclick="event.stopPropagation()"></div>` : '';
}

export function mountSewingAnimations(root) {
  root.querySelectorAll('[data-sew-anim]').forEach(el => {
    try {
      new Player(el, SEWING_TUTORIALS[el.dataset.sewAnim]);
    } catch (err) {
      console.error('Sewing animation failed; showing the written instructions', err);
      el.remove();
      const fallback = root.querySelector(`details.guide-more[data-for="${el.dataset.sewAnim}"]`);
      if (fallback) fallback.open = true;
    }
  });
}
