const profileBtn = document.getElementById('profileIconBtn');
const profileModal = document.getElementById('profileModal');
const profileModalCard = document.getElementById('profileModalCard');
const closeProfileModal = document.getElementById('closeProfileModal');
const profileSummary = document.getElementById('profileSummary');

let avatarBuilderMoved = false;
let avatarViewerStarted = false;

profileBtn?.addEventListener('click', () => {
  profileSummary.innerHTML = '';

  if (!avatarBuilderMoved) {
    avatarBuilderMoved = true;
    const bodyView = document.getElementById('body-view');
    const bdForm = document.getElementById('bd-form');
    if (bodyView) { bodyView.style.display = 'block'; profileModalCard.appendChild(bodyView); }
    if (bdForm) { bdForm.style.display = 'flex'; profileModalCard.appendChild(bdForm); }
  }

  profileModal.style.display = 'flex';

  window.renderAuthUI && window.renderAuthUI();
  window.loadSavedMeasurements && window.loadSavedMeasurements();
  window.loadCloudPatterns && window.loadCloudPatterns();

  if (!avatarViewerStarted) {
    avatarViewerStarted = true;
    // Wait a frame so the modal is actually laid out (real width/height)
    // before the WebGL viewer tries to measure the space it mounts into —
    // mounting into a still-hidden container is what broke this last time.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.initBodyDoubleViewer && window.initBodyDoubleViewer();
      });
    });
  }
});

closeProfileModal?.addEventListener('click', () => {
  profileModal.style.display = 'none';
});

profileModal?.addEventListener('click', (e) => {
  if (e.target === profileModal) profileModal.style.display = 'none';
});
