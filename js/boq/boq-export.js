import { getEffectivePrice } from '../shared/price-config.js';

function formatTHB(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calculateBOQTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.amount_thb || 0), 0);
  const vat = subtotal * 0.07;
  const total = subtotal + vat;
  return { subtotal, vat, total };
}

function renderBOQRows(groupedItems) {
  return groupedItems.map(group => `
    <tr class="boq-category-header">
      <td colspan="7">${group.label}</td>
    </tr>
    ${group.items.map(item => `
      <tr>
        <td>${item.item_code || ''}</td>
        <td>${item.description || ''}</td>
        <td>${item.unit || ''}</td>
        <td class="col-qty">${Number(item.quantity || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td>
        <td class="col-unit-price">${formatTHB(item.unit_rate_thb || 0)}</td>
        <td class="col-amount">${formatTHB(item.amount_thb || 0)}</td>
        <td>${item.unit_price_source || 'price-config'}</td>
      </tr>
    `).join('')}
  `).join('');
}

function exportBOQtoPDF(projectId = null) {
  const sourceItems = JSON.parse(localStorage.getItem(`constistant_boq_items_v1${projectId ? `__${projectId}` : ''}`) || '[]');
  const enriched = sourceItems.map(item => {
    const price = getEffectivePrice(`${item.work_category}.${item.work_category === 'concrete' ? 'ready_mix_240' : item.work_category === 'rebar' ? 'sd40_db16' : 'beam'}`);
    return {
      ...item,
      unit_rate_thb: item.unit_rate_thb ?? price.price,
      amount_thb: (item.quantity || 0) * (item.unit_rate_thb ?? price.price),
      unit_price_source: item.unit_price_source || price.source,
    };
  });

  const totals = calculateBOQTotals(enriched);
  const grouped = [
    { label: 'หมวด 1 — งานโครงสร้างคอนกรีต', items: enriched.filter(item => item.work_category === 'concrete') },
    { label: 'หมวด 2 — งานเหล็กเสริม', items: enriched.filter(item => item.work_category === 'rebar') },
    { label: 'หมวด 3 — งานแบบหล่อ', items: enriched.filter(item => item.work_category === 'formwork') },
  ];

  const html = `
    <div id="boq-print-root" class="boq-print-root">
      <h1>BOQ Summary</h1>
      <p>ราคาส่วนใหญ่ใช้จาก price-config และ override จาก localStorage หากมี</p>
      <table class="boq-table">
        <thead>
          <tr>
            <th>ลำดับ</th><th>รายการ</th><th>หน่วย</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>เป็นเงิน</th><th>แหล่งราคา</th>
          </tr>
        </thead>
        <tbody>${renderBOQRows(grouped)}</tbody>
        <tfoot>
          <tr class="boq-subtotal"><td colspan="5">รวมก่อน VAT</td><td colspan="2">${formatTHB(totals.subtotal)}</td></tr>
          <tr class="boq-subtotal"><td colspan="5">VAT 7%</td><td colspan="2">${formatTHB(totals.vat)}</td></tr>
          <tr class="boq-grand-total"><td colspan="5">รวมทั้งสิ้น (รวม VAT)</td><td colspan="2">${formatTHB(totals.total)}</td></tr>
        </tfoot>
      </table>
    </div>
  `;

  const mount = document.getElementById('boq-print-root') || document.createElement('div');
  mount.id = 'boq-print-root';
  mount.innerHTML = html;
  document.body.appendChild(mount);
  window.print();
}

function setBOQLogo(logoDataUrl) {
  const el = document.getElementById('boq-logo');
  if (el) el.src = logoDataUrl;
}

export { exportBOQtoPDF, renderBOQRows, calculateBOQTotals, setBOQLogo };
window.exportBOQtoPDF = exportBOQtoPDF;
window.setBOQLogo = setBOQLogo;
