// wz-step3.js — Onboarding Wizard Step 3: project config, timeline + budget estimate
//
// 5 sections per AOW 1.3: A Project Identity, B Design Standard, C Site Location,
// D Timeline (estimateConstructionDuration + calculateBudgetImpact), E Material Pricing.
// wz_finishWizard() assembles project_config, marks the wizard complete, syncs the
// project record, and advances to Step 4 (pipeline generation).

import { PROVINCIAL_WEATHER } from '../shared/schema.js';
import { estimateConstructionDuration, calculateBudgetImpact } from '../shared/timeline-engine.js';
import { getCurrentProjectId, getCurrentProject, getProjectElements, updateProject } from '../shared/project-store.js';
import { wz_ensureConfig, wz_saveConfig, wz_goToStep, wz_prevStep } from './wz-index.js';

const PROVINCES = Object.keys(PROVINCIAL_WEATHER);

const BUILDING_TYPE_LABEL = {
  residential: 'พักอาศัย',
  commercial: 'พาณิชย์',
  industrial: 'อุตสาหกรรม',
  institutional: 'สถาบัน/ราชการ',
};

let formState = null;
let lastEstimate = null;

export function wz_renderStep3(root) {
  const projectId = getCurrentProjectId();
  const project = getCurrentProject();
  const config = wz_ensureConfig(projectId);

  formState = {
    project_name: config.project_name || project.name || '',
    building_type: config.building_type || project.building_type || 'residential',
    floor_count: config.floor_count ?? project.floors_above_ground ?? null,
    total_area_sqm: config.total_area_sqm ?? project.total_area_sqm ?? null,
    design_standard: config.design_standard || 'WSD',
    site_province: config.site_province || 'กรุงเทพมหานคร',
    site_district: config.site_district || project.location_label || '',
    site_lat: config.site_lat ?? project.location_lat ?? null,
    site_lng: config.site_lng ?? project.location_lng ?? null,
    user_start_date: config.timeline?.user_start_date || project.start_date || new Date().toISOString().slice(0, 10),
    user_end_date: config.timeline?.user_end_date || null,
    pricing_source: config.pricing_source || 'standard_bq',
  };

  root.innerHTML = `
    <div class="wz-step">
      <h2 class="wz-step__title">ขั้นตอนที่ 3 — ตั้งค่าโครงการ</h2>
      <p class="wz-step__desc">กรอกข้อมูลโครงการเพื่อประมาณระยะเวลาก่อสร้างและงบประมาณ</p>

      <div class="wz-panel">
        <h3 class="wz-panel__title">A. ข้อมูลโครงการ</h3>
        <div class="wz-form-grid">
          <label class="wz-field"><span>ชื่อโครงการ</span><input class="wz-input" id="wz3-name" value="${escapeHtml(formState.project_name)}"></label>
          <label class="wz-field"><span>ประเภทอาคาร</span>
            <select class="wz-input" id="wz3-building-type">
              ${Object.entries(BUILDING_TYPE_LABEL).map(([v, l]) => `<option value="${v}" ${formState.building_type === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </label>
          <label class="wz-field"><span>จำนวนชั้น</span><input type="number" min="1" class="wz-input" id="wz3-floors" value="${formState.floor_count ?? ''}"></label>
          <label class="wz-field"><span>พื้นที่รวม (ตร.ม.)</span><input type="number" min="0" class="wz-input" id="wz3-area" value="${formState.total_area_sqm ?? ''}"></label>
        </div>
      </div>

      <div class="wz-panel">
        <h3 class="wz-panel__title">B. มาตรฐานการออกแบบ</h3>
        <div class="wz-radio-group">
          <label class="wz-radio"><input type="radio" name="wz3-standard" value="WSD" ${formState.design_standard === 'WSD' ? 'checked' : ''}> WSD (Working Stress Design)</label>
          <label class="wz-radio"><input type="radio" name="wz3-standard" value="ACI318" ${formState.design_standard === 'ACI318' ? 'checked' : ''}> ACI 318 (Strength Design)</label>
        </div>
      </div>

      <div class="wz-panel">
        <h3 class="wz-panel__title">C. ที่ตั้งโครงการ</h3>
        <div class="wz-form-grid">
          <label class="wz-field"><span>จังหวัด</span>
            <select class="wz-input" id="wz3-province">
              ${PROVINCES.map(p => `<option value="${p}" ${formState.site_province === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </label>
          <label class="wz-field"><span>อำเภอ/เขต</span><input class="wz-input" id="wz3-district" value="${escapeHtml(formState.site_district)}"></label>
          <div class="wz-field">
            <span>ตำแหน่ง GPS</span>
            <button type="button" class="fp-btn-secondary" id="wz3-gps">📍 ใช้ตำแหน่งปัจจุบัน</button>
            <span class="wz-hint" id="wz3-gps-status">${formState.site_lat ? `${formState.site_lat.toFixed(4)}, ${formState.site_lng.toFixed(4)}` : ''}</span>
          </div>
        </div>
      </div>

      <div class="wz-panel">
        <h3 class="wz-panel__title">D. ระยะเวลาก่อสร้าง</h3>
        <div id="wz3-timeline-body"></div>
      </div>

      <div class="wz-panel">
        <h3 class="wz-panel__title">E. แหล่งราคาวัสดุ</h3>
        <div class="wz-radio-group">
          <label class="wz-radio"><input type="radio" name="wz3-pricing" value="standard_bq" ${formState.pricing_source === 'standard_bq' ? 'checked' : ''}> ราคากลางมาตรฐาน (BQ)</label>
          <label class="wz-radio"><input type="radio" name="wz3-pricing" value="catalog" ${formState.pricing_source === 'catalog' ? 'checked' : ''}> แคตตาล็อกซัพพลายเออร์</label>
          <label class="wz-radio"><input type="radio" name="wz3-pricing" value="manual" ${formState.pricing_source === 'manual' ? 'checked' : ''}> กำหนดราคาเอง</label>
        </div>
      </div>

      <div class="wz-actions">
        <button type="button" class="fp-btn-secondary" id="wz-step3-back">ย้อนกลับ</button>
        <div class="wz-actions__spacer"></div>
        <button type="button" class="fp-btn-primary" id="wz-step3-finish">เสร็จสิ้น — สร้างแผนงาน</button>
      </div>
    </div>
  `;

  root.querySelector('#wz3-name').addEventListener('input', e => formState.project_name = e.target.value);
  root.querySelector('#wz3-building-type').addEventListener('change', e => formState.building_type = e.target.value);
  root.querySelector('#wz3-floors').addEventListener('input', e => formState.floor_count = parseInt(e.target.value, 10) || null);
  root.querySelector('#wz3-area').addEventListener('input', e => formState.total_area_sqm = parseFloat(e.target.value) || null);
  root.querySelectorAll('[name="wz3-standard"]').forEach(r => r.addEventListener('change', e => formState.design_standard = e.target.value));
  root.querySelectorAll('[name="wz3-pricing"]').forEach(r => r.addEventListener('change', e => formState.pricing_source = e.target.value));
  root.querySelector('#wz3-district').addEventListener('input', e => formState.site_district = e.target.value);
  root.querySelector('#wz3-province').addEventListener('change', e => {
    formState.site_province = e.target.value;
    wz_recalcTimeline(root, projectId);
  });
  root.querySelector('#wz3-gps').addEventListener('click', () => wz_useGpsLocation(root));

  root.querySelector('#wz-step3-back').addEventListener('click', () => wz_prevStep());
  root.querySelector('#wz-step3-finish').addEventListener('click', () => wz_finishWizard(root, projectId));

  wz_recalcTimeline(root, projectId);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function wz_useGpsLocation(root) {
  const status = root.querySelector('#wz3-gps-status');
  if (!navigator.geolocation) { status.textContent = 'อุปกรณ์ไม่รองรับ GPS'; return; }
  status.textContent = 'กำลังค้นหาตำแหน่ง…';
  navigator.geolocation.getCurrentPosition(
    pos => {
      formState.site_lat = pos.coords.latitude;
      formState.site_lng = pos.coords.longitude;
      status.textContent = `${formState.site_lat.toFixed(4)}, ${formState.site_lng.toFixed(4)}`;
    },
    () => { status.textContent = 'ไม่สามารถเข้าถึงตำแหน่งได้'; },
  );
}

function wz_recalcTimeline(root, projectId) {
  const { elements, beamLibraryById } = getProjectElements(projectId);
  const project = getCurrentProject();
  lastEstimate = estimateConstructionDuration(elements, beamLibraryById, formState.site_province, {
    ...project,
    start_date: formState.user_start_date,
  });

  if (!formState.user_end_date) {
    const start = new Date(formState.user_start_date);
    start.setUTCDate(start.getUTCDate() + lastEstimate.estimated_recommended_days);
    formState.user_end_date = start.toISOString().slice(0, 10);
  }

  wz_renderTimelineBody(root);
}

function wz_renderTimelineBody(root) {
  const body = root.querySelector('#wz3-timeline-body');
  const { estimated_min_days, estimated_recommended_days, estimated_max_days, weather_buffer_days, rainy_season_months, method } = lastEstimate;
  const maxScale = estimated_max_days || 1;

  body.innerHTML = `
    <div class="wz-timeline-bars">
      <div class="wz-bar-row"><span class="wz-bar-row__label">เร่งที่สุด</span><div class="wz-bar"><div class="wz-bar__fill wz-bar__fill--min" style="width:${(estimated_min_days / maxScale) * 100}%"></div></div><span class="wz-bar-row__value">${estimated_min_days} วัน</span></div>
      <div class="wz-bar-row"><span class="wz-bar-row__label">แนะนำ</span><div class="wz-bar"><div class="wz-bar__fill wz-bar__fill--recommended" style="width:${(estimated_recommended_days / maxScale) * 100}%"></div></div><span class="wz-bar-row__value">${estimated_recommended_days} วัน</span></div>
      <div class="wz-bar-row"><span class="wz-bar-row__label">ระยะเผื่อสูงสุด</span><div class="wz-bar"><div class="wz-bar__fill wz-bar__fill--max" style="width:100%"></div></div><span class="wz-bar-row__value">${estimated_max_days} วัน</span></div>
    </div>
    <p class="wz-hint">เผื่อฤดูฝน ${weather_buffer_days} วัน (${rainy_season_months.length ? `เดือน ${rainy_season_months.join(', ')}` : 'ไม่มีข้อมูล'}) · วิธีประมาณ: ${method === 'engine' ? 'จากแบบที่อ่านได้' : 'ประมาณเบื้องต้น'}</p>

    <div class="wz-form-grid">
      <label class="wz-field"><span>วันที่เริ่มงาน</span><input type="date" class="wz-input" id="wz3-start-date" value="${formState.user_start_date}"></label>
      <label class="wz-field"><span>วันที่สิ้นสุด (ตามแผนผู้ใช้)</span><input type="date" class="wz-input" id="wz3-end-date" value="${formState.user_end_date}"></label>
    </div>

    <div class="wz-banner" id="wz3-budget-banner"></div>
  `;

  body.querySelector('#wz3-start-date').addEventListener('change', e => {
    formState.user_start_date = e.target.value;
    wz_recalcBudget(body);
  });
  body.querySelector('#wz3-end-date').addEventListener('change', e => {
    formState.user_end_date = e.target.value;
    wz_recalcBudget(body);
  });

  wz_recalcBudget(body);
}

function wz_recalcBudget(body) {
  const budget = calculateBudgetImpact(
    { estimated_recommended_days: lastEstimate.estimated_recommended_days },
    formState.user_start_date,
    formState.user_end_date,
  );
  formState.budget_impact = budget;

  const banner = body.querySelector('#wz3-budget-banner');
  const riskTone = { none: 'info', low: 'info', medium: 'amber', high: 'red' }[budget.risk_level] || 'info';
  const deltaText = budget.delta_cost
    ? `${budget.delta_cost > 0 ? '+' : ''}${budget.delta_cost.toLocaleString('th-TH')} บาท`
    : 'ไม่มีการเปลี่ยนแปลง';
  banner.className = `wz-banner wz-banner--${riskTone}`;
  banner.textContent = `ประมาณการงบ ${budget.current_cost_estimate.toLocaleString('th-TH')} บาท (${deltaText})` +
    (budget.extra_crew_needed ? ` · ต้องเพิ่มทีมงาน ${budget.extra_crew_needed} คน` : '') +
    (budget.rain_risk_extra_days ? ` · เสี่ยงฝนเพิ่ม ${budget.rain_risk_extra_days} วัน` : '');
}

function wz_finishWizard(root, projectId) {
  const config = wz_ensureConfig(projectId);

  config.project_name = formState.project_name;
  config.building_type = formState.building_type;
  config.floor_count = formState.floor_count;
  config.total_area_sqm = formState.total_area_sqm;
  config.design_standard = formState.design_standard;
  config.site_province = formState.site_province;
  config.site_district = formState.site_district || null;
  config.site_lat = formState.site_lat;
  config.site_lng = formState.site_lng;
  config.pricing_source = formState.pricing_source;

  config.timeline = {
    ...config.timeline,
    estimated_min_days: lastEstimate.estimated_min_days,
    estimated_recommended_days: lastEstimate.estimated_recommended_days,
    estimated_max_days: lastEstimate.estimated_max_days,
    user_start_date: formState.user_start_date,
    user_end_date: formState.user_end_date,
    user_duration_days: Math.max(1, Math.round((new Date(formState.user_end_date) - new Date(formState.user_start_date)) / 86400000)),
    weather_buffer_days: lastEstimate.weather_buffer_days,
    rainy_season_months: lastEstimate.rainy_season_months,
    estimation_basis: {
      ...config.timeline?.estimation_basis,
      ...lastEstimate.estimation_basis,
    },
  };

  config.budget_impact = formState.budget_impact || config.budget_impact;
  config.wizard_completed_at = new Date().toISOString();
  config.wizard_step_reached = 4;
  wz_saveConfig(config, projectId);

  updateProject(projectId, {
    name: formState.project_name || undefined,
    building_type: formState.building_type,
    floors_above_ground: formState.floor_count,
    total_area_sqm: formState.total_area_sqm,
    location_label: formState.site_district || formState.site_province,
    location_lat: formState.site_lat,
    location_lng: formState.site_lng,
    start_date: formState.user_start_date,
    status: 'active',
  });

  wz_goToStep(4);
}
