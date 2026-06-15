/**
 * project-header.js — Shared, collapsible project header component
 *
 * Used across: overview.html, planner.html, resources.html, boq.html
 * Sticky to top of content area, shows project info, RAG status, progress, weather alerts
 *
 * API:
 * - renderProjectHeader(containerId, projectData) — render header in container
 * - toggleProjectHeader() — toggle collapsed/expanded state
 * - ph_fetchProjectData(projectId) — async fetch project + readiness data (swappable for Supabase)
 */

import { getDemoProject, getDemoDataByEngine } from './demo-seed.js';
import { getCurrentProjectId, DEMO_PROJECT_ID } from './project-store.js';
import { STORAGE_KEYS } from './pipeline.js';

const COLLAPSE_STATE_KEY = 'constistant_header_collapsed';
const RAIN_MONTHS = [5, 6, 7, 8, 9, 10]; // May-Oct (wet season Bangkok)

let currentProjectData = null;
let isCollapsed = false;

// ─────────────────────────────────────────────
// DATA FETCHING (swappable for Supabase later)
// ─────────────────────────────────────────────

export async function ph_fetchProjectData(projectId) {
  // TODO: Replace with Supabase fetch
  // const project = await supabase.from('projects').select('*').eq('id', projectId).single();
  // const readiness = await supabase.from('readiness_checks').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1);
  // const schedule = await supabase.from('schedule_tasks').select('percent_complete').eq('project_id', projectId);

  // For now: demo data
  if (projectId === DEMO_PROJECT_ID) {
    const project = getDemoProject();
    const readinessData = getDemoDataByEngine('readiness');
    const scheduleData = getDemoDataByEngine('schedule') || {};

    return {
      project,
      readiness: readinessData,
      schedule: scheduleData.SCHEDULE_TASKS || [],
    };
  }

  return { project: null, readiness: null, schedule: [] };
}

// ─────────────────────────────────────────────
// CALCULATIONS
// ─────────────────────────────────────────────

function calculateOverallProgress(scheduleTasks) {
  if (!scheduleTasks || scheduleTasks.length === 0) return 0;
  const sum = scheduleTasks.reduce((acc, task) => acc + (task.percent_complete || 0), 0);
  return Math.round(sum / scheduleTasks.length);
}

function calculateDaysRemaining(targetDate) {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  const today = new Date();
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getRAGStatus(readiness) {
  // Read from readiness_checks: if all items are 'green', RAG = green; if any 'red', RAG = red; else amber
  if (!readiness) return { status: 'neutral', label: '?', color: '#94a3b8' };

  const items = readiness.READINESS_CHECKS || [];
  if (items.length === 0) return { status: 'neutral', label: '?', color: '#94a3b8' };

  const statuses = items.map(item => item.status);
  if (statuses.includes('red')) return { status: 'red', label: '🔴 At Risk', color: '#ef4444' };
  if (statuses.includes('amber')) return { status: 'amber', label: '🟡 Caution', color: '#f59e0b' };
  return { status: 'green', label: '🟢 On Track', color: '#10b981' };
}

function getWeatherAlert(project) {
  // Check if current month is in wet season
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12

  if (RAIN_MONTHS.includes(currentMonth)) {
    return { alert: true, label: '⚠️ ฤดูฝน', tooltip: 'Wet season — weather delays expected' };
  }
  return { alert: false, label: null, tooltip: null };
}

function getTargetCompletionDate(project, schedule) {
  // If project has user-set target, use it; else calculate from last task end_date
  if (project.target_completion_date) {
    return new Date(project.target_completion_date);
  }

  // Fallback: max end_date from schedule tasks
  if (schedule && schedule.length > 0) {
    const maxDate = schedule.reduce((max, task) => {
      if (!task.end_date) return max;
      const taskDate = new Date(task.end_date);
      return !max || taskDate > max ? taskDate : max;
    }, null);
    return maxDate;
  }

  return null;
}

// ─────────────────────────────────────────────
// RENDERING
// ─────────────────────────────────────────────

function renderExpandedHeader(projectData) {
  const { project, readiness, schedule } = projectData;
  const rag = getRAGStatus(readiness);
  const weather = getWeatherAlert(project);
  const progress = calculateOverallProgress(schedule);
  const targetDate = getTargetCompletionDate(project, schedule);
  const daysRemaining = calculateDaysRemaining(targetDate?.toISOString?.());

  const startDateStr = project.start_date
    ? new Date(project.start_date).toLocaleDateString('th-TH', { day: 'short', month: 'short', year: 'numeric' })
    : '—';

  const targetDateStr = targetDate
    ? targetDate.toLocaleDateString('th-TH', { day: 'short', month: 'short', year: 'numeric' })
    : '—';

  const daysStr = daysRemaining !== null
    ? daysRemaining > 0
      ? `${daysRemaining} วันที่เหลือ`
      : daysRemaining === 0
        ? 'วันนี้'
        : `ล่าช้า ${Math.abs(daysRemaining)} วัน`
    : '—';

  return `
    <div class="ph-expanded">
      <div class="ph-top-row">
        <div class="ph-project-info">
          <h2 class="ph-project-name">${escapeHtml(project.name)}</h2>
          <p class="ph-project-meta">
            ${escapeHtml(project.location_label || '—')}
            ${project.building_type ? `• ${escapeHtml(project.building_type)}` : ''}
            ${project.floors_above_ground ? `• ${project.floors_above_ground} ชั้น` : ''}
          </p>
        </div>
        <div class="ph-badges">
          <span class="ph-badge ph-badge--rag" style="background-color: ${rag.color}22; color: ${rag.color}" title="RAG Status">
            ${rag.label}
          </span>
          ${weather.alert ? `<span class="ph-badge ph-badge--weather" title="${weather.tooltip}">${weather.label}</span>` : ''}
        </div>
      </div>

      <div class="ph-progress-section">
        <div class="ph-progress-header">
          <span>ความคืบหน้าโครงการ</span>
          <strong>${progress}%</strong>
        </div>
        <div class="ph-progress-bar">
          <div class="ph-progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>

      <div class="ph-dates-section">
        <div class="ph-date-item">
          <span class="ph-date-label">เริ่มต้น:</span>
          <span class="ph-date-value">${startDateStr}</span>
        </div>
        <div class="ph-date-item">
          <span class="ph-date-label">เป้าหมาย:</span>
          <span class="ph-date-value">${targetDateStr}</span>
        </div>
        <div class="ph-date-item">
          <span class="ph-date-label">สถานะ:</span>
          <span class="ph-date-value" style="color: ${daysRemaining !== null && daysRemaining < 0 ? '#ef4444' : '#666'}">${daysStr}</span>
        </div>
      </div>
    </div>
  `;
}

function renderCollapsedHeader(projectData) {
  const { project, readiness, schedule } = projectData;
  const rag = getRAGStatus(readiness);
  const progress = calculateOverallProgress(schedule);

  return `
    <div class="ph-collapsed">
      <span class="ph-collapsed-name">${escapeHtml(project.name)}</span>
      <span class="ph-collapsed-badge" style="background-color: ${rag.color}22; color: ${rag.color}">
        ${rag.label}
      </span>
      <span class="ph-collapsed-progress">${progress}%</span>
      <span class="ph-collapsed-chevron">▼</span>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────

export async function renderProjectHeader(containerId, projectData = null) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[project-header] container #${containerId} not found`);
    return;
  }

  // Load state before render to avoid flash
  const storedCollapsed = localStorage.getItem(COLLAPSE_STATE_KEY);
  if (storedCollapsed !== null) {
    isCollapsed = storedCollapsed === '1';
  } else {
    // Default: collapsed on mobile, expanded on desktop
    isCollapsed = window.innerWidth < 768;
  }

  // Fetch data if not provided
  if (!projectData) {
    const projectId = getCurrentProjectId();
    projectData = await ph_fetchProjectData(projectId);
  }

  currentProjectData = projectData;

  const html = `
    <div class="project-header ${isCollapsed ? 'is-collapsed' : 'is-expanded'}">
      <div class="ph-content">
        ${isCollapsed ? renderCollapsedHeader(projectData) : renderExpandedHeader(projectData)}
      </div>
    </div>
  `;

  container.innerHTML = html;
  container.classList.add('project-header-mounted');

  // Attach toggle handler
  container.addEventListener('click', () => {
    toggleProjectHeader(containerId);
  });

  // Attach resize listener to auto-collapse on mobile
  window.addEventListener('resize', () => {
    const shouldCollapse = window.innerWidth < 768;
    if (shouldCollapse !== isCollapsed) {
      isCollapsed = shouldCollapse;
      localStorage.setItem(COLLAPSE_STATE_KEY, isCollapsed ? '1' : '0');
      renderProjectHeader(containerId, currentProjectData);
    }
  });
}

export function toggleProjectHeader(containerId = 'project-header') {
  isCollapsed = !isCollapsed;
  localStorage.setItem(COLLAPSE_STATE_KEY, isCollapsed ? '1' : '0');
  renderProjectHeader(containerId, currentProjectData);
}

// ─────────────────────────────────────────────
// WINDOW EXPORTS
// ─────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.ph_renderProjectHeader = renderProjectHeader;
  window.ph_toggleProjectHeader = toggleProjectHeader;
  window.ph_fetchProjectData = ph_fetchProjectData;
}
