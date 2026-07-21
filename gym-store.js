/**
 * Gym Store Module
 * Single source of truth for all gym data. LocalStorage backed, namespaced with
 * "gym." so it never collides with the HIIT timer's existing keys.
 *
 * Data models
 *   profile   { name, age, heightCm, heightUnit }
 *   routines  [ { id, name, exercises: [exerciseName] } ]   // order matters
 *   sessions  [ { id, date, routineId, routineName, entries: [ { exercise, sets:[{weight,reps,done}] } ] } ]
 *   weights   [ { id, date:'YYYY-MM-DD', kg } ]
 *   custom    { muscle: [exerciseName] }
 *   lastRoutineId  string   // last completed routine, drives Today's Workout
 */

const GymStore = (() => {

  const K = {
    profile: 'gym.profile',
    routines: 'gym.routines',
    sessions: 'gym.sessions',
    weights: 'gym.weights',
    custom: 'gym.customExercises',
    last: 'gym.lastRoutineId'
  };

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('GymStore read failed', key, e);
      return fallback;
    }
  };

  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('GymStore write failed', key, e);
      return false;
    }
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /* ==================== Seed ==================== */

  const DEFAULT_ROUTINES = [
    { id: 'r-chest', name: 'Chest', exercises: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Machine Chest Fly', 'Low Cable Crossover'] },
    { id: 'r-back', name: 'Back', exercises: ['Lat Pulldown (Overhand Grip)', 'Barbell Row', 'Seated Cable Row', 'Straight-Arm Pulldown'] },
    { id: 'r-shoulders', name: 'Shoulders', exercises: ['Dumbbell Overhead Press', 'Dumbbell Lateral Raise', 'Reverse Pec Deck Fly', 'Face Pull'] },
    { id: 'r-arms', name: 'Arms', exercises: ['Barbell Curl', 'Hammer Curl', 'Cable Pushdown', 'EZ Bar Skull Crusher'] },
    { id: 'r-legs', name: 'Legs', exercises: ['Barbell Squat', 'Leg Press', 'Lying Leg Curl', 'Standing Calf Raise'] }
  ];

  const init = () => {
    if (!localStorage.getItem(K.routines)) write(K.routines, DEFAULT_ROUTINES);
    if (!localStorage.getItem(K.profile)) write(K.profile, { name: '', age: '', heightCm: '', heightUnit: 'cm' });
    if (!localStorage.getItem(K.custom)) write(K.custom, {});
  };

  /* ==================== Profile ==================== */

  const getProfile = () => read(K.profile, { name: '', age: '', heightCm: '', heightUnit: 'cm' });
  const updateProfile = (patch) => {
    const next = { ...getProfile(), ...patch };
    write(K.profile, next);
    return next;
  };

  const cmToFtIn = (cm) => {
    const totalIn = Number(cm) / 2.54;
    const ft = Math.floor(totalIn / 12);
    const inches = Math.round(totalIn - ft * 12);
    return inches === 12 ? { ft: ft + 1, in: 0 } : { ft, in: inches };
  };
  const ftInToCm = (ft, inches) => Math.round(((Number(ft) || 0) * 12 + (Number(inches) || 0)) * 2.54);

  /* ==================== Routines ==================== */

  const getRoutines = () => read(K.routines, []);
  const saveRoutines = (list) => write(K.routines, list);
  const getRoutine = (id) => getRoutines().find(r => r.id === id) || null;

  const addRoutine = (name) => {
    const list = getRoutines();
    const routine = { id: uid(), name: name.trim() || 'New Routine', exercises: [] };
    list.push(routine);
    saveRoutines(list);
    return routine;
  };

  const updateRoutine = (id, patch) => {
    const list = getRoutines();
    const i = list.findIndex(r => r.id === id);
    if (i === -1) return null;
    list[i] = { ...list[i], ...patch };
    saveRoutines(list);
    return list[i];
  };

  const deleteRoutine = (id) => {
    saveRoutines(getRoutines().filter(r => r.id !== id));
    if (getLastRoutineId() === id) localStorage.removeItem(K.last);
  };

  const moveRoutine = (id, delta) => {
    const list = getRoutines();
    const i = list.findIndex(r => r.id === id);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= list.length) return false;
    [list[i], list[j]] = [list[j], list[i]];
    saveRoutines(list);
    return true;
  };

  /** Reorder by an explicit array of routine ids (used by drag & drop). */
  const reorderRoutines = (idsInOrder) => {
    const list = getRoutines();
    const next = idsInOrder.map(id => list.find(r => r.id === id)).filter(Boolean);
    list.forEach(r => { if (!next.includes(r)) next.push(r); });
    saveRoutines(next);
  };

  /* ==================== Today's workout ==================== */

  const getLastRoutineId = () => localStorage.getItem(K.last);
  const setLastRoutineId = (id) => localStorage.setItem(K.last, id);

  /** Next routine after the last completed one; wraps to the first. */
  const getTodaysRoutine = () => {
    const list = getRoutines();
    if (!list.length) return null;
    const lastId = getLastRoutineId();
    if (!lastId) return list[0];
    const i = list.findIndex(r => r.id === lastId);
    if (i === -1) return list[0];
    return list[(i + 1) % list.length];
  };

  /* ==================== Custom exercises ==================== */

  const getCustom = () => read(K.custom, {});

  const addCustomExercise = (muscle, name) => {
    const clean = name.trim();
    if (!clean) return false;
    const custom = getCustom();
    custom[muscle] = custom[muscle] || [];
    const exists = [...(GymData.EXERCISES[muscle] || []), ...custom[muscle]]
      .some(e => e.toLowerCase() === clean.toLowerCase());
    if (exists) return false;
    custom[muscle].push(clean);
    write(K.custom, custom);
    return true;
  };

  const removeCustomExercise = (muscle, name) => {
    const custom = getCustom();
    if (!custom[muscle]) return;
    custom[muscle] = custom[muscle].filter(e => e !== name);
    write(K.custom, custom);
  };

  /** Full catalogue: built-in + custom, grouped by muscle. */
  const getExerciseCatalogue = () => {
    const custom = getCustom();
    const out = {};
    GymData.MUSCLES.forEach(m => {
      out[m] = [...GymData.EXERCISES[m], ...(custom[m] || [])];
    });
    Object.keys(custom).forEach(m => {
      if (!out[m]) out[m] = [...custom[m]];
    });
    return out;
  };

  const muscleOf = (exerciseName) => {
    const cat = getExerciseCatalogue();
    return Object.keys(cat).find(m => cat[m].includes(exerciseName)) || 'Other';
  };

  /* ==================== Sessions ==================== */

  const getSessions = () => read(K.sessions, []);
  const saveSessions = (list) => write(K.sessions, list);

  /**
   * Persist a finished workout. Only sets with a weight or reps value are kept.
   * Marks the routine as completed so Today's Workout advances.
   */
  /** Normalise logger rows into stored sets, discarding untouched rows. */
  const cleanEntries = (entries) => entries
    .map(e => ({
      exercise: e.exercise,
      sets: e.sets.filter(s => s.weight !== '' || s.reps !== '')
        .map(s => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0, done: !!s.done }))
    }))
    .filter(e => e.sets.length);

  /** Newest last. completedAt is precise; date is the fallback for old records. */
  const byTime = (a, b) => (a.completedAt || a.date).localeCompare(b.completedAt || b.date);

  const finishSession = ({ routineId, routineName, entries }) => {
    const cleaned = cleanEntries(entries);

    const session = {
      id: uid(),
      date: todayKey(),
      completedAt: new Date().toISOString(),
      routineId,
      routineName,
      entries: cleaned
    };
    const list = getSessions();
    list.push(session);
    saveSessions(list);
    if (routineId) setLastRoutineId(routineId);
    return session;
  };

  const getSession = (id) => getSessions().find(s => s.id === id) || null;

  /** Replace the logged sets of a past workout. Date and routine stay put. */
  const updateSession = (id, entries) => {
    const list = getSessions();
    const i = list.findIndex(s => s.id === id);
    if (i === -1) return null;
    list[i] = { ...list[i], entries: cleanEntries(entries) };
    saveSessions(list);
    return list[i];
  };

  /**
   * Remove a workout. The rotation then follows whatever session is now the
   * most recent, so deleting a mistake doesn't leave Today's Workout skipped
   * ahead. With no sessions left, the rotation resets to the first routine.
   */
  const deleteSession = (id) => {
    const list = getSessions().filter(s => s.id !== id);
    saveSessions(list);
    const newest = list.slice().sort(byTime).pop();
    if (newest && newest.routineId) setLastRoutineId(newest.routineId);
    else localStorage.removeItem(K.last);
    return newest || null;
  };

  /**
   * Which personal records were set during this session, judged only against
   * workouts logged BEFORE it. Recomputed on demand — nothing extra is stored.
   */
  const getSessionPRs = (id) => {
    const list = getSessions().slice().sort(byTime);
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return {};
    const session = list[idx];
    const prior = list.slice(0, idx);
    const out = {};

    session.entries.forEach(e => {
      let bestW = 0, bestV = 0, bestR = 0, seen = false;
      prior.forEach(p => p.entries.forEach(x => {
        if (x.exercise !== e.exercise) return;
        seen = true;
        x.sets.forEach(s => {
          bestW = Math.max(bestW, s.weight);
          bestR = Math.max(bestR, s.reps);
        });
        bestV = Math.max(bestV, x.sets.reduce((t, s) => t + s.weight * s.reps, 0));
      }));

      const w = e.sets.reduce((m, s) => Math.max(m, s.weight), 0);
      const r = e.sets.reduce((m, s) => Math.max(m, s.reps), 0);
      const v = e.sets.reduce((t, s) => t + s.weight * s.reps, 0);

      out[e.exercise] = {
        first: !seen,
        weight: seen && w > bestW && w > 0,
        volume: seen && v > bestV && v > 0,
        reps: seen && r > bestR && r > 0
      };
    });
    return out;
  };

  /** Totals for one session — used by both the list rows and the detail view. */
  const sessionTotals = (session) => {
    let sets = 0, reps = 0, volume = 0;
    session.entries.forEach(e => e.sets.forEach(s => {
      sets += 1; reps += s.reps; volume += s.weight * s.reps;
    }));
    return { exercises: session.entries.length, sets, reps, volume: Math.round(volume) };
  };

  /** Bodyweight logged on a given day, if any. */
  const getWeightOn = (date) => {
    const entry = read(K.weights, []).find(w => w.date === date);
    return entry ? entry.kg : null;
  };

  /* ==================== Exercise history / PRs ==================== */

  /** Flat, date-sorted history of every logged set for one exercise. */
  const getExerciseHistory = (exercise) => {
    const rows = [];
    getSessions().forEach(s => {
      s.entries.forEach(e => {
        if (e.exercise !== exercise) return;
        const volume = e.sets.reduce((sum, st) => sum + st.weight * st.reps, 0);
        rows.push({
          date: s.date,
          sessionId: s.id,
          sets: e.sets,
          topWeight: Math.max(...e.sets.map(st => st.weight), 0),
          topReps: Math.max(...e.sets.map(st => st.reps), 0),
          volume
        });
      });
    });
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  };

  const getExerciseRecords = (exercise) => {
    const hist = getExerciseHistory(exercise);
    return {
      maxWeight: hist.reduce((m, r) => Math.max(m, r.topWeight), 0),
      maxVolume: hist.reduce((m, r) => Math.max(m, r.volume), 0),
      maxReps: hist.reduce((m, r) => Math.max(m, r.topReps), 0),
      sessions: hist.length
    };
  };

  const getHighestWeight = (exercise) => getExerciseRecords(exercise).maxWeight;

  /* ==================== Weight tracking ==================== */

  const getWeights = () => read(K.weights, []).slice().sort((a, b) => a.date.localeCompare(b.date));

  const addWeight = (kg, date) => {
    const list = read(K.weights, []);
    const d = date || todayKey();
    const existing = list.find(w => w.date === d);
    if (existing) existing.kg = Number(kg);
    else list.push({ id: uid(), date: d, kg: Number(kg) });
    write(K.weights, list);
  };

  const updateWeight = (id, patch) => {
    const list = read(K.weights, []);
    const i = list.findIndex(w => w.id === id);
    if (i === -1) return;
    list[i] = { ...list[i], ...patch, kg: Number(patch.kg ?? list[i].kg) };
    write(K.weights, list);
  };

  const deleteWeight = (id) => write(K.weights, read(K.weights, []).filter(w => w.id !== id));

  const getWeightStats = () => {
    const list = getWeights();
    if (!list.length) return null;
    const kgs = list.map(w => w.kg);
    const start = list[0];
    const current = list[list.length - 1];
    const days = Math.max(1, (new Date(current.date) - new Date(start.date)) / 86400000);
    const weeks = days / 7;
    return {
      current: current.kg,
      starting: start.kg,
      highest: Math.max(...kgs),
      lowest: Math.min(...kgs),
      change: +(current.kg - start.kg).toFixed(1),
      weeklyAvg: weeks >= 1 ? +((current.kg - start.kg) / weeks).toFixed(2) : 0,
      entries: list.length
    };
  };

  /* ==================== Analytics ==================== */

  const getAnalytics = () => {
    const sessions = getSessions();
    const dates = [...new Set(sessions.map(s => s.date))].sort();

    let totalSets = 0, totalReps = 0, totalWeight = 0;
    const muscleCount = {};

    sessions.forEach(s => {
      s.entries.forEach(e => {
        const muscle = muscleOf(e.exercise);
        muscleCount[muscle] = (muscleCount[muscle] || 0) + e.sets.length;
        e.sets.forEach(st => {
          totalSets += 1;
          totalReps += st.reps;
          totalWeight += st.weight * st.reps;
        });
      });
    });

    // Streaks measured in consecutive calendar days with a logged session
    let longest = 0, run = 0, prev = null;
    dates.forEach(d => {
      if (prev && (new Date(d) - new Date(prev)) === 86400000) run += 1;
      else run = 1;
      longest = Math.max(longest, run);
      prev = d;
    });

    let current = 0;
    if (dates.length) {
      const day = new Date(todayKey());
      const set = new Set(dates);
      // Streak stays alive if the user trained today or yesterday
      if (!set.has(todayKey())) day.setDate(day.getDate() - 1);
      while (set.has(day.toISOString().slice(0, 10))) {
        current += 1;
        day.setDate(day.getDate() - 1);
      }
    }

    const now = new Date();
    const monthKey = todayKey().slice(0, 7);
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

    const topMuscle = Object.keys(muscleCount)
      .sort((a, b) => muscleCount[b] - muscleCount[a])[0] || '—';

    return {
      totalWorkouts: sessions.length,
      currentStreak: current,
      longestStreak: longest,
      topMuscle,
      totalWeight: Math.round(totalWeight),
      totalSets,
      totalReps,
      thisMonth: sessions.filter(s => s.date.startsWith(monthKey)).length,
      thisWeek: sessions.filter(s => s.date >= weekAgo).length,
      trainedDates: dates
    };
  };

  /* ==================== Export / import ==================== */

  const exportAll = () => ({
    profile: getProfile(),
    routines: getRoutines(),
    sessions: getSessions(),
    weights: getWeights(),
    custom: getCustom(),
    lastRoutineId: getLastRoutineId(),
    exportedAt: new Date().toISOString()
  });

  const importAll = (data) => {
    if (data.profile) write(K.profile, data.profile);
    if (data.routines) write(K.routines, data.routines);
    if (data.sessions) write(K.sessions, data.sessions);
    if (data.weights) write(K.weights, data.weights);
    if (data.custom) write(K.custom, data.custom);
    if (data.lastRoutineId) setLastRoutineId(data.lastRoutineId);
  };

  init();

  return {
    uid, todayKey,
    getProfile, updateProfile, cmToFtIn, ftInToCm,
    getRoutines, getRoutine, addRoutine, updateRoutine, deleteRoutine, moveRoutine, reorderRoutines, saveRoutines,
    getTodaysRoutine, getLastRoutineId, setLastRoutineId,
    getExerciseCatalogue, addCustomExercise, removeCustomExercise, muscleOf,
    getSessions, getSession, finishSession, updateSession, deleteSession,
    getSessionPRs, sessionTotals, getWeightOn,
    getExerciseHistory, getExerciseRecords, getHighestWeight,
    getWeights, addWeight, updateWeight, deleteWeight, getWeightStats,
    getAnalytics, exportAll, importAll
  };
})();
