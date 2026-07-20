/**
 * Gym UI Module
 * Reusable presentation helpers shared by every gym screen.
 * No app state lives here — everything is a pure function of its arguments.
 */

const GymUI = (() => {

  /** Escape user-supplied text before it goes into innerHTML. */
  const esc = (str) => String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const fmtDate = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fmtDateShort = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  /* ==================== Toast ==================== */

  let toastTimer = null;
  const toast = (message) => {
    let el = document.getElementById('gymToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gymToast';
      el.className = 'gym-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 2000);
  };

  /* ==================== Charts ==================== */

  /**
   * Minimal dependency-free line chart.
   * points: [{ label, value }] in chronological order.
   */
  const lineChart = (points, opts = {}) => {
    if (!points || points.length === 0) {
      return `<div class="chart-empty">No data yet</div>`;
    }
    if (points.length === 1) {
      return `<div class="chart-empty">${esc(points[0].value)}${esc(opts.unit || '')} — log more to see a trend</div>`;
    }

    const w = 320, h = 140, padX = 10, padY = 16;
    const values = points.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = (max - min) || 1;

    const x = (i) => padX + (i * (w - padX * 2)) / (points.length - 1);
    const y = (v) => h - padY - ((v - min) / span) * (h - padY * 2);

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)},${h - padY} L${x(0).toFixed(1)},${h - padY} Z`;
    const dots = points.map((p, i) =>
      `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3" class="chart-dot"><title>${esc(p.label)}: ${esc(p.value)}${esc(opts.unit || '')}</title></circle>`
    ).join('');

    return `
      <div class="chart">
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="chart-svg" role="img" aria-label="Progress chart">
          <path d="${area}" class="chart-area"></path>
          <path d="${line}" class="chart-line"></path>
          ${dots}
        </svg>
        <div class="chart-axis">
          <span>${esc(points[0].label)}</span>
          <span>${esc(points[points.length - 1].label)}</span>
        </div>
        <div class="chart-range">
          <span>Low ${esc(min)}${esc(opts.unit || '')}</span>
          <span>High ${esc(max)}${esc(opts.unit || '')}</span>
        </div>
      </div>`;
  };

  /** Workout calendar for the current month; trained days are highlighted. */
  const calendar = (trainedDates, refDate = new Date()) => {
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // week starts Monday
    const set = new Set(trainedDates);
    const todayStr = GymStore.todayKey();

    let cells = '';
    for (let i = 0; i < offset; i++) cells += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cls = ['cal-cell'];
      if (set.has(key)) cls.push('trained');
      if (key === todayStr) cls.push('today');
      cells += `<div class="${cls.join(' ')}">${d}</div>`;
    }

    return `
      <div class="calendar">
        <div class="cal-title">${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
        <div class="cal-grid cal-head">
          ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<div class="cal-cell head">${d}</div>`).join('')}
        </div>
        <div class="cal-grid">${cells}</div>
      </div>`;
  };

  /* ==================== Drag sorting ==================== */

  /**
   * Pointer-based drag reordering that works with both mouse and touch.
   * Dragging starts only from an element carrying [data-drag-handle], so normal
   * scrolling and input focus inside the row keep working.
   *
   * onReorder receives the ids (data-id) in their new order.
   */
  let drag = null;

  const itemsOf = (container) => Array.from(container.querySelectorAll('[data-sortable]'));

  const onPointerDown = (e) => {
    const handle = e.target.closest('[data-drag-handle]');
    if (!handle) return;
    const item = handle.closest('[data-sortable]');
    const container = handle.closest('.sortable-list');
    if (!item || !container || !container.__onReorder) return;

    e.preventDefault();
    drag = { item, container, startY: e.clientY, originY: item.getBoundingClientRect().top };
    item.classList.add('dragging');
    handle.setPointerCapture?.(e.pointerId);
    document.body.classList.add('is-dragging');
  };

  const onPointerMove = (e) => {
    if (!drag) return;
    e.preventDefault();
    const { item, container } = drag;
    const dy = e.clientY - drag.startY;
    item.style.transform = `translateY(${dy}px)`;

    const centre = drag.originY + item.offsetHeight / 2 + dy;
    const rebase = () => {
      drag.startY = e.clientY;
      drag.originY = item.getBoundingClientRect().top;
      item.style.transform = 'translateY(0px)';
    };

    itemsOf(container).forEach(other => {
      if (other === item) return;
      const rect = other.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const itemIsAfter = other.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING;
      if (centre < mid && itemIsAfter) {
        container.insertBefore(item, other);
        rebase();
      } else if (centre > mid && !itemIsAfter) {
        container.insertBefore(item, other.nextSibling);
        rebase();
      }
    });
  };

  const onPointerUp = () => {
    if (!drag) return;
    const { item, container } = drag;
    item.style.transform = '';
    item.classList.remove('dragging');
    document.body.classList.remove('is-dragging');
    drag = null;
    container.__onReorder(itemsOf(container).map(el => el.dataset.id));
  };

  /** Registered once at boot; every sortable list is then handled by these. */
  const initDragSort = () => {
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  /** Attach a reorder callback to a freshly rendered list. */
  const enableDragSort = (container, onReorder) => {
    if (container) container.__onReorder = onReorder;
  };

  return { esc, fmtDate, fmtDateShort, toast, lineChart, calendar, initDragSort, enableDragSort };
})();
