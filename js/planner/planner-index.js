// Planner — construction schedule (Gantt-style task list)
//
// ทำงานแบบ standalone (localStorage) ก่อน ค่อยสลับไปต่อ Supabase ทีหลัง
// โครงสร้าง object ของแต่ละรายการ = createScheduleTask() จาก ../shared/schema.js
// ห้ามสร้าง object เองตรงๆ — ใช้ factory function เสมอ ตามกติกาของ schema.js

import { createScheduleTask, calcAdjustedDuration } from '../shared/schema.js';
import { getDemoDataByEngine } from '../shared/demo-seed.js';
import { projectStorageKey, getCurrentProjectId, DEMO_PROJECT_ID, PROJECT_EVENT } from '../shared/project-store.js';

const STORAGE_KEY = 'constistant_schedule_tasks_v1';

const WORK_CATEGORIES = [
  { value: 'structural', label: '🏗️ โครงสร้าง' },
  { value: 'architectural', label: '🏠 สถาปัตยกรรม' },
  { value: 'mep', label: '🔧 งานระบบ (MEP)' },
  { value: 'finishing', label: '🎨 งานตกแต่ง' },
];

let tasks = [];

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

  const sorted = [...tasks].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  const criticalCount = tasks.filter(t => t.is_critical).length;
  const totalDays = tasks.reduce((sum, t) => sum + (t.adjusted_duration_days ?? t.base_duration_days ?? 0), 0);

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

    <div class="fp-card">
      <h2>ตารางงานทั้งหมด</h2>
      ${sorted.length === 0 ? '<p class="fp-empty">ยังไม่มีกิจกรรม</p>' : `
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
      `}
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
      <td>${escapeHtml(task.start_date || '-')}</td>
      <td>${escapeHtml(task.end_date || '-')}</td>
      <td class="rh-num">${duration ? duration.toFixed(1) : '-'}</td>
      <td class="rh-num">${task.crew_size ?? '-'}</td>
      <td>${task.is_critical ? '🔥 Critical' : '-'}</td>
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

// expose ให้ inline onclick="" ใน HTML เรียกได้
window.pl_addTask = pl_addTask;
window.pl_deleteTask = pl_deleteTask;

document.addEventListener('DOMContentLoaded', () => {
  tasks = loadTasks();
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
  render();
});
