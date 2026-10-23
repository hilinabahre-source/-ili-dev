import { PATTERNS } from '../data/patterns.js';
import { figureSvg } from '../lib/sewing-figures.js';
import { sewingAnimationHtml } from './sewing-player.js';

/* ============================================================
   ILLUSTRATED SEWING STEPS
   Steps with `details`, `tips` and `figures` render as a numbered guide with a figure strip.
   Clicking a figure opens it large; arrow keys / buttons move through the step's figures,
   Esc or the backdrop closes. Clicks inside a step never toggle its progress checkbox.
   ============================================================ */

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function guideStepHtml(p, s, stepIndex) {
  const details = (s.details || []).map(d => `<li>${esc(d)}</li>`).join('');
  const tips = (s.tips || []).map(t => `<p class="guide-tip">💡 ${esc(t)}</p>`).join('');
  const figures = (s.figures || []).map((fig, j) => `
      <figure class="guide-figure">
        <button type="button" class="guide-figure-btn" aria-label="Enlarge: ${esc(fig.caption)}"
          onclick="event.stopPropagation();iliOpenFigure('${esc(p.id)}',${stepIndex},${j})">${figureSvg(fig.id)}
          <span class="guide-zoom" aria-hidden="true">⤢</span></button>
        <figcaption>${esc(fig.caption)}</figcaption>
      </figure>`).join('');
  const gallery = figures ? `<div class="guide-figures" onclick="event.stopPropagation()">${figures}</div>` : '';
  const animation = s.tutorial ? sewingAnimationHtml(s.tutorial) : '';
  if (!animation) return `
    ${details ? `<ol class="guide-details">${details}</ol>` : ''}
    ${tips}
    ${gallery}`;
  // Visual-first: the animation and its one-line instructions lead; every written instruction,
  // measurement and warning, plus the static diagrams, stays in "More details" (opened if the animation can't run).
  return `
    ${animation}
    <details class="guide-more" data-for="${esc(s.tutorial)}" onclick="event.stopPropagation()">
      <summary>More details</summary>
      <p class="guide-more-intro">${s.text}</p>
      ${details ? `<ol class="guide-details">${details}</ol>` : ''}
      ${tips}
      ${gallery ? `<p class="guide-more-label">Diagrams</p>${gallery}` : ''}
    </details>`;
}

let viewer = null;
let current = null;   // { figures, index, stepTitle, opener }

function build() {
  viewer = document.createElement('div');
  viewer.className = 'figure-viewer';
  viewer.hidden = true;
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.innerHTML = `
    <div class="figure-viewer-card">
      <div class="figure-viewer-head">
        <span class="figure-viewer-step"></span>
        <span class="figure-viewer-count"></span>
        <button type="button" class="figure-viewer-close" aria-label="Close">×</button>
      </div>
      <div class="figure-viewer-art"></div>
      <p class="figure-viewer-caption"></p>
      <div class="figure-viewer-nav">
        <button type="button" class="btn btn-ghost btn-sm figure-viewer-prev">← Previous</button>
        <button type="button" class="btn btn-ghost btn-sm figure-viewer-next">Next →</button>
      </div>
    </div>`;
  document.body.appendChild(viewer);
  viewer.addEventListener('click', e => { if (e.target === viewer) close(); });
  viewer.querySelector('.figure-viewer-close').addEventListener('click', close);
  viewer.querySelector('.figure-viewer-prev').addEventListener('click', () => show(current.index - 1));
  viewer.querySelector('.figure-viewer-next').addEventListener('click', () => show(current.index + 1));
  document.addEventListener('keydown', e => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(current.index - 1);
    if (e.key === 'ArrowRight') show(current.index + 1);
  });
}

function show(index) {
  const { figures } = current;
  if (index < 0 || index >= figures.length) return;
  current.index = index;
  const fig = figures[index];
  viewer.querySelector('.figure-viewer-art').innerHTML = figureSvg(fig.id);
  viewer.querySelector('.figure-viewer-caption').textContent = fig.caption;
  viewer.querySelector('.figure-viewer-step').textContent = current.stepTitle;
  viewer.querySelector('.figure-viewer-count').textContent = figures.length > 1 ? `${index + 1} of ${figures.length}` : '';
  viewer.querySelector('.figure-viewer-prev').disabled = index === 0;
  viewer.querySelector('.figure-viewer-next').disabled = index === figures.length - 1;
  viewer.querySelector('.figure-viewer-nav').hidden = figures.length < 2;
}

function close() {
  viewer.hidden = true;
  document.body.style.overflow = '';
  current?.opener?.focus();
}

export function openFigure(patternId, stepIndex, figIndex) {
  const p = PATTERNS.find(x => x.id === patternId);
  const step = p?.steps[stepIndex];
  if (!step?.figures?.length) return;
  if (!viewer) build();
  current = { figures: step.figures, index: figIndex, stepTitle: `Step ${stepIndex + 1} · ${step.title}`, opener: document.activeElement };
  show(figIndex);
  viewer.hidden = false;
  document.body.style.overflow = 'hidden';
  viewer.querySelector('.figure-viewer-close').focus();
}
