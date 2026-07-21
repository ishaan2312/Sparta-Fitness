/**
 * Gym App Module
 * Owns the Workout and Profile tabs: routing, view rendering and user actions.
 * The HIIT tab is untouched and still handled entirely by the original App module.
 *
 * Routing model
 *   Each tab keeps its own navigation stack so switching tabs never loses your place.
 *   go(tab, view, params) pushes, back(tab) pops, render(tab) paints the top entry.
 */

const GymApp = (() => {

  const esc = GymUI.esc;

  const CONTAINERS = {
    workout: 'viewWorkout',
    profile: 'viewProfile'
  };

  const stacks = {
    workout: [{ view: 'dashboard', params: {} }],
    profile: [{ view: 'profile', params: {} }]
  };

  // Live workout being logged (null when no workout is in progress)
  let session = null;

  /* ==================== Router ==================== */

  const current = (tab) => stacks[tab][stacks[tab].length - 1];

  const go = (tab, view, params = {}) => {
    stacks[tab].push({ view, params });
    render(tab);
  };

  const replace = (tab, view, params = {}) => {
    stacks[tab][stacks[tab].length - 1] = { view, params };
    render(tab);
  };

  const back = (tab) => {
    if (stacks[tab].length > 1) stacks[tab].pop();
    render(tab);
  };

  const resetTo = (tab, view) => {
    stacks[tab] = [{ view, params: {} }];
    render(tab);
  };

  const canGoBack = (tab) => stacks[tab].length > 1;

  const VIEWS = {
    dashboard: renderDashboard,
    routines: renderRoutines,
    routineEdit: renderRoutineEdit,
    picker: renderPicker,
    prepare: renderPrepare,
    logger: renderLogger,
    exercise: renderExerciseHistory,
    sessions: renderSessions,
    session: renderSessionDetail,
    profile: renderProfile,
    analytics: renderAnalytics
  };

  function render(tab) {
    const container = document.getElementById(CONTAINERS[tab]);
    if (!container) return;
    const { view, params } = current(tab);
    const fn = VIEWS[view];
    if (!fn) return;
    container.innerHTML = fn(params, tab);
    container.scrollTop = 0;
    if (typeof fn.after === 'function') fn.after(params, tab, container);
  }

  const header = (title, tab, subtitle) => `
    <div class="gym-header">
      ${canGoBack(tab) ? `<button class="gym-back" data-gym="back" data-tab="${tab}" aria-label="Back">‹</button>` : '<span class="gym-back-spacer"></span>'}
      <div class="gym-header-text">
        <h1>${esc(title)}</h1>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
      </div>
    </div>`;

  /* ==================== Dashboard ==================== */

  function renderDashboard(_params, tab) {
    const routine = GymStore.getTodaysRoutine();
    const quote = GymData.getDailyQuote();
    const stats = GymStore.getAnalytics();

    return `
      ${header('Today', tab)}
      <div class="gym-content">
        ${session && !session.editingId ? `
          <button class="resume-banner fade-in" data-gym="resumeWorkout" data-tab="${tab}">
            <span>Workout in progress · ${esc(session.routineName)}</span>
            <strong>Resume ›</strong>
          </button>
        ` : ''}
        ${routine ? `
          <div class="hero-card fade-in">
            <span class="hero-label">Today's Workout</span>
            <h2 class="hero-title">${esc(routine.name)}</h2>
            <p class="hero-sub">${routine.exercises.length} exercise${routine.exercises.length === 1 ? '' : 's'}</p>
            <button class="gym-btn primary block" data-gym="startPrepare" data-id="${routine.id}"
              ${routine.exercises.length ? '' : 'disabled'}>
              Start Workout
            </button>
            ${routine.exercises.length ? '' : '<p class="hint">Add exercises to this routine first.</p>'}
          </div>
        ` : `
          <div class="hero-card fade-in">
            <h2 class="hero-title">No routines yet</h2>
            <p class="hero-sub">Create your first routine to get started.</p>
            <button class="gym-btn primary block" data-gym="nav" data-view="routines" data-tab="${tab}">Create Routine</button>
          </div>
        `}

        <div class="quote-card fade-in">
          <span class="quote-mark">“</span>
          <p>${esc(quote)}</p>
        </div>

        <div class="stat-row fade-in">
          <div class="stat-chip"><strong>${stats.currentStreak}</strong><span>Day streak</span></div>
          <div class="stat-chip"><strong>${stats.thisWeek}</strong><span>This week</span></div>
          <div class="stat-chip"><strong>${stats.totalWorkouts}</strong><span>Total</span></div>
        </div>

        <button class="gym-btn ghost block" data-gym="nav" data-view="routines" data-tab="${tab}">
          Manage Routines
        </button>
      </div>`;
  }

  /* ==================== Routines list ==================== */

  function renderRoutines(_params, tab) {
    const routines = GymStore.getRoutines();
    const lastId = GymStore.getLastRoutineId();
    const today = GymStore.getTodaysRoutine();

    return `
      ${header('Routines', tab, 'Order decides what comes next')}
      <div class="gym-content">
        <div class="sortable-list" data-sortable-list id="routineList">
          ${routines.map(r => `
            <div class="row-card" data-sortable data-id="${r.id}">
              <button class="drag-handle" data-drag-handle aria-label="Reorder">⋮⋮</button>
              <div class="row-main" data-gym="nav" data-view="routineEdit" data-tab="${tab}" data-id="${r.id}">
                <span class="row-title">${esc(r.name)}</span>
                <span class="row-sub">${r.exercises.length} exercises${today && today.id === r.id ? ' · up next' : ''}${lastId === r.id ? ' · last done' : ''}</span>
              </div>
              <button class="icon-btn danger" data-gym="deleteRoutine" data-id="${r.id}" data-tab="${tab}" aria-label="Delete">✕</button>
            </div>
          `).join('') || '<p class="empty-note">No routines yet.</p>'}
        </div>

        <div class="inline-form">
          <input type="text" id="newRoutineName" class="gym-input" placeholder="New routine name" maxlength="40">
          <button class="gym-btn secondary" data-gym="addRoutine" data-tab="${tab}">Add</button>
        </div>
        <p class="hint">Hold the ⋮⋮ handle to drag a routine into a new position.</p>
      </div>`;
  }

  renderRoutines.after = (_params, tab) => {
    const list = document.getElementById('routineList');
    GymUI.enableDragSort(list, (ids) => {
      GymStore.reorderRoutines(ids);
      GymUI.toast('Order saved');
    });
  };

  /* ==================== Routine editor ==================== */

  function renderRoutineEdit({ id }, tab) {
    const routine = GymStore.getRoutine(id);
    if (!routine) return `${header('Routine', tab)}<div class="gym-content"><p class="empty-note">This routine no longer exists.</p></div>`;

    return `
      ${header('Edit Routine', tab)}
      <div class="gym-content">
        <label class="field-label">Routine name</label>
        <input type="text" class="gym-input" id="routineName" value="${esc(routine.name)}"
          data-gym-input="routineName" data-id="${routine.id}" maxlength="40">

        <label class="field-label">Exercises</label>
        <div class="sortable-list" data-sortable-list id="exerciseList">
          ${routine.exercises.map(ex => `
            <div class="row-card" data-sortable data-id="${esc(ex)}">
              <button class="drag-handle" data-drag-handle aria-label="Reorder">⋮⋮</button>
              <div class="row-main" data-gym="openExercise" data-name="${esc(ex)}" data-tab="${tab}">
                <span class="row-title">${esc(ex)}</span>
                <span class="row-sub">${esc(GymStore.muscleOf(ex))}</span>
              </div>
              <button class="icon-btn danger" data-gym="removeExercise" data-id="${routine.id}" data-name="${esc(ex)}" data-tab="${tab}" aria-label="Remove">✕</button>
            </div>
          `).join('') || '<p class="empty-note">No exercises yet.</p>'}
        </div>

        <button class="gym-btn secondary block" data-gym="nav" data-view="picker" data-tab="${tab}" data-id="${routine.id}">
          + Add Exercises
        </button>
      </div>`;
  }

  renderRoutineEdit.after = ({ id }) => {
    GymUI.enableDragSort(document.getElementById('exerciseList'), (names) => {
      GymStore.updateRoutine(id, { exercises: names });
      GymUI.toast('Order saved');
    });
  };

  /* ==================== Exercise picker ==================== */

  function renderPicker({ id }, tab) {
    const routine = GymStore.getRoutine(id);
    if (!routine) return `${header('Add Exercises', tab)}<div class="gym-content"><p class="empty-note">Routine not found.</p></div>`;
    const catalogue = GymStore.getExerciseCatalogue();
    const selected = new Set(routine.exercises);

    return `
      ${header('Add Exercises', tab, esc(routine.name))}
      <div class="gym-content">
        ${Object.keys(catalogue).map(muscle => `
          <details class="muscle-group" ${catalogue[muscle].some(e => selected.has(e)) ? 'open' : ''}>
            <summary>
              <span>${esc(muscle)}</span>
              <span class="muscle-count">${catalogue[muscle].filter(e => selected.has(e)).length}/${catalogue[muscle].length}</span>
            </summary>
            <div class="muscle-body">
              ${catalogue[muscle].map(ex => `
                <label class="check-row ${selected.has(ex) ? 'checked' : ''}">
                  <input type="checkbox" ${selected.has(ex) ? 'checked' : ''}
                    data-gym="toggleExercise" data-id="${routine.id}" data-name="${esc(ex)}" data-tab="${tab}">
                  <span>${esc(ex)}</span>
                </label>
              `).join('')}
              <div class="inline-form small">
                <input type="text" class="gym-input" placeholder="Custom ${esc(muscle.toLowerCase())} exercise"
                  data-custom-input="${esc(muscle)}" maxlength="60">
                <button class="gym-btn secondary" data-gym="addCustom" data-muscle="${esc(muscle)}" data-id="${routine.id}" data-tab="${tab}">Add</button>
              </div>
            </div>
          </details>
        `).join('')}
        <button class="gym-btn primary block" data-gym="back" data-tab="${tab}">Done</button>
      </div>`;
  }

  /* ==================== Prepare (choose today's exercises) ==================== */

  function renderPrepare({ id }, tab) {
    const routine = GymStore.getRoutine(id);
    if (!routine) return `${header('Workout', tab)}<div class="gym-content"><p class="empty-note">Routine not found.</p></div>`;

    return `
      ${header(routine.name, tab, 'Pick what you are training today')}
      <div class="gym-content pad-bottom">
        <div class="select-bar">
          <span id="selectedCount">0 of ${routine.exercises.length} selected</span>
          <button class="link-btn" data-gym="selectAll" data-tab="${tab}">Select all</button>
        </div>
        <div class="select-list" id="prepareList">
          ${routine.exercises.map(ex => `
            <label class="check-row large">
              <input type="checkbox" data-prepare value="${esc(ex)}">
              <span class="check-body">
                <span class="row-title">${esc(ex)}</span>
                <span class="row-sub">Best: ${GymStore.getHighestWeight(ex) || '—'} kg</span>
              </span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="sticky-action">
        <button class="gym-btn primary block big" data-gym="startWorkout" data-id="${routine.id}" data-tab="${tab}">
          START WORKOUT
        </button>
      </div>`;
  }

  /** Refresh the "n of m selected" label on the prepare screen. */
  const updateSelectedCount = () => {
    const label = document.getElementById('selectedCount');
    if (!label) return;
    const boxes = document.querySelectorAll('[data-prepare]');
    const checked = document.querySelectorAll('[data-prepare]:checked');
    label.textContent = `${checked.length} of ${boxes.length} selected`;
    const btn = document.querySelector('[data-gym="selectAll"]');
    if (btn) btn.textContent = (boxes.length && checked.length === boxes.length) ? 'Clear all' : 'Select all';
  };

  /* ==================== Workout history ==================== */

  const monthLabel = (key) => new Date(key + '-01T00:00:00')
    .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function renderSessions({ filter }, tab) {
    const all = GymStore.getSessions().slice()
      .sort((a, b) => (b.completedAt || b.date).localeCompare(a.completedAt || a.date));

    // Filter chips are built from routines that actually appear in history
    const routines = [...new Set(all.map(s => s.routineName).filter(Boolean))];
    const active = filter && routines.includes(filter) ? filter : null;
    const shown = active ? all.filter(s => s.routineName === active) : all;

    // Group into months, preserving the newest-first order
    const months = [];
    shown.forEach(s => {
      const key = s.date.slice(0, 7);
      const bucket = months.find(m => m.key === key);
      (bucket || months[months.push({ key, items: [] }) - 1]).items.push(s);
    });

    return `
      ${header('Workout History', tab, `${all.length} workout${all.length === 1 ? '' : 's'} logged`)}
      <div class="gym-content">
        ${routines.length > 1 ? `
          <div class="filter-row">
            <button class="chip ${!active ? 'on' : ''}" data-gym="filterSessions" data-tab="${tab}" data-value="">All</button>
            ${routines.map(r => `
              <button class="chip ${active === r ? 'on' : ''}" data-gym="filterSessions" data-tab="${tab}" data-value="${esc(r)}">${esc(r)}</button>
            `).join('')}
          </div>` : ''}

        ${shown.length ? months.map(m => `
          <div class="month-head">
            <span>${esc(monthLabel(m.key))}</span>
            <span>${m.items.length}</span>
          </div>
          ${m.items.map(s => {
            const t = GymStore.sessionTotals(s);
            return `
              <button class="session-row" data-gym="nav" data-view="session" data-tab="${tab}" data-id="${s.id}">
                <span class="session-date">
                  <strong>${new Date(s.date + 'T00:00:00').getDate()}</strong>
                  <em>${new Date(s.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}</em>
                </span>
                <span class="session-main">
                  <span class="row-title">${esc(s.routineName || 'Workout')}</span>
                  <span class="row-sub">${t.exercises} exercises · ${t.sets} sets · ${t.volume.toLocaleString()} kg</span>
                </span>
                <span class="session-chevron">›</span>
              </button>`;
          }).join('')}
        `).join('') : `<p class="empty-note">${active ? 'No ' + esc(active) + ' workouts yet.' : 'No workouts logged yet.'}</p>`}
      </div>`;
  }

  function renderSessionDetail({ id }, tab) {
    const s = GymStore.getSession(id);
    if (!s) return `${header('Workout', tab)}<div class="gym-content"><p class="empty-note">This workout was deleted.</p></div>`;

    const t = GymStore.sessionTotals(s);
    const prs = GymStore.getSessionPRs(s.id);
    const bw = GymStore.getWeightOn(s.date);

    const badges = (p) => {
      if (!p) return '';
      const out = [];
      if (p.weight) out.push('<span class="pr-badge">Weight PR</span>');
      if (p.volume) out.push('<span class="pr-badge">Volume PR</span>');
      if (p.reps) out.push('<span class="pr-badge">Reps PR</span>');
      if (p.first) out.push('<span class="pr-badge muted">First time</span>');
      return out.join('');
    };

    return `
      ${header(s.routineName || 'Workout', tab, GymUI.fmtDate(s.date))}
      <div class="gym-content">
        <div class="stat-grid">
          <div class="stat-box"><span>Exercises</span><strong>${t.exercises}</strong></div>
          <div class="stat-box"><span>Sets</span><strong>${t.sets}</strong></div>
          <div class="stat-box"><span>Reps</span><strong>${t.reps}</strong></div>
          <div class="stat-box"><span>Volume</span><strong>${t.volume.toLocaleString()} kg</strong></div>
          ${bw ? `<div class="stat-box"><span>Bodyweight</span><strong>${bw} kg</strong></div>` : ''}
        </div>

        ${s.entries.map(e => {
          const vol = Math.round(e.sets.reduce((sum, x) => sum + x.weight * x.reps, 0));
          return `
            <div class="history-card">
              <div class="history-head">
                <button class="log-title small" data-gym="openExercise" data-name="${esc(e.exercise)}" data-tab="${tab}">
                  ${esc(e.exercise)}
                </button>
                <span>${vol.toLocaleString()} kg</span>
              </div>
              ${badges(prs[e.exercise]) ? `<div class="badge-row">${badges(prs[e.exercise])}</div>` : ''}
              <div class="history-sets">
                ${e.sets.map((x, i) => `<span class="set-pill">${i + 1}. ${x.weight}kg × ${x.reps}</span>`).join('')}
              </div>
            </div>`;
        }).join('')}

        <div class="action-row">
          <button class="gym-btn secondary grow" data-gym="editSession" data-id="${s.id}" data-tab="${tab}">Edit</button>
          <button class="gym-btn danger-outline grow" data-gym="deleteSession" data-id="${s.id}" data-tab="${tab}">Delete</button>
        </div>
      </div>`;
  }

  /* ==================== Workout logger ==================== */

  const EMPTY_SET = () => ({ weight: '', reps: '', done: false });

  const setRowHTML = (exIdx, setIdx, set) => `
    <div class="set-row ${set.done ? 'done' : ''}" data-ex="${exIdx}" data-set="${setIdx}">
      <span class="set-index">${setIdx + 1}</span>
      <input type="number" inputmode="decimal" step="0.5" class="set-input" placeholder="0"
        value="${set.weight}" data-field="weight" data-ex="${exIdx}" data-set="${setIdx}">
      <input type="number" inputmode="numeric" class="set-input" placeholder="0"
        value="${set.reps}" data-field="reps" data-ex="${exIdx}" data-set="${setIdx}">
      <button class="set-check ${set.done ? 'on' : ''}" data-gym="toggleSet" data-ex="${exIdx}" data-set="${setIdx}" aria-label="Complete set">✓</button>
    </div>`;

  function renderLogger(_params, tab) {
    if (!session) return `${header('Workout', tab)}<div class="gym-content"><p class="empty-note">No workout in progress.</p></div>`;
    const editing = !!session.editingId;

    return `
      ${header(session.routineName, tab, editing ? `Editing ${GymUI.fmtDate(session.date)}` : 'Workout in progress')}
      <div class="gym-content pad-bottom" id="loggerBody">
        ${session.entries.map((entry, i) => {
          const best = GymStore.getHighestWeight(entry.exercise);
          return `
            <div class="log-card" data-ex-card="${i}">
              <button class="log-title" data-gym="openExercise" data-name="${esc(entry.exercise)}" data-tab="${tab}">
                ${esc(entry.exercise)}
              </button>
              <p class="log-best">Highest Weight Ever: ${best ? best + ' kg' : '—'}</p>
              <div class="set-head">
                <span class="set-index">#</span>
                <span>Weight</span>
                <span>Reps</span>
                <span></span>
              </div>
              <div class="set-rows" data-rows="${i}">
                ${entry.sets.map((s, j) => setRowHTML(i, j, s)).join('')}
              </div>
            </div>`;
        }).join('')}
      </div>
      <div class="sticky-action row">
        <button class="gym-btn ghost" data-gym="cancelWorkout" data-tab="${tab}">Cancel</button>
        <button class="gym-btn primary big grow" data-gym="${editing ? 'saveSession' : 'finishWorkout'}" data-tab="${tab}">
          ${editing ? 'Save Changes' : 'Finish Workout'}
        </button>
      </div>`;
  }

  /** Keep at least one empty row available at the end of each exercise. */
  const ensureTrailingRow = (exIdx) => {
    const entry = session.entries[exIdx];
    const allFilled = entry.sets.every(s => s.weight !== '' && s.reps !== '');
    if (!allFilled) return;
    entry.sets.push(EMPTY_SET());
    const rows = document.querySelector(`[data-rows="${exIdx}"]`);
    if (rows) rows.insertAdjacentHTML('beforeend', setRowHTML(exIdx, entry.sets.length - 1, EMPTY_SET()));
  };

  /* ==================== Exercise history ==================== */

  function renderExerciseHistory({ name }, tab) {
    const records = GymStore.getExerciseRecords(name);
    const history = GymStore.getExerciseHistory(name);
    const points = history.map(h => ({ label: GymUI.fmtDateShort(h.date), value: h.topWeight }));

    return `
      ${header(name, tab, GymStore.muscleOf(name))}
      <div class="gym-content">
        <div class="pr-grid">
          <div class="pr-card"><span>Highest Weight</span><strong>${records.maxWeight || '—'}<em>kg</em></strong></div>
          <div class="pr-card"><span>Highest Volume</span><strong>${records.maxVolume || '—'}<em>kg</em></strong></div>
          <div class="pr-card"><span>Most Reps</span><strong>${records.maxReps || '—'}</strong></div>
          <div class="pr-card"><span>Sessions</span><strong>${records.sessions}</strong></div>
        </div>

        <h3 class="section-title">Top Weight Over Time</h3>
        ${GymUI.lineChart(points, { unit: 'kg' })}

        <h3 class="section-title">History</h3>
        ${history.length ? history.slice().reverse().map(h => `
          <div class="history-card">
            <div class="history-head">
              <strong>${esc(GymUI.fmtDate(h.date))}</strong>
              <span>${h.sets.length} sets · ${h.volume} kg volume</span>
            </div>
            <div class="history-sets">
              ${h.sets.map((s, i) => `<span class="set-pill">${i + 1}. ${s.weight}kg × ${s.reps}</span>`).join('')}
            </div>
          </div>
        `).join('') : '<p class="empty-note">No history logged yet.</p>'}
      </div>`;
  }

  /* ==================== Profile ==================== */

  function renderProfile(_params, tab) {
    const p = GymStore.getProfile();
    const stats = GymStore.getWeightStats();
    const weights = GymStore.getWeights();
    const ftIn = p.heightCm ? GymStore.cmToFtIn(p.heightCm) : { ft: '', in: '' };
    const points = weights.map(w => ({ label: GymUI.fmtDateShort(w.date), value: w.kg }));

    return `
      ${header('Profile', tab)}
      <div class="gym-content">
        <h3 class="section-title">Personal Details</h3>
        <div class="panel">
          <label class="field-label">Name</label>
          <input type="text" class="gym-input" value="${esc(p.name)}" data-gym-input="name" maxlength="40">

          <label class="field-label">Age</label>
          <input type="number" class="gym-input" value="${esc(p.age)}" data-gym-input="age" min="1" max="120" inputmode="numeric">

          <label class="field-label">Height</label>
          <div class="unit-toggle">
            <button class="unit-btn ${p.heightUnit !== 'ft' ? 'on' : ''}" data-gym="heightUnit" data-unit="cm" data-tab="${tab}">cm</button>
            <button class="unit-btn ${p.heightUnit === 'ft' ? 'on' : ''}" data-gym="heightUnit" data-unit="ft" data-tab="${tab}">ft + in</button>
          </div>
          ${p.heightUnit === 'ft' ? `
            <div class="row-inputs">
              <input type="number" class="gym-input" placeholder="ft" value="${ftIn.ft}" data-gym-input="heightFt" inputmode="numeric">
              <input type="number" class="gym-input" placeholder="in" value="${ftIn.in}" data-gym-input="heightIn" inputmode="numeric">
            </div>
            <p class="hint">${p.heightCm ? p.heightCm + ' cm' : ''}</p>
          ` : `
            <input type="number" class="gym-input" placeholder="cm" value="${esc(p.heightCm)}" data-gym-input="heightCm" inputmode="numeric">
            <p class="hint">${p.heightCm ? `${GymStore.cmToFtIn(p.heightCm).ft} ft ${GymStore.cmToFtIn(p.heightCm).in} in` : ''}</p>
          `}
        </div>

        <h3 class="section-title">Weight</h3>
        <div class="panel">
          <div class="inline-form">
            <input type="number" step="0.1" inputmode="decimal" class="gym-input" id="weightInput" placeholder="Today's weight (kg)">
            <button class="gym-btn secondary" data-gym="logWeight" data-tab="${tab}">Log</button>
          </div>

          ${stats ? `
            <div class="stat-grid">
              <div class="stat-box"><span>Current</span><strong>${stats.current} kg</strong></div>
              <div class="stat-box"><span>Starting</span><strong>${stats.starting} kg</strong></div>
              <div class="stat-box"><span>Highest</span><strong>${stats.highest} kg</strong></div>
              <div class="stat-box"><span>Lowest</span><strong>${stats.lowest} kg</strong></div>
              <div class="stat-box"><span>${stats.change <= 0 ? 'Weight Lost' : 'Weight Gained'}</span><strong>${Math.abs(stats.change)} kg</strong></div>
              <div class="stat-box"><span>Weekly Avg</span><strong>${stats.weeklyAvg > 0 ? '+' : ''}${stats.weeklyAvg} kg</strong></div>
            </div>
            ${GymUI.lineChart(points, { unit: 'kg' })}
            <div class="weight-list">
              ${weights.slice().reverse().map(w => `
                <div class="weight-row">
                  <span>${esc(GymUI.fmtDate(w.date))}</span>
                  <strong>${w.kg} kg</strong>
                  <button class="icon-btn" data-gym="editWeight" data-id="${w.id}" data-tab="${tab}" aria-label="Edit">✎</button>
                  <button class="icon-btn danger" data-gym="deleteWeight" data-id="${w.id}" data-tab="${tab}" aria-label="Delete">✕</button>
                </div>
              `).join('')}
            </div>
          ` : '<p class="empty-note">Log your weight to start tracking.</p>'}
        </div>

        <button class="gym-btn secondary block" data-gym="nav" data-view="analytics" data-tab="${tab}">Analytics</button>
        <button class="gym-btn ghost block" data-gym="exportData" data-tab="${tab}">Export All Data</button>
      </div>`;
  }

  /* ==================== Analytics ==================== */

  function renderAnalytics(_params, tab) {
    const a = GymStore.getAnalytics();

    return `
      ${header('Analytics', tab)}
      <div class="gym-content">
        <div class="stat-grid">
          <button class="stat-box tappable" data-gym="nav" data-view="sessions" data-tab="${tab}"><span>Total Workouts</span><strong>${a.totalWorkouts}</strong><span class="stat-chevron">›</span></button>
          <div class="stat-box"><span>Current Streak</span><strong>${a.currentStreak}</strong></div>
          <div class="stat-box"><span>Longest Streak</span><strong>${a.longestStreak}</strong></div>
          <div class="stat-box"><span>Most Trained</span><strong>${esc(a.topMuscle)}</strong></div>
          <div class="stat-box"><span>Weight Lifted</span><strong>${a.totalWeight.toLocaleString()} kg</strong></div>
          <div class="stat-box"><span>Total Sets</span><strong>${a.totalSets}</strong></div>
          <div class="stat-box"><span>Total Reps</span><strong>${a.totalReps}</strong></div>
          <div class="stat-box"><span>This Month</span><strong>${a.thisMonth}</strong></div>
          <div class="stat-box"><span>This Week</span><strong>${a.thisWeek}</strong></div>
        </div>

        <h3 class="section-title">Workout Calendar</h3>
        ${GymUI.calendar(a.trainedDates)}
      </div>`;
  }

  /* ==================== Actions ==================== */

  const ACTIONS = {
    nav: (el) => go(el.dataset.tab, el.dataset.view, {
      id: el.dataset.id, name: el.dataset.name, filter: el.dataset.filter || null
    }),

    back: (el) => back(el.dataset.tab),

    addRoutine: (el) => {
      const input = document.getElementById('newRoutineName');
      const name = (input?.value || '').trim();
      if (!name) return GymUI.toast('Enter a routine name');
      GymStore.addRoutine(name);
      render(el.dataset.tab);
    },

    deleteRoutine: (el) => {
      const routine = GymStore.getRoutine(el.dataset.id);
      if (!routine || !confirm(`Delete "${routine.name}"?`)) return;
      GymStore.deleteRoutine(el.dataset.id);
      render(el.dataset.tab);
    },

    removeExercise: (el) => {
      const routine = GymStore.getRoutine(el.dataset.id);
      if (!routine) return;
      GymStore.updateRoutine(routine.id, { exercises: routine.exercises.filter(e => e !== el.dataset.name) });
      render(el.dataset.tab);
    },

    toggleExercise: (el) => {
      const routine = GymStore.getRoutine(el.dataset.id);
      if (!routine) return;
      const name = el.dataset.name;
      const has = routine.exercises.includes(name);
      GymStore.updateRoutine(routine.id, {
        exercises: has ? routine.exercises.filter(e => e !== name) : [...routine.exercises, name]
      });
      el.closest('.check-row')?.classList.toggle('checked', !has);
      const details = el.closest('.muscle-group');
      const count = details?.querySelector('.muscle-count');
      if (count) {
        const boxes = details.querySelectorAll('input[type="checkbox"]');
        const checked = details.querySelectorAll('input[type="checkbox"]:checked');
        count.textContent = `${checked.length}/${boxes.length}`;
      }
    },

    addCustom: (el) => {
      const muscle = el.dataset.muscle;
      const input = document.querySelector(`[data-custom-input="${CSS.escape(muscle)}"]`);
      const name = (input?.value || '').trim();
      if (!name) return GymUI.toast('Enter an exercise name');
      if (!GymStore.addCustomExercise(muscle, name)) return GymUI.toast('That exercise already exists');
      const routine = GymStore.getRoutine(el.dataset.id);
      if (routine) GymStore.updateRoutine(routine.id, { exercises: [...routine.exercises, name] });
      render(el.dataset.tab);
      GymUI.toast('Exercise added');
    },

    startPrepare: (el) => go('workout', 'prepare', { id: el.dataset.id }),

    selectAll: (el) => {
      const boxes = Array.from(document.querySelectorAll('[data-prepare]'));
      const turnOn = !boxes.every(b => b.checked);
      boxes.forEach(b => {
        b.checked = turnOn;
        b.closest('.check-row')?.classList.toggle('checked', turnOn);
      });
      el.textContent = turnOn ? 'Clear all' : 'Select all';
      updateSelectedCount();
    },

    startWorkout: (el) => {
      const routine = GymStore.getRoutine(el.dataset.id);
      if (!routine) return;
      const chosen = Array.from(document.querySelectorAll('[data-prepare]:checked')).map(c => c.value);
      if (!chosen.length) return GymUI.toast('Select at least one exercise');
      session = {
        routineId: routine.id,
        routineName: routine.name,
        entries: chosen.map(ex => ({ exercise: ex, sets: [EMPTY_SET(), EMPTY_SET(), EMPTY_SET()] }))
      };
      replace('workout', 'logger', {});
    },

    filterSessions: (el) => replace(el.dataset.tab, 'sessions', { filter: el.dataset.value || null }),

    editSession: (el) => {
      const s = GymStore.getSession(el.dataset.id);
      if (!s) return;
      // Reuse the logger: stored numbers become editable strings, plus a spare row
      session = {
        editingId: s.id,
        date: s.date,
        routineId: s.routineId,
        routineName: s.routineName || 'Workout',
        entries: s.entries.map(e => ({
          exercise: e.exercise,
          sets: [...e.sets.map(x => ({ weight: String(x.weight), reps: String(x.reps), done: x.done })), EMPTY_SET()]
        }))
      };
      go(el.dataset.tab, 'logger', {});
    },

    saveSession: (el) => {
      if (!session || !session.editingId) return;
      GymStore.updateSession(session.editingId, session.entries);
      const id = session.editingId;
      session = null;
      replace(el.dataset.tab, 'session', { id });
      GymUI.toast('Changes saved');
    },

    deleteSession: (el) => {
      const s = GymStore.getSession(el.dataset.id);
      if (!s) return;
      if (!confirm(`Delete the ${s.routineName || 'workout'} from ${GymUI.fmtDate(s.date)}? This cannot be undone.`)) return;
      GymStore.deleteSession(el.dataset.id);
      replace(el.dataset.tab, 'sessions', {});
      GymUI.toast('Workout deleted');
    },

    resumeWorkout: (el) => {
      if (session) go(el.dataset.tab, 'logger', {});
    },

    toggleSet: (el) => {
      const i = +el.dataset.ex, j = +el.dataset.set;
      const set = session.entries[i].sets[j];
      set.done = !set.done;
      el.classList.toggle('on', set.done);
      el.closest('.set-row')?.classList.toggle('done', set.done);
    },

    cancelWorkout: (el) => {
      if (session && session.editingId) {
        const id = session.editingId;
        session = null;
        replace(el.dataset.tab, 'session', { id });   // edits dropped, workout untouched
        return;
      }
      if (!confirm('Discard this workout?')) return;
      session = null;
      resetTo(el.dataset.tab, 'dashboard');
    },

    finishWorkout: (el) => {
      if (!session) return;
      const logged = session.entries.some(e => e.sets.some(s => s.weight !== '' || s.reps !== ''));
      if (!logged && !confirm('Nothing logged. Finish anyway?')) return;
      GymStore.finishSession(session);
      session = null;
      resetTo(el.dataset.tab, 'dashboard');
      GymUI.toast('Workout saved');
    },

    openExercise: (el) => go(el.dataset.tab, 'exercise', { name: el.dataset.name }),

    heightUnit: (el) => {
      GymStore.updateProfile({ heightUnit: el.dataset.unit });
      render(el.dataset.tab);
    },

    logWeight: (el) => {
      const input = document.getElementById('weightInput');
      const kg = parseFloat(input?.value);
      if (!kg || kg <= 0) return GymUI.toast('Enter a valid weight');
      GymStore.addWeight(kg);
      render(el.dataset.tab);
      GymUI.toast('Weight logged');
    },

    editWeight: (el) => {
      const entry = GymStore.getWeights().find(w => w.id === el.dataset.id);
      if (!entry) return;
      const value = prompt(`Weight on ${GymUI.fmtDate(entry.date)} (kg)`, entry.kg);
      if (value === null) return;
      const kg = parseFloat(value);
      if (!kg || kg <= 0) return GymUI.toast('Invalid weight');
      GymStore.updateWeight(entry.id, { kg });
      render(el.dataset.tab);
    },

    deleteWeight: (el) => {
      if (!confirm('Delete this entry?')) return;
      GymStore.deleteWeight(el.dataset.id);
      render(el.dataset.tab);
    },

    exportData: () => {
      const hiit = typeof Storage !== 'undefined' ? Storage.exportData() : null;
      const data = { ...GymStore.exportAll(), hiit };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fitness-backup-${GymStore.todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  /* ==================== Event wiring ==================== */

  const setupEvents = () => {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-gym]');
      if (!el) return;
      const action = ACTIONS[el.dataset.gym];
      if (action) action(el, e);
    });

    // Text/number fields that write straight through to storage
    document.addEventListener('input', (e) => {
      const el = e.target;

      if (el.dataset.field && session) {
        const entry = session.entries[+el.dataset.ex];
        entry.sets[+el.dataset.set][el.dataset.field] = el.value;
        ensureTrailingRow(+el.dataset.ex);
        return;
      }

      const key = el.dataset.gymInput;
      if (!key) return;

      if (key === 'routineName') {
        GymStore.updateRoutine(el.dataset.id, { name: el.value });
      } else if (key === 'heightFt' || key === 'heightIn') {
        const ft = document.querySelector('[data-gym-input="heightFt"]')?.value || 0;
        const inches = document.querySelector('[data-gym-input="heightIn"]')?.value || 0;
        GymStore.updateProfile({ heightCm: GymStore.ftInToCm(ft, inches) });
      } else if (key === 'heightCm') {
        GymStore.updateProfile({ heightCm: el.value });
      } else {
        GymStore.updateProfile({ [key]: el.value });
      }
    });

    // Keep the prepare-screen rows visually in sync with their checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.dataset.prepare !== undefined) {
        e.target.closest('.check-row')?.classList.toggle('checked', e.target.checked);
        updateSelectedCount();
      }
    });
  };

  const init = () => {
    setupEvents();
    GymUI.initDragSort();
    render('workout');
    render('profile');
  };

  return { init, render, go, back, resetTo, hasActiveSession: () => !!session };
})();
