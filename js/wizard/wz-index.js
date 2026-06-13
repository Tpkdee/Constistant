// wz-index.js — Onboarding Wizard orchestrator (step state machine + overlay mount)
//
// Step modules (wz-step1..4.js) each export a render function `wz_renderStepN(root, state)`
// that fills #wizard-step-root with that step's markup and wires its own events.
// wz-index.js owns: overlay show/hide, progress dots, project_config persistence,
// and the WIZARD_EVENT contract consumed by shell-index.js (tab gating).

import { createProjectConfig } from '../shared/schema.js';
import { getCurrentProjectId, projectStorageKey, DEMO_PROJECT_ID } from '../shared/project-store.js';
import { wz_renderStep1 } from './wz-step1.js';
import { wz_renderStep2 } from './wz-step2.js';
import { wz_renderStep3 } from './wz-step3.js';
import { wz_renderStep4 } from './wz-step4.js';

export const WIZARD_EVENT = 'constistant:wizard-step-changed';
const CONFIG_KEY = 'constistant_project_config_v1';
const TOTAL_STEPS = 4;

export const wz_state = {
  projectId: null,
  step: 1,
};

const STEP_RENDERERS = {
  1: wz_renderStep1,
  2: wz_renderStep2,
  3: wz_renderStep3,
  4: wz_renderStep4,
};

// ─────────────────────────────────────────────
// project_config persistence
// ─────────────────────────────────────────────

export function wz_getConfig(projectId = getCurrentProjectId()) {
  try {
    const raw = localStorage.getItem(projectStorageKey(CONFIG_KEY, projectId));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('[wizard] failed to load project_config', e);
  }
  return null;
}

export function wz_saveConfig(config, projectId = getCurrentProjectId()) {
  config.updated_at = new Date().toISOString();
  localStorage.setItem(projectStorageKey(CONFIG_KEY, projectId), JSON.stringify(config));
  return config;
}

export function wz_ensureConfig(projectId = getCurrentProjectId()) {
  let config = wz_getConfig(projectId);
  if (!config) {
    config = createProjectConfig({
      id: crypto.randomUUID(),
      project_id: projectId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    wz_saveConfig(config, projectId);
  }
  return config;
}

// ─────────────────────────────────────────────
// overlay show / hide
// ─────────────────────────────────────────────

export function wz_show(step = 1) {
  const overlay = document.getElementById('wizard-overlay');
  if (!overlay) return;
  wz_state.step = Math.min(Math.max(step, 1), TOTAL_STEPS);
  overlay.hidden = false;
  document.body.classList.add('wz-open');
  wz_renderProgress();
  wz_renderStep(wz_state.step);
  wz_emit('shown');
}

export function wz_hide() {
  const overlay = document.getElementById('wizard-overlay');
  if (overlay) overlay.hidden = true;
  document.body.classList.remove('wz-open');
  wz_emit('hidden');
}

export function wz_isVisible() {
  const overlay = document.getElementById('wizard-overlay');
  return !!overlay && !overlay.hidden;
}

// ─────────────────────────────────────────────
// step navigation
// ─────────────────────────────────────────────

export function wz_goToStep(step) {
  const clamped = Math.min(Math.max(step, 1), TOTAL_STEPS);
  wz_state.step = clamped;

  const config = wz_ensureConfig(wz_state.projectId);
  config.wizard_step_reached = Math.max(config.wizard_step_reached || 1, clamped);
  wz_saveConfig(config, wz_state.projectId);

  wz_renderProgress();
  wz_renderStep(clamped);
  wz_emit('changed');
}

export function wz_nextStep() {
  wz_goToStep(wz_state.step + 1);
}

export function wz_prevStep() {
  wz_goToStep(wz_state.step - 1);
}

function wz_renderStep(step) {
  const root = document.getElementById('wizard-step-root');
  if (!root) return;
  const renderer = STEP_RENDERERS[step] || wz_renderStep1;
  renderer(root, wz_state);
}

function wz_renderProgress() {
  const progress = document.querySelector('#wizard-overlay .wz-progress');
  if (!progress) return;
  const labels = ['อัปโหลดแบบ', 'ตรวจสอบข้อมูล', 'ตั้งค่าโครงการ', 'สร้างแผนงาน'];
  progress.innerHTML = labels.map((label, i) => {
    const n = i + 1;
    let cls = 'wz-dot';
    if (n === wz_state.step) cls += ' wz-dot--active';
    else if (n < wz_state.step) cls += ' wz-dot--done';
    return `<div class="${cls}" data-step="${n}"><span class="wz-dot__num">${n}</span><span class="wz-dot__label">${label}</span></div>`;
  }).join('');
}

function wz_emit(status) {
  window.dispatchEvent(new CustomEvent(WIZARD_EVENT, {
    detail: { projectId: wz_state.projectId, step: wz_state.step, status },
  }));
}

// ─────────────────────────────────────────────
// entry point
// ─────────────────────────────────────────────

export function wz_checkAndShow(projectId) {
  wz_state.projectId = projectId;
  if (projectId === DEMO_PROJECT_ID) { wz_hide(); return; }
  const cfg = wz_getConfig(projectId);
  if (cfg?.wizard_completed_at) { wz_hide(); return; }
  wz_show(cfg?.wizard_step_reached || 1);
}

// expose for inline handlers inside step modules
window.wz_goToStep = wz_goToStep;
window.wz_nextStep = wz_nextStep;
window.wz_prevStep = wz_prevStep;
window.wz_hide = wz_hide;
window.wz_show = wz_show;
window.wz_checkAndShow = wz_checkAndShow;

globalThis.wz_goToStep = wz_goToStep;
globalThis.wz_nextStep = wz_nextStep;
globalThis.wz_prevStep = wz_prevStep;
globalThis.wz_hide = wz_hide;
globalThis.wz_show = wz_show;
globalThis.wz_checkAndShow = wz_checkAndShow;
