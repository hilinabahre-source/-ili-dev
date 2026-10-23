import { DONATION_CAUSES, DONATION_THUMBS } from '../data/donations.js';

export function donationCauseHtml(cause, i){
  const thumb = DONATION_THUMBS[i % DONATION_THUMBS.length];
  const logoUrl = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + thumb.logoFile;
  return `
      <div class="pattern-card" style="cursor:default;">
        <div class="pattern-thumb" style="background:#ffffff; padding:20px;">
          <img src="${logoUrl}" alt="${thumb.name} logo" style="width:70%;height:70%;object-fit:contain;" loading="lazy">
        </div>
        <div class="pattern-body">
          <h3>${cause.region}</h3>
          <p style="font-size:0.85rem; color:var(--text-dim); line-height:1.5; margin-bottom:10px;">${cause.blurb}</p>
          <a href="${cause.article.url}" target="_blank" rel="noopener" style="display:inline-block; font-size:0.8rem; color:var(--text-dim); text-decoration:underline; text-decoration-color:var(--border); margin-bottom:4px;">
            ${cause.article.title} \u2197
          </a>
          <div style="font-size:0.72rem; color:var(--text-dimmer); margin-bottom:12px;">${cause.article.source}</div>
          <div class="pattern-foot" style="flex-direction:column; align-items:stretch; gap:10px; border-top:1px solid var(--border); padding-top:12px; margin-top:0;">
            <div>
              <div style="font-size:0.85rem; color:var(--text); font-weight:600;">${cause.charity.name}</div>
              <div style="font-size:0.72rem; color:var(--text-dimmer);">${cause.charity.note}</div>
            </div>
            <a href="${cause.charity.url}" target="_blank" rel="noopener" style="position:relative; display:inline-flex; align-items:center; justify-content:center; width:60px; height:60px; align-self:flex-start;">
              <img src="https://www.emoji.family/api/emojis/1f4b5/noto/svg" alt="Donate" style="width:100%;height:100%;object-fit:contain;" loading="lazy">
              <span style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#ffffff; font-weight:800; font-size:9px; letter-spacing:0.03em; text-transform:uppercase; text-shadow:0 1px 3px rgba(0,0,0,0.6);">Donate</span>
            </a>
          </div>
          ${cause.campaign ? `
          <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:10px;">
            <div>
              <div style="font-size:0.85rem; color:var(--text); font-weight:600;">📣 ${cause.campaign.name}</div>
              <div style="font-size:0.72rem; color:var(--text-dimmer); margin-bottom:8px;">${cause.campaign.note}</div>
            </div>
            <a href="${cause.campaign.url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="white-space:nowrap;">Visit campaign \u2197</a>
          </div>` : ''}
        </div>
      </div>`;
}

export function renderDonate(){
  const grid = document.getElementById('donateGrid');
  if (grid) grid.innerHTML = DONATION_CAUSES.map(donationCauseHtml).join('');
}
