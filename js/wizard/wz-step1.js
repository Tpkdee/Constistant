// wz-step1.js — Onboarding Wizard Step 1: upload + classify drawing sheets
//
// Reuses the existing Drawing Intelligence helpers (qt_extractPdfPages, qt_callGeminiParts,
// qt_normalizeGeminiResponse, qt_saveExtractionToProject) so the wizard's extraction stays
// in sync with the standalone QT flow.

import { qt_extractPdfPages } from '../drawing/drawing-upload.js';
import { qt_callGeminiParts, qt_classifySheet, qt_getMime } from '../drawing/drawing-gemini.js';
import { qt_normalizeGeminiResponse } from '../drawing/drawing-parser.js';
import { qt_saveExtractionToProject } from '../drawing/drawing-bridge.js';
import { createDrawingUpload } from '../shared/schema.js';
import { getCurrentProjectId, projectStorageKey, selectProject, DEMO_PROJECT_ID } from '../shared/project-store.js';
import { wz_ensureConfig, wz_saveConfig, wz_goToStep } from './wz-index.js';

const API_KEY_STORAGE = 'constistant_gemini_api_key_v1';
const UPLOADS_KEY = 'constistant_drawing_uploads_v1';

const SHEET_TYPE_LABEL = {
  floor_plan: 'ผังพื้น',
  section_detail: 'รายละเอียดหน้าตัด',
  general_notes: 'หมายเหตุทั่วไป',
  schedule_table: 'ตารางตาราง element',
  unknown: 'ไม่ทราบประเภท',
};

const step1 = {
  file: null,
  pages: [],          // data URLs (full res)
  thumbs: [],         // data URLs (low res, for display)
  classifications: [], // [{ sheet_type, confidence }]
  busy: false,
  extracted: false,
};

export function wz_renderStep1(root) {
  root.innerHTML = `
    <div class="wz-step">
      <h2 class="wz-step__title">ขั้นตอนที่ 1 — อัปโหลดแบบก่อสร้าง</h2>
      <p class="wz-step__desc">อัปโหลดไฟล์ PDF หรือรูปแบบก่อสร้าง (ผังพื้น/รายละเอียดหน้าตัด) ระบบจะวิเคราะห์ประเภทของแต่ละหน้าให้อัตโนมัติ</p>

      <div class="wz-panel">
        <label class="wz-field">
          <span>Gemini API Key</span>
          <input type="password" id="wz-api-key" class="wz-input" placeholder="AIza..." autocomplete="off" spellcheck="false">
        </label>
      </div>

      <div class="wz-dropzone" id="wz-dropzone">
        <input type="file" id="wz-file-input" accept=".pdf,image/*" hidden>
        <div class="wz-dropzone__icon">📄</div>
        <div class="wz-dropzone__text">ลากไฟล์มาวาง หรือ <span class="wz-link">เลือกไฟล์</span></div>
        <div class="wz-dropzone__filename" id="wz-filename"></div>
      </div>

      <div class="wz-thumb-grid" id="wz-thumb-grid"></div>

      <div class="wz-status" id="wz-step1-status"></div>

      <div class="wz-banner wz-banner--info" id="wz-low-confidence-banner" hidden>
        ⚠️ ระบบไม่สามารถระบุประเภทหน้าได้แม่นยำ — คุณสามารถ
        <button type="button" class="wz-link-btn" id="wz-manual-link">กรอกข้อมูลปริมาณงานเอง</button>
        แทนได้
      </div>

      <div class="wz-actions">
        <button type="button" class="fp-btn-secondary" id="wz-use-demo">ใช้โปรเจกต์ตัวอย่าง</button>
        <div class="wz-actions__spacer"></div>
        <button type="button" class="fp-btn-secondary" id="wz-skip-manual">กรอกข้อมูลเอง</button>
        <button type="button" class="fp-btn-primary" id="wz-step1-next" disabled>วิเคราะห์และดึงข้อมูล</button>
      </div>
    </div>
  `;

  const apiKeyInput = root.querySelector('#wz-api-key');
  apiKeyInput.value = globalThis.qt_API_KEY || localStorage.getItem(API_KEY_STORAGE) || '';
  apiKeyInput.addEventListener('input', () => {
    globalThis.qt_API_KEY = apiKeyInput.value.trim();
    localStorage.setItem(API_KEY_STORAGE, apiKeyInput.value.trim());
  });

  const dropzone = root.querySelector('#wz-dropzone');
  const fileInput = root.querySelector('#wz-file-input');
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('wz-dropzone--over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('wz-dropzone--over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('wz-dropzone--over');
    const file = e.dataTransfer.files?.[0];
    if (file) wz_step1_handleFile(file, root);
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) wz_step1_handleFile(file, root);
  });

  root.querySelector('#wz-use-demo').addEventListener('click', () => {
    selectProject(DEMO_PROJECT_ID);
  });
  root.querySelector('#wz-skip-manual').addEventListener('click', () => {
    sessionStorage.setItem('wz_manual_mode', '1');
    wz_goToStep(2);
  });
  root.querySelector('#wz-manual-link')?.addEventListener('click', () => {
    sessionStorage.setItem('wz_manual_mode', '1');
    wz_goToStep(2);
  });
  root.querySelector('#wz-step1-next').addEventListener('click', () => wz_step1_runExtraction(root));

  if (step1.thumbs.length) wz_step1_renderThumbs(root);
}

async function wz_step1_handleFile(file, root) {
  const status = root.querySelector('#wz-step1-status');
  root.querySelector('#wz-filename').textContent = file.name;
  step1.file = file;
  step1.pages = [];
  step1.thumbs = [];
  step1.classifications = [];
  step1.extracted = false;
  root.querySelector('#wz-step1-next').disabled = true;

  const key = (globalThis.qt_API_KEY || '').trim();
  if (!key) {
    status.textContent = '⚠️ กรุณากรอก Gemini API Key ก่อนอัปโหลดไฟล์';
    return;
  }

  status.textContent = 'กำลังเตรียมหน้าแบบ…';
  try {
    if (file.type === 'application/pdf') {
      step1.pages = await qt_extractPdfPages(file, 1.2);
      step1.thumbs = step1.pages.length > 1 ? await qt_extractPdfPages(file, 0.5) : step1.pages;
    } else {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      step1.pages = [dataUrl];
      step1.thumbs = [dataUrl];
    }
  } catch (e) {
    status.textContent = `❌ อ่านไฟล์ไม่สำเร็จ: ${e.message}`;
    return;
  }

  step1.classifications = step1.pages.map(() => null);
  wz_step1_renderThumbs(root);

  for (let i = 0; i < step1.pages.length; i++) {
    status.textContent = `กำลังวิเคราะห์หน้า ${i + 1}/${step1.pages.length}…`;
    try {
      step1.classifications[i] = await qt_classifySheet(key, step1.pages[i]);
    } catch (e) {
      step1.classifications[i] = { sheet_type: 'unknown', confidence: 0 };
    }
    wz_step1_renderThumbs(root);
  }

  status.textContent = `วิเคราะห์เสร็จสิ้น — พบ ${step1.pages.length} หน้า`;
  root.querySelector('#wz-step1-next').disabled = false;

  const usable = step1.classifications.filter(c => c?.sheet_type === 'section_detail' || c?.sheet_type === 'floor_plan');
  const banner = root.querySelector('#wz-low-confidence-banner');
  if (banner) banner.hidden = usable.length > 0;
}

function wz_step1_renderThumbs(root) {
  const grid = root.querySelector('#wz-thumb-grid');
  grid.innerHTML = step1.thumbs.map((src, i) => {
    const cls = step1.classifications[i];
    let badge = '<span class="wz-badge wz-badge--pending">กำลังวิเคราะห์…</span>';
    if (cls) {
      const pct = Math.round((cls.confidence || 0) * 100);
      const tone = cls.confidence >= 0.7 ? 'green' : cls.confidence >= 0.4 ? 'amber' : 'red';
      badge = `<span class="wz-badge wz-badge--${tone}">${SHEET_TYPE_LABEL[cls.sheet_type] || cls.sheet_type} · ${pct}%</span>`;
    }
    return `
      <div class="wz-thumb">
        <img src="${src}" alt="page ${i + 1}">
        <div class="wz-thumb__caption">หน้า ${i + 1}</div>
        ${badge}
      </div>
    `;
  }).join('');
}

async function wz_step1_runExtraction(root) {
  if (step1.busy) return;
  const status = root.querySelector('#wz-step1-status');
  const key = (globalThis.qt_API_KEY || '').trim();
  if (!key) { status.textContent = '⚠️ กรุณากรอก Gemini API Key'; return; }
  if (!step1.pages.length) { status.textContent = '⚠️ กรุณาอัปโหลดไฟล์ก่อน'; return; }

  step1.busy = true;
  root.querySelector('#wz-step1-next').disabled = true;
  status.textContent = 'กำลังดึงข้อมูลปริมาณงานจากแบบ…';

  try {
    const sectionIdxs = step1.classifications
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c?.sheet_type === 'section_detail');
    const floorPlanIdxs = step1.classifications
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c?.sheet_type === 'floor_plan');
    const targetIdxs = (sectionIdxs.length ? sectionIdxs : (floorPlanIdxs.length ? floorPlanIdxs : step1.pages.map((_, i) => ({ i }))))
      .map(({ i }) => i);

    const parts = targetIdxs.map(i => ({
      inline_data: { mime_type: qt_getMime(step1.file), data: step1.pages[i].split(',')[1] },
    }));

    const prompt = `You are a structural engineer reading STRUCTURAL DRAWINGS.\nELEMENT TYPES TO FIND: beam, column, girder, slab, footing, staircase\nExtract ALL structural elements shown in the drawing, with dimensions, rebar, and counts where visible.`;
    const raw = await qt_callGeminiParts(key, prompt, parts);
    const normalized = qt_normalizeGeminiResponse(raw);
    const elements = normalized.elements || [];
    if (!elements.length) throw new Error('ไม่พบ element ในแบบ — ลองอัปโหลดรูปที่ชัดกว่านี้ หรือกรอกข้อมูลเอง');

    globalThis.qt_elementsData = elements.map(e => ({ ...e }));
    const projectId = getCurrentProjectId();
    qt_saveExtractionToProject(projectId, { floorLevel: 'F1' });

    const uploads = step1.pages.map((_, i) => createDrawingUpload({
      id: crypto.randomUUID(),
      project_id: projectId,
      file_name: step1.file?.name || `page-${i + 1}`,
      drawing_type: step1.classifications[i]?.sheet_type === 'floor_plan' ? 'floor_plan' : 'section_detail',
      page_count: 1,
      extraction_status: targetIdxs.includes(i) ? 'done' : 'pending',
      sheet_type: step1.classifications[i]?.sheet_type ?? 'unknown',
      sheet_confidence: step1.classifications[i]?.confidence ?? null,
      created_at: new Date().toISOString(),
    }));
    localStorage.setItem(projectStorageKey(UPLOADS_KEY, projectId), JSON.stringify(uploads));

    const config = wz_ensureConfig(projectId);
    config.wizard_step_reached = Math.max(config.wizard_step_reached || 1, 2);
    wz_saveConfig(config, projectId);

    step1.extracted = true;
    status.textContent = `✅ สำเร็จ — พบ ${elements.length} element`;
    wz_goToStep(2);
  } catch (e) {
    status.textContent = `❌ ${e.message}`;
  } finally {
    step1.busy = false;
    root.querySelector('#wz-step1-next').disabled = false;
  }
}
