// wz-manual-fallback.js — Onboarding Wizard manual element-count entry table
//
// Used by wz-step2.js when Drawing Intelligence extraction found zero elements
// (or the user opted to skip extraction). Builds drawing_elements + a matching
// beam_library entry (using reasonable defaults per element_type) so the pipeline
// can still compute a BOQ/schedule estimate.

import { createDrawingElement, createBeamLibraryEntry } from '../shared/schema.js';
import { getCurrentProjectId, getProjectElements, saveProjectElements } from '../shared/project-store.js';

const ELEMENT_TYPE_LABEL = {
  column: 'เสา',
  beam: 'คาน',
  slab: 'พื้น',
  footing: 'ฐานราก',
  staircase: 'บันได',
};

// reasonable default cross-sections so computeBOQ/computeSchedule can run from manual counts
const DEFAULT_LIBRARY = {
  column: { width_mm: 300, height_mm: 300, main_bar_count: 8, main_bar_dia_mm: 16, stirrup_dia_mm: 6, stirrup_type: 'RB', stirrup_spacing_mm: 150 },
  beam: { width_mm: 200, height_mm: 400, main_bar_count: 4, main_bar_dia_mm: 16, stirrup_dia_mm: 6, stirrup_type: 'RB', stirrup_spacing_mm: 150 },
  slab: { width_mm: null, height_mm: 120, main_bar_count: null, main_bar_dia_mm: 10, stirrup_dia_mm: null, stirrup_type: null, stirrup_spacing_mm: 200 },
  footing: { width_mm: 1200, height_mm: 500, main_bar_count: 10, main_bar_dia_mm: 16, stirrup_dia_mm: 9, stirrup_type: 'RB', stirrup_spacing_mm: 200 },
  staircase: { width_mm: 1000, height_mm: 150, main_bar_count: 6, main_bar_dia_mm: 12, stirrup_dia_mm: null, stirrup_type: null, stirrup_spacing_mm: 150 },
};

let manualRows = [{ element_type: 'column', count: 1, floor_level: 'F1', notes: '' }];

export function wz_renderManualFallback(container) {
  container.innerHTML = `
    <div class="wz-panel">
      <h3 class="wz-panel__title">กรอกปริมาณงานเอง</h3>
      <p class="wz-panel__desc">ระบุประเภทและจำนวน element โดยประมาณ — ระบบจะใช้ค่าหน้าตัด/เหล็กเสริมมาตรฐานเพื่อประมาณ BOQ และแผนงานเบื้องต้น</p>
      <table class="wz-table">
        <thead>
          <tr><th>ประเภทงาน</th><th>ชั้น</th><th>จำนวน</th><th>หมายเหตุ</th><th></th></tr>
        </thead>
        <tbody id="wz-manual-rows"></tbody>
      </table>
      <button type="button" class="fp-btn-secondary" id="wz-manual-add">+ เพิ่มแถว</button>
    </div>
  `;
  wz_renderRows(container);
  container.querySelector('#wz-manual-add').addEventListener('click', () => {
    manualRows.push({ element_type: 'column', count: 1, floor_level: 'F1', notes: '' });
    wz_renderRows(container);
  });
}

function wz_renderRows(container) {
  const tbody = container.querySelector('#wz-manual-rows');
  tbody.innerHTML = manualRows.map((row, i) => `
    <tr>
      <td>
        <select class="wz-input" data-field="element_type" data-row="${i}">
          ${Object.entries(ELEMENT_TYPE_LABEL).map(([type, label]) =>
            `<option value="${type}" ${row.element_type === type ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </td>
      <td><input class="wz-input wz-input--narrow" data-field="floor_level" data-row="${i}" value="${row.floor_level}"></td>
      <td><input type="number" min="0" class="wz-input wz-input--narrow" data-field="count" data-row="${i}" value="${row.count}"></td>
      <td><input class="wz-input" data-field="notes" data-row="${i}" value="${row.notes}" placeholder="เช่น ขนาดหน้าตัด, เกรดเหล็ก"></td>
      <td><button type="button" class="wz-icon-btn" data-remove="${i}" title="ลบแถว">✕</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('input', (e) => {
      const row = +e.target.dataset.row;
      const field = e.target.dataset.field;
      manualRows[row][field] = field === 'count' ? Math.max(0, parseInt(e.target.value, 10) || 0) : e.target.value;
    });
  });
  tbody.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      manualRows.splice(+btn.dataset.remove, 1);
      if (!manualRows.length) manualRows.push({ element_type: 'column', count: 1, floor_level: 'F1', notes: '' });
      wz_renderRows(container);
    });
  });
}

export function wz_saveManualEntries() {
  const projectId = getCurrentProjectId();
  const { elements: existingElements, beamLibraryById: existingLibrary } = getProjectElements(projectId);

  const elements = [...existingElements];
  const beamLibraryById = { ...existingLibrary };

  manualRows.filter(r => r.count > 0).forEach((row, idx) => {
    const elementId = `MANUAL-${row.element_type.toUpperCase()}-${idx + 1}`;
    const lib = createBeamLibraryEntry({
      id: `lib-${elementId}`,
      project_id: projectId,
      element_id: elementId,
      element_type: row.element_type,
      steel_grade: 'SD40',
      concrete_grade: 'M240',
      confidence_score: 1.0,
      ...DEFAULT_LIBRARY[row.element_type],
    });
    beamLibraryById[lib.id] = lib;

    elements.push(createDrawingElement({
      id: `elem-${elementId}-${row.floor_level}`,
      project_id: projectId,
      beam_library_id: lib.id,
      floor_level: row.floor_level || 'F1',
      element_id: elementId,
      element_type: row.element_type,
      count: row.count,
      confidence_score: 1.0,
      confidence_flags: [],
      source: 'manual',
      user_verified: true,
      manual_override_note: row.notes || null,
      created_at: new Date().toISOString(),
    }));
  });

  saveProjectElements(projectId, elements, beamLibraryById);
  return { elements, beamLibraryById };
}
