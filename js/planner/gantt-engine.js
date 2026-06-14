/**
 * gantt-engine.js — Advanced Gantt chart with hierarchical grouping, critical path,
 * weather buffers, task detail drawer, and view filters.
 *
 * API:
 * - cp_renderGantt(scheduleTasks, containerId, options) — main render function
 * - cp_toggleGroup(groupId) — collapse/expand floor/work-package groups
 * - cp_openTaskDetail(taskId) — open task detail drawer
 * - cp_closeTaskDetail() — close drawer
 * - cp_updateProgress(taskId, value) — update task progress (0-100)
 * - cp_applyFilter(filterType, value) — apply view filter
 * - cp_toggleCompactView() — toggle compact floor-level view
 */

import { PRODUCTIVITY_RATES, CREW_TYPES } from '../shared/schema.js';
import { getDemoDataByEngine } from '../shared/demo-seed.js';

// ─────────────────────────────────────────────
// STATE & CONSTANTS
// ─────────────────────────────────────────────

let ganttState = {
  tasks: [],
  expandedGroups: {},  // { groupId: true/false }
  selectedTaskId: null,
  filters: {
    floors: [],        // empty = all floors
    trades: [],        // empty = all trades
    statuses: [],      // empty = all statuses
  },
  compactMode: false,
};

const CURE_TIME_DAYS = {
  column: 3,
  beam: 21,
  slab: 21,
  footing: 7,
  staircase: 14,
};

const WEATHER_REASONS = {
  5: 'เดือน พ.ค. ฝนตก 17 วัน',
  6: 'เดือน มิ.ย. ฝนตก 21 วัน',
  7: 'เดือน ก.ค. ฝนตก 20 วัน',
  8: 'เดือน ส.ค. ฝนตก 21 วัน',
  9: 'เดือน ก.ย. ฝนตก 22 วัน',
  10: 'เดือน ต.ค. ฝนตก 14 วัน',
};

const TRADE_LABELS = {
  steel_fixer: 'ผูกเหล็ก',
  carpenter: 'ช่างทำแบบ',
  concrete_gang: 'คนเทคอนกรีต',
  masonry: 'ช่างก่ออิฐ',
  mep: 'ช่าง MEP',
};

const STATUS_LABELS = {
  not_started: 'ยังไม่เริ่ม',
  in_progress: 'กำลังดำเนิน',
  complete: 'เสร็จสิ้น',
};

// ─────────────────────────────────────────────
// HIERARCHICAL GROUPING
// ─────────────────────────────────────────────

function groupTasksHierarchical(tasks) {
  const byFloor = {};

  tasks.forEach(task => {
    // Extract floor from wbs_code (e.g., "2.1" -> "F1", "2.2" -> "F2")
    const floor = extractFloor(task.wbs_code || task.floor_level || 'F1');
    if (!byFloor[floor]) byFloor[floor] = {};

    // Extract work package (e.g., "2.1.1" -> "2.1", "2.2.1" -> "2.2")
    const workPackage = extractWorkPackage(task.wbs_code || '2.1');
    if (!byFloor[floor][workPackage]) byFloor[floor][workPackage] = [];

    byFloor[floor][workPackage].push(task);
  });

  return byFloor;
}

function extractFloor(wbsCode) {
  if (typeof wbsCode === 'string' && wbsCode.startsWith('2.')) {
    const floorNum = parseInt(wbsCode.split('.')[1], 10);
    if (floorNum === 1) return 'F1';
    if (floorNum === 2) return 'F2';
    if (floorNum === 3) return 'RF';
  }
  return 'F1';
}

function extractWorkPackage(wbsCode) {
  if (typeof wbsCode === 'string') {
    const parts = wbsCode.split('.');
    return `${parts[0]}.${parts[1]}`;
  }
  return '2.1';
}

function getWorkPackageLabel(wbsCode) {
  const labels = {
    '2.1': 'ฐานราก',
    '2.2': 'เสา',
    '2.3': 'คาน',
    '2.4': 'พื้น',
    '2.5': 'หลังคา/ฝา',
  };
  return labels[wbsCode] || wbsCode;
}

// ─────────────────────────────────────────────
// DATE CALCULATIONS
// ─────────────────────────────────────────────

function getDateRange(tasks) {
  if (!tasks || tasks.length === 0) {
    const today = new Date();
    return { start: today, end: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) };
  }

  const starts = tasks.filter(t => t.start_date).map(t => new Date(t.start_date));
  const ends = tasks.filter(t => t.end_date).map(t => new Date(t.end_date));

  const start = starts.length > 0 ? new Date(Math.min(...starts)) : new Date();
  const end = ends.length > 0 ? new Date(Math.max(...ends)) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Pad by 2 weeks
  start.setDate(start.getDate() - 14);
  end.setDate(end.getDate() + 14);

  return { start, end };
}

function getPixelPosition(date, dateRange, pixelWidth) {
  const totalMs = dateRange.end.getTime() - dateRange.start.getTime();
  const offsetMs = new Date(date).getTime() - dateRange.start.getTime();
  return (offsetMs / totalMs) * pixelWidth;
}

function getTaskDuration(task) {
  if (task.start_date && task.end_date) {
    const start = new Date(task.start_date);
    const end = new Date(task.end_date);
    return Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }
  return task.adjusted_duration_days || task.base_duration_days || 1;
}

function getTaskStatus(task) {
  if ((task.percent_complete || 0) >= 100) return 'complete';
  if ((task.percent_complete || 0) > 0) return 'in_progress';
  return 'not_started';
}

// ─────────────────────────────────────────────
// FILTERING
// ─────────────────────────────────────────────

function shouldShowTask(task, filters) {
  const floor = extractFloor(task.wbs_code || task.floor_level || 'F1');
  const trade = task.resource_group?.primary_trade || task.trade || 'concrete_gang';
  const status = getTaskStatus(task);

  if (filters.floors.length > 0 && !filters.floors.includes(floor)) return false;
  if (filters.trades.length > 0 && !filters.trades.includes(trade)) return false;
  if (filters.statuses.length > 0 && !filters.statuses.includes(status)) return false;

  return true;
}

// ─────────────────────────────────────────────
// RENDERING — GANTT GRID
// ─────────────────────────────────────────────

export function cp_renderGantt(scheduleTasks = [], containerId = 'gantt-container', options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[gantt-engine] container #${containerId} not found`);
    return;
  }

  ganttState.tasks = scheduleTasks;

  // Get date range and calculate pixel width
  const dateRange = getDateRange(scheduleTasks);
  const pixelWidth = options.pixelWidth || 2400;
  const dayPixels = pixelWidth / ((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));

  // Group tasks hierarchically
  const grouped = ganttState.compactMode
    ? groupTasksCompact(scheduleTasks)
    : groupTasksHierarchical(scheduleTasks);

  // Render
  const html = `
    <div class="gantt-wrapper">
      <div class="gantt-left-panel">
        <div class="gantt-left-header">งานก่อสร้าง</div>
        <div class="gantt-left-content" id="gantt-task-list"></div>
      </div>

      <div class="gantt-right-panel">
        <div class="gantt-axis" id="gantt-axis"></div>
        <div class="gantt-grid" id="gantt-grid" style="min-width: ${pixelWidth}px"></div>
      </div>
    </div>

    <div class="gantt-drawer" id="gantt-drawer" hidden></div>
  `;

  container.innerHTML = html;

  // Render axis (month labels + today line)
  renderAxis(dateRange, pixelWidth);

  // Render task list and bars
  if (ganttState.compactMode) {
    renderCompactView(grouped, dateRange, pixelWidth);
  } else {
    renderHierarchicalView(grouped, dateRange, pixelWidth, dayPixels);
  }

  // Attach event listeners
  container.querySelectorAll('[data-task-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (!e.target.closest('.gantt-handle')) {
        cp_openTaskDetail(el.dataset.taskId);
      }
    });
  });
}

function renderAxis(dateRange, pixelWidth) {
  const axisDiv = document.getElementById('gantt-axis');
  const today = new Date();

  let html = '<div class="gantt-axis-labels">';

  // Generate month labels
  const current = new Date(dateRange.start);
  while (current <= dateRange.end) {
    const monthName = current.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
    const startPx = getPixelPosition(current, dateRange, pixelWidth);
    const nextMonth = new Date(current);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const endPx = getPixelPosition(nextMonth, dateRange, pixelWidth);

    html += `
      <div class="gantt-axis-label" style="left: ${startPx}px; width: ${endPx - startPx}px">
        ${monthName}
      </div>
    `;
    current.setMonth(current.getMonth() + 1);
  }

  html += '</div>';

  // Add today line
  if (today >= dateRange.start && today <= dateRange.end) {
    const todayPx = getPixelPosition(today, dateRange, pixelWidth);
    html = html.replace('</div>', `
      <div class="gantt-today-line" style="left: ${todayPx}px" title="วันนี้"></div>
    </div>`);
  }

  axisDiv.innerHTML = html;
}

function renderHierarchicalView(grouped, dateRange, pixelWidth, dayPixels) {
  const taskListDiv = document.getElementById('gantt-task-list');
  const gridDiv = document.getElementById('gantt-grid');

  let taskListHtml = '';
  let gridHtml = '';

  const floorOrder = ['F1', 'F2', 'RF'];
  const floors = Object.keys(grouped).sort((a, b) => floorOrder.indexOf(a) - floorOrder.indexOf(b));

  floors.forEach(floor => {
    const floorId = `floor-${floor}`;
    const isExpanded = ganttState.expandedGroups[floorId] !== false; // default expanded

    // Floor header
    taskListHtml += `
      <div class="gantt-group gantt-group--floor">
        <div class="gantt-group-header" data-toggle="${floorId}">
          <span class="gantt-chevron" style="transform: rotate(${isExpanded ? 0 : -90}deg)">▼</span>
          <span class="gantt-group-label">📍 ${floor}</span>
        </div>
      </div>
    `;

    gridHtml += `<div class="gantt-group-row" id="${floorId}" ${!isExpanded ? 'hidden' : ''}></div>`;

    const workPackages = Object.keys(grouped[floor]).sort();
    workPackages.forEach(wp => {
      const wpId = `wp-${wp}`;
      const wpExpanded = ganttState.expandedGroups[wpId] !== false; // default expanded
      const wpLabel = getWorkPackageLabel(wp);

      if (isExpanded) {
        taskListHtml += `
          <div class="gantt-group gantt-group--wp">
            <div class="gantt-group-header" data-toggle="${wpId}">
              <span class="gantt-chevron" style="transform: rotate(${wpExpanded ? 0 : -90}deg)">▼</span>
              <span class="gantt-group-label">${wpLabel}</span>
            </div>
          </div>
        `;

        const wpRowHtml = [];
        const wpGridHtml = [];

        grouped[floor][wp].forEach(task => {
          if (!shouldShowTask(task, ganttState.filters)) return;

          const taskId = task.id;
          const duration = getTaskDuration(task);
          const progress = Math.min(100, Math.max(0, task.percent_complete || 0));
          const isCritical = task.is_critical_path || task.is_critical || false;
          const hasWeatherBuffer = (task.weather_buffer_factor || 0) > 0;

          if (wpExpanded) {
            // Task name row
            wpRowHtml.push(`
              <div class="gantt-task-row">
                <div class="gantt-task-name" data-task-id="${taskId}">
                  <span class="gantt-task-label">${escapeHtml(task.activity_name || task.description || taskId)}</span>
                </div>
              </div>
            `);

            // Task bar row
            const startPx = getPixelPosition(task.start_date, dateRange, pixelWidth);
            const barWidth = duration * dayPixels;
            const bufferWidth = hasWeatherBuffer ? (task.weather_buffer_factor * duration * dayPixels) : 0;
            const weatherMonth = task.start_date ? new Date(task.start_date).getMonth() + 1 : null;
            const weatherReason = WEATHER_REASONS[weatherMonth] || 'เผื่อฝนตก';

            wpGridHtml.push(`
              <div class="gantt-task-bars" id="${taskId}">
                <div class="gantt-bar-container" style="left: ${startPx}px; width: ${barWidth + bufferWidth}px" data-task-id="${taskId}">
                  <div class="gantt-bar ${isCritical ? 'gantt-critical' : ''}" style="width: ${barWidth}px">
                    <div class="gantt-bar-fill" style="width: ${progress}%"></div>
                    <span class="gantt-bar-label">${progress}%</span>
                  </div>
                  ${bufferWidth > 0 ? `
                    <div class="gantt-weather-buffer" style="width: ${bufferWidth}px" title="${weatherReason}"></div>
                  ` : ''}
                </div>
              </div>
            `);
          }
        });

        if (wpExpanded) {
          taskListHtml += wpRowHtml.join('');
          document.getElementById(wpId)?.parentElement?.insertAdjacentHTML('beforeend', wpGridHtml.join(''));
        }
      }
    });
  });

  taskListDiv.innerHTML = taskListHtml;
  gridDiv.innerHTML = gridHtml;

  // Attach group toggle handlers
  document.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      cp_toggleGroup(el.dataset.toggle);
    });
  });
}

function renderCompactView(grouped, dateRange, pixelWidth) {
  const taskListDiv = document.getElementById('gantt-task-list');
  const gridDiv = document.getElementById('gantt-grid');

  let taskListHtml = '';
  let gridHtml = '';

  Object.entries(grouped).forEach(([floor, tasks]) => {
    const totalDuration = tasks.reduce((sum, t) => sum + getTaskDuration(t), 0);
    const totalProgress = Math.round(tasks.reduce((sum, t) => sum + (t.percent_complete || 0), 0) / tasks.length);

    taskListHtml += `
      <div class="gantt-task-row">
        <div class="gantt-task-name">
          <span class="gantt-task-label">📍 ${floor}</span>
        </div>
      </div>
    `;

    const minStart = tasks.filter(t => t.start_date).map(t => new Date(t.start_date)).reduce((m, d) => !m || d < m ? d : m, null);
    const startPx = minStart ? getPixelPosition(minStart, dateRange, pixelWidth) : 0;
    const barWidth = totalDuration * (pixelWidth / ((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)));

    gridHtml += `
      <div class="gantt-task-bars">
        <div class="gantt-bar-container" style="left: ${startPx}px; width: ${barWidth}px">
          <div class="gantt-bar" style="width: ${barWidth}px">
            <div class="gantt-bar-fill" style="width: ${totalProgress}%"></div>
            <span class="gantt-bar-label">${totalProgress}%</span>
          </div>
        </div>
      </div>
    `;
  });

  taskListDiv.innerHTML = taskListHtml;
  gridDiv.innerHTML = gridHtml;
}

function groupTasksCompact(tasks) {
  const byFloor = {};
  tasks.forEach(task => {
    const floor = extractFloor(task.wbs_code || task.floor_level || 'F1');
    if (!byFloor[floor]) byFloor[floor] = [];
    byFloor[floor].push(task);
  });
  return byFloor;
}

// ─────────────────────────────────────────────
// TASK DETAIL DRAWER
// ─────────────────────────────────────────────

export function cp_openTaskDetail(taskId) {
  const task = ganttState.tasks.find(t => t.id === taskId);
  if (!task) return;

  ganttState.selectedTaskId = taskId;

  const drawer = document.getElementById('gantt-drawer');
  const duration = getTaskDuration(task);
  const progress = Math.min(100, Math.max(0, task.percent_complete || 0));

  const html = `
    <div class="gantt-detail-content">
      <div class="gantt-detail-header">
        <h3>${escapeHtml(task.activity_name || 'Task')}</h3>
        <button class="gantt-close-btn" onclick="window.cp_closeTaskDetail()">✕</button>
      </div>

      <div class="gantt-detail-meta">
        <div><strong>WBS:</strong> ${task.wbs_code || '—'}</div>
        <div><strong>Floor:</strong> ${task.floor_level || '—'}</div>
        <div><strong>Trade:</strong> ${TRADE_LABELS[task.resource_group?.primary_trade] || '—'}</div>
      </div>

      <div class="gantt-detail-section">
        <h4>Duration Calculation</h4>
        <div class="gantt-calc">
          <div>Volume: ${(task.quantity || 0).toFixed(2)} ${task.unit || '—'}</div>
          <div>Crew: ${task.crew_size || '—'} people</div>
          <div>Rate: ${task.productivity_rate || '—'} unit/person/day</div>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">
            <strong>Duration: ${duration.toFixed(1)} days</strong>
          </div>
        </div>
      </div>

      <div class="gantt-detail-section">
        <h4>Progress</h4>
        <div class="gantt-progress-slider">
          <input type="range" min="0" max="100" value="${progress}"
            onchange="window.cp_updateProgress('${taskId}', this.value)">
          <span class="gantt-progress-value">${progress}%</span>
        </div>
      </div>

      <div class="gantt-detail-section">
        <h4>Dates</h4>
        <div>
          <strong>Start:</strong> ${formatDate(task.start_date)}<br>
          <strong>End:</strong> ${formatDate(task.end_date)}<br>
          ${task.weather_buffer_factor ? `<strong>Weather Buffer:</strong> ${(task.weather_buffer_factor * duration).toFixed(1)} days` : ''}
        </div>
      </div>

      ${task.predecessor_task_ids && task.predecessor_task_ids.length > 0 ? `
        <div class="gantt-detail-section">
          <h4>Predecessors</h4>
          <div class="gantt-chips">
            ${task.predecessor_task_ids.map(pid => `
              <a href="#" class="gantt-chip" onclick="window.cp_openTaskDetail('${pid}'); return false;">
                ${ganttState.tasks.find(t => t.id === pid)?.activity_name || pid}
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  drawer.innerHTML = html;
  drawer.hidden = false;
  drawer.scrollTop = 0;
}

export function cp_closeTaskDetail() {
  const drawer = document.getElementById('gantt-drawer');
  if (drawer) {
    drawer.hidden = true;
    ganttState.selectedTaskId = null;
  }
}

export function cp_updateProgress(taskId, value) {
  const task = ganttState.tasks.find(t => t.id === taskId);
  if (task) {
    task.percent_complete = Math.min(100, Math.max(0, parseFloat(value)));
    // Trigger a re-render or dispatch event for Planner to update
    window.dispatchEvent(new CustomEvent('gantt-progress-changed', { detail: { taskId, progress: task.percent_complete } }));
    cp_openTaskDetail(taskId); // Re-open drawer to show updated value
  }
}

// ─────────────────────────────────────────────
// FILTERING & VIEWS
// ─────────────────────────────────────────────

export function cp_applyFilter(filterType, value) {
  if (filterType === 'floors') ganttState.filters.floors = value;
  else if (filterType === 'trades') ganttState.filters.trades = value;
  else if (filterType === 'statuses') ganttState.filters.statuses = value;

  // Re-render
  const container = document.getElementById('gantt-container');
  if (container) {
    cp_renderGantt(ganttState.tasks, 'gantt-container');
  }
}

export function cp_toggleCompactView() {
  ganttState.compactMode = !ganttState.compactMode;
  cp_renderGantt(ganttState.tasks, 'gantt-container');
}

export function cp_toggleGroup(groupId) {
  ganttState.expandedGroups[groupId] = ganttState.expandedGroups[groupId] !== false ? false : true;

  // Re-render hierarchical view (this is simpler than full re-render)
  const container = document.getElementById('gantt-container');
  if (container && !ganttState.compactMode) {
    cp_renderGantt(ganttState.tasks, 'gantt-container');
  }
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', { day: 'short', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────
// WINDOW EXPORTS
// ─────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.cp_renderGantt = cp_renderGantt;
  window.cp_toggleGroup = cp_toggleGroup;
  window.cp_openTaskDetail = cp_openTaskDetail;
  window.cp_closeTaskDetail = cp_closeTaskDetail;
  window.cp_updateProgress = cp_updateProgress;
  window.cp_applyFilter = cp_applyFilter;
  window.cp_toggleCompactView = cp_toggleCompactView;
}
