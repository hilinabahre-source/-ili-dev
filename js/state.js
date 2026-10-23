/* ============================================================
   STATE
   ============================================================ */
export const state = {
  view: 'home',
  currentPatternId: null,
  saved: new Set(),           // bookmarked pattern ids
  progress: {},                // { patternId: Set(stepIndex) }
  activeTrend: 'All',
  activeDifficulty: 'All',
  feedbackLevel: null,
  requests: [],                // pattern requests forum
  miniJellyShownFor: {}        // { patternId: true } once its assembly-guide mini-Jelly has auto-popped
};

export const FEEDBACK_LEVELS = ['Noob', 'Avid pattern user', 'Pattern maker'];
export const TRENDS = ['Y2K Streetwear','Coquette','Clubcore','Cottagecore','Grunge Upcycle','Balletcore','Clean Girl'];
export const DIFFICULTIES = ['Beginner','Intermediate','Advanced'];
export const TREND_COLOR = {
  'Y2K Streetwear':'pink','Coquette':'purple','Clubcore':'lime','Cottagecore':'orange',
  'Grunge Upcycle':'purple','Balletcore':'pink','Clean Girl':'lime'
};
export const DIFF_COLOR = {'Beginner':'lime','Intermediate':'orange','Advanced':'pink'};
