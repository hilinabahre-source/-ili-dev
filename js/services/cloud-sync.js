import { state } from '../state.js';
import { render } from '../router.js';

/* ============================================================
   ACCOUNT SYNC — saved/hearted patterns + step progress
   (uses window.supabaseClient, set up in services/supabase.js)
   ============================================================ */
export async function syncPatternToCloud(patternId){
  if(!window.supabaseClient || !window.iliGetCurrentUser) return;
  const user = await window.iliGetCurrentUser();
  if(!user) return; // no account — stays session-only, as before

  const completedSteps = state.progress[patternId] ? Array.from(state.progress[patternId]) : [];
  const { error } = await window.supabaseClient.from('user_patterns').upsert({
    user_id: user.id,
    pattern_id: patternId,
    saved: state.saved.has(patternId),
    completed_steps: completedSteps,
    updated_at: new Date().toISOString()
  });
  if(error) console.error('Could not sync pattern to account:', error);
}

// Pulls every saved/in-progress pattern for the logged-in user from the
// cloud into local state, then re-renders whatever view is on screen.
export async function loadCloudPatterns(){
  if(!window.supabaseClient || !window.iliGetCurrentUser) return;
  const user = await window.iliGetCurrentUser();
  if(!user) return;

  const { data, error } = await window.supabaseClient
    .from('user_patterns')
    .select('*')
    .eq('user_id', user.id);
  if(error){ console.error('Could not load cloud patterns:', error); return; }

  (data || []).forEach(row => {
    if(row.saved) state.saved.add(row.pattern_id);
    if(row.completed_steps && row.completed_steps.length){
      state.progress[row.pattern_id] = new Set(row.completed_steps);
    }
  });
  render();
}

// Clears locally-held saved/progress state on logout, so a different
// account signing in on the same device doesn't inherit the previous
// person's hearts/progress.
export function resetLocalPatternState(){
  state.saved = new Set();
  state.progress = {};
  render();
}


// services/supabase.js and components/profile-modal.js call these through
// window, so they work without importing this file.
window.loadCloudPatterns = loadCloudPatterns;
window.resetLocalPatternState = resetLocalPatternState;
