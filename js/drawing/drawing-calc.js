/**
 * Quantity takeoff calculations for concrete, formwork, and rebar.
 */

import { qt_setPhase, qt_setStatus, qt_getCalcOptions } from './drawing-ui.js';

const STEEL_UW = { 6: 0.222, 9: 0.499, 10: 0.617, 12: 0.888, 16: 1.578, 19: 2.226, 20: 2.466, 25: 3.853, 28: 4.834, 32: 6.313 };

export function qt_initSteelGlobals() {
  globalThis.qt_UW = globalThis.qt_UW || STEEL_UW;
  globalThis.qt_steelUW = globalThis.qt_steelUW || function (d) {
    return globalThis.qt_UW[+d] || (0.006165 * d * d);
  };
  globalThis.qt_elementsData = globalThis.qt_elementsData || [];
  globalThis.qt_API_KEY = globalThis.qt_API_KEY || '';
}

function qt_steelUW(d) {
  return globalThis.qt_steelUW(d);
}

export function qt_calcElement(el) {
  const isSlab = (el.type || 'beam') === 'slab';

  if (isSlab) {
    const W = el.width_m || el.width / 1000;
    const L = el.length_slab || 0;
    const T = (el.thickness || 120) / 1000;
    const concrete = +(W * L * T).toFixed(4);
    const formwork = +(W * L).toFixed(4);
    const rows = [];
    let totalSteel = 0;

    const addSlabBar = (pos, barObj, spanLen) => {
      if (!barObj?.dia || !barObj?.spacing || !spanLen) return;
      const { dia, spacing, type = 'DB' } = barObj;
      const qty = Math.ceil(spanLen / spacing) + 1;
      const uw = qt_steelUW(dia);
      const kg = +(qty * spanLen * uw).toFixed(2);
      totalSteel += kg;
      rows.push({ pos, count: qty, dia, barType: type, len: +spanLen.toFixed(2), uw, kg });
    };
    addSlabBar('Main Bar', el.steel_main, L);
    addSlabBar('Dist Bar', el.steel_dist, W);

    const byDia = {};
    rows.forEach(r => { const k = `${r.barType}${r.dia}`; byDia[k] = (byDia[k] || 0) + r.kg; });
    Object.keys(byDia).forEach(k => { byDia[k] = +byDia[k].toFixed(2); });
    return { concrete, formwork, steel: +totalSteel.toFixed(2), rows, byDia };
  }

  const W = el.width / 1000;
  const H = el.height / 1000;
  const hook = 0.3;
  const groups = el.length_groups?.length ? el.length_groups : [{ length: el.length || 0, qty: 1 }];
  const sections = el.sections?.length ? el.sections : [{
    label: 'Section 1',
    length_ratio: 1.0,
    steel_top: el.steel_top,
    steel_bottom: el.steel_bottom,
    steel_extra: el.steel_extra || [],
    stirrup: el.stirrup,
  }];

  const rows = [];
  let totalSteel = 0;
  let totalConcrete = 0;
  let totalFormwork = 0;

  groups.forEach(g => {
    const L = g.length || 0;
    const qty = g.qty || 1;
    totalConcrete += W * H * L * qty;
    totalFormwork += (2 * H + W) * L * qty;

    sections.forEach(sec => {
      const sL = +(L * (sec.length_ratio || 1)).toFixed(3);
      const addBar = (pos, count, dia, barType = 'DB') => {
        if (!count || !dia || !sL) return;
        const len = +(sL + 2 * hook).toFixed(2);
        const uw = qt_steelUW(dia);
        const kg = +(count * len * uw * qty).toFixed(2);
        totalSteel += kg;
        rows.push({ pos: `${sec.label || 'Sec'} – ${pos}`, count: count * qty, dia, barType, len, uw, kg });
      };
      if (sec.steel_top?.count) addBar('Top', sec.steel_top.count, sec.steel_top.dia);
      if (sec.steel_bottom?.count) addBar('Bottom', sec.steel_bottom.count, sec.steel_bottom.dia);
      (sec.steel_extra || []).forEach((s, j) => { if (s.count && s.dia) addBar(`Extra ${j + 1}`, s.count, s.dia); });

      if (sec.stirrup?.dia && sec.stirrup?.spacing && sL > 0) {
        const { dia, spacing, type = 'DB' } = sec.stirrup;
        const cover = 0.03;
        const perim = 2 * ((W - 2 * cover) + (H - 2 * cover)) + 8 * (dia / 1000);
        const qtyStir = (Math.ceil(sL / spacing) + 1) * qty;
        const kg = +(qtyStir * perim * qt_steelUW(dia)).toFixed(2);
        totalSteel += kg;
        rows.push({
          pos: `${sec.label || 'Sec'} – Stirrup`,
          count: qtyStir,
          dia,
          barType: type,
          len: +perim.toFixed(3),
          uw: qt_steelUW(dia),
          kg,
        });
      }
    });
  });

  const concrete = +totalConcrete.toFixed(4);
  const formwork = +totalFormwork.toFixed(4);
  const byDia = {};
  rows.forEach(r => { const key = `${r.barType || 'DB'}${r.dia}`; byDia[key] = (byDia[key] || 0) + r.kg; });
  Object.keys(byDia).forEach(k => { byDia[k] = +byDia[k].toFixed(2); });
  return { concrete, formwork, steel: +totalSteel.toFixed(2), rows, byDia };
}

export function qt_runCalculate() {
  const qt_elementsData = globalThis.qt_elementsData || [];
  if (!qt_elementsData.length) { alert('ไม่มี element ให้คำนวณ'); return; }

  const opts = qt_getCalcOptions();
  if (!opts.length) { alert('กรุณาเลือกรายการคำนวณอย่างน้อย 1 อย่าง'); return; }

  const showConcrete = opts.includes('concrete');
  const showFormwork = opts.includes('formwork');
  const showSteel = opts.includes('steel') || opts.includes('stirrup');
  const showBarSched = opts.includes('bar_schedule');
  const showStirrUp = opts.includes('stirrup');

  let totC = 0;
  let totS = 0;
  let totF = 0;
  const totByDia = {};
  qt_elementsData.forEach(el => {
    const c = qt_calcElement(el);
    totC += c.concrete;
    totS += c.steel;
    totF += c.formwork;
    Object.entries(c.byDia).forEach(([key, kg]) => { totByDia[key] = (totByDia[key] || 0) + kg; });
  });
  Object.keys(totByDia).forEach(k => { totByDia[k] = +totByDia[k].toFixed(2); });

  const cellConcrete = document.querySelector('.summary-grid .summary-cell:nth-child(1)');
  const cellSteel = document.querySelector('.summary-grid .summary-cell:nth-child(2)');
  const cellFormwork = document.querySelector('.summary-grid .summary-cell:nth-child(3)');
  cellConcrete.style.display = showConcrete ? '' : 'none';
  cellSteel.style.display = showSteel ? '' : 'none';
  cellFormwork.style.display = showFormwork ? '' : 'none';

  if (showConcrete) document.getElementById('tot-concrete').textContent = totC.toFixed(3);
  if (showSteel) {
    document.getElementById('tot-steel').textContent = totS.toFixed(1);
    const diaRows = Object.keys(totByDia).sort((a, b) => +a.replace(/\D/g, '') - +b.replace(/\D/g, ''))
      .map(d => `<div class="dia-row"><span class="dia-tag">${d}</span><span class="dia-kg">${totByDia[d]} kg</span></div>`).join('');
    document.getElementById('steel-dia-breakdown').innerHTML = diaRows;
    document.getElementById('steel-dia-breakdown').style.display = '';
  } else {
    document.getElementById('steel-dia-breakdown').style.display = 'none';
  }
  if (showFormwork) document.getElementById('tot-formwork').textContent = totF.toFixed(2);

  const container = document.getElementById('beam-cards');
  container.innerHTML = '';
  qt_elementsData.forEach((el, i) => {
    const c = qt_calcElement(el);
    let filteredRows = c.rows;
    if (!showStirrUp) filteredRows = filteredRows.filter(r => !r.pos.includes('Stirrup'));
    if (!showSteel) filteredRows = [];

    const rows = filteredRows.map(r =>
      `<tr><td>${r.pos}</td><td>${r.count} × ${r.barType || 'DB'}${r.dia}</td><td>${r.len} m</td><td>${r.uw} kg/m</td><td><b>${r.kg} kg</b></td></tr>`
    ).join('');

    const diaPills = showSteel
      ? Object.keys(c.byDia).sort((a, b) => +a.replace(/\D/g, '') - +b.replace(/\D/g, ''))
        .map(d => `<div class="qty-pill qty-pill-dia"><div class="qp-val">${c.byDia[d]}</div><div class="qp-unit">kg</div><div class="qp-label">${d}</div></div>`)
        .join('')
      : '';

    const qtyPills = [
      showConcrete ? `<div class="qty-pill"><div class="qp-val">${c.concrete}</div><div class="qp-unit">m³</div><div class="qp-label">Concrete</div></div>` : '',
      showFormwork ? `<div class="qty-pill"><div class="qp-val">${c.formwork}</div><div class="qp-unit">m²</div><div class="qp-label">Formwork</div></div>` : '',
      diaPills,
    ].join('');

    const tableSection = showBarSched && rows
      ? `<table class="steel-table"><thead><tr><th>Position</th><th>Bar</th><th>Length/Perim</th><th>Unit Wt</th><th>Weight</th></tr></thead><tbody>${rows}</tbody></table>`
      : (showBarSched ? '<div style="color:var(--muted);font-size:12px">No steel data</div>' : '');

    container.innerHTML += `
    <div class="beam-card open" id="rc-${i}">
      <div class="beam-header" onclick="document.getElementById('rc-${i}').classList.toggle('open')">
        <div class="beam-id-block">
          <span class="beam-id">${el.id}</span>
          <span class="beam-size">${el.width}×${el.height}mm · L=${el.length}m</span>
        </div>
        <span class="beam-chevron">▼</span>
      </div>
      <div class="beam-body">
        <div class="qty-row">${qtyPills}</div>
        ${tableSection}
      </div>
    </div>`;
  });

  qt_setPhase(3);
  qt_setStatus('done');
  document.getElementById('result-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function qt_copyResult() {
  const qt_elementsData = globalThis.qt_elementsData || [];
  let txt = 'QUANTITY TAKEOFF SUMMARY\n' + '='.repeat(50) + '\n';
  qt_elementsData.forEach(el => {
    const c = qt_calcElement(el);
    txt += `\n${el.id} (${el.width}x${el.height}mm, L=${el.length}m)\n`;
    txt += `  Concrete : ${c.concrete} m³\n  Steel    : ${c.steel} kg\n  Formwork : ${c.formwork} m²\n`;
    c.rows.forEach(r => { txt += `    ${r.pos}: ${r.count}×DB${r.dia}, L=${r.len}m → ${r.kg} kg\n`; });
  });
  navigator.clipboard.writeText(txt);
  const btn = document.getElementById('copy-btn');
  btn.textContent = '✓ Copied!';
  btn.classList.add('copied');
  setTimeout(() => { btn.textContent = 'Copy Summary'; btn.classList.remove('copied'); }, 2000);
}

window.qt_runCalculate = qt_runCalculate;
window.qt_copyResult = qt_copyResult;
globalThis.qt_runCalculate = qt_runCalculate;
globalThis.qt_copyResult = qt_copyResult;
