// project-store.js — manage the list of projects + which one is "active"
//
// ทุก feature module (Planner, Resource Hub, Readiness, Pipeline ฯลฯ) เก็บข้อมูลแยกต่อโปรเจกต์
// โดยใช้ projectStorageKey(baseKey) ต่อท้าย project id เข้าไปใน localStorage key
//
// โปรเจกต์สาธิต (จาก demo-seed.js) เป็นโปรเจกต์แรกเสมอ — มีข้อมูลตัวอย่างครบ
// โปรเจกต์ใหม่ที่ผู้ใช้สร้างเองจะเริ่มต้นแบบว่างเปล่า (ไม่ seed demo data)

import { createProject } from './schema.js';
import { getDemoProject } from './demo-seed.js';

export const PROJECT_EVENT = 'constistant:project-changed';

const STORAGE_KEY_PROJECTS = 'constistant_projects_v1';
const STORAGE_KEY_CURRENT = 'constistant_current_project_id_v1';
const STORAGE_KEY_ELEMENTS_PREFIX = 'constistant_drawing_elements_v1';

export const DEMO_PROJECT_ID = getDemoProject().project.id;

// ─────────────────────────────────────────────
// Projects list
// ─────────────────────────────────────────────

function seedProjects() {
  const demo = getDemoProject();
  const list = [demo.project];
  saveProjects(list);
  return list;
}

export function getProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('[project-store] failed to load projects', e);
  }
  return seedProjects();
}

function saveProjects(list) {
  localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(list));
}

export function getCurrentProjectId() {
  const id = localStorage.getItem(STORAGE_KEY_CURRENT);
  if (id) return id;
  const projects = getProjects();
  const fallback = projects[0]?.id ?? DEMO_PROJECT_ID;
  localStorage.setItem(STORAGE_KEY_CURRENT, fallback);
  return fallback;
}

export function getCurrentProject() {
  const id = getCurrentProjectId();
  const projects = getProjects();
  return projects.find(p => p.id === id) ?? projects[0];
}

export function selectProject(id) {
  localStorage.setItem(STORAGE_KEY_CURRENT, id);
  window.dispatchEvent(new CustomEvent(PROJECT_EVENT, { detail: { projectId: id } }));
}

export function addProject(overrides = {}) {
  const projects = getProjects();
  const project = createProject({
    id: crypto.randomUUID(),
    user_id: 'local-user',
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });
  projects.push(project);
  saveProjects(projects);
  selectProject(project.id);
  return project;
}

export function deleteProject(id) {
  if (id === DEMO_PROJECT_ID) {
    throw new Error('ไม่สามารถลบโปรเจกต์สาธิตได้');
  }
  const projects = getProjects().filter(p => p.id !== id);
  saveProjects(projects.length ? projects : seedProjects());

  // ล้างข้อมูลทุก feature module ของโปรเจกต์นี้
  PROJECT_SCOPED_KEYS.forEach(base => localStorage.removeItem(`${base}__${id}`));
  localStorage.removeItem(`${STORAGE_KEY_ELEMENTS_PREFIX}__${id}`);

  if (getCurrentProjectId() === id) {
    selectProject(projects[0]?.id ?? DEMO_PROJECT_ID);
  }
}

// localStorage base keys ที่ต้อง namespaced ต่อโปรเจกต์ (ใช้ตอนลบโปรเจกต์)
export const PROJECT_SCOPED_KEYS = [
  'constistant_boq_items_v1',
  'constistant_bbs_items_v1',
  'constistant_schedule_tasks_v1',
  'constistant_resource_items_v1',
  'constistant_readiness_checks_v1',
];

// ─────────────────────────────────────────────
// Per-project storage key helper
// ─────────────────────────────────────────────

/**
 * @param {string} baseKey — เช่น 'constistant_schedule_tasks_v1'
 * @param {string} [projectId] — ถ้าไม่ระบุ ใช้โปรเจกต์ที่เลือกอยู่
 */
export function projectStorageKey(baseKey, projectId = getCurrentProjectId()) {
  return `${baseKey}__${projectId}`;
}

// ─────────────────────────────────────────────
// Drawing elements / beam library (input ของ pipeline)
// ─────────────────────────────────────────────

/**
 * คืนค่า { elements, beamLibraryById } ของโปรเจกต์ที่ระบุ
 * โปรเจกต์สาธิต -> seed จาก demo-seed.js (ครั้งแรก)
 * โปรเจกต์ใหม่ -> เริ่มว่างเปล่า [] (รอข้อมูลจาก Drawing Intelligence ในอนาคต)
 */
export function getProjectElements(projectId = getCurrentProjectId()) {
  const key = `${STORAGE_KEY_ELEMENTS_PREFIX}__${projectId}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('[project-store] failed to load drawing elements', e);
  }

  let data = { elements: [], beamLibraryById: {} };
  if (projectId === DEMO_PROJECT_ID) {
    const demo = getDemoProject();
    const beamLibraryById = {};
    Object.values(demo.beam_library).forEach(lib => { beamLibraryById[lib.id] = lib; });
    data = { elements: Object.values(demo.drawing_elements), beamLibraryById };
  }
  localStorage.setItem(key, JSON.stringify(data));
  return data;
}
