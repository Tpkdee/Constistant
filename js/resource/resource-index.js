// Resource Hub — manpower / material / equipment list with cost roll-up
//
// ทำงานแบบ standalone (localStorage) ก่อน ค่อยสลับไปต่อ Supabase ทีหลัง
// โครงสร้าง object ของแต่ละรายการ = createResourceItem() จาก ../shared/schema.js
// ห้ามสร้าง object เองตรงๆ — ใช้ factory function เสมอ ตามกติกาของ schema.js

import { createResourceItem } from '../shared/schema.js';
import { getDemoDataByEngine } from '../shared/demo-seed.js';
import { projectStorageKey, getCurrentProjectId, DEMO_PROJECT_ID, PROJECT_EVENT } from '../shared/project-store.js';

const STORAGE_KEY = 'constistant_resource_items_v1';

const RESOURCE_TYPES = [
  { value: 'manpower', label: '👷 แรงงาน', icon: '👷', defaultUnit: 'person-day' },
  { value: 'material', label: '🧱 วัสดุ', icon: '🧱', defaultUnit: 'kg' },
  { value: 'equipment', label: '🚜 เครื่องจักร', icon: '🚜', defaultUnit: 'day' },
];

let items = [];

function loadItems() {
  try {
    const raw = localStorage.getItem(projectStorageKey(STORAGE_KEY));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('[resource] failed to load from localStorage', e);
  }
  return seedItems();
}

// ค่าเริ่มต้น: เฉพาะโปรเจกต์สาธิต ดึงจาก demo-seed.js
// (โปรเจกต์ใหม่ที่ผู้ใช้สร้างเองเริ่มต้นแบบว่างเปล่า)
function seedItems() {
  if (getCurrentProjectId() !== DEMO_PROJECT_ID) {
    saveItems([]);
    return [];
  }
  const { expected_resources } = getDemoDataByEngine('resource');
  const seed = expected_resources.map(r => createResourceItem({ ...r }));
  saveItems(seed);
  return seed;
}

function saveItems(list) {
  localStorage.setItem(projectStorageKey(STORAGE_KEY), JSON.stringify(list));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatTHB(n) {
  return (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function typeMeta(type) {
  return RESOURCE_TYPES.find(t => t.value === type) || { icon: '📦', label: type };
}

function render() {
  const root = document.getElementById('resource-app');
  if (!root) return;

  const totals = { manpower: 0, material: 0, equipment: 0 };
  let grandTotal = 0;
  items.forEach(i => {
    const cost = i.total_cost_thb ?? 0;
    totals[i.resource_type] = (totals[i.resource_type] || 0) + cost;
    grandTotal += cost;
  });

  root.innerHTML = `
    <div class="fp-header">
      <h1>👥 Resource Hub</h1>
      <p>จัดการแรงงาน วัสดุ และเครื่องจักร พร้อมสรุปต้นทุนรวม</p>
      <div class="fp-summary">
        <span class="fp-pill" style="background:#3b82f622;color:#3b82f6">👷 แรงงาน ฿${formatTHB(totals.manpower)}</span>
        <span class="fp-pill" style="background:#f59e0b22;color:#f59e0b">🧱 วัสดุ ฿${formatTHB(totals.material)}</span>
        <span class="fp-pill" style="background:#8b5cf622;color:#8b5cf6">🚜 เครื่องจักร ฿${formatTHB(totals.equipment)}</span>
        <span class="fp-pill" style="background:#10b98122;color:#10b981">รวมทั้งหมด ฿${formatTHB(grandTotal)}</span>
      </div>
    </div>

    <div class="fp-card">
      <h2>เพิ่มรายการทรัพยากร</h2>
      <div class="fp-form-grid">
        <label>ประเภท
          <select id="rh-input-type">
            ${RESOURCE_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
          </select>
        </label>
        <label>ชื่อรายการ
          <input type="text" id="rh-input-name" placeholder="เช่น ช่างปูน, ปูนซีเมนต์" />
        </label>
        <label>หน่วย
          <input type="text" id="rh-input-unit" placeholder="person-day, kg, m3, day" />
        </label>
        <label>จำนวน
          <input type="number" id="rh-input-quantity" min="0" step="any" placeholder="0" />
        </label>
        <label>ราคาต่อหน่วย (บาท)
          <input type="number" id="rh-input-unit-cost" min="0" step="any" placeholder="0.00" />
        </label>
      </div>
      <button class="fp-btn-primary" onclick="rh_addItem()">+ เพิ่มรายการ</button>
    </div>

    <div class="fp-card">
      <h2>รายการทรัพยากรทั้งหมด</h2>
      ${items.length === 0 ? '<p class="fp-empty">ยังไม่มีรายการทรัพยากร</p>' : `
      <table class="rh-table">
        <thead>
          <tr>
            <th>ประเภท</th>
            <th>ชื่อรายการ</th>
            <th>หน่วย</th>
            <th class="rh-num">จำนวน</th>
            <th class="rh-num">ราคา/หน่วย</th>
            <th class="rh-num">รวม (บาท)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${items.map(renderItemRow).join('')}
        </tbody>
        <tfoot>
          <tr class="rh-total-row">
            <td colspan="5">รวมทั้งหมด</td>
            <td class="rh-num">฿${formatTHB(grandTotal)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      `}
    </div>
  `;
}

function renderItemRow(item) {
  const meta = typeMeta(item.resource_type);
  return `
    <tr>
      <td>${meta.icon} ${escapeHtml(item.resource_type)}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.unit)}</td>
      <td class="rh-num">${item.quantity ?? 0}</td>
      <td class="rh-num">฿${formatTHB(item.unit_cost_thb)}</td>
      <td class="rh-num">฿${formatTHB(item.total_cost_thb)}</td>
      <td><button class="rh-delete" onclick="rh_deleteItem('${item.id}')" title="ลบรายการ">✕</button></td>
    </tr>
  `;
}

export function rh_addItem() {
  const nameInput = document.getElementById('rh-input-name');
  const name = nameInput.value.trim();
  if (!name) {
    alert('กรุณากรอกชื่อรายการ');
    return;
  }
  const quantity = parseFloat(document.getElementById('rh-input-quantity').value) || 0;
  const unitCost = parseFloat(document.getElementById('rh-input-unit-cost').value) || 0;

  const item = createResourceItem({
    id: crypto.randomUUID(),
    resource_type: document.getElementById('rh-input-type').value,
    name,
    unit: document.getElementById('rh-input-unit').value.trim(),
    quantity,
    unit_cost_thb: unitCost,
    total_cost_thb: quantity * unitCost,
    created_at: new Date().toISOString(),
  });
  items.unshift(item);
  saveItems(items);
  render();
}

export function rh_deleteItem(id) {
  items = items.filter(i => i.id !== id);
  saveItems(items);
  render();
}

// expose ให้ inline onclick="" ใน HTML เรียกได้
window.rh_addItem = rh_addItem;
window.rh_deleteItem = rh_deleteItem;

document.addEventListener('DOMContentLoaded', () => {
  items = loadItems();
  render();
});

// เมื่อ pipeline (ปุ่ม Calculate Project) คำนวณเสร็จ ให้โหลดผลลัพธ์ใหม่จาก localStorage มาแสดง
window.addEventListener('constistant:pipeline-updated', (e) => {
  items = e.detail?.resources ?? loadItems();
  render();
});

// เมื่อสลับโปรเจกต์ ให้โหลด/seed ข้อมูลของโปรเจกต์ที่เลือกใหม่
window.addEventListener(PROJECT_EVENT, () => {
  items = loadItems();
  render();
});
