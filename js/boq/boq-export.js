/**
 * boq-export.js — Government-standard BOQ export to print-ready HTML
 *
 * Mirrors "Boq Excel Template for public job.xlsm" structure:
 * - Hierarchical WBS numbering (1, 1.1, 1.1.1, etc.)
 * - Category grouping with subtotals
 * - Grand total + 7% VAT footer
 * - Print-ready CSS formatting for A4 landscape
 *
 * Usage: exportBOQToHTML(projectId) → opens print dialog
 */

import { getEffectivePrice } from '../shared/price-config.js';
import { projectStorageKey, getCurrentProject, DEMO_PROJECT_ID } from '../shared/project-store.js';
import { STORAGE_KEYS } from '../shared/pipeline.js';
import { getDemoProject } from '../shared/demo-seed.js';

const VAT_RATE = 0.07;

function formatNumber(n, fractionDigits = 2) {
  if (n === null || n === undefined) return '-';
  n = Number(n);
  return isNaN(n) ? '-' : n.toLocaleString('th-TH', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

function formatTHB(n) {
  return formatNumber(n, 2);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function calculateBOQTotals(items) {
  const subtotal = (items || []).reduce((sum, item) => sum + Number(item.amount_thb || 0), 0);
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;
  return { subtotal, vat, total };
}

function groupBOQByCategory(items) {
  const groups = {};
  for (const item of items) {
    const cat = item.category_code || '1';
    if (!groups[cat]) {
      groups[cat] = { code: cat, label: item.category_label_th || 'อื่นๆ', items: [] };
    }
    groups[cat].items.push(item);
  }

  // Sort numerically
  return Object.values(groups).sort((a, b) => {
    const aParts = a.code.split('.').map(Number);
    const bParts = b.code.split('.').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      if ((aParts[i] || 0) !== (bParts[i] || 0)) return (aParts[i] || 0) - (bParts[i] || 0);
    }
    return 0;
  });
}

function renderBOQTableHTML(groupedByCategory) {
  let tableHtml = `
    <table class="boq-table">
      <thead>
        <tr>
          <th class="col-no">ลำดับ</th>
          <th class="col-desc">รายการ</th>
          <th class="col-unit">หน่วย</th>
          <th class="col-qty">ปริมาณ</th>
          <th class="col-rate">ราคา/หน่วย (บาท)</th>
          <th class="col-amount">รวม (บาท)</th>
        </tr>
      </thead>
      <tbody>
  `;

  let rowNum = 1;
  const categorySubtotals = {};

  for (const group of groupedByCategory) {
    tableHtml += `
      <tr class="boq-cat-header">
        <td colspan="6"><strong>หมวดที่ ${group.code} — ${escapeHtml(group.label)}</strong></td>
      </tr>
    `;

    let catSum = 0;
    for (const item of group.items) {
      const amount = (item.quantity || 0) * (item.unit_rate_thb || 0);
      catSum += amount;

      tableHtml += `
        <tr class="boq-item">
          <td class="col-no">${rowNum}</td>
          <td class="col-desc">${escapeHtml(item.description || item.item_code)}</td>
          <td class="col-unit">${escapeHtml(item.unit)}</td>
          <td class="col-qty">${formatNumber(item.quantity)}</td>
          <td class="col-rate">${formatTHB(item.unit_rate_thb)}</td>
          <td class="col-amount">${formatTHB(amount)}</td>
        </tr>
      `;
      rowNum++;
    }

    categorySubtotals[group.code] = catSum;
    tableHtml += `
      <tr class="boq-subtotal">
        <td colspan="5"><strong>รวมหมวดที่ ${group.code}</strong></td>
        <td class="col-amount"><strong>${formatTHB(catSum)}</strong></td>
      </tr>
    `;
  }

  const grandTotal = Object.values(categorySubtotals).reduce((a, b) => a + b, 0);
  const vatAmount = grandTotal * VAT_RATE;
  const totalWithVat = grandTotal + vatAmount;

  tableHtml += `
      </tbody>
      <tfoot>
        <tr class="boq-grand-total">
          <td colspan="5"><strong>รวมราคาทั้งสิ้น</strong></td>
          <td class="col-amount"><strong>${formatTHB(grandTotal)}</strong></td>
        </tr>
        <tr class="boq-vat-row">
          <td colspan="5"><strong>ภาษีมูลค่าเพิ่ม 7%</strong></td>
          <td class="col-amount"><strong>${formatTHB(vatAmount)}</strong></td>
        </tr>
        <tr class="boq-total-with-vat">
          <td colspan="5"><strong>รวมราคาทั้งสิ้น (รวม VAT)</strong></td>
          <td class="col-amount"><strong>${formatTHB(totalWithVat)}</strong></td>
        </tr>
      </tfoot>
    </table>
  `;

  return { html: tableHtml, grandTotal, vatAmount, totalWithVat };
}

function renderHeaderHTML(project) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' });

  return `
    <div class="boq-header">
      <div class="boq-header__title">
        <h1 class="boq-title">บัญชีรายการถอดแบบงานก่อสร้าง</h1>
        <p class="boq-subtitle">Bill of Quantities (BOQ)</p>
      </div>

      <table class="boq-meta-table">
        <tr><td>โครงการ</td><td><strong>${escapeHtml(project.name)}</strong></td></tr>
        <tr><td>เจ้าของโครงการ</td><td>${escapeHtml(project.client_name || '-')}</td></tr>
        <tr><td>สถานที่ก่อสร้าง</td><td>${escapeHtml(project.location_label || '-')}</td></tr>
        <tr><td>วันที่จัดทำ</td><td>${dateStr}</td></tr>
      </table>
    </div>
  `;
}

function renderFooterHTML() {
  return `
    <div class="boq-footer">
      <div class="boq-notes">
        <p><strong>หมายเหตุ:</strong></p>
        <ul>
          <li>ราคานี้เป็นราคาประมาณการเบื้องต้น อ้างอิงจาก ราคากลาง กรมบัญชีกลาง ปี 2569</li>
          <li>ราคาจริงอาจเปลี่ยนแปลงตามสภาวะตลาด และเงื่อนไขการจัดซื้อจัดจ้าง</li>
          <li>ราคาข้างต้นไม่รวมค่าโสหุ่ย บน-ลง และค่าบริหารโครงการ</li>
        </ul>
      </div>

      <div class="boq-signature-block">
        <div class="boq-sig-box">
          <div class="boq-sig-line"></div>
          <p><strong>ผู้จัดทำ</strong></p>
          <p class="boq-date-line">วันที่ ……………………</p>
        </div>
        <div class="boq-sig-box">
          <div class="boq-sig-line"></div>
          <p><strong>ผู้ตรวจสอบ</strong></p>
          <p class="boq-date-line">วันที่ ……………………</p>
        </div>
      </div>
    </div>
  `;
}

export function exportBOQToHTML(projectId = null) {
  // Load project
  const project = projectId ? getCurrentProject() : (getCurrentProject() || getDemoProject());
  if (!project) {
    alert('ไม่พบข้อมูลโครงการ');
    return;
  }

  // Load BOQ items
  let boqItems = [];
  try {
    const key = projectId ? projectStorageKey(STORAGE_KEYS.boq, projectId) : STORAGE_KEYS.boq;
    const raw = localStorage.getItem(key);
    if (raw) boqItems = JSON.parse(raw);
  } catch (e) {
    console.error('[boq-export] failed to load BOQ items', e);
  }

  if (!boqItems || boqItems.length === 0) {
    alert('ไม่พบรายการ BOQ — กรุณา "Calculate Project" ก่อน');
    return;
  }

  // Enrich prices
  const enriched = boqItems.map(item => ({
    ...item,
    unit_rate_thb: item.unit_rate_thb || 0,
    amount_thb: (item.quantity || 0) * (item.unit_rate_thb || 0),
  }));

  // Group and render
  const grouped = groupBOQByCategory(enriched);
  const { html: tableHtml, grandTotal, vatAmount, totalWithVat } = renderBOQTableHTML(grouped);

  const fullHTML = `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BOQ — ${escapeHtml(project.name)}</title>
      <link rel="stylesheet" href="../boq-print.css">
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: 'Sarabun', sans-serif;
          font-size: 12px;
          color: #000;
          background: #fff;
        }
        .boq-container { max-width: 100%; margin: 0 auto; }
        @media print {
          body { padding: 15px; }
          .boq-footer { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="boq-container">
        ${renderHeaderHTML(project)}
        ${tableHtml}
        ${renderFooterHTML()}
      </div>

      <script>
        window.addEventListener('load', () => {
          setTimeout(() => window.print(), 300);
        });
      </script>
    </body>
    </html>
  `;

  // Open in new window
  const win = window.open('', 'BOQ-Export', 'width=1200,height=800');
  if (win) {
    win.document.write(fullHTML);
    win.document.close();
  } else {
    alert('ไม่สามารถเปิดหน้าพิมพ์ได้ — ตรวจสอบการบล็อก pop-up');
  }
}

export function setBOQLogo(logoDataUrl) {
  try {
    localStorage.setItem('constistant_boq_logo', logoDataUrl);
  } catch (e) {
    console.warn('[boq-export] logo storage failed', e);
  }
}

// Window exports for onclick handlers
if (typeof window !== 'undefined') {
  window.exportBOQToHTML = exportBOQToHTML;
  window.setBOQLogo = setBOQLogo;
}
