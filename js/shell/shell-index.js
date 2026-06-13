/**
 * Constistant shell — tab navigation, sidebar, project switcher, pipeline trigger.
 */

import { runPipeline } from '../shared/pipeline.js';
import {
  getProjects,
  getCurrentProjectId,
  selectProject,
  addProject,
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

function updateStatusSheet(sheetName) {
  const status = document.getElementById('status-main');
  const sheetText = sheetName || 'Sheet: ไม่ระบุ';
  status.textContent = `Project: อาคาร A · ${sheetText} · Last sync: 2 min ago`;
  document.getElementById('properties-sheet').textContent = sheetName;
}

function handleTabClick(event) {
  event.preventDefault();
  setActiveTab(event.currentTarget.dataset.module);
}

function handleSidebarClick(event) {
  const item = event.currentTarget;
  document.querySelectorAll('.sidebar__item').forEach(i => i.classList.remove('sidebar__item--selected'));
  item.classList.add('sidebar__item--selected');
  const sheetName = item.dataset.sheet || item.textContent.trim();
  updateStatusSheet(sheetName);
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
  const status = document.getElementById('pipeline-status');
  if (status) status.textContent = '';
  wz_checkAndShow(getCurrentProjectId());
  applyWizardTabGating();
  if (wz_isVisible()) setActiveTab('Overview');
});

window.addEventListener(WIZARD_EVENT, () => {
  applyWizardTabGating();
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', handleTabClick));
  document.querySelectorAll('.sidebar__item').forEach(item => item.addEventListener('click', handleSidebarClick));
  setActiveTab('Overview');
  updateStatusSheet('Sheet S-101');
  renderProjectSelect();

  wz_checkAndShow(getCurrentProjectId());
  applyWizardTabGating();
  if (wz_isVisible()) setActiveTab('Overview');
});
