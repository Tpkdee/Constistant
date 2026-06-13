// Material Price Catalog — user-level price list (Supabase table: material_prices)
//
// Demo mode (no Supabase session): prices live in localStorage, seeded from
// DEMO_MATERIAL_PRICES below, so the page is fully usable without login.
// Logged-in mode: reads/writes Supabase `material_prices` (RLS scoped to auth.uid()).
//
// ห้ามสร้างชื่อ field ใหม่สำหรับ material_prices — ใช้ตามตารางใน database/material_prices.sql เท่านั้น

import { CATALOG_PACKS } from './catalog-seed.js';
import { parseCSV, exportToCSV, downloadCSV } from './csv-utils.js';
import { getEffectivePrice, getPriceSourceInfo } from '../shared/price-config.js';
import { uploadPriceFile, confirmAndSaveParsedPrices } from './price-file-parser.js';

const DEMO_STORAGE_KEY = 'constistant_demo_material_prices_v1';
const TABLE = 'material_prices';

export const MATERIAL_TYPES = [
  { value: 'concrete', label: 'คอนกรีต' },
  { value: 'rebar', label: 'เหล็ก' },
  { value: 'formwork', label: 'แบบหล่อ' },
  { value: 'masonry', label: 'ก่ออิฐ' },
  { value: 'finishing', label: 'งานตกแต่ง' },
  { value: 'mep', label: 'ระบบ' },
];

export const UNITS = ['m3', 'kg', 'ton', 'm2', 'piece', 'set'];

const CSV_COLUMNS = [
  'material_type', 'material_subtype', 'brand', 'trade_name', 'unit',
  'unit_price', 'price_date', 'supplier_name', 'notes', 'catalog_source',
];

// ─────────────────────────────────────────────
// Demo seed data (10–15 rows, covers concrete/rebar/formwork + others)
// ─────────────────────────────────────────────

const DEMO_MATERIAL_PRICES = [
  { id: 'demo-1', material_type: 'concrete', material_subtype: 'ready_mix_concrete', brand: 'SCG', trade_name: 'คอนกรีตผสมเสร็จ fc=240 ksc', unit: 'm3', unit_price: 2200, price_date: '2025-11-01', supplier_name: 'ปูนซิเมนต์ไทย จำกัด', notes: '', catalog_source: 'manual', is_active: true },
  { id: 'demo-2', material_type: 'concrete', material_subtype: 'ready_mix_concrete', brand: 'SCG', trade_name: 'คอนกรีตผสมเสร็จ fc=240 ksc', unit: 'm3', unit_price: 2250, price_date: '2026-01-15', supplier_name: 'ปูนซิเมนต์ไทย จำกัด', notes: 'ราคาปรับขึ้นต้นปี', catalog_source: 'manual', is_active: true },
  { id: 'demo-3', material_type: 'concrete', material_subtype: 'ready_mix_concrete', brand: 'TPI', trade_name: 'คอนกรีตผสมเสร็จ fc=210 ksc', unit: 'm3', unit_price: 1950, price_date: '2025-12-01', supplier_name: 'TPI Concrete', notes: '', catalog_source: 'manual', is_active: true },
  { id: 'demo-4', material_type: 'rebar', material_subtype: 'deformed_bar', brand: 'Siam Steel', trade_name: 'เหล็กข้ออ้อย DB12', unit: 'kg', unit_price: 24.5, price_date: '2025-11-01', supplier_name: 'ร้านเหล็กไทย', notes: '', catalog_source: 'manual', is_active: true },
  { id: 'demo-5', material_type: 'rebar', material_subtype: 'deformed_bar', brand: 'Siam Steel', trade_name: 'เหล็กข้ออ้อย DB12', unit: 'kg', unit_price: 25.8, price_date: '2026-02-01', supplier_name: 'ร้านเหล็กไทย', notes: 'ราคาเหล็กปรับขึ้น', catalog_source: 'manual', is_active: true },
  { id: 'demo-6', material_type: 'rebar', material_subtype: 'deformed_bar', brand: 'TPI', trade_name: 'เหล็กข้ออ้อย DB16', unit: 'kg', unit_price: 25.0, price_date: '2025-12-15', supplier_name: 'TPI Steel', notes: '', catalog_source: 'manual', is_active: true },
  { id: 'demo-7', material_type: 'rebar', material_subtype: 'round_bar', brand: null, trade_name: 'เหล็กเส้นกลม RB6', unit: 'kg', unit_price: 23.0, price_date: '2025-12-01', supplier_name: 'ร้านเหล็กไทย', notes: '', catalog_source: 'manual', is_active: true },
  { id: 'demo-8', material_type: 'formwork', material_subtype: 'plywood_formwork', brand: null, trade_name: 'แบบหล่อไม้อัดยาง 15mm', unit: 'm2', unit_price: 180, price_date: '2025-11-20', supplier_name: 'ร้านวัสดุก่อสร้าง ABC', notes: '', catalog_source: 'manual', is_active: true },
  { id: 'demo-9', material_type: 'formwork', material_subtype: 'steel_formwork', brand: null, trade_name: 'แบบหล่อเหล็กระบบ', unit: 'm2', unit_price: 350, price_date: '2025-12-01', supplier_name: 'ร้านวัสดุก่อสร้าง ABC', notes: 'ค่าเช่าต่อรอบ', catalog_source: 'manual', is_active: true },
  { id: 'demo-10', material_type: 'masonry', material_subtype: 'cement_block', brand: 'Q-CON', trade_name: 'อิฐมวลเบา Q-CON หนา 7.5cm', unit: 'piece', unit_price: 28, price_date: '2025-12-10', supplier_name: 'Q-CON Showroom', notes: '', catalog_source: 'manual', is_active: true },
  { id: 'demo-11', material_type: 'masonry', material_subtype: 'clay_brick', brand: null, trade_name: 'อิฐมอญ', unit: 'piece', unit_price: 2.5, price_date: '2025-12-10', supplier_name: 'ร้านวัสดุก่อสร้าง ABC', notes: '', catalog_source: 'manual', is_active: true },
  { id: 'demo-12', material_type: 'finishing', material_subtype: 'tile', brand: 'Cotto', trade_name: 'กระเบื้องปูพื้น 60x60 ซม.', unit: 'm2', unit_price: 350, price_date: '2026-01-05', supplier_name: 'Cotto Showroom', notes: '', catalog_source: 'manual', is_active: true },
  { id: 'demo-13', material_type: 'finishing', material_subtype: 'paint', brand: 'TOA', trade_name: 'สีทาภายนอก TOA', unit: 'set', unit_price: 1450, price_date: '2026-01-10', supplier_name: 'TOA Shop', notes: 'ขนาด 5 แกลลอน', catalog_source: 'manual', is_active: true },
  { id: 'demo-14', material_type: 'mep', material_subtype: 'electrical_wire', brand: null, trade_name: 'สายไฟ THW 2.5 sq.mm', unit: 'set', unit_price: 1200, price_date: '2026-01-12', supplier_name: 'ร้านไฟฟ้า XYZ', notes: 'ม้วน 100m', catalog_source: 'manual', is_active: true },
];

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

let prices = [];
let supabaseClient = null;
let currentUserId = null;
let activeTab = 'my-prices';
let editingId = null;
let csvPreview = null; // { headers, rows }

const filters = {
  materialTypes: new Set(),
  brand: '',
  unit: '',
  search: '',
  latestOnly: false,
};

// ─────────────────────────────────────────────
// Data loading / persistence
// ─────────────────────────────────────────────

async function initSupabase() {
  try {
    const mod = await import('../../supabase.js');
    supabaseClient = mod.supabase || window.supabase || null;
  } catch {
    supabaseClient = window.supabase || null;
  }
  if (!supabaseClient) return false;

  try {
    const { data } = await supabaseClient.auth.getUser();
    currentUserId = data?.user?.id || null;
  } catch {
    currentUserId = null;
  }
  return !!currentUserId;
}

function loadDemoPrices() {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('[catalog] failed to load demo prices', e);
  }
  saveDemoPrices(DEMO_MATERIAL_PRICES);
  return DEMO_MATERIAL_PRICES.map(p => ({ ...p }));
}

function saveDemoPrices(list) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(list));
}

async function loadPrices() {
  if (supabaseClient && currentUserId) {
    const { data, error } = await supabaseClient
      .from(TABLE)
      .select('*')
      .eq('is_active', true)
      .order('price_date', { ascending: false });
    if (error) {
      console.error('[catalog] failed to load from Supabase', error);
      return loadDemoPrices();
    }
    return data || [];
  }
  return loadDemoPrices();
}

/**
 * Returns the active price list for the current user (or demo data).
 * Used by js/boq/boq-summary.js to link BOQ items to prices.
 */
export async function loadMaterialPrices() {
  if (!supabaseClient) await initSupabase();
  return loadPrices();
}

async function persist(list) {
  if (supabaseClient && currentUserId) return; // Supabase writes happen per-row in CRUD ops below
  saveDemoPrices(list);
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatPrice(n) {
  if (n === null || n === undefined || n === '') return null;
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function typeLabel(value) {
  return (MATERIAL_TYPES.find(t => t.value === value) || {}).label || value || '-';
}

function uniqueBrands() {
  return [...new Set(prices.map(p => p.brand).filter(Boolean))].sort();
}

function applyFilters(list) {
  let result = list;

  if (filters.materialTypes.size > 0) {
    result = result.filter(p => filters.materialTypes.has(p.material_type));
  }
  if (filters.brand) {
    result = result.filter(p => p.brand === filters.brand);
  }
  if (filters.unit) {
    result = result.filter(p => p.unit === filters.unit);
  }
  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    result = result.filter(p => (p.trade_name || '').toLowerCase().includes(q));
  }
  if (filters.latestOnly) {
    const latestByKey = new Map();
    result.forEach(p => {
      const key = `${p.material_type}|${p.material_subtype}|${p.brand}|${p.trade_name}|${p.unit}`;
      const existing = latestByKey.get(key);
      if (!existing || (p.price_date || '') > (existing.price_date || '')) {
        latestByKey.set(key, p);
      }
    });
    result = [...latestByKey.values()];
  }

  return result;
}

// ─────────────────────────────────────────────
// Render: shell + tabs
// ─────────────────────────────────────────────

function render() {
  const root = document.getElementById('material-catalog-app');
  if (!root) return;

  root.innerHTML = `
    <div class="fp-header">
      <h1>📦 Material Price Catalog</h1>
      <p>${supabaseClient && currentUserId ? 'บันทึกราคาวัสดุของคุณ — ใช้เชื่อมกับ BOQ เพื่อคำนวณต้นทุน' : '⚠️ โหมดสาธิต — ข้อมูลบันทึกไว้ในเบราว์เซอร์นี้เท่านั้น'}</p>
    </div>

    <div class="mc-tabs">
      <button class="mc-tab ${activeTab === 'my-prices' ? 'active' : ''}" onclick="materialCatalog.switchTab('my-prices')">ราคาวัสดุของฉัน</button>
      <button class="mc-tab ${activeTab === 'catalogs' ? 'active' : ''}" onclick="materialCatalog.switchTab('catalogs')">Catalog สำเร็จรูป</button>
      <button class="mc-tab ${activeTab === 'history' ? 'active' : ''}" onclick="materialCatalog.switchTab('history')">ประวัติราคา</button>
    </div>

    <div id="mc-tab-content"></div>
    <div id="mc-modal-root"></div>
  `;

  renderTabContent();
}

function renderTabContent() {
  const el = document.getElementById('mc-tab-content');
  if (!el) return;
  if (activeTab === 'my-prices') el.innerHTML = renderMyPricesTab();
  else if (activeTab === 'catalogs') el.innerHTML = renderCatalogsTab();
  else el.innerHTML = renderHistoryTab();

  if (activeTab === 'history') renderHistoryChart();
}

// ─────────────────────────────────────────────
// Tab 1: My Prices
// ─────────────────────────────────────────────

function renderMyPricesTab() {
  const filtered = applyFilters(prices);
  const brands = uniqueBrands();

  return `
    <div class="mc-layout">
      <aside class="mc-sidebar fp-card">
        <h2>ตัวกรอง</h2>

        <div class="mc-filter-group">
          <div class="mc-filter-label">หมวดวัสดุ</div>
          ${MATERIAL_TYPES.map(t => `
            <label class="mc-checkbox">
              <input type="checkbox" ${filters.materialTypes.has(t.value) ? 'checked' : ''}
                onchange="materialCatalog.toggleTypeFilter('${t.value}')" />
              ${t.label}
            </label>
          `).join('')}
        </div>

        <div class="mc-filter-group">
          <label class="mc-filter-label" for="mc-filter-brand">แบรนด์</label>
          <select id="mc-filter-brand" onchange="materialCatalog.setFilter('brand', this.value)">
            <option value="">ทั้งหมด</option>
            ${brands.map(b => `<option value="${escapeHtml(b)}" ${filters.brand === b ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('')}
          </select>
        </div>

        <div class="mc-filter-group">
          <label class="mc-filter-label" for="mc-filter-unit">หน่วย</label>
          <select id="mc-filter-unit" onchange="materialCatalog.setFilter('unit', this.value)">
            <option value="">ทั้งหมด</option>
            ${UNITS.map(u => `<option value="${u}" ${filters.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </div>

        <div class="mc-filter-group">
          <label class="mc-filter-label" for="mc-filter-search">ค้นหาชื่อสินค้า</label>
          <input type="text" id="mc-filter-search" placeholder="พิมพ์ชื่อสินค้า..."
            value="${escapeHtml(filters.search)}" oninput="materialCatalog.setFilter('search', this.value)" />
        </div>

        <div class="mc-filter-group">
          <label class="mc-checkbox">
            <input type="checkbox" ${filters.latestOnly ? 'checked' : ''}
              onchange="materialCatalog.setFilter('latestOnly', this.checked)" />
            แสดงเฉพาะรายการล่าสุด
          </label>
        </div>

        <button class="fp-btn-secondary" style="width:100%" onclick="materialCatalog.clearFilters()">ล้างตัวกรอง</button>
      </aside>

      <section class="mc-main">
        <div class="fp-card">
          <div class="mc-table-toolbar">
            <h2>รายการราคาวัสดุ (${filtered.length})</h2>
            <div class="mc-toolbar-actions">
              <button class="fp-btn-primary" onclick="materialCatalog.openModal()">+ เพิ่มรายการ</button>
              <button class="fp-btn-secondary" onclick="materialCatalog.triggerImportCSV()">นำเข้า CSV</button>
              <button class="fp-btn-secondary" onclick="materialCatalog.uploadPriceFileInput()">📁 อัปโหลดราคาวัสดุ</button>
              <button class="fp-btn-secondary" onclick="materialCatalog.exportCSV()">ส่งออก CSV</button>
              <input type="file" id="mc-csv-input" accept=".csv" style="display:none" onchange="materialCatalog.handleCSVFile(this.files[0])" />
              <input type="file" id="mc-price-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="materialCatalog.handlePriceFile(this.files[0])" />
            </div>
          </div>

          ${filtered.length === 0 ? '<p class="fp-empty">ไม่พบรายการ</p>' : `
          <table class="ov-table mc-table">
            <thead>
              <tr>
                <th>หมวด</th>
                <th>ประเภทย่อย</th>
                <th>แบรนด์</th>
                <th>ชื่อสินค้า</th>
                <th>หน่วย</th>
                <th class="ov-num">ราคา/หน่วย</th>
                <th>วันที่ราคา</th>
                <th>ซัพพลายเออร์</th>
                <th>แหล่งที่มา</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(renderPriceRow).join('')}
            </tbody>
          </table>
          `}
        </div>
      </section>
    </div>

    ${csvPreview ? renderCSVPreviewModal() : ''}
    ${editingId !== null ? renderPriceModal() : ''}
  `;
}

function renderPriceRow(p) {
  const effective = getEffectivePrice(`${p.material_type || 'concrete'}.${p.material_subtype || 'ready_mix_240'}`);
  const sourceInfo = getPriceSourceInfo(effective.source || p.catalog_source || 'manual');
  const displayPrice = effective.price ?? p.unit_price ?? 0;
  return `
    <tr>
      <td>${typeLabel(p.material_type)}</td>
      <td>${escapeHtml(p.material_subtype || '-')}</td>
      <td>${escapeHtml(p.brand || '-')}</td>
      <td>${escapeHtml(p.trade_name)}</td>
      <td class="mc-mono">${escapeHtml(p.unit)}</td>
      <td class="ov-num mc-mono">
        <span style="color:${sourceInfo.color};font-weight:700">${sourceInfo.icon}</span>
        <input type="number" step="0.01" min="0" class="mc-inline-input" value="${displayPrice ?? ''}"
          onchange="materialCatalog.updateField('${p.id}', 'unit_price', this.value)" />
      </td>
      <td>
        <input type="date" class="mc-inline-input" value="${p.price_date || ''}"
          onchange="materialCatalog.updateField('${p.id}', 'price_date', this.value)" />
      </td>
      <td>${escapeHtml(p.supplier_name || '-')}</td>
      <td>${escapeHtml(sourceLabel(p.catalog_source || effective.source))}</td>
      <td class="mc-actions">
        <button class="fp-btn-secondary" onclick="materialCatalog.openModal('${p.id}')" title="อัปเดตราคา">อัปเดตราคา</button>
        <button class="rh-delete" onclick="materialCatalog.deletePrice('${p.id}')" title="ลบรายการ">✕</button>
      </td>
    </tr>
  `;
}

function sourceLabel(source) {
  const labels = {
    manual: 'กรอกเอง',
    import_csv: 'นำเข้า CSV',
    catalog_scg: 'SCG Catalog',
    catalog_siam_steel: 'Siam Steel Catalog',
    catalog_government: 'ราคากลางรัฐบาล',
    catalog_sme_starter: 'SME Starter Pack',
  };
  return labels[source] || source || 'manual';
}

// ─────────────────────────────────────────────
// Tab 2: Pre-built Catalogs
// ─────────────────────────────────────────────

function renderCatalogsTab() {
  return `
    <div class="mc-catalog-grid">
      ${CATALOG_PACKS.map(renderCatalogCard).join('')}
    </div>
  `;
}

function isPackInstalled(pack) {
  return prices.some(p => p.catalog_source === `catalog_${pack.id}`);
}

function renderCatalogCard(pack) {
  const installed = isPackInstalled(pack);
  return `
    <div class="fp-card mc-catalog-card">
      <div class="mc-catalog-icon">${pack.icon}</div>
      <h3>${escapeHtml(pack.name)}</h3>
      <p class="mc-catalog-provider">${escapeHtml(pack.provider)}</p>
      <p class="mc-catalog-desc">${escapeHtml(pack.description)}</p>
      <div class="mc-catalog-meta">
        <span>${pack.items.length} รายการ</span>
        <span>อัปเดตล่าสุด: ${pack.last_updated}</span>
      </div>
      <button class="${installed ? 'fp-btn-secondary' : 'fp-btn-primary'}" style="width:100%"
        onclick="materialCatalog.installPack('${pack.id}')">
        ${installed ? 'อัปเดต' : 'ติดตั้ง'}
      </button>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Tab 3: Price History
// ─────────────────────────────────────────────

let historySubtype = null;
let historyChart = null;

function getSubtypeOptions() {
  const seen = new Map();
  prices.forEach(p => {
    if (!p.material_subtype) return;
    if (!seen.has(p.material_subtype)) {
      seen.set(p.material_subtype, `${typeLabel(p.material_type)} — ${p.material_subtype}`);
    }
  });
  return [...seen.entries()];
}

function renderHistoryTab() {
  const options = getSubtypeOptions();
  if (!historySubtype && options.length > 0) historySubtype = options[0][0];

  const records = prices
    .filter(p => p.material_subtype === historySubtype)
    .sort((a, b) => (a.price_date || '').localeCompare(b.price_date || ''));

  return `
    <div class="fp-card">
      <h2>ประวัติราคาวัสดุ</h2>
      <div class="mc-filter-group" style="max-width:360px">
        <label class="mc-filter-label" for="mc-history-select">เลือกประเภทวัสดุ</label>
        <select id="mc-history-select" onchange="materialCatalog.setHistorySubtype(this.value)">
          ${options.length === 0 ? '<option value="">ไม่มีข้อมูล</option>' : options.map(([value, label]) =>
            `<option value="${escapeHtml(value)}" ${historySubtype === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
          ).join('')}
        </select>
      </div>

      ${records.length === 0 ? '<p class="fp-empty">ไม่มีประวัติราคาสำหรับรายการนี้</p>' : `
      <div class="mc-chart-wrap">
        <canvas id="mc-history-chart"></canvas>
      </div>
      <table class="ov-table mc-table">
        <thead>
          <tr>
            <th>วันที่ราคา</th>
            <th>แบรนด์</th>
            <th>ชื่อสินค้า</th>
            <th class="ov-num">ราคา/หน่วย</th>
            <th>หน่วย</th>
            <th>ซัพพลายเออร์</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(p => `
            <tr>
              <td>${escapeHtml(p.price_date || '-')}</td>
              <td>${escapeHtml(p.brand || '-')}</td>
              <td>${escapeHtml(p.trade_name)}</td>
              <td class="ov-num mc-mono">${formatPrice(p.unit_price) ?? '-'}</td>
              <td class="mc-mono">${escapeHtml(p.unit)}</td>
              <td>${escapeHtml(p.supplier_name || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      `}
    </div>
  `;
}

function renderHistoryChart() {
  if (historyChart) {
    historyChart.destroy();
    historyChart = null;
  }
  if (typeof Chart === 'undefined') return;

  const canvas = document.getElementById('mc-history-chart');
  if (!canvas) return;

  const records = prices
    .filter(p => p.material_subtype === historySubtype)
    .sort((a, b) => (a.price_date || '').localeCompare(b.price_date || ''));
  if (records.length === 0) return;

  historyChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: records.map(p => p.price_date),
      datasets: [{
        label: 'ราคา/หน่วย (บาท)',
        data: records.map(p => p.unit_price),
        borderColor: '#2563EB',
        backgroundColor: '#2563EB22',
        tension: 0.2,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: false } },
    },
  });
}

// ─────────────────────────────────────────────
// Modal: add / edit price
// ─────────────────────────────────────────────

function renderPriceModal() {
  const isNew = editingId === 'new';
  const item = isNew ? {} : (prices.find(p => p.id === editingId) || {});
  const brands = uniqueBrands();

  return `
    <div class="modal-overlay">
      <div class="modal-card">
        <h2>${isNew ? 'เพิ่มรายการราคาวัสดุ' : 'แก้ไขรายการราคาวัสดุ'}</h2>
        <div class="fp-form-grid">
          <label>หมวดวัสดุ
            <select id="mc-input-type">
              ${MATERIAL_TYPES.map(t => `<option value="${t.value}" ${item.material_type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </label>
          <label>ประเภทย่อย
            <input type="text" id="mc-input-subtype" value="${escapeHtml(item.material_subtype || '')}" placeholder="เช่น ready_mix_concrete" />
          </label>
          <label>แบรนด์
            <input type="text" id="mc-input-brand" list="mc-brand-list" value="${escapeHtml(item.brand || '')}" placeholder="เช่น SCG" />
            <datalist id="mc-brand-list">
              ${brands.map(b => `<option value="${escapeHtml(b)}"></option>`).join('')}
            </datalist>
          </label>
          <label>ชื่อสินค้า
            <input type="text" id="mc-input-trade-name" value="${escapeHtml(item.trade_name || '')}" placeholder="เช่น คอนกรีตผสมเสร็จ fc=240 ksc" />
          </label>
          <label>หน่วย
            <select id="mc-input-unit">
              ${UNITS.map(u => `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </label>
          <label>ราคา/หน่วย (บาท)
            <input type="number" id="mc-input-price" min="0" step="0.01" value="${item.unit_price ?? ''}" />
          </label>
          <label>วันที่ราคา
            <input type="date" id="mc-input-date" value="${item.price_date || new Date().toISOString().slice(0, 10)}" />
          </label>
          <label>ซัพพลายเออร์
            <input type="text" id="mc-input-supplier" value="${escapeHtml(item.supplier_name || '')}" />
          </label>
        </div>
        <label>หมายเหตุ
          <textarea id="mc-input-notes">${escapeHtml(item.notes || '')}</textarea>
        </label>
        <div class="modal-actions">
          <button class="fp-btn-secondary" onclick="materialCatalog.closeModal()">ยกเลิก</button>
          <button class="fp-btn-primary" onclick="materialCatalog.savePrice()">บันทึก</button>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// CSV import preview modal
// ─────────────────────────────────────────────

function renderCSVPreviewModal() {
  const { headers, rows } = csvPreview;
  const preview = rows.slice(0, 10);
  return `
    <div class="modal-overlay">
      <div class="modal-card mc-csv-modal">
        <h2>ตัวอย่างข้อมูลนำเข้า (${rows.length} แถว)</h2>
        <div class="mc-csv-preview-wrap">
          <table class="ov-table mc-table">
            <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
            <tbody>
              ${preview.map(row => `<tr>${headers.map(h => `<td>${escapeHtml(row[h])}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          ${rows.length > preview.length ? `<p class="fp-empty">แสดง ${preview.length} จาก ${rows.length} แถว</p>` : ''}
        </div>
        <div class="modal-actions">
          <button class="fp-btn-secondary" onclick="materialCatalog.cancelImportCSV()">ยกเลิก</button>
          <button class="fp-btn-primary" onclick="materialCatalog.confirmImportCSV()">ยืนยันนำเข้า (${rows.length} รายการ)</button>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Public API (window.materialCatalog)
// ─────────────────────────────────────────────

async function init() {
  await initSupabase();
  prices = await loadPrices();
  render();
}

async function refresh() {
  prices = await loadPrices();
  render();
}

function switchTab(tab) {
  activeTab = tab;
  renderTabContent();
}

function toggleTypeFilter(value) {
  if (filters.materialTypes.has(value)) filters.materialTypes.delete(value);
  else filters.materialTypes.add(value);
  renderTabContent();
}

function setFilter(key, value) {
  filters[key] = value;
  renderTabContent();
}

function clearFilters() {
  filters.materialTypes.clear();
  filters.brand = '';
  filters.unit = '';
  filters.search = '';
  filters.latestOnly = false;
  renderTabContent();
}

function openModal(id = 'new') {
  editingId = id;
  if (id === 'new') {
    // default price_date to today, leave the rest blank
  } else if (id !== 'new') {
    const item = prices.find(p => p.id === id);
    if (item) item.price_date = item.price_date || new Date().toISOString().slice(0, 10);
  }
  renderTabContent();
}

function closeModal() {
  editingId = null;
  renderTabContent();
}

async function savePrice() {
  const material_type = document.getElementById('mc-input-type').value;
  const trade_name = document.getElementById('mc-input-trade-name').value.trim();
  const unit = document.getElementById('mc-input-unit').value;
  if (!trade_name) {
    alert('กรุณากรอกชื่อสินค้า');
    return;
  }

  const payload = {
    material_type,
    material_subtype: document.getElementById('mc-input-subtype').value.trim() || null,
    brand: document.getElementById('mc-input-brand').value.trim() || null,
    trade_name,
    unit,
    unit_price: parseFloat(document.getElementById('mc-input-price').value) || null,
    price_date: document.getElementById('mc-input-date').value || null,
    supplier_name: document.getElementById('mc-input-supplier').value.trim() || null,
    notes: document.getElementById('mc-input-notes').value.trim() || null,
  };

  if (editingId === 'new') {
    payload.catalog_source = 'manual';
    payload.is_active = true;
    await insertPrice(payload);
  } else {
    await updatePrice(editingId, payload);
  }

  editingId = null;
  prices = await loadPrices();
  render();
}

async function insertPrice(payload) {
  if (supabaseClient && currentUserId) {
    const { error } = await supabaseClient.from(TABLE).insert({ ...payload, user_id: currentUserId });
    if (error) console.error('[catalog] insert failed', error);
    return;
  }
  const row = { id: crypto.randomUUID(), ...payload };
  prices.push(row);
  saveDemoPrices(prices);
}

async function updatePrice(id, payload) {
  if (supabaseClient && currentUserId) {
    const { error } = await supabaseClient.from(TABLE).update(payload).eq('id', id);
    if (error) console.error('[catalog] update failed', error);
    return;
  }
  const idx = prices.findIndex(p => p.id === id);
  if (idx !== -1) prices[idx] = { ...prices[idx], ...payload };
  saveDemoPrices(prices);
}

async function updateField(id, field, value) {
  const payload = { [field]: field === 'unit_price' ? (parseFloat(value) || null) : (value || null) };
  await updatePrice(id, payload);
  prices = await loadPrices();
  renderTabContent();
}

async function deletePrice(id) {
  if (supabaseClient && currentUserId) {
    const { error } = await supabaseClient.from(TABLE).delete().eq('id', id);
    if (error) console.error('[catalog] delete failed', error);
  } else {
    prices = prices.filter(p => p.id !== id);
    saveDemoPrices(prices);
  }
  prices = await loadPrices();
  render();
}

async function installPack(packId) {
  const pack = CATALOG_PACKS.find(p => p.id === packId);
  if (!pack) return;
  const catalogSource = `catalog_${packId}`;

  if (supabaseClient && currentUserId) {
    await supabaseClient.from(TABLE).delete().eq('catalog_source', catalogSource).eq('user_id', currentUserId);
    const rows = pack.items.map(item => ({
      ...item,
      price_date: item.price_date || pack.last_updated,
      catalog_source: catalogSource,
      is_active: true,
      user_id: currentUserId,
    }));
    const { error } = await supabaseClient.from(TABLE).insert(rows);
    if (error) console.error('[catalog] install failed', error);
  } else {
    prices = prices.filter(p => p.catalog_source !== catalogSource);
    pack.items.forEach(item => {
      prices.push({
        id: crypto.randomUUID(),
        ...item,
        price_date: item.price_date || pack.last_updated,
        catalog_source: catalogSource,
        is_active: true,
      });
    });
    saveDemoPrices(prices);
  }

  prices = await loadPrices();
  render();
}

function setHistorySubtype(value) {
  historySubtype = value;
  renderTabContent();
}

function exportCSV() {
  const filtered = applyFilters(prices);
  const csv = exportToCSV(filtered, CSV_COLUMNS);
  downloadCSV(csv, `material_prices_${new Date().toISOString().slice(0, 10)}.csv`);
}

function triggerImportCSV() {
  document.getElementById('mc-csv-input')?.click();
}

function uploadPriceFileInput() {
  document.getElementById('mc-price-input')?.click();
}

async function handlePriceFile(file) {
  if (!file) return;
  try {
    const result = await uploadPriceFile(file);
    const confirmed = confirmAndSaveParsedPrices(result.aiResult.mapped, result.aiResult);
    alert(`อัปโหลดสำเร็จ: ${confirmed.overrides ? Object.keys(confirmed.overrides).length : 0} รายการ ถูกบันทึกลง localStorage`);
    await refresh();
  } catch (e) {
    console.error('[catalog] price upload failed', e);
    alert('อัปโหลดไฟล์ราคาล้มเหลว');
  }
}

function handleCSVFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const { headers, rows } = parseCSV(String(e.target.result));
    if (rows.length === 0) {
      alert('ไม่พบข้อมูลในไฟล์ CSV');
      return;
    }
    csvPreview = { headers, rows };
    renderTabContent();
  };
  reader.readAsText(file, 'utf-8');
}

function cancelImportCSV() {
  csvPreview = null;
  renderTabContent();
}

async function confirmImportCSV() {
  if (!csvPreview) return;
  const { rows } = csvPreview;

  const newRows = rows.map(row => ({
    material_type: row.material_type || 'concrete',
    material_subtype: row.material_subtype || null,
    brand: row.brand || null,
    trade_name: row.trade_name || '',
    unit: row.unit || 'm3',
    unit_price: parseFloat(row.unit_price) || null,
    price_date: row.price_date || null,
    supplier_name: row.supplier_name || null,
    notes: row.notes || null,
    catalog_source: 'import_csv',
    is_active: true,
  })).filter(r => r.trade_name);

  if (supabaseClient && currentUserId) {
    const { error } = await supabaseClient.from(TABLE).insert(newRows.map(r => ({ ...r, user_id: currentUserId })));
    if (error) console.error('[catalog] CSV import failed', error);
  } else {
    newRows.forEach(r => prices.push({ id: crypto.randomUUID(), ...r }));
    saveDemoPrices(prices);
  }

  csvPreview = null;
  prices = await loadPrices();
  render();
}

export const materialCatalog = {
  init,
  refresh,
  switchTab,
  toggleTypeFilter,
  setFilter,
  clearFilters,
  openModal,
  closeModal,
  savePrice,
  updateField,
  deletePrice,
  installPack,
  setHistorySubtype,
  exportCSV,
  triggerImportCSV,
  uploadPriceFileInput,
  handlePriceFile,
  handleCSVFile,
  cancelImportCSV,
  confirmImportCSV,
};

window.materialCatalog = materialCatalog;

document.addEventListener('DOMContentLoaded', init);
