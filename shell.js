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
      // A paused or running timer means a workout is genuinely underway, so
      // return to it. Otherwise start fresh at the timer home screen.
      let midWorkout = false;
      try {
        const state = typeof Timer !== 'undefined' ? Timer.getState().state : null;
        midWorkout = state === 'running' || state === 'paused';
      } catch (e) {
        midWorkout = false;
      }
      if (typeof App === 'undefined') return;
      if (midWorkout && App.refresh) App.refresh();
      else if (App.goHome) App.goHome();
      else if (App.refresh) App.refresh();
    } else if (typeof GymApp !== 'undefined') {
      GymApp.enterTab(tab);
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
