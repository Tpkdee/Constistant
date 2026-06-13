/**
 * Constistant shell — tab navigation, sidebar, project switcher, pipeline trigger.
 */

import { runPipeline, STORAGE_KEYS, PIPELINE_EVENT } from '../shared/pipeline.js';
import {
  getProjects,
  getCurrentProjectId,
  getCurrentProject,
  selectProject,
  addProject,
  projectStorageKey,
  PROJECT_EVENT,
  DEMO_PROJECT_ID,
} from '../shared/project-store.js';
import { wz_checkAndShow, wz_isVisible, WIZARD_EVENT } from '../wizard/wz-index.js';

const modulePlaceholders = {
  Overview: {
    description: 'ภาพรวมโครงการ — สถานะความพร้อม, ปริมาณงาน, แผนงาน',
    icon: '📊',
    mode: 'light',
  },
  'Drawing Intelligence': {
    description: 'สกัดพารามิเตอร์จากแบบ 2D แล้วสรุปเป็นข้อมูลโครงสร้าง',
    icon: '🗺️',
    mode: 'light',
  },
  BBS: {
    description: 'ตารางตัด-ดัดเหล็กเสริม (Bar Bending Schedule)',
    icon: '🔩',
    mode: 'light',
  },
  'Readiness Check': {
    description: 'ตรวจสอบความพร้อมงานก่อสร้างและรายงานจุดที่ต้องแก้ไข',
    icon: '✅',
    mode: 'light',
  },
  Planner: {
    description: 'วางแผนงาน กำหนดไทม์ไลน์ และติดตามความคืบหน้า',
    icon: '📅',
    mode: 'light',
  },
  'Resource Hub': {
    description: 'จัดการแรงงาน วัสดุ และผู้รับเหมาอย่างเป็นระบบ',
    icon: '👥',
    mode: 'light',
  },
};

function setActiveTab(moduleName) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('tab--active', tab.dataset.module === moduleName);
  });

  document.querySelectorAll('.canvas-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.module === moduleName);
  });

  // "Drawing Intelligence" tab mounts the QuantiTake panel (#qt-module) directly —
  // there is no separate placeholder panel for it anymore.
  const qtModule = document.getElementById('qt-module');
  if (moduleName === 'Drawing Intelligence') {
    qtModule.classList.add('active');
    qtModule.style.display = 'flex';
  } else {
    qtModule.classList.remove('active');
    qtModule.style.display = 'none';
  }

  const placeholder = modulePlaceholders[moduleName];
  const canvas = document.getElementById('canvas');
  if (placeholder) {
    canvas.style.background = placeholder.mode === 'dark'
      ? 'var(--color-canvas-dark)'
      : 'var(--color-canvas-light)';
  }
}

/**
 * Disables non-Overview tabs while the onboarding wizard is visible for a non-demo
 * project (AOW 1.0 §1.0 tab gating). Demo project is always exempt.
 */
function applyWizardTabGating() {
  const gated = wz_isVisible() && getCurrentProjectId() !== DEMO_PROJECT_ID;
  document.querySelectorAll('.tab').forEach(tab => {
    const isOverview = tab.dataset.module === 'Overview';
    if (gated && !isOverview) {
      tab.style.pointerEvents = 'none';
      tab.setAttribute('aria-disabled', 'true');
      tab.classList.add('tab--disabled');
    } else {
      tab.style.pointerEvents = '';
      tab.removeAttribute('aria-disabled');
      tab.classList.remove('tab--disabled');
    }
  });
}

// แผ่นงานที่เลือกใน sidebar (สถานะ navigation จริง — ใช้ในแถบสถานะด้านล่าง)
let currentSheet = 'Sheet S-101';

const BUILDING_TYPE_LABEL = { residential: 'ที่อยู่อาศัย', commercial: 'อาคารพาณิชย์', mixed: 'อาคารผสม' };
const PROJECT_STATUS_LABEL = { draft: 'ฉบับร่าง', active: 'กำลังดำเนินการ', completed: 'เสร็จสิ้น', on_hold: 'ระงับชั่วคราว' };

// นับรายการ readiness ที่ยังไม่พร้อม (red/yellow) จากผลที่ pipeline เซฟไว้ (project-scoped)
function loadReadinessCount() {
  try {
    const raw = localStorage.getItem(projectStorageKey(STORAGE_KEYS.readiness));
    if (!raw) return null;
    const checks = JSON.parse(raw);
    if (!Array.isArray(checks) || checks.length === 0) return null;
    const open = checks.filter(c => c.status === 'red' || c.status === 'yellow').length;
    return { total: checks.length, open };
  } catch (e) {
    return null;
  }
}

function renderStatusbar() {
  const project = getCurrentProject();
  const statusMain = document.getElementById('status-main');
  if (statusMain) {
    statusMain.textContent = `โปรเจกต์: ${project?.name || '-'} · ${currentSheet}`;
  }
  const tag = document.getElementById('status-tag');
  if (tag) {
    const rc = loadReadinessCount();
    if (!rc) {
      tag.textContent = 'ยังไม่มีผลตรวจความพร้อม';
    } else if (rc.open === 0) {
      tag.textContent = 'พร้อมดำเนินการ ✓';
    } else {
      tag.textContent = `${rc.open} รายการต้องติดตาม ⚠`;
    }
  }
}

// แสดงข้อมูลจริงของโปรเจกต์ที่เลือกอยู่ในแถบ Properties (ขวา) — อัปเดตเมื่อสลับโปรเจกต์
function renderProperties() {
  const body = document.getElementById('properties-body');
  if (!body) return;
  const p = getCurrentProject() || {};
  const rows = [
    ['ชื่อโครงการ', p.name],
    ['เจ้าของโครงการ', p.client_name],
    ['ประเภทอาคาร', BUILDING_TYPE_LABEL[p.building_type] || p.building_type],
    ['จำนวนชั้น', p.floors_above_ground != null ? `${p.floors_above_ground} ชั้น` : null],
    ['พื้นที่รวม', p.total_area_sqm ? `${p.total_area_sqm.toLocaleString('th-TH')} ตร.ม.` : null],
    ['ที่ตั้ง', p.location_label],
    ['วันที่เริ่มโครงการ', p.start_date],
    ['สถานะ', PROJECT_STATUS_LABEL[p.status] || p.status],
  ];
  body.innerHTML = rows.map(([label, value]) => `
    <div class="properties__field">
      <span class="properties__field-label">${label}</span>
      <div class="properties__field-value">${escapeHtml(value != null && value !== '' ? String(value) : '—')}</div>
    </div>
  `).join('');
}

function handleTabClick(event) {
  event.preventDefault();
  setActiveTab(event.currentTarget.dataset.module);
}

function handleSidebarClick(event) {
  const item = event.currentTarget;
  document.querySelectorAll('.sidebar__item').forEach(i => i.classList.remove('sidebar__item--selected'));
  item.classList.add('sidebar__item--selected');
  currentSheet = item.dataset.sheet || item.textContent.trim();
  renderStatusbar();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function renderProjectSelect() {
  const select = document.getElementById('project-select');
  const projects = getProjects();
  const currentId = getCurrentProjectId();
  select.innerHTML = projects.map(p =>
    `<option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>${escapeHtml(p.name || '(ไม่มีชื่อ)')}</option>`
  ).join('');
}

window.constistant_runPipeline = async function () {
  const btn = document.getElementById('pipeline-calc-btn');
  const status = document.getElementById('pipeline-status');
  btn.disabled = true;
  try {
    const result = await runPipeline((label, step, total) => {
      status.textContent = `⏳ (${step}/${total}) ${label}...`;
    });
    status.textContent = `✅ เสร็จสิ้น — BOQ ฿${result.totals.boq_amount_thb.toLocaleString('th-TH')} | ` +
      `ทรัพยากร ฿${result.totals.resource_amount_thb.toLocaleString('th-TH')} | ` +
      `แผนงาน ${result.totals.schedule_days} วัน (เสร็จ ${result.totals.project_end_date || '-'})`;
  } catch (err) {
    console.error('[pipeline] failed', err);
    status.textContent = `❌ คำนวณไม่สำเร็จ: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
};

window.constistant_selectProject = function (id) {
  selectProject(id);
};

window.constistant_openNewProjectModal = function () {
  document.getElementById('np-name').value = '';
  document.getElementById('np-client').value = '';
  document.getElementById('np-location').value = '';
  document.getElementById('np-start-date').value = '';
  document.getElementById('np-building-type').value = 'residential';
  document.getElementById('np-floors').value = '';
  document.getElementById('np-area').value = '';
  document.getElementById('new-project-modal').hidden = false;
};

window.constistant_closeNewProjectModal = function () {
  document.getElementById('new-project-modal').hidden = true;
};

window.constistant_createProject = function () {
  const name = document.getElementById('np-name').value.trim();
  if (!name) {
    alert('กรุณากรอกชื่อโครงการ');
    return;
  }
  addProject({
    name,
    client_name: document.getElementById('np-client').value.trim(),
    location_label: document.getElementById('np-location').value.trim(),
    start_date: document.getElementById('np-start-date').value || null,
    building_type: document.getElementById('np-building-type').value,
    floors_above_ground: parseInt(document.getElementById('np-floors').value, 10) || null,
    total_area_sqm: parseFloat(document.getElementById('np-area').value) || null,
  });
  window.constistant_closeNewProjectModal();
};

window.constistant_setActiveTab = setActiveTab;

window.addEventListener(PROJECT_EVENT, () => {
  renderProjectSelect();
  renderProperties();
  renderStatusbar();
  const status = document.getElementById('pipeline-status');
  if (status) status.textContent = '';
  wz_checkAndShow(getCurrentProjectId());
  applyWizardTabGating();
  if (wz_isVisible()) setActiveTab('Overview');
});

// อัปเดตจำนวนรายการ readiness ในแถบสถานะหลังกด Calculate Project
window.addEventListener(PIPELINE_EVENT, renderStatusbar);

window.addEventListener(WIZARD_EVENT, () => {
  applyWizardTabGating();
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', handleTabClick));
  document.querySelectorAll('.sidebar__item').forEach(item => item.addEventListener('click', handleSidebarClick));
  setActiveTab('Overview');
  renderProjectSelect();
  renderProperties();
  renderStatusbar();
  // feature modules seed their own localStorage during their DOMContentLoaded (fires after
  // this one); re-read once after the tick so the readiness count reflects seeded demo data
  setTimeout(renderStatusbar, 0);

  wz_checkAndShow(getCurrentProjectId());
  applyWizardTabGating();
  if (wz_isVisible()) setActiveTab('Overview');
});
