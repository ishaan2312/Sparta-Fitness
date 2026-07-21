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
   * Pointer-based drag reordering for mouse and touch.
   *
   * The geometry of the list is measured ONCE on pickup. While you drag, the
   * DOM is never touched — the other rows simply slide aside with a transform,
   * so nothing can shift underneath the calculation and cause a row to
   * overshoot its target. The real reorder is committed once, on release.
   *
   * Dragging starts only from an element carrying [data-drag-handle], so
   * scrolling and typing inside a row keep working normally.
   */

  const DEAD_ZONE = 0.25;   // fraction of a row you must cross before the gap moves
  const SLIDE = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
  const EDGE = 72;          // px from the edge where auto-scroll kicks in
  const MAX_SCROLL_SPEED = 14;

  let drag = null;

  /** Nearest ancestor that actually scrolls. */
  const scrollParent = (el) => {
    let node = el.parentElement;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node;
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  };

  const onPointerDown = (e) => {
    const handle = e.target.closest('[data-drag-handle]');
    if (!handle) return;
    const item = handle.closest('[data-sortable]');
    const container = handle.closest('[data-sortable-list]');
    if (!item || !container || !container.__onReorder) return;

    const items = Array.from(container.querySelectorAll('[data-sortable]'));
    if (items.length < 2) return;

    e.preventDefault();
    const scroller = scrollParent(container);
    const startScroll = scroller.scrollTop;

    // Snapshot the layout in content coordinates so later scrolling can't skew it
    const rects = items.map(el => el.getBoundingClientRect());
    const centres = rects.map(r => r.top + r.height / 2 + startScroll);
    const heights = rects.map(r => r.height);
    const fromIndex = items.indexOf(item);

    // Distance each displaced row travels: the dragged row plus the list gap
    const gap = items.length > 1 ? Math.max(0, rects[1].top - (rects[0].top + rects[0].height)) : 0;
    const step = rects[fromIndex].height + gap;

    drag = {
      item, container, items, centres, heights, fromIndex, step,
      newIndex: fromIndex, scroller, startScroll,
      startY: e.clientY, pointerY: e.clientY, raf: null
    };

    items.forEach((el, i) => {
      el.style.willChange = 'transform';
      if (i !== fromIndex) el.style.transition = SLIDE;
    });
    item.style.transition = 'none';
    item.classList.add('dragging');
    handle.setPointerCapture?.(e.pointerId);
    document.body.classList.add('is-dragging');
    navigator.vibrate?.(10);
  };

  /** Recompute the landing slot and slide the other rows out of the way. */
  const update = () => {
    if (!drag) return;
    const { item, items, centres, heights, fromIndex, step, scroller, startScroll } = drag;

    const scrollDelta = scroller.scrollTop - startScroll;
    const offset = (drag.pointerY - drag.startY) + scrollDelta;
    item.style.transform = `translateY(${offset}px)`;

    const centre = centres[fromIndex] + offset;

    // Compare against the ORIGINAL centres — they never move, so no cascade.
    // A row yields as soon as its centre is crossed (so the gap tracks your
    // finger), but once yielded it takes an extra nudge back to release it.
    // That asymmetry is what stops flicker when you hover on a boundary.
    let newIndex = fromIndex;
    for (let i = 0; i < items.length; i++) {
      if (i === fromIndex) continue;
      const dz = heights[i] * DEAD_ZONE;

      if (i > fromIndex) {
        const held = drag.newIndex >= i;
        if (centre > centres[i] - (held ? dz : 0)) newIndex = Math.max(newIndex, i);
      } else {
        const held = drag.newIndex <= i;
        if (centre < centres[i] + (held ? dz : 0)) newIndex = Math.min(newIndex, i);
      }
    }
    drag.newIndex = newIndex;

    items.forEach((el, i) => {
      if (i === fromIndex) return;
      let shift = 0;
      if (newIndex > fromIndex && i > fromIndex && i <= newIndex) shift = -step;
      else if (newIndex < fromIndex && i < fromIndex && i >= newIndex) shift = step;
      el.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  };

  /** Scroll the list when the finger sits near the top or bottom edge. */
  const autoScroll = () => {
    if (!drag) return;
    const { scroller } = drag;
    const box = scroller === document.scrollingElement || scroller === document.documentElement
      ? { top: 0, bottom: window.innerHeight }
      : scroller.getBoundingClientRect();

    let speed = 0;
    if (drag.pointerY < box.top + EDGE) {
      speed = -MAX_SCROLL_SPEED * Math.min(1, (box.top + EDGE - drag.pointerY) / EDGE);
    } else if (drag.pointerY > box.bottom - EDGE) {
      speed = MAX_SCROLL_SPEED * Math.min(1, (drag.pointerY - (box.bottom - EDGE)) / EDGE);
    }

    if (speed) {
      const before = scroller.scrollTop;
      scroller.scrollTop = before + speed;
      if (scroller.scrollTop !== before) update();
    }
    drag.raf = requestAnimationFrame(autoScroll);
  };

  const onPointerMove = (e) => {
    if (!drag) return;
    e.preventDefault();
    drag.pointerY = e.clientY;
    if (drag.raf === null) drag.raf = requestAnimationFrame(autoScroll);
    update();
  };

  const onPointerUp = () => {
    if (!drag) return;
    const { item, container, items, fromIndex, newIndex, raf } = drag;
    if (raf !== null) cancelAnimationFrame(raf);
    drag = null;

    items.forEach(el => {
      el.style.transition = '';
      el.style.transform = '';
      el.style.willChange = '';
    });
    item.classList.remove('dragging');
    document.body.classList.remove('is-dragging');

    if (newIndex === fromIndex) return;   // a tap, or dropped back where it started

    // One DOM write, in final order
    const order = items.slice();
    order.splice(fromIndex, 1);
    order.splice(newIndex, 0, item);
    order.forEach(el => container.appendChild(el));

    container.__onReorder(order.map(el => el.dataset.id));
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

  /**
   * Bar chart with labelled axes. Bars suit training volume better than a line:
   * you either trained that day or you didn't, and a line would imply
   * continuity across the gap.
   * points: [{ label, value, sub }] in chronological order.
   */
  const barChart = (points, opts = {}) => {
    if (!points || !points.length) {
      return `<div class="chart-empty">${esc(opts.empty || 'No data yet')}</div>`;
    }

    const MAX_BARS = 24;
    const clipped = points.length > MAX_BARS;
    const data = clipped ? points.slice(-MAX_BARS) : points;

    const w = 340, h = 190, padL = 42, padR = 8, padT = 12, padB = 30;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const max = Math.max(...data.map(p => p.value));

    // Round the axis top to something readable
    const mag = Math.pow(10, Math.floor(Math.log10(max || 1)));
    const top = Math.ceil(max / (mag / 2)) * (mag / 2) || 1;

    const slot = plotW / data.length;
    const barW = Math.max(3, Math.min(26, slot * 0.62));

    const ticks = [0, 0.5, 1].map(f => {
      const v = top * f;
      const y = padT + plotH - f * plotH;
      return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" class="grid-line"/>
              <text x="${padL - 6}" y="${(y + 3.5).toFixed(1)}" class="axis-label" text-anchor="end">${Math.round(v).toLocaleString()}</text>`;
    }).join('');

    const bars = data.map((p, i) => {
      const bh = Math.max(1, (p.value / top) * plotH);
      const x = padL + i * slot + (slot - barW) / 2;
      const y = padT + plotH - bh;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}"
                rx="2" class="bar"><title>${esc(p.label)}${p.sub ? ' · ' + esc(p.sub) : ''}: ${p.value.toLocaleString()}${esc(opts.unit || '')}</title></rect>`;
    }).join('');

    // Only first / middle / last get an x label, or they collide
    const idx = data.length > 2 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : data.map((_, i) => i);
    const xLabels = [...new Set(idx)].map(i => {
      const x = padL + i * slot + slot / 2;
      const anchor = i === 0 ? 'start' : (i === data.length - 1 ? 'end' : 'middle');
      return `<text x="${x.toFixed(1)}" y="${h - 10}" class="axis-label" text-anchor="${anchor}">${esc(data[i].label)}</text>`;
    }).join('');

    return `
      <div class="chart">
        <svg viewBox="0 0 ${w} ${h}" class="bar-svg" role="img" aria-label="${esc(opts.title || 'Volume chart')}">
          ${ticks}
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" class="axis-line"/>
          <line x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}" class="axis-line"/>
          ${bars}
          ${xLabels}
        </svg>
        <div class="chart-foot">
          <span>${esc(opts.yTitle || 'kg lifted')}</span>
          <span>${clipped ? `last ${MAX_BARS} of ${points.length} sessions` : `${points.length} session${points.length === 1 ? '' : 's'}`}</span>
        </div>
      </div>`;
  };

  return { esc, fmtDate, fmtDateShort, toast, lineChart, barChart, calendar, initDragSort, enableDragSort };
})();
