// Planner — construction schedule (Gantt-style task list)
//
// ทำงานแบบ standalone (localStorage) ก่อน ค่อยสลับไปต่อ Supabase ทีหลัง
// โครงสร้าง object ของแต่ละรายการ = createScheduleTask() จาก ../shared/schema.js
// ห้ามสร้าง object เองตรงๆ — ใช้ factory function เสมอ ตามกติกาของ schema.js

import { createScheduleTask, calcAdjustedDuration, createTimelineViewState, WORK_TYPE_HIERARCHY } from '../shared/schema.js';
import { getDemoDataByEngine } from '../shared/demo-seed.js';
import { projectStorageKey, getCurrentProjectId, DEMO_PROJECT_ID, PROJECT_EVENT } from '../shared/project-store.js';
import { STORAGE_KEYS, PIPELINE_EVENT } from '../shared/pipeline.js';
import { groupTasksByMode, shiftDependents, calculateBudgetImpact } from '../shared/timeline-engine.js';

const STORAGE_KEY = STORAGE_KEYS.schedule;

const GROUPING_LABEL = {
  time: '📅 ตามช่วงเวลา',
  work_type: '🏗️ ตามหมวดงาน',
  resource: '👥 ตามทีมงาน',
};

let diffChip = null; // { text, timer } — transient banner after a reactive date edit

const WORK_CATEGORIES = [
  { value: 'structural', label: '🏗️ โครงสร้าง' },
  { value: 'architectural', label: '🏠 สถาปัตยกรรม' },
  { value: 'mep', label: '🔧 งานระบบ (MEP)' },
  { value: 'finishing', label: '🎨 งานตกแต่ง' },
];

const WORK_TYPE_COLORS = {
  foundation: '#92400e', structure: '#1d4ed8', roof: '#7c3aed',
  mep: '#0891b2', finishing: '#16a34a', other: '#64748b',
};

let tasks = [];
let viewState = null;

function loadTasks() {
  try {
    const raw = localStorage.getItem(projectStorageKey(STORAGE_KEY));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('[planner] failed to load from localStorage', e);
  }
  return seedTasks();
}

// ค่าเริ่มต้น: เฉพาะโปรเจกต์สาธิต ดึงจาก demo-seed.js
// (โปรเจกต์ใหม่ที่ผู้ใช้สร้างเองเริ่มต้นแบบว่างเปล่า)
function seedTasks() {
  if (getCurrentProjectId() !== DEMO_PROJECT_ID) {
    saveTasks([]);
    return [];
  }
  const { expected_tasks } = getDemoDataByEngine('planner');
  const seed = expected_tasks.map(t => createScheduleTask({ ...t }));
  saveTasks(seed);
  return seed;
}

function saveTasks(list) {
  localStorage.setItem(projectStorageKey(STORAGE_KEY), JSON.stringify(list));
}

function loadViewState() {
  try {
    const raw = localStorage.getItem(projectStorageKey(STORAGE_KEYS.timelineViewState));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('[planner] failed to load timeline view state', e);
  }
  return createTimelineViewState({ id: crypto.randomUUID(), project_id: getCurrentProjectId(), grouping_mode: 'time' });
}

function saveViewState(state) {
  state.updated_at = new Date().toISOString();
  localStorage.setItem(projectStorageKey(STORAGE_KEYS.timelineViewState), JSON.stringify(state));
}

function loadProjectConfig() {
  try {
    const raw = localStorage.getItem(projectStorageKey(STORAGE_KEYS.projectConfig));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('[planner] failed to load project_config', e);
  }
  return null;
}

function saveProjectConfig(config) {
  localStorage.setItem(projectStorageKey(STORAGE_KEYS.projectConfig), JSON.stringify(config));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function categoryMeta(category) {
  return WORK_CATEGORIES.find(c => c.value === category) || { label: category || '-' };
}

function render() {
  const root = document.getElementById('planner-app');
  if (!root) return;

  const criticalCount = tasks.filter(t => t.is_critical || t.is_critical_path).length;
  const totalDays = tasks.reduce((sum, t) => sum + (t.adjusted_duration_days ?? t.base_duration_days ?? 0), 0);
  const projectConfig = loadProjectConfig();
  const groups = tasks.length ? groupTasksByMode(tasks, viewState.grouping_mode, projectConfig) : [];

  root.innerHTML = `
    <div class="fp-header">
      <h1>📅 Planner</h1>
      <p>วางแผนงาน กำหนดไทม์ไลน์ และติดตามความคืบหน้า — duration ปรับด้วย weather buffer แล้ว</p>
      <div class="fp-summary">
        <span class="fp-pill" style="background:#3b82f622;color:#3b82f6">📋 ${tasks.length} กิจกรรม</span>
        <span class="fp-pill" style="background:#ef444422;color:#ef4444">🔥 ${criticalCount} critical path</span>
        <span class="fp-pill" style="background:#10b98122;color:#10b981">⏱️ รวม ${totalDays.toFixed(1)} วัน</span>
      </div>
    </div>

    <div class="fp-card">
      <h2>เพิ่มกิจกรรม</h2>
      <div class="fp-form-grid">
        <label>WBS Code
          <input type="text" id="pl-input-wbs" placeholder="เช่น 2.1.1" />
        </label>
        <label>ชื่อกิจกรรม
          <input type="text" id="pl-input-name" placeholder="เช่น Column Rebar — F1" />
        </label>
        <label>หมวดงาน
          <select id="pl-input-category">
            ${WORK_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
          </select>
        </label>
        <label>ชั้น
          <input type="text" id="pl-input-floor" placeholder="F1, F2, ..." />
        </label>
        <label>วันที่เริ่ม
          <input type="date" id="pl-input-start" />
        </label>
        <label>วันที่สิ้นสุด
          <input type="date" id="pl-input-end" />
        </label>
        <label>จำนวนคนงาน (crew)
          <input type="number" id="pl-input-crew" min="0" step="1" placeholder="0" />
        </label>
        <label>Productivity (หน่วย/คน/วัน)
          <input type="number" id="pl-input-productivity" min="0" step="any" placeholder="0" />
        </label>
        <label>ปริมาณงาน
          <input type="number" id="pl-input-quantity" min="0" step="any" placeholder="0" />
        </label>
        <label>Weather buffer (0-0.4)
          <input type="number" id="pl-input-weather" min="0" max="0.4" step="0.05" value="0.10" />
        </label>
        <label>Critical path?
          <select id="pl-input-critical">
            <option value="false">ไม่ใช่</option>
            <option value="true">ใช่ — critical</option>
          </select>
        </label>
      </div>
      <button class="fp-btn-primary" onclick="pl_addTask()">+ เพิ่มกิจกรรม</button>
    </div>

    ${diffChip ? `<div class="pl-diff-chip">${escapeHtml(diffChip)}</div>` : ''}

    <div class="fp-card">
      <div class="pl-card-header">
        <h2>ตารางงานทั้งหมด</h2>
        <div class="pl-grouping-toggle">
          ${Object.entries(GROUPING_LABEL).map(([mode, label]) => `
            <button type="button" class="fp-btn-secondary pl-grouping-btn${viewState.grouping_mode === mode ? ' pl-grouping-btn--active' : ''}" onclick="pl_setGrouping('${mode}')">${label}</button>
          `).join('')}
        </div>
      </div>
      ${tasks.length === 0 ? '<p class="fp-empty">ยังไม่มีกิจกรรม</p>' : groups.map(renderGroupTable).join('')}
    </div>

    ${tasks.length === 0 ? '' : `
    <div class="fp-card">
      <h2>📊 Gantt Timeline</h2>
      <div id="planner-gantt" class="fp-gantt">${renderGanttSVG(tasks, projectConfig)}</div>
      ${renderGanttLegend(projectConfig)}
    </div>`}
  `;
}

/**
 * วาด Gantt timeline แบบ pure SVG (ไม่ใช้ chart library) — แท่งงานเรียงตาม tasks order
 * แสดง overlay สีแดงโปร่งสำหรับเดือนที่อยู่ในฤดูฝน (rainy_season_months) และเส้นประสีฟ้าแสดง "วันนี้"
 * แท่งงานที่ weather_risk='high' จะมีลายทางทับซ้อน; งาน critical path มีเส้นขอบสีแดง
 */
function renderGanttSVG(tasks, projectConfig) {
  const timeline = projectConfig?.timeline;
  const sortedByStart = [...tasks].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  const startDate = new Date(timeline?.user_start_date || sortedByStart[0]?.start_date || Date.now());
  const sortedByEnd = [...tasks].sort((a, b) => (b.end_date || '').localeCompare(a.end_date || ''));
  const endDate = new Date(timeline?.user_end_date || sortedByEnd[0]?.end_date || Date.now());
  const totalDays = Math.max(1, (endDate - startDate) / 86400000);

  const rowHeight = 28;
  const chartWidth = 800;
  const dayWidth = chartWidth / totalDays;
  const chartHeight = sortedByStart.length * rowHeight + 40;

  const dayOffset = (dateStr) => Math.max(0, (new Date(dateStr) - startDate) / 86400000);

  // Rainy-season overlay bands — แท่งสีแดงโปร่งใส 1 แท่งต่อเดือนที่อยู่ในฤดูฝน
  const rainyMonths = timeline?.rainy_season_months || [];
  const overlayBands = [];
  if (rainyMonths.length) {
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= endDate) {
      const month = cursor.getMonth() + 1;
      if (rainyMonths.includes(month)) {
        const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const x1 = Math.max(0, dayOffset(monthStart.toISOString().slice(0, 10))) * dayWidth;
        const x2 = Math.min(totalDays, dayOffset(monthEnd.toISOString().slice(0, 10)) + 1) * dayWidth;
        if (x2 > x1) overlayBands.push(`<rect x="${x1.toFixed(1)}" y="0" width="${(x2 - x1).toFixed(1)}" height="${chartHeight}" fill="#ef4444" opacity="0.08"/>`);
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  // Today marker
  const todayOffset = dayOffset(new Date().toISOString().slice(0, 10));
  const todayLine = todayOffset >= 0 && todayOffset <= totalDays
    ? `<line x1="${(todayOffset * dayWidth).toFixed(1)}" y1="0" x2="${(todayOffset * dayWidth).toFixed(1)}" y2="${chartHeight}" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,2"/>`
    : '';

  // Task bars — สีตาม work_type, ลายทางถ้า weather_risk='high', เส้นขอบแดงถ้า critical path
  const bars = sortedByStart.map((t, i) => {
    if (!t.start_date) return '';
    const x = dayOffset(t.start_date) * dayWidth;
    const w = Math.max(2, (t.adjusted_duration_days || t.base_duration_days || 1) * dayWidth);
    const y = i * rowHeight + 8;
    const color = WORK_TYPE_COLORS[t.work_type] || '#94a3b8';
    const riskStripe = t.weather_risk === 'high'
      ? `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="12" fill="url(#rain-stripe)"/>`
      : '';
    const criticalStroke = (t.is_critical || t.is_critical_path) ? ' stroke="#ef4444" stroke-width="1.5"' : '';
    const label = escapeHtml(t.activity_name).slice(0, Math.max(0, Math.floor(w / 6)));
    return `<g style="cursor:pointer">
      <rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="12" rx="3" fill="${color}"${criticalStroke}/>
      ${riskStripe}
      <text x="${(x + 4).toFixed(1)}" y="${y + 9}" font-size="9" fill="#fff">${label}</text>
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${chartWidth} ${chartHeight}" class="fp-gantt__svg" preserveAspectRatio="xMinYMin meet">
    <defs><pattern id="rain-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="#3b82f6" opacity="0.15"/><rect width="3" height="6" fill="#3b82f6" opacity="0.3"/>
    </pattern></defs>
    ${overlayBands.join('')}
    ${bars}
    ${todayLine}
  </svg>`;
}

function renderGanttLegend(projectConfig) {
  const workTypeSwatches = Object.entries(WORK_TYPE_HIERARCHY).map(([key, def]) => `
    <span class="fp-gantt__legend-item"><span class="fp-gantt__swatch" style="background:${WORK_TYPE_COLORS[key] || '#94a3b8'}"></span>${escapeHtml(def.label_th)}</span>
  `).join('');
  const rainySwatch = `<span class="fp-gantt__legend-item"><span class="fp-gantt__swatch" style="background:#ef4444;opacity:0.3"></span>ช่วงฤดูฝน</span>`;
  const todaySwatch = `<span class="fp-gantt__legend-item"><span class="fp-gantt__swatch fp-gantt__swatch--line" style="border-color:#3b82f6"></span>วันนี้</span>`;
  return `<div class="fp-gantt__legend">${workTypeSwatches}${rainySwatch}${todaySwatch}</div>`;
}

function renderGroupTable(group) {
  const sorted = [...group.tasks].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  return `
    <div class="pl-group">
      <h3 class="pl-group__title">${escapeHtml(group.label)} <span class="pl-group__count">(${group.tasks.length})</span></h3>
      <table class="rh-table">
        <thead>
          <tr>
            <th>WBS</th>
            <th>กิจกรรม</th>
            <th>ชั้น</th>
            <th>เริ่ม</th>
            <th>สิ้นสุด</th>
            <th class="rh-num">ระยะเวลา (วัน)</th>
            <th class="rh-num">Crew</th>
            <th>Critical</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(renderTaskRow).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTaskRow(task) {
  const duration = task.adjusted_duration_days ?? task.base_duration_days ?? 0;
  return `
    <tr>
      <td>${escapeHtml(task.wbs_code)}</td>
      <td>
        ${escapeHtml(task.activity_name)}
        <div class="rc-item-type">${categoryMeta(task.work_category).label}</div>
      </td>
      <td>${escapeHtml(task.floor_level || '-')}</td>
      <td><input type="date" class="wz-input wz-input--narrow" value="${task.start_date || ''}" onchange="pl_updateTaskDate('${task.id}','start_date',this.value)"></td>
      <td><input type="date" class="wz-input wz-input--narrow" value="${task.end_date || ''}" onchange="pl_updateTaskDate('${task.id}','end_date',this.value)"></td>
      <td class="rh-num">${duration ? duration.toFixed(1) : '-'}</td>
      <td class="rh-num">${task.crew_size ?? '-'}</td>
      <td>${(task.is_critical || task.is_critical_path) ? '🔥 Critical' : '-'}</td>
      <td><button class="rh-delete" onclick="pl_deleteTask('${task.id}')" title="ลบกิจกรรม">✕</button></td>
    </tr>
  `;
}

export function pl_addTask() {
  const nameInput = document.getElementById('pl-input-name');
  const activityName = nameInput.value.trim();
  if (!activityName) {
    alert('กรุณากรอกชื่อกิจกรรม');
    return;
  }

  const crewSize = parseFloat(document.getElementById('pl-input-crew').value) || null;
  const productivity = parseFloat(document.getElementById('pl-input-productivity').value) || null;
  const quantity = parseFloat(document.getElementById('pl-input-quantity').value) || null;
  const weatherBuffer = parseFloat(document.getElementById('pl-input-weather').value) || 0;
  const startDate = document.getElementById('pl-input-start').value || null;

  let baseDuration = null;
  if (quantity && crewSize && productivity) {
    baseDuration = parseFloat((quantity / (crewSize * productivity)).toFixed(1));
  }

  const month = startDate ? new Date(startDate).getMonth() + 1 : null;
  const adjustedDuration = baseDuration != null && month != null
    ? calcAdjustedDuration(baseDuration, month)
    : baseDuration;

  const task = createScheduleTask({
    id: crypto.randomUUID(),
    wbs_code: document.getElementById('pl-input-wbs').value.trim(),
    activity_name: activityName,
    work_category: document.getElementById('pl-input-category').value,
    floor_level: document.getElementById('pl-input-floor').value.trim() || null,
    quantity,
    crew_size: crewSize,
    productivity_rate: productivity,
    base_duration_days: baseDuration,
    weather_buffer_factor: weatherBuffer,
    adjusted_duration_days: adjustedDuration,
    start_date: startDate,
    end_date: document.getElementById('pl-input-end').value || null,
    is_critical: document.getElementById('pl-input-critical').value === 'true',
    created_at: new Date().toISOString(),
  });

  tasks.push(task);
  saveTasks(tasks);
  render();
}

export function pl_deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(tasks);
  render();
}

export function pl_setGrouping(mode) {
  viewState.grouping_mode = mode;
  saveViewState(viewState);
  render();
}

/**
 * แก้ไขวันที่ของ task แบบ reactive — เลื่อน dependent ทุกตัวตาม (shiftDependents)
 * คำนวณ budget impact ใหม่จาก project_config.timeline (ถ้ามี) แล้ว broadcast PIPELINE_EVENT
 * reason: 'schedule-changed' ให้ Overview/Resource Hub/Readiness re-render จากข้อมูลล่าสุด
 */
export function pl_updateTaskDate(id, field, value) {
  if (!value) return;
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const changedTask = { ...task, [field]: value };
  if (field === 'start_date' && task.start_date && task.end_date) {
    const durationMs = new Date(task.end_date) - new Date(task.start_date);
    changedTask.end_date = new Date(new Date(value).getTime() + Math.max(durationMs, 0)).toISOString().slice(0, 10);
  }

  const before = new Map(tasks.map(t => [t.id, t.start_date]));
  tasks = shiftDependents(changedTask, tasks);
  saveTasks(tasks);

  const shifted = tasks.filter(t => before.get(t.id) !== t.start_date && t.id !== id);
  const budgetImpact = recalcBudgetImpact();
  showDiffChip(task, shifted, budgetImpact);

  window.dispatchEvent(new CustomEvent(PIPELINE_EVENT, {
    detail: { schedule: tasks, budget_impact: budgetImpact, reason: 'schedule-changed' },
  }));

  render();
}

function recalcBudgetImpact() {
  const config = loadProjectConfig();
  if (!config?.timeline?.estimated_recommended_days || !tasks.length) return null;

  const starts = tasks.map(t => t.start_date).filter(Boolean).sort();
  const ends = tasks.map(t => t.end_date).filter(Boolean).sort();
  if (!starts.length || !ends.length) return null;

  const overallStart = starts[0];
  const overallEnd = ends[ends.length - 1];
  const budgetImpact = calculateBudgetImpact(config.timeline, overallStart, overallEnd);

  config.timeline.user_start_date = overallStart;
  config.timeline.user_end_date = overallEnd;
  config.timeline.user_duration_days = Math.max(1, Math.round((new Date(overallEnd) - new Date(overallStart)) / 86400000));
  config.budget_impact = budgetImpact;
  saveProjectConfig(config);

  return budgetImpact;
}

function showDiffChip(changedTask, shifted, budgetImpact) {
  let text = `🔄 อัปเดต "${changedTask.activity_name}"`;
  if (shifted.length) text += ` — เลื่อนงานที่เกี่ยวข้อง ${shifted.length} รายการ`;
  if (budgetImpact?.delta_cost) {
    const sign = budgetImpact.delta_cost > 0 ? '+' : '';
    text += ` · งบเปลี่ยน ${sign}${budgetImpact.delta_cost.toLocaleString('th-TH')} บาท`;
  }
  diffChip = text;
  render();
  clearTimeout(showDiffChip._timer);
  showDiffChip._timer = setTimeout(() => { diffChip = null; render(); }, 5000);
}

// expose ให้ inline onclick="" ใน HTML เรียกได้
window.pl_addTask = pl_addTask;
window.pl_deleteTask = pl_deleteTask;
window.pl_setGrouping = pl_setGrouping;
window.pl_updateTaskDate = pl_updateTaskDate;

document.addEventListener('DOMContentLoaded', () => {
  tasks = loadTasks();
  viewState = loadViewState();
  render();
});

// เมื่อ pipeline (ปุ่ม Calculate Project) คำนวณเสร็จ ให้โหลดผลลัพธ์ใหม่จาก localStorage มาแสดง
window.addEventListener('constistant:pipeline-updated', (e) => {
  tasks = e.detail?.schedule ?? loadTasks();
  render();
});

// เมื่อสลับโปรเจกต์ ให้โหลด/seed ข้อมูลของโปรเจกต์ที่เลือกใหม่
window.addEventListener(PROJECT_EVENT, () => {
  tasks = loadTasks();
  viewState = loadViewState();
  render();
});
