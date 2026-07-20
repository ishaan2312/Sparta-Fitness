/**
 * Shell Module
 * Owns the three-tab bottom navigation and decides which view is on screen.
 * The HIIT tab hosts the original timer untouched; leaving it always stops the
 * timer and any speech so audio never keeps playing in the background.
 */

const Shell = (() => {

  const TABS = ['workout', 'hiit', 'profile'];
  const PANELS = { workout: 'viewWorkout', hiit: 'screenContainer', profile: 'viewProfile' };

  let activeTab = 'workout';

  const getActiveTab = () => activeTab;

  const setTab = (tab) => {
    if (!TABS.includes(tab)) return;

    // Leaving the timer: pause it and silence speech so nothing keeps running
    // in the background. Pausing (not resetting) preserves workout progress.
    if (activeTab === 'hiit' && tab !== 'hiit') {
      try {
        if (typeof Timer !== 'undefined') {
          Timer.pause();
          Timer.stop();
        }
        if (typeof Speech !== 'undefined') Speech.cancel();
      } catch (e) {
        console.warn('Could not pause timer on tab change', e);
      }
    }

    activeTab = tab;

    TABS.forEach(t => {
      const panel = document.getElementById(PANELS[t]);
      if (panel) panel.classList.toggle('active', t === tab);
      const btn = document.querySelector(`[data-tab-btn="${t}"]`);
      if (btn) {
        btn.classList.toggle('active', t === tab);
        btn.setAttribute('aria-selected', String(t === tab));
      }
    });

    if (tab === 'hiit') {
      // Redraw so the controls match the real timer state (e.g. show Resume
      // after the timer was paused by leaving the tab)
      if (typeof App !== 'undefined' && App.refresh) App.refresh();
    } else if (typeof GymApp !== 'undefined') {
      GymApp.render(tab);
    }
  };

  const init = () => {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab-btn]');
      if (btn) setTab(btn.dataset.tabBtn);
    });
    setTab('workout');
  };

  return { init, setTab, getActiveTab };
})();
