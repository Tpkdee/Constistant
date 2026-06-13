// js/resource/resource-index.js
// Resource Hub — manpower / material / equipment readiness dashboard
// Self-contained: state, rendering, styles all in this file.
// Mounts into #resource-app inside contistant.html.

import { getCurrentProject, getCurrentProjectId, projectStorageKey, DEMO_PROJECT_ID, PROJECT_EVENT } from '../shared/project-store.js';
import { getDemoDataByEngine } from '../shared/demo-seed.js';
import { CREW_TYPES, EQUIPMENT_TYPES, EQUIPMENT_RATES, MATERIAL_LEAD_TIMES } from '../shared/schema.js';
import { STORAGE_KEYS, PIPELINE_EVENT } from '../shared/pipeline.js';

const PLAN_KEY = 'constistant_resource_plan_v1';

const EQUIP_STATUS_LABELS = {
  not_booked: 'ยังไม่จอง',
  booked: 'จองแล้ว',
  on_site: 'อยู่ในไซต์',
  returned: 'คืนแล้ว',
  not_needed: 'ไม่ต้องใช้',
};

const EQUIP_STATUS_COLOR = {
  not_booked: 'amber',
  booked: 'green',
  on_site: 'green',
  returned: 'gray',
  not_needed: 'gray',
};

const CREW_CHART_COLORS = {
  steel_fixer: '#2563eb',
  carpenter: '#d97706',
  concrete_gang: '#16a34a',
  mason: '#9333ea',
  electrician: '#0891b2',
  plumber: '#0d9488',
  painter: '#db2777',
  surveyor: '#64748b',
  piling: '#78350f',
  site_foreman: '#475569',
  other: '#9ca3af',
};

const STATUS_TH = {
  green: 'พร้อม',
  amber: 'ใกล้พอ',
  red: 'ขาดคน',
};

const MATERIAL_STATUS_TH = {
  green: 'พร้อม',
  amber: 'รอส่งมอบ',
  red: 'ด่วน',
};

export const rh_state = {
  active_tab: 'manpower', // 'manpower' | 'material' | 'equipment'
  crew_cards: [],
  material_rows: [],
  equipment_cards: [],
  alerts: [],
  weekly_demand: [],
  kpi: {
    total_budget: 0,
    labor_pct: 0,
    material_pct: 0,
    equipment_pct: 0,
    readiness_pct: 0,
    critical_count: 0,
    schedule_impact_days: 0,
  },
  has_plan: false,
};

let _project = null;
let _scheduleTasks = [];
let _resourceItems = [];
let _suppliers = [];
let _plan = { crew_confirmed: {}, material_status: {}, equipment_status: {} };

// ─────────────────────────────────────────────
// Data loading
// ─────────────────────────────────────────────

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadPlan() {
  const stored = readJSON(projectStorageKey(PLAN_KEY));
  if (stored) return stored;
  if (getCurrentProjectId() === DEMO_PROJECT_ID) {
    const demo = getDemoDataByEngine('resource');
    if (demo.resource_plan_seed) {
      return JSON.parse(JSON.stringify(demo.resource_plan_seed));
    }
  }
  return { crew_confirmed: {}, material_status: {}, equipment_status: {} };
}

function savePlan() {
  localStorage.setItem(projectStorageKey(PLAN_KEY), JSON.stringify(_plan));
}

function loadData() {
  _project = getCurrentProject();
  if (getCurrentProjectId() === DEMO_PROJECT_ID) {
    const demo = getDemoDataByEngine('resource');
    _scheduleTasks = demo.schedule_tasks || [];
    _resourceItems = demo.expected_resources || [];
    _suppliers = demo.suppliers || [];
  } else {
    _scheduleTasks = readJSON(projectStorageKey(STORAGE_KEYS.schedule)) || [];
    _resourceItems = readJSON(projectStorageKey(STORAGE_KEYS.resources)) || [];
    _suppliers = [];
  }
  _plan = loadPlan();
}

// ─────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────

function crewTypeForTask(task) {
  const name = (task.activity_name || '').toLowerCase();
  if (name.includes('rebar')) return 'steel_fixer';
  if (name.includes('formwork')) return 'carpenter';
  if (name.includes('concrete')) return 'concrete_gang';
  if (name.includes('mason') || name.includes('wall')) return 'mason';
  if (name.includes('electric')) return 'electrician';
  if (name.includes('plumb')) return 'plumber';
  if (name.includes('paint')) return 'painter';
  if (name.includes('pile')) return 'piling';
  if (name.includes('survey')) return 'surveyor';
  return null;
}

function buildCrewCards() {
  const requiredByType = {};
  _scheduleTasks.forEach((task) => {
    const type = crewTypeForTask(task);
    if (!type) return;
    const size = task.crew_size || 0;
    requiredByType[type] = Math.max(requiredByType[type] || 0, size);
  });

  const confirmed = _plan.crew_confirmed || {};

  return Object.entries(requiredByType)
    .filter(([, required]) => required > 0)
    .map(([type, required]) => {
      const def = CREW_TYPES[type] || { name_th: type, icon: '👷', day_rate_thb: 0, productivity_unit: '-' };
      const confirmedCount = confirmed[type] ?? 0;
      const ratio = required > 0 ? confirmedCount / required : 1;
      let status = 'red';
      if (ratio >= 1) status = 'green';
      else if (ratio >= 0.7) status = 'amber';
      return {
        crew_type: type,
        name_th: def.name_th,
        icon: def.icon,
        day_rate_thb: def.day_rate_thb,
        productivity_unit: def.productivity_unit,
        required,
        confirmed: confirmedCount,
        ratio,
        status,
      };
    });
}

function buildMaterialRows() {
  const today = new Date();
  return _resourceItems
    .filter((i) => i.resource_type === 'material')
    .map((item) => {
      const task = _scheduleTasks.find((t) => t.id === item.schedule_task_id);
      const planEntry = (_plan.material_status && _plan.material_status[item.id]) || {};
      const supplier = _suppliers.find((s) => s.id === item.supplier_id);

      const activityName = (task && task.activity_name) || '';
      let leadTimeKey = null;
      if (/rebar/i.test(activityName)) leadTimeKey = 'rebar';
      else if (/formwork/i.test(activityName)) leadTimeKey = 'formwork';
      else if (/concrete/i.test(activityName)) leadTimeKey = 'concrete';
      const leadTime = leadTimeKey ? MATERIAL_LEAD_TIMES[leadTimeKey] : null;

      const neededDate = task ? task.start_date : null;
      const daysUntilNeeded = neededDate
        ? Math.round((new Date(neededDate) - today) / 86400000)
        : null;

      const ordered = planEntry.qty_ordered || 0;
      const received = planEntry.qty_received || 0;
      const needed = item.quantity || 0;

      let status = 'green';
      if (received >= needed && needed > 0) status = 'green';
      else if (ordered > 0) status = 'amber';
      else status = 'red';
      if (received < needed && daysUntilNeeded !== null && daysUntilNeeded < 0) status = 'red';

      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        needed_qty: needed,
        qty_ordered: ordered,
        qty_received: received,
        supplier_name: planEntry.supplier_name || (supplier ? supplier.name : ''),
        order_date: task ? task.material_order_date : null,
        lead_time_days: leadTime,
        days_until_needed: daysUntilNeeded,
        status,
        schedule_task_id: item.schedule_task_id,
      };
    });
}

function buildEquipmentCards() {
  const proj = _project || {};
  const hasPiling = _scheduleTasks.some((t) => /pil/i.test(t.activity_name || ''));
  const ctx = {
    floors_above_ground: proj.floors_above_ground || 0,
    total_area_sqm: proj.total_area_sqm || 0,
    has_piling: hasPiling,
  };

  return Object.entries(EQUIPMENT_TYPES)
    .filter(([, def]) => {
      switch (def.condition) {
        case 'always': return true;
        case 'floors_above_ground >= 2': return ctx.floors_above_ground >= 2;
        case 'has_piling': return ctx.has_piling;
        case 'total_area_sqm > 200': return ctx.total_area_sqm > 200;
        default: return true;
      }
    })
    .map(([type, def]) => {
      const planEntry = (_plan.equipment_status && _plan.equipment_status[type]) || { status: 'not_booked', vendor_name: '' };
      const status = planEntry.status || 'not_booked';
      return {
        equipment_type: type,
        name_th: def.name_th,
        icon: def.icon,
        rate_thb_per_day: EQUIPMENT_RATES[type] || 0,
        status,
        vendor_name: planEntry.vendor_name || '',
        color: EQUIP_STATUS_COLOR[status] || 'amber',
      };
    });
}

function buildWeeklyDemand() {
  if (!_project || !_project.start_date || _scheduleTasks.length === 0) return [];
  const start = new Date(_project.start_date);
  const buckets = {};

  _scheduleTasks.forEach((task) => {
    if (!task.start_date) return;
    const taskStart = new Date(task.start_date);
    const weekIndex = Math.max(0, Math.floor((taskStart - start) / (7 * 86400000)));
    if (weekIndex >= 8) return;
    const type = crewTypeForTask(task) || 'other';
    buckets[weekIndex] = buckets[weekIndex] || {};
    buckets[weekIndex][type] = (buckets[weekIndex][type] || 0) + (task.crew_size || 0);
  });

  const weekIndices = Object.keys(buckets).map(Number);
  if (weekIndices.length === 0) return [];
  const maxWeek = Math.max(...weekIndices);

  const weeks = [];
  for (let w = 0; w <= maxWeek; w++) {
    const byType = buckets[w] || {};
    const total = Object.values(byType).reduce((a, b) => a + b, 0);
    weeks.push({ week_index: w, label: `สัปดาห์ ${w + 1}`, total, by_type: byType });
  }
  return weeks;
}

function computeAlerts() {
  const alerts = [];

  rh_state.crew_cards.forEach((c) => {
    if (c.status === 'red') {
      alerts.push({
        severity: 'critical',
        category: 'crew',
        ref_id: c.crew_type,
        title: `${c.name_th} ไม่พอ`,
        detail: `ต้องการ ${c.required} คน ยืนยันแล้ว ${c.confirmed} คน (${Math.round(c.ratio * 100)}%)`,
      });
    } else if (c.status === 'amber') {
      alerts.push({
        severity: 'warning',
        category: 'crew',
        ref_id: c.crew_type,
        title: `${c.name_th} ใกล้พอ`,
        detail: `ยืนยันแล้ว ${c.confirmed}/${c.required} คน`,
      });
    }
  });

  rh_state.material_rows.forEach((m) => {
    if (m.status === 'red') {
      const overdue = m.days_until_needed !== null && m.days_until_needed < 0 ? Math.abs(m.days_until_needed) : null;
      alerts.push({
        severity: 'critical',
        category: 'material',
        ref_id: m.id,
        title: `${m.name} ยังไม่สั่งซื้อ`,
        detail: overdue !== null
          ? `เลยกำหนดใช้งานมาแล้ว ${overdue} วัน — ติดต่อ ${m.supplier_name || 'ผู้จำหน่าย'} ด่วน`
          : `ยังไม่สั่งซื้อ — lead time ${m.lead_time_days || '-'} วัน`,
      });
    } else if (m.status === 'amber') {
      alerts.push({
        severity: 'warning',
        category: 'material',
        ref_id: m.id,
        title: `${m.name} กำลังรอส่งมอบ`,
        detail: `สั่งแล้ว ${m.qty_ordered} / ต้องการ ${m.needed_qty} ${m.unit}`,
      });
    }
  });

  rh_state.equipment_cards.forEach((e) => {
    if (e.status === 'not_booked') {
      alerts.push({
        severity: 'warning',
        category: 'equipment',
        ref_id: e.equipment_type,
        title: `${e.name_th} ยังไม่จอง`,
        detail: `ค่าเช่าประมาณ ฿${e.rate_thb_per_day.toLocaleString()}/วัน — จองล่วงหน้าเพื่อกันคิว`,
      });
    }
  });

  return alerts.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));
}

function computeKPIs() {
  const manpowerCost = _resourceItems.filter((i) => i.resource_type === 'manpower').reduce((s, i) => s + (i.total_cost_thb || 0), 0);
  const materialCost = _resourceItems.filter((i) => i.resource_type === 'material').reduce((s, i) => s + (i.total_cost_thb || 0), 0);
  const equipmentCost = rh_state.equipment_cards
    .filter((e) => e.status === 'booked' || e.status === 'on_site')
    .reduce((s, e) => s + (e.rate_thb_per_day || 0), 0);

  const total = manpowerCost + materialCost + equipmentCost;
  const labor_pct = total > 0 ? Math.round((manpowerCost / total) * 100) : 0;
  const material_pct = total > 0 ? Math.round((materialCost / total) * 100) : 0;
  const equipment_pct = total > 0 ? Math.max(0, 100 - labor_pct - material_pct) : 0;

  const crewRatios = rh_state.crew_cards.map((c) => Math.min(c.ratio, 1));
  const readiness_pct = crewRatios.length
    ? Math.round((crewRatios.reduce((a, b) => a + b, 0) / crewRatios.length) * 100)
    : 100;

  const critical_count = rh_state.alerts.filter((a) => a.severity === 'critical').length;

  let schedule_impact_days = 0;
  rh_state.material_rows.forEach((m) => {
    if (m.status === 'red' && m.lead_time_days) {
      schedule_impact_days = Math.max(schedule_impact_days, m.lead_time_days);
    }
  });
  rh_state.crew_cards.forEach((c) => {
    if (c.status === 'red') schedule_impact_days += 1;
  });

  return {
    total_budget: Math.round(total),
    labor_pct,
    material_pct,
    equipment_pct,
    readiness_pct,
    critical_count,
    schedule_impact_days,
  };
}

function rebuildState() {
  rh_state.has_plan = _scheduleTasks.length > 0;
  rh_state.crew_cards = buildCrewCards();
  rh_state.material_rows = buildMaterialRows();
  rh_state.equipment_cards = buildEquipmentCards();
  rh_state.weekly_demand = buildWeeklyDemand();
  rh_state.alerts = computeAlerts();
  rh_state.kpi = computeKPIs();
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('rh-styles')) return;
  const style = document.createElement('style');
  style.id = 'rh-styles';
  style.textContent = `
    :root {
      --rh-green: #16a34a;
      --rh-green-light: #dcfce7;
      --rh-amber: #d97706;
      --rh-amber-light: #fef3c7;
      --rh-red: #dc2626;
      --rh-red-light: #fee2e2;
      --rh-blue: #2563eb;
      --rh-blue-light: #dbeafe;
      --rh-gray-50: #f9fafb;
      --rh-gray-100: #f3f4f6;
      --rh-gray-200: #e5e7eb;
      --rh-gray-300: #d1d5db;
      --rh-gray-500: #6b7280;
      --rh-gray-700: #374151;
      --rh-gray-900: #111827;
    }
    .rh-app { display:flex; flex-direction:column; gap:16px; font-size:14px; color:var(--rh-gray-900); }

    .rh-kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; position:sticky; top:0; z-index:5; background:var(--rh-gray-50); padding:8px; border-radius:12px; }
    .rh-kpi { background:#fff; border:1px solid var(--rh-gray-200); border-radius:10px; padding:12px 14px; border-left:4px solid var(--rh-gray-300); }
    .rh-kpi--green { border-left-color:var(--rh-green); }
    .rh-kpi--amber { border-left-color:var(--rh-amber); }
    .rh-kpi--red { border-left-color:var(--rh-red); }
    .rh-kpi__label { font-size:12px; color:var(--rh-gray-500); margin-bottom:4px; }
    .rh-kpi__value { font-size:20px; font-weight:700; }
    .rh-kpi__sub { font-size:11px; color:var(--rh-gray-500); margin-top:4px; }

    .rh-main { display:grid; grid-template-columns:2fr 1fr; gap:16px; align-items:start; }
    @media (max-width: 900px) { .rh-main { grid-template-columns:1fr; } }

    .rh-board { background:#fff; border:1px solid var(--rh-gray-200); border-radius:12px; padding:14px; }
    .rh-sidebar { display:flex; flex-direction:column; gap:16px; }

    .rh-tabs { display:flex; gap:8px; border-bottom:1px solid var(--rh-gray-200); margin-bottom:14px; padding-bottom:8px; flex-wrap:wrap; }
    .rh-tab { display:flex; align-items:center; gap:6px; background:none; border:none; padding:8px 12px; border-radius:8px; font-size:14px; font-weight:600; color:var(--rh-gray-500); cursor:pointer; }
    .rh-tab:hover { background:var(--rh-gray-100); }
    .rh-tab--active { background:var(--rh-blue-light); color:var(--rh-blue); }

    .rh-badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; }
    .rh-badge--green { background:var(--rh-green-light); color:var(--rh-green); }
    .rh-badge--amber { background:var(--rh-amber-light); color:var(--rh-amber); }
    .rh-badge--red { background:var(--rh-red-light); color:var(--rh-red); }

    .rh-crew-grid, .rh-equip-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px; }

    .rh-card { display:flex; gap:10px; align-items:flex-start; background:var(--rh-gray-50); border:1px solid var(--rh-gray-200); border-left:4px solid var(--rh-gray-300); border-radius:10px; padding:12px; position:relative; transition:box-shadow .2s, border-color .2s; }
    .rh-card--green { border-left-color:var(--rh-green); }
    .rh-card--amber { border-left-color:var(--rh-amber); }
    .rh-card--red { border-left-color:var(--rh-red); }
    .rh-card--gray { border-left-color:var(--rh-gray-300); }
    .rh-card__icon { font-size:24px; line-height:1; }
    .rh-card__body { flex:1; display:flex; flex-direction:column; gap:6px; }
    .rh-card__title { font-weight:700; }
    .rh-card__rate { font-size:12px; color:var(--rh-gray-500); }
    .rh-card__progress { display:flex; flex-direction:column; gap:4px; }
    .rh-card__count { font-size:12px; color:var(--rh-gray-700); display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
    .rh-card > .rh-badge { position:absolute; top:10px; right:10px; }

    .rh-progress { width:100%; height:6px; border-radius:4px; background:var(--rh-gray-200); overflow:hidden; }
    .rh-progress__bar { height:100%; border-radius:4px; }
    .rh-progress__bar--green { background:var(--rh-green); }
    .rh-progress__bar--amber { background:var(--rh-amber); }
    .rh-progress__bar--red { background:var(--rh-red); }

    .rh-input { border:1px solid var(--rh-gray-300); border-radius:6px; padding:3px 6px; font-size:12px; font-family:inherit; background:#fff; }
    .rh-input--num { width:56px; text-align:right; }

    .rh-table { width:100%; border-collapse:collapse; font-size:13px; }
    .rh-table th { text-align:left; font-size:11px; color:var(--rh-gray-500); padding:6px 8px; border-bottom:1px solid var(--rh-gray-200); }
    .rh-table td { padding:8px; border-bottom:1px solid var(--rh-gray-100); vertical-align:middle; }
    .rh-row--red { border-left:4px solid var(--rh-red); background:var(--rh-red-light); }
    .rh-row--amber { border-left:4px solid var(--rh-amber); background:var(--rh-amber-light); }
    .rh-row--green { border-left:4px solid var(--rh-green); }

    .rh-empty { text-align:center; padding:32px 12px; color:var(--rh-gray-500); font-size:13px; }
    .rh-empty--ok { color:var(--rh-green); font-weight:600; }

    .rh-panel { background:#fff; border:1px solid var(--rh-gray-200); border-radius:12px; padding:14px; }
    .rh-panel__title { font-size:14px; font-weight:700; margin:0 0 10px; }

    .rh-alerts { display:flex; flex-direction:column; gap:10px; max-height:420px; overflow-y:auto; }
    .rh-alert { border-radius:8px; padding:10px; border-left:4px solid var(--rh-gray-300); background:var(--rh-gray-50); }
    .rh-alert--red { border-left-color:var(--rh-red); background:var(--rh-red-light); }
    .rh-alert--amber { border-left-color:var(--rh-amber); background:var(--rh-amber-light); }
    .rh-alert__header { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
    .rh-alert__title { font-weight:700; font-size:13px; }
    .rh-alert__detail { font-size:12px; color:var(--rh-gray-700); margin-bottom:6px; }

    .rh-link { background:none; border:none; color:var(--rh-blue); font-size:12px; font-weight:600; cursor:pointer; padding:0; }
    .rh-link:hover { text-decoration:underline; }

    .rh-chart { width:100%; height:160px; margin-top:8px; }
    .rh-legend { display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; font-size:11px; color:var(--rh-gray-700); }
    .rh-legend__item { display:flex; align-items:center; gap:4px; }
    .rh-legend__swatch { width:10px; height:10px; border-radius:2px; display:inline-block; }

    .rh-onboarding { text-align:center; padding:60px 20px; background:#fff; border:1px solid var(--rh-gray-200); border-radius:12px; }
    .rh-onboarding__icon { font-size:40px; margin-bottom:12px; }
    .rh-onboarding h2 { margin:0 0 8px; font-size:18px; }
    .rh-onboarding p { color:var(--rh-gray-500); font-size:13px; max-width:420px; margin:0 auto 16px; }

    .rh-btn { border:none; border-radius:8px; padding:10px 18px; font-size:13px; font-weight:700; cursor:pointer; }
    .rh-btn--primary { background:var(--rh-blue); color:#fff; }
    .rh-btn--primary:hover { background:#1d4ed8; }

    .rh-highlight { box-shadow:0 0 0 3px var(--rh-blue); }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────
// Render: Zone A — KPI header
// ─────────────────────────────────────────────

function renderKPI() {
  const k = rh_state.kpi;
  const readinessColor = k.readiness_pct >= 80 ? 'green' : k.readiness_pct >= 50 ? 'amber' : 'red';
  const criticalColor = k.critical_count === 0 ? 'green' : k.critical_count <= 2 ? 'amber' : 'red';
  const impactColor = k.schedule_impact_days === 0 ? 'green' : k.schedule_impact_days <= 3 ? 'amber' : 'red';

  return `
  <div class="rh-kpi-row">
    <div class="rh-kpi">
      <div class="rh-kpi__label">งบทรัพยากรรวม</div>
      <div class="rh-kpi__value">฿${k.total_budget.toLocaleString()}</div>
      <div class="rh-kpi__sub">แรงงาน ${k.labor_pct}% · วัสดุ ${k.material_pct}% · เครื่องจักร ${k.equipment_pct}%</div>
    </div>
    <div class="rh-kpi rh-kpi--${readinessColor}">
      <div class="rh-kpi__label">ความพร้อมสัปดาห์นี้</div>
      <div class="rh-kpi__value">${k.readiness_pct}%</div>
    </div>
    <div class="rh-kpi rh-kpi--${criticalColor}">
      <div class="rh-kpi__label">รายการขาดแคลนวิกฤต</div>
      <div class="rh-kpi__value">${k.critical_count} รายการ</div>
    </div>
    <div class="rh-kpi rh-kpi--${impactColor}">
      <div class="rh-kpi__label">ผลกระทบต่อกำหนดการ</div>
      <div class="rh-kpi__value">${k.schedule_impact_days} วัน</div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// Render: Zone B — tabs + content
// ─────────────────────────────────────────────

function renderTabs() {
  const crewRed = rh_state.crew_cards.filter((c) => c.status === 'red').length;
  const matRed = rh_state.material_rows.filter((m) => m.status === 'red').length;
  const equipRed = rh_state.equipment_cards.filter((e) => e.color === 'red').length;

  const badge = (count) => count > 0
    ? `<span class="rh-badge rh-badge--red">${count} red</span>`
    : `<span class="rh-badge rh-badge--green">✓ green</span>`;

  return `
  <div class="rh-tabs">
    <button class="rh-tab ${rh_state.active_tab === 'manpower' ? 'rh-tab--active' : ''}" onclick="rh_switchTab('manpower')">แรงงาน ${badge(crewRed)}</button>
    <button class="rh-tab ${rh_state.active_tab === 'material' ? 'rh-tab--active' : ''}" onclick="rh_switchTab('material')">วัสดุ ${badge(matRed)}</button>
    <button class="rh-tab ${rh_state.active_tab === 'equipment' ? 'rh-tab--active' : ''}" onclick="rh_switchTab('equipment')">เครื่องจักร ${badge(equipRed)}</button>
  </div>`;
}

function renderCrewCard(c) {
  const pct = Math.round(c.ratio * 100);
  return `
  <div class="rh-card rh-card--${c.status}" data-crew="${c.crew_type}">
    <div class="rh-card__icon">${c.icon}</div>
    <div class="rh-card__body">
      <div class="rh-card__title">${c.name_th}</div>
      <div class="rh-card__rate">฿${c.day_rate_thb.toLocaleString()}/วัน · ${c.productivity_unit}</div>
      <div class="rh-card__progress">
        <div class="rh-progress"><div class="rh-progress__bar rh-progress__bar--${c.status}" style="width:${Math.min(pct, 100)}%"></div></div>
        <div class="rh-card__count">
          ยืนยันแล้ว
          <input type="number" min="0" value="${c.confirmed}" class="rh-input rh-input--num" onchange="rh_updateCrew('${c.crew_type}', this.value)" />
          / ${c.required} คน (${pct}%)
        </div>
      </div>
    </div>
    <span class="rh-badge rh-badge--${c.status}">${STATUS_TH[c.status]}</span>
  </div>`;
}

function renderManpowerTab() {
  if (rh_state.crew_cards.length === 0) {
    return `<div class="rh-empty">ยังไม่มีข้อมูลความต้องการแรงงานจากแผนงาน</div>`;
  }
  return `<div class="rh-crew-grid">${rh_state.crew_cards.map(renderCrewCard).join('')}</div>`;
}

function renderMaterialRow(m) {
  const dueLabel = m.days_until_needed === null
    ? '-'
    : m.days_until_needed < 0
      ? `เลยกำหนด ${Math.abs(m.days_until_needed)} วัน`
      : `อีก ${m.days_until_needed} วัน`;

  return `
  <tr class="rh-row rh-row--${m.status}" data-material="${m.id}">
    <td>${m.name}</td>
    <td>${m.needed_qty.toLocaleString()} ${m.unit}</td>
    <td><input type="number" min="0" value="${m.qty_ordered}" class="rh-input rh-input--num" onchange="rh_updateMaterial('${m.id}','qty_ordered', this.value)" /></td>
    <td><input type="number" min="0" value="${m.qty_received}" class="rh-input rh-input--num" onchange="rh_updateMaterial('${m.id}','qty_received', this.value)" /></td>
    <td><input type="text" value="${m.supplier_name || ''}" class="rh-input" onchange="rh_updateMaterial('${m.id}','supplier_name', this.value)" /></td>
    <td>${m.lead_time_days != null ? m.lead_time_days + ' วัน' : '-'}</td>
    <td>${dueLabel}</td>
    <td><span class="rh-badge rh-badge--${m.status}">${MATERIAL_STATUS_TH[m.status]}</span></td>
  </tr>`;
}

function renderMaterialsTab() {
  if (rh_state.material_rows.length === 0) {
    return `<div class="rh-empty">ยังไม่มีรายการวัสดุจาก BOQ</div>`;
  }
  return `
  <table class="rh-table">
    <thead>
      <tr>
        <th>วัสดุ</th><th>ต้องการ</th><th>สั่งแล้ว</th><th>รับแล้ว</th><th>ผู้จำหน่าย</th><th>Lead time</th><th>กำหนดใช้</th><th>สถานะ</th>
      </tr>
    </thead>
    <tbody>
      ${rh_state.material_rows.map(renderMaterialRow).join('')}
    </tbody>
  </table>`;
}

function renderEquipCard(e) {
  const options = Object.entries(EQUIP_STATUS_LABELS)
    .map(([val, label]) => `<option value="${val}" ${e.status === val ? 'selected' : ''}>${label}</option>`)
    .join('');
  return `
  <div class="rh-card rh-card--${e.color}" data-equipment="${e.equipment_type}">
    <div class="rh-card__icon">${e.icon}</div>
    <div class="rh-card__body">
      <div class="rh-card__title">${e.name_th}</div>
      <div class="rh-card__rate">฿${e.rate_thb_per_day.toLocaleString()}/วัน${e.vendor_name ? ' · ' + e.vendor_name : ''}</div>
      <select class="rh-input" onchange="rh_updateEquipment('${e.equipment_type}', this.value)">${options}</select>
    </div>
  </div>`;
}

function renderEquipmentTab() {
  if (rh_state.equipment_cards.length === 0) {
    return `<div class="rh-empty">ไม่มีเครื่องจักรที่ต้องใช้สำหรับโครงการนี้</div>`;
  }
  return `<div class="rh-equip-grid">${rh_state.equipment_cards.map(renderEquipCard).join('')}</div>`;
}

// ─────────────────────────────────────────────
// Render: Zone C — alert sidebar
// ─────────────────────────────────────────────

function renderAlertCard(a) {
  const sevClass = a.severity === 'critical' ? 'red' : 'amber';
  const sevLabel = a.severity === 'critical' ? 'วิกฤต' : 'เฝ้าระวัง';
  return `
  <div class="rh-alert rh-alert--${sevClass}">
    <div class="rh-alert__header">
      <span class="rh-badge rh-badge--${sevClass}">${sevLabel}</span>
      <span class="rh-alert__title">${a.title}</span>
    </div>
    <div class="rh-alert__detail">${a.detail}</div>
    <button class="rh-link" onclick="rh_focusResource('${a.category}','${a.ref_id}')">ดูรายละเอียด →</button>
  </div>`;
}

function renderAlerts() {
  if (rh_state.alerts.length === 0) {
    return `
    <div class="rh-panel">
      <h3 class="rh-panel__title">การแจ้งเตือน</h3>
      <div class="rh-empty rh-empty--ok">✓ ไม่มีรายการขาดแคลนตอนนี้</div>
    </div>`;
  }
  return `
  <div class="rh-panel">
    <h3 class="rh-panel__title">การแจ้งเตือน (${rh_state.alerts.length})</h3>
    <div class="rh-alerts">${rh_state.alerts.map(renderAlertCard).join('')}</div>
  </div>`;
}

// ─────────────────────────────────────────────
// Render: Zone D — weekly demand chart
// ─────────────────────────────────────────────

function renderChart() {
  const weeks = rh_state.weekly_demand;
  if (!weeks.length) return '';

  const W = 280, H = 160, padBottom = 24, padTop = 10, padLeft = 28;
  const maxTotal = Math.max(1, ...weeks.map((w) => w.total));
  const barW = (W - padLeft - 10) / weeks.length;
  const types = Array.from(new Set(weeks.flatMap((w) => Object.keys(w.by_type))));

  const bars = weeks.map((w, i) => {
    let yOffset = H - padBottom;
    const x = padLeft + i * barW + 4;
    const segs = types.map((type) => {
      const val = w.by_type[type] || 0;
      if (!val) return '';
      const h = (val / maxTotal) * (H - padTop - padBottom);
      yOffset -= h;
      return `<rect x="${x.toFixed(1)}" y="${yOffset.toFixed(1)}" width="${(barW - 8).toFixed(1)}" height="${h.toFixed(1)}" fill="${CREW_CHART_COLORS[type] || CREW_CHART_COLORS.other}" rx="2" />`;
    }).join('');
    const label = `<text x="${(x + (barW - 8) / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="var(--rh-gray-500)">W${w.week_index + 1}</text>`;
    return segs + label;
  }).join('');

  const legend = types.map((type) => `
    <span class="rh-legend__item">
      <span class="rh-legend__swatch" style="background:${CREW_CHART_COLORS[type] || CREW_CHART_COLORS.other}"></span>
      ${(CREW_TYPES[type] && CREW_TYPES[type].name_th) || type}
    </span>`).join('');

  return `
  <div class="rh-panel">
    <h3 class="rh-panel__title">ความต้องการแรงงานรายสัปดาห์</h3>
    <svg viewBox="0 0 ${W} ${H}" class="rh-chart" preserveAspectRatio="none">
      <line x1="${padLeft}" y1="${H - padBottom}" x2="${W - 4}" y2="${H - padBottom}" stroke="var(--rh-gray-300)" />
      ${bars}
    </svg>
    <div class="rh-legend">${legend}</div>
  </div>`;
}

// ─────────────────────────────────────────────
// Render: onboarding
// ─────────────────────────────────────────────

function renderOnboarding() {
  return `
  <div class="rh-onboarding">
    <div class="rh-onboarding__icon">📦</div>
    <h2>ยังไม่มีแผนทรัพยากร</h2>
    <p>กด "Calculate Project" ในหน้าหลักเพื่อสร้างตารางงานและ BOQ ก่อน จากนั้นกลับมาที่นี่เพื่อสร้างแผนทรัพยากร (แรงงาน / วัสดุ / เครื่องจักร)</p>
    <button class="rh-btn rh-btn--primary" onclick="rh_generateFromPlan()">สร้างแผนทรัพยากรจากแผนงาน</button>
  </div>`;
}

// ─────────────────────────────────────────────
// Render: root
// ─────────────────────────────────────────────

function render() {
  const root = document.getElementById('resource-app');
  if (!root) return;

  injectStyles();

  if (!rh_state.has_plan) {
    root.innerHTML = renderOnboarding();
    return;
  }

  const tabContent = rh_state.active_tab === 'manpower'
    ? renderManpowerTab()
    : rh_state.active_tab === 'material'
      ? renderMaterialsTab()
      : renderEquipmentTab();

  root.innerHTML = `
  <div class="rh-app">
    ${renderKPI()}
    <div class="rh-main">
      <div class="rh-board">
        ${renderTabs()}
        <div class="rh-tab-content">${tabContent}</div>
      </div>
      <div class="rh-sidebar">
        ${renderAlerts()}
        ${renderChart()}
      </div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export function rh_switchTab(tab) {
  rh_state.active_tab = tab;
  render();
}

export function rh_updateCrew(crewType, value) {
  _plan.crew_confirmed = _plan.crew_confirmed || {};
  _plan.crew_confirmed[crewType] = Math.max(0, parseInt(value, 10) || 0);
  savePlan();
  rebuildState();
  render();
}

export function rh_updateMaterial(id, field, value) {
  _plan.material_status = _plan.material_status || {};
  const entry = _plan.material_status[id] || { qty_ordered: 0, qty_received: 0, supplier_name: '' };
  if (field === 'qty_ordered' || field === 'qty_received') {
    entry[field] = Math.max(0, parseFloat(value) || 0);
  } else {
    entry[field] = value;
  }
  _plan.material_status[id] = entry;
  savePlan();
  rebuildState();
  render();
}

export function rh_updateEquipment(type, value) {
  _plan.equipment_status = _plan.equipment_status || {};
  const prev = _plan.equipment_status[type] || { status: 'not_booked', vendor_name: '' };
  _plan.equipment_status[type] = { ...prev, status: value };
  savePlan();
  rebuildState();
  render();
}

export function rh_focusResource(category, id) {
  const tabMap = { crew: 'manpower', material: 'material', equipment: 'equipment' };
  rh_state.active_tab = tabMap[category] || rh_state.active_tab;
  render();
  requestAnimationFrame(() => {
    const selector = category === 'crew'
      ? `[data-crew="${id}"]`
      : category === 'material'
        ? `[data-material="${id}"]`
        : `[data-equipment="${id}"]`;
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('rh-highlight');
      setTimeout(() => el.classList.remove('rh-highlight'), 1500);
    }
  });
}

export function rh_generateFromPlan() {
  loadData();
  if (_scheduleTasks.length === 0) {
    alert('ยังไม่มีข้อมูลแผนงาน — กรุณากด "Calculate Project" ในหน้าหลักก่อน');
    return;
  }
  rebuildState();
  savePlan();
  render();
}

export function rh_init() {
  loadData();
  rebuildState();
  render();
}

window.rh_switchTab = rh_switchTab;
window.rh_updateCrew = rh_updateCrew;
window.rh_updateMaterial = rh_updateMaterial;
window.rh_updateEquipment = rh_updateEquipment;
window.rh_focusResource = rh_focusResource;
window.rh_generateFromPlan = rh_generateFromPlan;
window.rh_init = rh_init;

window.addEventListener(PROJECT_EVENT, rh_init);
window.addEventListener(PIPELINE_EVENT, rh_init);

if (document.getElementById('resource-app')) {
  rh_init();
}
