// BBS — Bar Bending Schedule view (ตารางตัด-ดัดเหล็ก)
//
// อ่าน bbs_items ที่ computeBBS() ใน js/shared/pipeline.js คำนวณไว้ (project-scoped localStorage)
// ถ้ายังไม่เคยกด Calculate Project และเป็นโปรเจกต์สาธิต -> fallback ไปใช้ข้อมูลตัวอย่างจาก demo-seed.js
// ห้ามสร้าง object เอง — ใช้ bbs_items ตามที่ createBBSItem() (schema.js) ประกาศไว้เท่านั้น

import { getDemoProject } from '../shared/demo-seed.js';
import {
  getCurrentProjectId,
  getCurrentProject,
  DEMO_PROJECT_ID,
  projectStorageKey,
  PROJECT_EVENT,
} from '../shared/project-store.js';
import { STORAGE_KEYS, PIPELINE_EVENT } from '../shared/pipeline.js';

// รหัสรูปดัดตาม วสท. (BS 8666 / มยผ.) — แสดงคู่กับ shape_code
const SHAPE_LABEL = {
  '00': 'ตรง',
  '11': 'ดัดปลาย (L)',
  '21': 'ตัวยู (U)',
  '37': 'ปลอกเปิด',
  '38': 'ปลอกปิด',
};

// ─────────────────────────────────────────────
// Data loading (pipeline output -> demo-seed fallback -> empty)
// ─────────────────────────────────────────────

function loadBBS(projectId) {
  try {
    const raw = localStorage.getItem(projectStorageKey(STORAGE_KEYS.bbs));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('[bbs] failed to load', e);
  }
  if (projectId === DEMO_PROJECT_ID) return Object.values(getDemoProject().bbs_items);
  return [];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatNum(n, digits = 2) {
  return (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function barSize(item) {
  return `${item.bar_type || 'DB'}${item.diameter_mm ?? ''}`;
}

function shapeCell(item) {
  const label = SHAPE_LABEL[item.shape_code] || '';
  return label ? `${item.shape_code} · ${label}` : (item.shape_code || '-');
}

// ─────────────────────────────────────────────
// Compute
// ─────────────────────────────────────────────

// สรุปน้ำหนักเหล็กแยกตามขนาด (bar schedule summary) — ใช้สั่งซื้อเหล็กเป็นเส้น/มัด
function computeWeightByDiameter(bbs) {
  const map = {};
  bbs.forEach(b => {
    const key = barSize(b);
    if (!map[key]) map[key] = { size: key, grade: b.steel_grade, totalLengthM: 0, totalWeightKg: 0, totalBars: 0 };
    map[key].totalLengthM += b.total_length_m || 0;
    map[key].totalWeightKg += b.total_weight_kg || 0;
    map[key].totalBars += b.total_bars || 0;
  });
  return Object.values(map).sort((a, b) => (parseFloat(b.size.replace(/\D/g, '')) || 0) - (parseFloat(a.size.replace(/\D/g, '')) || 0));
}

function groupByMember(bbs) {
  const groups = {};
  bbs.forEach(b => {
    const key = b.member_id || '(ไม่ระบุ)';
    (groups[key] = groups[key] || []).push(b);
  });
  return Object.entries(groups)
    .map(([member, items]) => ({ member, items }))
    .sort((a, b) => a.member.localeCompare(b.member, 'th'));
}

// ─────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────

function render() {
  const root = document.getElementById('bbs-app');
  if (!root) return;

  const project = getCurrentProject();
  const projectId = getCurrentProjectId();
  const bbs = loadBBS(projectId);

  const totalBars = bbs.reduce((s, b) => s + (b.total_bars || 0), 0);
  const totalWeight = bbs.reduce((s, b) => s + (b.total_weight_kg || 0), 0);
  const totalLength = bbs.reduce((s, b) => s + (b.total_length_m || 0), 0);
  const byDiameter = computeWeightByDiameter(bbs);
  const memberGroups = groupByMember(bbs);

  root.innerHTML = `
    <div class="fp-header">
      <h1>🔩 BBS — Bar Bending Schedule</h1>
      <p>${escapeHtml(project?.name || 'โปรเจกต์')} — ตารางตัด-ดัดเหล็กเสริม (ส่งโรงงานตัดดัดตาม material_order_date)</p>
      <div class="fp-summary">
        <span class="fp-pill" style="background:#2563EB22;color:#2563EB">📋 ${bbs.length} รายการ</span>
        <span class="fp-pill" style="background:#9333EA22;color:#9333EA">🔩 ${totalBars.toLocaleString('th-TH')} เส้น</span>
        <span class="fp-pill" style="background:#16A34A22;color:#16A34A">⚖️ ${formatNum(totalWeight, 1)} kg</span>
        <span class="fp-pill" style="background:#D9770622;color:#D97706">📏 ${formatNum(totalLength, 1)} m</span>
      </div>
    </div>

    ${bbs.length === 0 ? `
      <div class="fp-card">
        <p class="fp-empty">ยังไม่มี BBS — กด "🚀 Calculate Project" เพื่อสร้างตารางตัด-ดัดเหล็กจากแบบ</p>
      </div>
    ` : `
      <div class="fp-card">
        <h2>สรุปน้ำหนักเหล็กตามขนาด (สำหรับสั่งซื้อ)</h2>
        <table class="ov-table">
          <thead>
            <tr>
              <th>ขนาดเหล็ก</th>
              <th>ชั้นคุณภาพ</th>
              <th class="ov-num">รวมเส้น</th>
              <th class="ov-num">ความยาวรวม (m)</th>
              <th class="ov-num">น้ำหนักรวม (kg)</th>
            </tr>
          </thead>
          <tbody>
            ${byDiameter.map(d => `
              <tr>
                <td><strong>${escapeHtml(d.size)}</strong></td>
                <td>${escapeHtml(d.grade || '-')}</td>
                <td class="ov-num">${d.totalBars.toLocaleString('th-TH')}</td>
                <td class="ov-num">${formatNum(d.totalLengthM, 1)}</td>
                <td class="ov-num">${formatNum(d.totalWeightKg, 1)}</td>
              </tr>
            `).join('')}
            <tr style="font-weight:700;border-top:2px solid var(--color-border-default)">
              <td>รวมทั้งหมด</td>
              <td></td>
              <td class="ov-num">${totalBars.toLocaleString('th-TH')}</td>
              <td class="ov-num">${formatNum(totalLength, 1)}</td>
              <td class="ov-num">${formatNum(totalWeight, 1)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="fp-card">
        <h2>รายละเอียดการตัด-ดัด แยกตามชิ้นส่วน</h2>
        ${memberGroups.map(renderMemberTable).join('')}
      </div>
    `}
  `;
}

function renderMemberTable(group) {
  const memberWeight = group.items.reduce((s, b) => s + (b.total_weight_kg || 0), 0);
  return `
    <div class="bbs-group">
      <h3 class="bbs-group__title">ชิ้นส่วน ${escapeHtml(group.member)} <span class="bbs-group__sub">(${group.items.length} mark · ${formatNum(memberWeight, 1)} kg)</span></h3>
      <table class="ov-table">
        <thead>
          <tr>
            <th>Mark</th>
            <th>ขนาด</th>
            <th>ชั้นคุณภาพ</th>
            <th>รูปดัด</th>
            <th class="ov-num">Cut length (mm)</th>
            <th class="ov-num">ชิ้น</th>
            <th class="ov-num">เส้น/ชิ้น</th>
            <th class="ov-num">รวมเส้น</th>
            <th class="ov-num">น้ำหนัก (kg)</th>
          </tr>
        </thead>
        <tbody>
          ${group.items.map(b => `
            <tr>
              <td><strong>${escapeHtml(b.bar_mark || '-')}</strong></td>
              <td>${escapeHtml(barSize(b))}</td>
              <td>${escapeHtml(b.steel_grade || '-')}</td>
              <td>${escapeHtml(shapeCell(b))}</td>
              <td class="ov-num">${formatNum(b.cut_length_mm, 0)}</td>
              <td class="ov-num">${(b.num_members ?? 0).toLocaleString('th-TH')}</td>
              <td class="ov-num">${(b.bars_per_member ?? 0).toLocaleString('th-TH')}</td>
              <td class="ov-num">${(b.total_bars ?? 0).toLocaleString('th-TH')}</td>
              <td class="ov-num">${formatNum(b.total_weight_kg, 1)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Wiring
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', render);

window.addEventListener(PIPELINE_EVENT, (e) => {
  // ใช้ bbs จาก event ถ้ามี (full-run) ไม่งั้นโหลดจาก localStorage
  render();
});

window.addEventListener(PROJECT_EVENT, render);
