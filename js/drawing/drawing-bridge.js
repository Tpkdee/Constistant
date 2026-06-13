/**
 * drawing-bridge.js — แปลงผลลัพธ์ Drawing Intelligence (globalThis.qt_elementsData)
 * เป็น schema entities (beam_library + drawing_elements) แล้วบันทึกผ่าน project-store.js
 * เพื่อให้ getProjectElements() / runPipeline() ใช้ผลจากการอ่านแบบจริงได้
 * (ปิด TODO ใน pipeline.js — "ถ้า Drawing Intelligence ผลิต schema-shaped elements...")
 *
 * รูปแบบ QT element (อ้างอิง qt_calcElement ใน drawing-calc.js):
 *   beam/column: { id, type, width(mm), height(mm), length_groups:[{length(m), qty}],
 *                  sections:[{ steel_top:{count,dia}, steel_bottom:{count,dia},
 *                              steel_extra:[{count,dia}], stirrup:{dia(mm), spacing(M!), type} }],
 *                  estimated }
 *   slab:        { id, type:'slab', width_m|width(mm), length_slab(m), thickness(mm),
 *                  steel_main:{dia, spacing(M!), type}, steel_dist:{...} }
 */

import { createBeamLibraryEntry, createDrawingElement } from '../shared/schema.js';
import { getCurrentProjectId, saveProjectElements } from '../shared/project-store.js';

// QT type string -> schema element_type
const TYPE_MAP = {
  beam: 'beam',
  girder: 'girder',
  column: 'column',
  col: 'column',
  slab: 'slab',
  footing: 'footing',
  foundation: 'footing',
  staircase: 'staircase',
  stair: 'staircase',
};

function normalizeType(qtType) {
  return TYPE_MAP[(qtType || 'beam').toLowerCase()] ?? 'beam';
}

/**
 * section ตัวแทนของ element (sections[0] หรือ field ระดับบนสุด — fallback เดียวกับ qt_calcElement)
 */
function representativeSection(el) {
  if (el.sections?.length) return el.sections[0];
  return {
    steel_top: el.steel_top,
    steel_bottom: el.steel_bottom,
    steel_extra: el.steel_extra || [],
    stirrup: el.stirrup,
  };
}

/**
 * รวมเหล็กแกนจาก section ตัวแทน: จำนวน = top+bottom+extra,
 * dia = ขนาดที่มีจำนวนเส้นมากที่สุด (เสมอกันเลือกเส้นใหญ่กว่า) — ค่าประมาณสำหรับ schema
 * ที่เก็บ main bar ได้ชุดเดียว (BOQ engine คิดน้ำหนักจาก count × dia เดียว)
 */
function aggregateMainBars(sec) {
  const groups = [sec.steel_top, sec.steel_bottom, ...(sec.steel_extra || [])]
    .filter(g => g?.count && g?.dia);
  if (!groups.length) return { count: null, dia: null };

  const count = groups.reduce((s, g) => s + g.count, 0);
  const countByDia = {};
  groups.forEach(g => { countByDia[g.dia] = (countByDia[g.dia] || 0) + g.count; });
  const dia = +Object.entries(countByDia)
    .sort((a, b) => (b[1] - a[1]) || (+b[0] - +a[0]))[0][0];
  return { count, dia };
}

function confidenceOf(el) {
  return {
    confidence_score: el.estimated ? 0.6 : 0.9,
    confidence_flags: el.estimated ? ['count_estimated'] : [],
  };
}

function buildLibraryEntry(el, projectId, drawingUploadId) {
  const type = normalizeType(el.type);
  const conf = confidenceOf(el);

  if (type === 'slab') {
    return createBeamLibraryEntry({
      id: `lib-${el.id}`,
      project_id: projectId,
      drawing_upload_id: drawingUploadId,
      element_id: el.id,
      element_type: 'slab',
      width_mm: null,
      height_mm: el.thickness || 120, // ความหนาพื้น (ตามแบบแผน demo-seed)
      main_bar_count: null,
      main_bar_dia_mm: el.steel_main?.dia ?? null,
      main_bar_type: el.steel_main?.type || 'DB',
      stirrup_dia_mm: null,
      stirrup_type: null,
      // schema ใช้ field นี้เก็บระยะเรียงเหล็กพื้น — QT spacing เป็นเมตร แปลงเป็น mm
      stirrup_spacing_mm: el.steel_main?.spacing ? el.steel_main.spacing * 1000 : 200,
      steel_grade: 'SD40',
      ...conf,
    });
  }

  const sec = representativeSection(el);
  const main = aggregateMainBars(sec);
  return createBeamLibraryEntry({
    id: `lib-${el.id}`,
    project_id: projectId,
    drawing_upload_id: drawingUploadId,
    element_id: el.id,
    element_type: type,
    width_mm: el.width || null,
    height_mm: el.height || null,
    main_bar_count: main.count,
    main_bar_dia_mm: main.dia,
    main_bar_type: 'DB',
    stirrup_dia_mm: sec.stirrup?.dia ?? null,
    stirrup_type: sec.stirrup?.type || 'RB',
    // QT เก็บ spacing เป็นเมตร (เช่น 0.15) — schema เป็น mm
    stirrup_spacing_mm: sec.stirrup?.spacing ? sec.stirrup.spacing * 1000 : null,
    steel_grade: 'SD40',
    ...conf,
  });
}

function buildDrawingElement(el, lib, projectId, drawingUploadId, floorLevel) {
  const type = normalizeType(el.type);
  const conf = confidenceOf(el);

  if (type === 'slab') {
    const widthM = el.width_m || (el.width ? el.width / 1000 : 0);
    return createDrawingElement({
      id: `elem-${el.id}-${floorLevel}`,
      project_id: projectId,
      drawing_upload_id: drawingUploadId,
      beam_library_id: lib.id,
      floor_level: floorLevel,
      floor_area_sqm: +(widthM * (el.length_slab || 0)).toFixed(2) || null,
      element_id: el.id,
      element_type: 'slab',
      count: 1,
      span_length_m: null,
      ...conf,
    });
  }

  const groups = el.length_groups?.length
    ? el.length_groups
    : [{ length: el.length || 0, qty: 1 }];
  const count = groups.reduce((s, g) => s + (g.qty || 0), 0);
  const totalLength = groups.reduce((s, g) => s + (g.length || 0) * (g.qty || 0), 0);

  return createDrawingElement({
    id: `elem-${el.id}-${floorLevel}`,
    project_id: projectId,
    drawing_upload_id: drawingUploadId,
    beam_library_id: lib.id,
    floor_level: floorLevel,
    element_id: el.id,
    element_type: type,
    count: count || null,
    span_length_m: count ? +(totalLength / count).toFixed(2) : null,
    ...conf,
  });
}

/**
 * แปลง globalThis.qt_elementsData -> beam_library + drawing_elements แล้วบันทึก
 * ลง project store (overwrite ชุดเดิมของโปรเจกต์ — 1 upload ต่อโปรเจกต์ใน cycle นี้)
 *
 * @param {string} [projectId] — default โปรเจกต์ที่เลือกอยู่
 * @param {{ floorLevel?: string, drawingUploadId?: string|null }} [options]
 * @returns {{ beamLibrary: object[], elements: object[] }}
 */
export function qt_saveExtractionToProject(projectId = getCurrentProjectId(), options = {}) {
  const { floorLevel = 'F1', drawingUploadId = null } = options;
  const qtElements = globalThis.qt_elementsData || [];
  if (!qtElements.length) {
    throw new Error('ไม่มีผลการอ่านแบบ (qt_elementsData ว่าง) — รัน Drawing Intelligence ก่อน');
  }

  const beamLibrary = [];
  const elements = [];
  const beamLibraryById = {};
  const seenIds = new Set();

  qtElements.forEach((el, idx) => {
    const qtId = el.id || `EL${idx + 1}`;
    if (seenIds.has(qtId)) return; // 1 entry ต่อ element id
    seenIds.add(qtId);

    const lib = buildLibraryEntry({ ...el, id: qtId }, projectId, drawingUploadId);
    beamLibrary.push(lib);
    beamLibraryById[lib.id] = lib;
    elements.push(buildDrawingElement({ ...el, id: qtId }, lib, projectId, drawingUploadId, floorLevel));
  });

  saveProjectElements(projectId, elements, beamLibraryById);
  return { beamLibrary, elements };
}

window.qt_saveExtractionToProject = qt_saveExtractionToProject;
globalThis.qt_saveExtractionToProject = qt_saveExtractionToProject;
