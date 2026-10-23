import { navigate } from './router.js';
import { toggleSave } from './views/browse.js';
import { renderDetail, toggleStep, resetProgress, showMiniJelly, hideMiniJelly } from './views/detail.js';
import { openConstructionModal } from './views/construction.js';
import { submitRequest, searchPinterest } from './views/request.js';
import { setFeedbackLevel, submitFeedback } from './views/feedback.js';
import './services/cloud-sync.js';
import './components/profile-modal.js';
import { initJelly } from './components/jelly.js';
import { openProfile, choosePaper, downloadPattern } from './services/pattern-downloads.js';
import { openFigure } from './components/figure-viewer.js';

// Inline onclick/onmouseenter/onmouseleave handlers (in index.html and in
// the views' template strings) look these up as globals.
Object.assign(window, {
  navigate, toggleSave, renderDetail, toggleStep, resetProgress,
  openConstructionModal, setFeedbackLevel, submitFeedback,
  submitRequest, searchPinterest, showMiniJelly, hideMiniJelly,
  iliOpenProfile: openProfile, iliChoosePaper: choosePaper, iliDownloadPattern: downloadPattern,
  iliOpenFigure: openFigure,
});

navigate('home');
initJelly();

// Accounts (Supabase) and the BodyDouble avatar viewer load separately, so a
// slow or unavailable BodyDouble CDN can't hold up the rest of the site.
import('./services/supabase.js');
