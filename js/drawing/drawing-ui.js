/**
 * Renders Drawing Intelligence status, warnings, review cards, and field
 * editing controls for the extracted structural elements.
 */

const qt_elementsData = globalThis.qt_elementsData || [];

export function qt_setPhase(n) {
  [1, 2, 3].forEach(i => {
    const ps = document.getElementById(`ps-${i}`);
    ps.className = 'phase-step' + (i === n ? ' active' : i < n ? ' done' : '');
  });
  [1, 2].forEach(i => {
    const pl = document.getElementById(`pl-${i}`);
    if (pl) pl.className = 'phase-line' + (i < n ? ' done' : '');
  });
  document.getElementById('phase1').style.display = n === 1 ? 'flex' : 'none';
  document.getElementById('phase1').style.flexDirection = 'column';
  document.getElementById('phase1').style.gap = '24px';
  document.getElementById('review-section').style.display = n === 2 ? 'block' : 'none';
  document.getElementById('result-section').style.display = n === 3 ? 'block' : 'none';
}

export function qt_goBack() { qt_setPhase(1); }
export function qt_goReview() { qt_renderReview(); qt_setPhase(2); }

export function qt_setStatus(s) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  const m = { ready: ['#334155', 'Ready'], loading: ['#22d3ee', 'Analyzing…'], review: ['#f59e0b', 'Review'], done: ['#10b981', 'Complete'], error: ['#ef4444', 'Error'] };
  const [c, l] = m[s] || m.ready;
  dot.style.background = c;
  dot.style.boxShadow = s === 'loading' ? `0 0 6px ${c}` : 'none';
  txt.textContent = l;
  txt.style.color = c;
}

export function qt_showError(msg) { const el = document.getElementById('error-box'); el.style.display = 'block'; el.innerHTML = '⚠️ ' + msg; qt_setStatus('error'); }
export function qt_hideError() { document.getElementById('error-box').style.display = 'none'; }
export function qt_setProgress(msg) { const el = document.getElementById('progress'); if (msg) { el.style.display = 'flex'; document.getElementById('progress-msg').textContent = msg; } else { el.style.display = 'none'; } }
export function qt_getActiveChips(id) { return [...document.querySelectorAll(`#${id} .chip.active`)].map(c => c.dataset.id); }
export function qt_toggleChip(el) { el.classList.toggle('active'); }
export function qt_toggleCalcChip(el) { el.classList.toggle('active'); const calc = el.dataset.calc; if (el.classList.contains('active')) { if (calc === 'concrete') el.classList.add('active-green'); else if (calc === 'formwork') el.classList.add('active-yellow'); } else { el.classList.remove('active-green', 'active-yellow'); } }
export function qt_getCalcOptions() { return [...document.querySelectorAll('#calc-chips .calc-chip.active')].map(c => c.dataset.calc); }

export function qt_renderReview(warnings = []) {
  const container = document.getElementById('el-cards-container');
  container.innerHTML = '';
  if (warnings.length) container.innerHTML += `<div class="warn-box">⚠️ ${warnings.join(' · ')}</div>`;
  globalThis.qt_elementsData.forEach((el, i) => container.innerHTML += qt_buildElCard(el, i));
}

export function qt_buildElCard(el, i) {
  const est = v => v ? 'estimated' : '';
  const estBadge = v => v ? '<span class="estimated-badge">EST</span>' : '';
  const isSlab = (el.type || 'beam') === 'slab';
  const header = `
  <div class="el-card" id="elcard-${i}">
    <div class="el-card-header">
      <div style="display:flex;align-items:center;gap:10px">
        <input class="el-id-input" type="text" value="${el.id}" data-el="${i}" data-field="id" oninput="qt_updateField(this)">
        ${estBadge(el.estimated)}
        <span class="el-type-badge">${el.type || 'beam'}</span>
      </div>
      <button class="el-delete" onclick="qt_deleteElement(${i})" title="ลบ element นี้">✕</button>
    </div>
    <div class="el-body">`;
  const footer = `</div></div>`;

  if (isSlab) {
    return header + `
      <div class="field-grid">
        <div class="field-group"><div class="field-label">Width</div><input class="field-input ${est(el.estimated)}" type="number" min="0" step="0.01" value="${el.width_m || el.width / 1000 || 4}" data-el="${i}" data-field="slab_width_m" oninput="qt_updateField(this)"><div class="field-unit">m</div></div>
        <div class="field-group"><div class="field-label">Length</div><input class="field-input ${est(el.estimated)}" type="number" min="0" step="0.01" value="${el.length_slab || 0}" data-el="${i}" data-field="length_slab" oninput="qt_updateField(this)"><div class="field-unit">m</div></div>
        <div class="field-group"><div class="field-label">Thickness</div><input class="field-input ${est(el.estimated)}" type="number" min="1" value="${el.thickness || 120}" data-el="${i}" data-field="thickness" oninput="qt_updateField(this)"><div class="field-unit">mm</div></div>
      </div>
      <div class="steel-section"><div class="steel-section-title">Reinforcement</div><div class="steel-row"><div class="steel-pos">Main Bar ${estBadge(el.steel_main?.estimated)}</div><div style="display:flex;align-items:center;gap:6px;flex:1;flex-wrap:wrap"><span style="font-size:11px;color:var(--muted)">${el.steel_main?.type || 'DB'}</span><input class="steel-input ${est(el.steel_main?.estimated)}" type="number" min="6" max="32" value="${el.steel_main?.dia ?? 12}" data-el="${i}" data-field="slab_main_dia" oninput="qt_updateField(this)" style="width:70px"><span style="font-size:11px;color:var(--muted)">@ every</span><input class="steel-input ${est(el.steel_main?.estimated)}" type="number" min="0.05" max="1" step="0.01" value="${el.steel_main?.spacing ?? 0.20}" data-el="${i}" data-field="slab_main_spacing" oninput="qt_updateField(this)" style="width:70px"><span style="font-size:11px;color:var(--muted)">m</span></div></div><div class="steel-row"><div class="steel-pos">Dist Bar ${estBadge(el.steel_dist?.estimated)}</div><div style="display:flex;align-items:center;gap:6px;flex:1;flex-wrap:wrap"><span style="font-size:11px;color:var(--muted)">${el.steel_dist?.type || 'DB'}</span><input class="steel-input ${est(el.steel_dist?.estimated)}" type="number" min="6" max="32" value="${el.steel_dist?.dia ?? 12}" data-el="${i}" data-field="slab_dist_dia" oninput="qt_updateField(this)" style="width:70px"><span style="font-size:11px;color:var(--muted)">@ every</span><input class="steel-input ${est(el.steel_dist?.estimated)}" type="number" min="0.05" max="1" step="0.01" value="${el.steel_dist?.spacing ?? 0.20}" data-el="${i}" data-field="slab_dist_spacing" oninput="qt_updateField(this)" style="width:70px"><span style="font-size:11px;color:var(--muted)">m</span></div></div></div>` + footer;
  }

  const groups = el.length_groups || (el.length ? [{ length: el.length, qty: 1 }] : [{ length: 0, qty: 1 }]);
  const sections = el.sections || [{ label: 'Section 1-1', length_ratio: 1.0, steel_top: el.steel_top || { count: 2, dia: 16 }, steel_bottom: el.steel_bottom || { count: 2, dia: 16 }, steel_extra: el.steel_extra || [], stirrup: el.stirrup || null }];
  const groupRows = groups.map((g, gi) => `<div class="steel-row" style="align-items:center;gap:8px" id="lg-${i}-${gi}"><div class="steel-pos" style="min-width:60px">ช่วงที่ ${gi + 1}</div><span style="font-size:11px;color:var(--muted)">L =</span><input class="steel-input" type="number" min="0" step="0.01" value="${g.length || 0}" data-el="${i}" data-field="lg_len_${gi}" oninput="qt_updateField(this)" style="width:72px"><span style="font-size:11px;color:var(--muted)">m ×</span><input class="steel-input" type="number" min="1" step="1" value="${g.qty || 1}" data-el="${i}" data-field="lg_qty_${gi}" oninput="qt_updateField(this)" style="width:55px"><span style="font-size:11px;color:var(--muted)">ตัว</span>${groups.length > 1 ? `<button onclick="qt_removeLengthGroup(${i},${gi})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0 4px">✕</button>` : ''}</div>`).join('');
  const sectionHtml = sections.map((sec, si) => {
    let extraH = '';
    (sec.steel_extra || []).forEach((s, j) => { extraH += `<div class="steel-row"><div class="steel-pos" style="font-size:10px">Extra ${j + 1}</div><input class="steel-input" type="number" min="1" max="20" value="${s.count || 2}" data-el="${i}" data-field="sec_${si}_extra_count_${j}" style="width:60px"><div class="steel-between">× DB</div><input class="steel-input" type="number" min="6" max="40" value="${s.dia || 16}" data-el="${i}" data-field="sec_${si}_extra_dia_${j}" style="width:60px"></div>`; });
    return `<div class="section-block" id="sec-${i}-${si}"><div class="section-header"><span class="section-label">${sec.label || `Section ${si + 1}`}</span><div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;color:var(--muted)">สัดส่วน</span><input class="steel-input" type="number" min="0.01" max="1" step="0.01" value="${+(sec.length_ratio || 1).toFixed(2)}" data-el="${i}" data-field="sec_${si}_ratio" oninput="qt_updateField(this)" style="width:60px"><span style="font-size:10px;color:var(--muted)">× L</span></div></div><div class="steel-row"><div class="steel-pos">Top ${estBadge(sec.steel_top?.estimated)}</div><input class="steel-input ${est(sec.steel_top?.estimated)}" type="number" min="0" max="20" value="${sec.steel_top?.count ?? 2}" data-el="${i}" data-field="sec_${si}_top_count" oninput="qt_updateField(this)" style="width:65px"><div class="steel-between">× DB</div><input class="steel-input ${est(sec.steel_top?.estimated)}" type="number" min="6" max="40" value="${sec.steel_top?.dia ?? 16}" data-el="${i}" data-field="sec_${si}_top_dia" oninput="qt_updateField(this)" style="width:65px"></div><div class="steel-row"><div class="steel-pos">Bottom ${estBadge(sec.steel_bottom?.estimated)}</div><input class="steel-input ${est(sec.steel_bottom?.estimated)}" type="number" min="0" max="20" value="${sec.steel_bottom?.count ?? 2}" data-el="${i}" data-field="sec_${si}_bot_count" oninput="qt_updateField(this)" style="width:65px"><div class="steel-between">× DB</div><input class="steel-input ${est(sec.steel_bottom?.estimated)}" type="number" min="6" max="40" value="${sec.steel_bottom?.dia ?? 16}" data-el="${i}" data-field="sec_${si}_bot_dia" oninput="qt_updateField(this)" style="width:65px"></div>${extraH}<div class="steel-row" style="margin-top:4px"><div class="steel-pos">Stirrup ${sec.stirrup ? estBadge(sec.stirrup.estimated) : ''}</div><div style="display:flex;align-items:center;gap:6px;flex:1;flex-wrap:wrap"><div class="bar-type-toggle"><button class="bar-type-btn ${(sec.stirrup?.type || 'DB') === 'DB' ? 'active-db' : ''}" onclick="qt_setSecStirrupType(${i},${si},'DB',this)">DB</button><button class="bar-type-btn ${(sec.stirrup?.type || 'DB') === 'RB' ? 'active-rb' : ''}" onclick="qt_setSecStirrupType(${i},${si},'RB',this)">RB</button></div><input class="steel-input ${est(sec.stirrup?.estimated)}" type="number" min="6" max="25" value="${sec.stirrup?.dia ?? 6}" data-el="${i}" data-field="sec_${si}_stir_dia" oninput="qt_updateField(this)" style="width:60px"><span style="font-size:11px;color:var(--muted)">@ every</span><input class="steel-input ${est(sec.stirrup?.estimated)}" type="number" min="0.05" max="1" step="0.01" value="${sec.stirrup?.spacing ?? 0.15}" data-el="${i}" data-field="sec_${si}_stir_sp" oninput="qt_updateField(this)" style="width:65px"><span style="font-size:11px;color:var(--muted)">m</span></div></div></div>`;
  }).join('');

  return header + `<div class="field-grid"><div class="field-group"><div class="field-label">Width</div><input class="field-input ${est(el.estimated)}" type="number" min="1" value="${el.width || 250}" data-el="${i}" data-field="width" oninput="qt_updateField(this)"><div class="field-unit">mm</div></div><div class="field-group"><div class="field-label">Height / Depth</div><input class="field-input ${est(el.estimated)}" type="number" min="1" value="${el.height || 500}" data-el="${i}" data-field="height" oninput="qt_updateField(this)"><div class="field-unit">mm</div></div></div><div class="steel-section"><div class="steel-section-title" style="display:flex;justify-content:space-between;align-items:center"><span>ช่วงความยาว (Length Groups)</span><button class="add-el-btn" style="padding:4px 10px;font-size:11px" onclick="qt_addLengthGroup(${i})">+ เพิ่มช่วง</button></div><div id="lg-container-${i}">${groupRows}</div></div><div class="steel-section" style="margin-top:12px"><div class="steel-section-title" style="display:flex;justify-content:space-between;align-items:center"><span>Sections (หน้าตัดเหล็ก)</span><button class="add-el-btn" style="padding:4px 10px;font-size:11px" onclick="qt_addSection(${i})">+ เพิ่ม Section</button></div><div id="sec-container-${i}">${sectionHtml}</div></div>` + footer;
}

export function qt_updateField(input) {
  const i = +input.dataset.el, field = input.dataset.field, val = input.value;
  const el = globalThis.qt_elementsData[i];
  if (!el) return;
  if (field === 'id') { el.id = val; return; }
  if (field === 'width') { el.width = +val; return; }
  if (field === 'height') { el.height = +val; return; }
  if (field === 'length') { el.length = +val; return; }
  if (field === 'steel_top_count') { el.steel_top = el.steel_top || {}; el.steel_top.count = +val; return; }
  if (field === 'steel_top_dia') { el.steel_top = el.steel_top || {}; el.steel_top.dia = +val; return; }
  if (field === 'steel_bottom_count') { el.steel_bottom = el.steel_bottom || {}; el.steel_bottom.count = +val; return; }
  if (field === 'steel_bottom_dia') { el.steel_bottom = el.steel_bottom || {}; el.steel_bottom.dia = +val; return; }
  if (field === 'stirrup_dia') { el.stirrup = el.stirrup || {}; el.stirrup.dia = +val; return; }
  if (field === 'stirrup_spacing') { el.stirrup = el.stirrup || {}; el.stirrup.spacing = +val; return; }
  if (field === 'stirrup_type') { el.stirrup = el.stirrup || {}; el.stirrup.type = val; return; }
  if (field === 'length_slab') { el.length_slab = +val; return; }
  if (field === 'slab_width_m') { el.width_m = +val; return; }
  if (field === 'thickness') { el.thickness = +val; return; }
  if (field === 'slab_main_dia') { el.steel_main = el.steel_main || {}; el.steel_main.dia = +val; return; }
  if (field === 'slab_main_spacing') { el.steel_main = el.steel_main || {}; el.steel_main.spacing = +val; return; }
  if (field === 'slab_dist_dia') { el.steel_dist = el.steel_dist || {}; el.steel_dist.dia = +val; return; }
  if (field === 'slab_dist_spacing') { el.steel_dist = el.steel_dist || {}; el.steel_dist.spacing = +val; return; }
  const extraCount = field.match(/^extra_count_(\d+)$/);
  const extraDia = field.match(/^extra_dia_(\d+)$/);
  if (extraCount) { el.steel_extra[+extraCount[1]].count = +val; }
  if (extraDia) { el.steel_extra[+extraDia[1]].dia = +val; }
  const lgLen = field.match(/^lg_len_(\d+)$/);
  if (lgLen) { const gi = +lgLen[1]; el.length_groups = el.length_groups || []; el.length_groups[gi] = el.length_groups[gi] || {}; el.length_groups[gi].length = +val; return; }
  const lgQty = field.match(/^lg_qty_(\d+)$/);
  if (lgQty) { const gi = +lgQty[1]; el.length_groups = el.length_groups || []; el.length_groups[gi] = el.length_groups[gi] || {}; el.length_groups[gi].qty = +val; return; }
  const secM = field.match(/^sec_(\d+)_(.+)$/);
  if (secM) { const si = +secM[1], sf = secM[2]; el.sections = el.sections || []; el.sections[si] = el.sections[si] || {}; const sec = el.sections[si]; if (sf === 'ratio') { sec.length_ratio = +val; return; } if (sf === 'top_count') { sec.steel_top = sec.steel_top || {}; sec.steel_top.count = +val; return; } if (sf === 'top_dia') { sec.steel_top = sec.steel_top || {}; sec.steel_top.dia = +val; return; } if (sf === 'bot_count') { sec.steel_bottom = sec.steel_bottom || {}; sec.steel_bottom.count = +val; return; } if (sf === 'bot_dia') { sec.steel_bottom = sec.steel_bottom || {}; sec.steel_bottom.dia = +val; return; } if (sf === 'stir_dia') { sec.stirrup = sec.stirrup || {}; sec.stirrup.dia = +val; return; } if (sf === 'stir_sp') { sec.stirrup = sec.stirrup || {}; sec.stirrup.spacing = +val; return; } }
}

export function qt_setStirrupType(i, type, btn) { const el = globalThis.qt_elementsData[i]; if (!el) return; el.stirrup = el.stirrup || {}; el.stirrup.type = type; const toggle = btn.closest('.bar-type-toggle'); toggle.querySelectorAll('.bar-type-btn').forEach(b => b.classList.remove('active-db', 'active-rb')); btn.classList.add(type === 'DB' ? 'active-db' : 'active-rb'); }
export function qt_setSecStirrupType(i, si, type, btn) { const el = globalThis.qt_elementsData[i]; if (!el) return; el.sections = el.sections || []; el.sections[si] = el.sections[si] || {}; el.sections[si].stirrup = el.sections[si].stirrup || {}; el.sections[si].stirrup.type = type; const toggle = btn.closest('.bar-type-toggle'); toggle.querySelectorAll('.bar-type-btn').forEach(b => b.classList.remove('active-db', 'active-rb')); btn.classList.add(type === 'DB' ? 'active-db' : 'active-rb'); }
export function qt_addLengthGroup(i) { const el = globalThis.qt_elementsData[i]; if (!el) return; el.length_groups = el.length_groups || []; el.length_groups.push({ length: 0, qty: 1 }); qt_renderReview(); }
export function qt_removeLengthGroup(i, gi) { const el = globalThis.qt_elementsData[i]; if (!el || !el.length_groups) return; el.length_groups.splice(gi, 1); qt_renderReview(); }
export function qt_addSection(i) { const el = globalThis.qt_elementsData[i]; if (!el) return; el.sections = el.sections || []; const si = el.sections.length; el.sections.push({ label: `Section ${si + 1}`, length_ratio: 0.5, steel_top: { count: 2, dia: 16, estimated: true }, steel_bottom: { count: 2, dia: 16, estimated: true }, steel_extra: [], stirrup: { dia: 6, spacing: 0.15, type: 'DB', estimated: true } }); qt_renderReview(); }
export function qt_deleteElement(i) { globalThis.qt_elementsData.splice(i, 1); qt_renderReview(); }
export function qt_addElement() { globalThis.qt_elementsData.push({ id: `B${globalThis.qt_elementsData.length + 1}`, type: 'beam', width: 250, height: 500, estimated: true, length_groups: [{ length: 5.0, qty: 1 }], sections: [{ label: 'Section 1', length_ratio: 1.0, steel_top: { count: 2, dia: 16, estimated: true }, steel_bottom: { count: 2, dia: 16, estimated: true }, steel_extra: [], stirrup: { dia: 6, spacing: 0.15, type: 'DB', estimated: true } }] }); qt_renderReview(); setTimeout(() => { const cards = document.querySelectorAll('.el-card'); cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100); }
