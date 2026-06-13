/**
 * timeline-engine.js — duration estimation, budget impact, task grouping, weather buffering.
 * Pure functions only — no localStorage access, no DOM. Callers (wizard, planner, pipeline)
 * persist results via project-store.js.
 */

import {
  EARLY_ESTIMATE_RATES,
  EARLY_ESTIMATE_CREW_SIZE_DEFAULT,
  PRODUCTIVITY_RATES,
  getProvincialWeather,
  WORK_TYPE_HIERARCHY,
  workTypeFromElementType,
  CREW_TYPES,
  OVERTIME_COST_MULTIPLIER,
} from './schema.js';
import { computeBOQ, computeSchedule } from './pipeline.js';

// ─────────────────────────────────────────────
// date helpers (local — pure, no Date mutation surprises)
// ─────────────────────────────────────────────

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  return (new Date(b) - new Date(a)) / 86400000;
}

/**
 * แตกช่วง [startDate, endDate] (inclusive) ออกเป็นรายเดือนปฏิทิน พร้อมจำนวนวันที่ overlap ในแต่ละเดือน
 * @returns {Array<{ month: number, overlapDays: number }>} month เป็น 1-12
 */
function monthsSpanned(startDate, endDate) {
  const result = [];
  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  let cursor = start;

  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth(); // 0-based
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEndExclusive = new Date(Date.UTC(year, month + 1, 1));

    const overlapStart = cursor > monthStart ? cursor : monthStart;
    const overlapEndExclusive = end < monthEndExclusive ? addDays(end, 1) : monthEndExclusive;
    const overlapDays = Math.max(0, (overlapEndExclusive - overlapStart) / 86400000);

    result.push({ month: month + 1, overlapDays });
    cursor = monthEndExclusive;
  }

  return result;
}

// ─────────────────────────────────────────────
// estimateConstructionDuration
// ─────────────────────────────────────────────

/**
 * ประมาณระยะเวลาก่อสร้าง
 *
 * Primary path (มี beam_library — element ผ่าน Drawing Intelligence แล้ว):
 *   รัน computeBOQ -> computeSchedule จริงจาก pipeline.js แล้วอ่าน baseDays จากช่วงวันที่ของ schedule จริง
 *   method: 'engine'
 *
 * Fallback path (beamLibraryById ว่าง — ยังไม่มีแบบ, ใช้ wizard Step 3 ก่อน Drawing Intelligence):
 *   ใช้ EARLY_ESTIMATE_RATES แบบหยาบจาก element counts ดิบ
 *   method: 'early_rates'
 *
 * @param {Array} elements - drawing_elements (จาก getProjectElements())
 * @param {Object} beamLibraryById - beam_library lookup (จาก getProjectElements())
 * @param {string} province - project_config.site_province
 * @param {Object} project - { id, start_date, ... } (createProject shape)
 * @returns {{
 *   estimated_min_days: number, estimated_recommended_days: number, estimated_max_days: number,
 *   weather_buffer_days: number, rainy_season_months: number[], method: 'engine'|'early_rates',
 *   estimation_basis: object
 * }}
 */
export function estimateConstructionDuration(elements, beamLibraryById, province, project) {
  const weather = getProvincialWeather(province);
  const rainyMonths = weather ? weather.rainy_months : [];

  const hasLibrary = beamLibraryById && Object.keys(beamLibraryById).length > 0;
  if (hasLibrary) {
    return estimateViaEngine(elements, beamLibraryById, province, project, weather, rainyMonths);
  }
  return estimateViaEarlyRates(elements, province, weather, rainyMonths);
}

function estimateViaEngine(elements, beamLibraryById, province, project, weather, rainyMonths) {
  const boq = computeBOQ(elements, beamLibraryById, project);
  const schedule = computeSchedule(elements, boq, project);

  const startDate = new Date(`${project.start_date}T00:00:00Z`);
  const lastTask = schedule[schedule.length - 1];
  const endDate = lastTask ? new Date(`${lastTask.end_date}T00:00:00Z`) : startDate;
  const baseDays = Math.max(diffDays(startDate, endDate), 0);

  // weather buffer: สำหรับทุกเดือนปฏิทินที่ schedule ครอบคลุม ถ้าเป็นเดือนฝน
  // บวกวันที่อยู่ในเดือนนั้น × 0.4 × (avg_rain_days_per_month / 30)
  let weatherBufferDays = 0;
  if (rainyMonths.length) {
    monthsSpanned(startDate, endDate).forEach(({ month, overlapDays }) => {
      if (rainyMonths.includes(month)) {
        const avgRainDays = weather.avg_rain_days_per_month[month - 1] || 0;
        weatherBufferDays += overlapDays * 0.4 * (avgRainDays / 30);
      }
    });
  }

  const countsByWorkType = {};
  elements.forEach(el => {
    const workType = workTypeFromElementType(el.element_type);
    countsByWorkType[workType] = (countsByWorkType[workType] || 0) + (el.count || 1);
  });

  return {
    estimated_min_days: Math.round(baseDays * 0.9),
    estimated_recommended_days: Math.round(baseDays + weatherBufferDays),
    estimated_max_days: Math.round(baseDays * 1.25 + weatherBufferDays),
    weather_buffer_days: parseFloat(weatherBufferDays.toFixed(1)),
    rainy_season_months: rainyMonths,
    method: 'engine',
    estimation_basis: {
      element_counts: countsByWorkType,
      productivity_rates_used: PRODUCTIVITY_RATES,
      crew_size_used: null, // engine ใช้ crew_size ต่อ task จาก computeSchedule (5 สำหรับคอนกรีต, 2 อื่นๆ)
      weather_source: weather ? 'provincial_table' : 'fallback',
      province,
      base_duration_days: parseFloat(baseDays.toFixed(1)),
    },
  };
}

function estimateViaEarlyRates(elements, province, weather, rainyMonths) {
  // 1. รวม element counts ตาม work_type (column/beam/slab เก็บแยกละเอียด ตาม EARLY_ESTIMATE_RATES)
  const countsByWorkType = {};
  elements.forEach(el => {
    const workType = workTypeFromElementType(el.element_type);
    const rateKey = workType === 'structure' ? el.element_type : workType;
    countsByWorkType[rateKey] = (countsByWorkType[rateKey] || 0) + (el.count || 1);
  });

  // 2. crew-days รวม = Σ(count / rate) จากนั้นปรับด้วย parallelism factor (crew_size_default / 4)
  const crewSize = EARLY_ESTIMATE_CREW_SIZE_DEFAULT;
  let totalCrewDays = 0;
  const ratesUsed = {};
  Object.entries(countsByWorkType).forEach(([type, count]) => {
    const rateDef = EARLY_ESTIMATE_RATES[type] || EARLY_ESTIMATE_RATES.finishing;
    ratesUsed[type] = rateDef;
    totalCrewDays += count / rateDef.rate;
  });
  const parallelBaseDuration = Math.max(totalCrewDays / Math.max(crewSize / 4, 1), 1);

  // 3. weather buffer ตามสัดส่วนเดือนฝนต่อปี
  const avgRainyDaysInRainySeason = rainyMonths.length
    ? rainyMonths.reduce((s, m) => s + weather.avg_rain_days_per_month[m - 1], 0) / rainyMonths.length
    : 0;
  const rainySeasonOverlapDays = parallelBaseDuration * (rainyMonths.length / 12);
  const weatherBufferDays = rainySeasonOverlapDays * 0.4;

  return {
    estimated_min_days: Math.round(parallelBaseDuration * 0.8),
    estimated_recommended_days: Math.round(parallelBaseDuration + weatherBufferDays),
    estimated_max_days: Math.round(parallelBaseDuration * 1.35 + weatherBufferDays),
    weather_buffer_days: parseFloat(weatherBufferDays.toFixed(1)),
    rainy_season_months: rainyMonths,
    method: 'early_rates',
    estimation_basis: {
      element_counts: countsByWorkType,
      productivity_rates_used: ratesUsed,
      crew_size_used: crewSize,
      weather_source: weather ? 'provincial_table' : 'fallback',
      province,
      avg_rainy_days_in_rainy_season: parseFloat(avgRainyDaysInRainySeason.toFixed(1)),
    },
  };
}

// ─────────────────────────────────────────────
// calculateBudgetImpact
// ─────────────────────────────────────────────

/**
 * @param {object} baselineTimeline - project_config.timeline (หลัง estimateConstructionDuration)
 * @param {string} userStartDate - ISO date
 * @param {string} userEndDate - ISO date
 * @param {{ crew_size_default?: number, daily_wage?: number }} [crewConfig]
 * @returns {object} project_config.budget_impact shape
 */
export function calculateBudgetImpact(baselineTimeline, userStartDate, userEndDate, crewConfig = {}) {
  const crewSizeDefault = crewConfig.crew_size_default ?? EARLY_ESTIMATE_CREW_SIZE_DEFAULT;
  // ค่าแรงเฉลี่ยต่อวัน = ค่าเฉลี่ยของ 3 ทีมหลัก (เหล็ก/ไม้แบบ/คอนกรีต)
  const dailyWage = crewConfig.daily_wage
    ?? Math.round((CREW_TYPES.steel_fixer.day_rate_thb + CREW_TYPES.carpenter.day_rate_thb + CREW_TYPES.concrete_gang.day_rate_thb) / 3);

  const recommendedDays = baselineTimeline.estimated_recommended_days;
  const actualDays = Math.max(1, Math.round(diffDays(userStartDate, userEndDate)));

  const baselineCost = recommendedDays * crewSizeDefault * dailyWage;

  let extraCrewNeeded = 0;
  let rainRiskExtraDays = 0;
  let deltaCost = 0;
  let deltaReason = null;
  let riskLevel = 'none';
  let currentCost = baselineCost;

  if (actualDays < recommendedDays) {
    // บีบระยะเวลา -> ต้องเพิ่มทีม จ่าย OT
    extraCrewNeeded = Math.max(0, Math.ceil(recommendedDays / actualDays * crewSizeDefault) - crewSizeDefault);
    const extraCost = extraCrewNeeded * dailyWage * actualDays * OVERTIME_COST_MULTIPLIER;
    currentCost = actualDays * crewSizeDefault * dailyWage + extraCost;
    deltaCost = currentCost - baselineCost;
    deltaReason = 'compressed_schedule';
    const pctCompression = (recommendedDays - actualDays) / recommendedDays;
    riskLevel = pctCompression > 0.3 ? 'high' : pctCompression > 0.1 ? 'medium' : 'low';
  } else if (actualDays > recommendedDays) {
    // ขยายระยะเวลา -> มีวันที่ตกอยู่ในฤดูฝนมากขึ้น
    const additionalDays = actualDays - recommendedDays;
    rainRiskExtraDays = additionalDays * 0.4;
    const rainCost = rainRiskExtraDays * crewSizeDefault * dailyWage;
    currentCost = actualDays * crewSizeDefault * dailyWage + rainCost;
    deltaCost = currentCost - baselineCost;
    deltaReason = 'extended_schedule';
    riskLevel = additionalDays > recommendedDays * 0.3 ? 'medium' : 'low';
  } else {
    currentCost = baselineCost;
  }

  return {
    baseline_cost_estimate: Math.round(baselineCost),
    current_cost_estimate: Math.round(currentCost),
    delta_cost: Math.round(deltaCost),
    delta_reason: deltaReason,
    extra_crew_needed: extraCrewNeeded,
    rain_risk_extra_days: parseFloat(rainRiskExtraDays.toFixed(1)),
    risk_level: riskLevel,
  };
}

// ─────────────────────────────────────────────
// computeEVM — Earned Value Management
// ─────────────────────────────────────────────

function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

/**
 * fraction ของงานที่ "ควร" เสร็จตามแผน ณ วันที่ d (linear ระหว่าง start→end)
 */
function plannedFraction(task, d) {
  const s = new Date(task.start_date);
  const e = new Date(task.end_date);
  if (d <= s) return 0;
  if (d >= e) return 1;
  const span = e - s;
  return span > 0 ? (d - s) / span : 1;
}

/**
 * คำนวณ Earned Value Management จาก schedule_tasks
 *
 *   PV (Planned Value)   = Σ task_cost_estimate × planned% ตามวันที่ ณ status date
 *   EV (Earned Value)    = Σ task_cost_estimate × percent_complete
 *   AC (Actual Cost)     = Σ task_cost_actual (ถ้าไม่มี → ใช้ EV ของ task นั้น = ไม่ทราบส่วนเกิน)
 *   BAC (Budget At Completion) = Σ task_cost_estimate
 *   SPI = EV / PV (>1 เร็วกว่าแผน) · CPI = EV / AC (>1 ต่ำกว่างบ)
 *   EAC (Estimate At Completion) = BAC / CPI · VAC = BAC − EAC
 *
 * S-curve series: cumulative PV เต็มช่วงโครงการ; EV/AC วาดถึง status date เท่านั้น
 * โดย scale ตามอัตราส่วนผลงานจริงต่อแผน ณ status (สม่ำเสมอตามรูปทรงแผน)
 *
 * @param {Array} tasks - schedule_tasks (ต้องมี start_date/end_date/task_cost_estimate)
 * @param {Date|string} [statusDate] - วันที่ตัดยอด (default = วันนี้)
 * @returns {object|null} null ถ้าไม่มี task ที่มีต้นทุน+วันที่
 */
export function computeEVM(tasks, statusDate = new Date()) {
  const costed = (tasks || []).filter(t => (t.task_cost_estimate || 0) > 0 && t.start_date && t.end_date);
  if (!costed.length) return null;

  const status = statusDate instanceof Date ? statusDate : new Date(statusDate);

  const bac = costed.reduce((s, t) => s + (t.task_cost_estimate || 0), 0);
  const pvNow = costed.reduce((s, t) => s + (t.task_cost_estimate || 0) * plannedFraction(t, status), 0);
  const evNow = costed.reduce((s, t) => s + (t.task_cost_estimate || 0) * ((t.percent_complete || 0) / 100), 0);
  const acNow = costed.reduce((s, t) => {
    const ac = t.task_cost_actual != null
      ? t.task_cost_actual
      : (t.task_cost_estimate || 0) * ((t.percent_complete || 0) / 100); // ไม่มี actual → AC = EV (CPI=1)
    return s + ac;
  }, 0);

  const notStarted = pvNow < 1 && evNow < 1;
  const spi = pvNow > 0 ? evNow / pvNow : null;
  const cpi = acNow > 0 ? evNow / acNow : null;
  const eac = cpi && cpi > 0 ? bac / cpi : bac;
  const percentComplete = bac > 0 ? (evNow / bac) * 100 : 0;

  // S-curve buckets — ปรับ step ให้ได้ ~12 จุดไม่ว่าโครงการสั้นหรือยาว
  const minStart = new Date(Math.min(...costed.map(t => +new Date(t.start_date))));
  const maxEnd = new Date(Math.max(...costed.map(t => +new Date(t.end_date))));
  const totalSpan = Math.max(maxEnd - minStart, 86400000);
  const bucketMs = Math.max(86400000, totalSpan / 12);

  const evRatio = pvNow > 0 ? evNow / pvNow : 0;
  const acRatio = pvNow > 0 ? acNow / pvNow : 0;

  const series = [];
  for (let d = minStart.getTime(); ; d += bucketMs) {
    const cur = new Date(Math.min(d, maxEnd.getTime()));
    const pv = costed.reduce((s, t) => s + (t.task_cost_estimate || 0) * plannedFraction(t, cur), 0);
    const past = cur <= status;
    series.push({
      date: toISODate(cur),
      pv: round2(pv),
      ev: past ? round2(pv * evRatio) : null,
      ac: past ? round2(pv * acRatio) : null,
    });
    if (d >= maxEnd.getTime()) break;
  }

  return {
    bac: round2(bac),
    pv: round2(pvNow),
    ev: round2(evNow),
    ac: round2(acNow),
    spi: spi != null ? parseFloat(spi.toFixed(2)) : null,
    cpi: cpi != null ? parseFloat(cpi.toFixed(2)) : null,
    eac: round2(eac),
    vac: round2(bac - eac),
    cost_variance: round2(evNow - acNow),       // CV — บวก=ต่ำกว่างบ
    schedule_variance: round2(evNow - pvNow),   // SV — บวก=เร็วกว่าแผน
    percent_complete: parseFloat(percentComplete.toFixed(1)),
    status_date: toISODate(status),
    not_started: notStarted,
    series,
  };
}

// ─────────────────────────────────────────────
// groupTasksByMode
// ─────────────────────────────────────────────

const WORK_TYPE_ORDER = ['foundation', 'structure', 'roof', 'mep', 'finishing', 'other'];

/**
 * @param {Array} tasks - schedule_tasks
 * @param {'time'|'work_type'|'resource'} mode
 * @param {object} projectConfig - project_config (สำหรับ timeline anchor ใน mode 'time')
 * @returns {Array<{ key: string, label: string, sortKey: any, tasks: Array }>}
 */
export function groupTasksByMode(tasks, mode, projectConfig) {
  if (mode === 'work_type') return groupByWorkType(tasks);
  if (mode === 'resource') return groupByResource(tasks);
  return groupByTime(tasks, projectConfig?.timeline);
}

export function groupByTime(tasks, timeline) {
  const startDate = timeline?.user_start_date ? new Date(timeline.user_start_date) : null;
  const groups = new Map();
  tasks.forEach(task => {
    let periodMonth = task.period_month;
    if (periodMonth == null && startDate && task.start_date) {
      const months = (new Date(task.start_date) - startDate) / (1000 * 60 * 60 * 24 * 30.44);
      periodMonth = Math.max(1, Math.floor(months) + 1);
    }
    periodMonth = periodMonth ?? 1;
    const key = `month_${periodMonth}`;
    if (!groups.has(key)) groups.set(key, { key, label: `เดือนที่ ${periodMonth}`, sortKey: periodMonth, tasks: [] });
    groups.get(key).tasks.push(task);
  });
  return [...groups.values()].sort((a, b) => a.sortKey - b.sortKey);
}

export function groupByWorkType(tasks) {
  const groups = new Map();
  tasks.forEach(task => {
    const workType = task.work_type || 'other';
    const def = WORK_TYPE_HIERARCHY[workType] || WORK_TYPE_HIERARCHY.other;
    if (!groups.has(workType)) groups.set(workType, { key: workType, label: def.label_th, sortKey: WORK_TYPE_ORDER.indexOf(workType), tasks: [] });
    groups.get(workType).tasks.push(task);
  });
  return [...groups.values()].sort((a, b) => a.sortKey - b.sortKey);
}

export function groupByResource(tasks) {
  const groups = new Map();
  tasks.forEach(task => {
    const trade = task.resource_group?.primary_trade || 'unassigned';
    const label = CREW_TYPES[trade]?.name_th || 'ไม่ระบุ';
    if (!groups.has(trade)) groups.set(trade, { key: trade, label, sortKey: label, tasks: [] });
    groups.get(trade).tasks.push(task);
  });
  return [...groups.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'th'));
}

// ─────────────────────────────────────────────
// applyWeatherBuffer
// ─────────────────────────────────────────────

/**
 * คืน array ใหม่ของ schedule_tasks หลังเผื่อ buffer ฤดูฝน
 * task ที่ start_date ตกในเดือนฝนและเป็นงานโครงสร้าง (structure/foundation):
 *   ขยาย adjusted_duration_days ด้วย bufferRatio, ตั้ง weather_risk='high', เลื่อน end_date
 *   และเลื่อน task ถัดไปทั้งหมดตาม extra วันที่เพิ่ม (shiftDays สะสม)
 * task อื่นที่ตกในเดือนฝน: weather_risk='medium' (ไม่ขยายเวลา)
 *
 * @param {Array} tasks - schedule_tasks (มี start_date/end_date/work_type แล้ว)
 * @param {number[]} rainyMonths - 1-12
 * @param {number} bufferRatio - เช่น 0.4
 * @returns {Array} tasks ใหม่ (ความยาวเท่าเดิม)
 */
export function applyWeatherBuffer(tasks, rainyMonths, bufferRatio = 0.4) {
  if (!rainyMonths?.length) return tasks.map(t => ({ ...t, weather_risk: 'none' }));

  let shiftDays = 0;
  return tasks.map(task => {
    const start = new Date(task.start_date);
    start.setUTCDate(start.getUTCDate() + shiftDays);
    const month = start.getUTCMonth() + 1;
    const inRainySeason = rainyMonths.includes(month);
    const isStructure = task.work_type === 'structure' || task.work_type === 'foundation';

    let adjustedDuration = task.adjusted_duration_days ?? task.base_duration_days;
    let weatherRisk = 'none';
    if (inRainySeason && isStructure) {
      const extra = parseFloat((adjustedDuration * bufferRatio).toFixed(1));
      adjustedDuration += extra;
      shiftDays += extra;
      weatherRisk = 'high';
    } else if (inRainySeason) {
      weatherRisk = 'medium';
    }

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + Math.ceil(adjustedDuration));

    return {
      ...task,
      start_date: toISODate(start),
      end_date: toISODate(end),
      adjusted_duration_days: parseFloat(adjustedDuration.toFixed(1)),
      weather_risk: weatherRisk,
    };
  });
}

// ─────────────────────────────────────────────
// shiftDependents
// ─────────────────────────────────────────────

/**
 * เลื่อนวันที่ของ task ที่ขึ้นกับ changedTask (depends_on_task_ids) เป็น cascade
 * เก็บ duration เดิมของแต่ละ task ที่ถูกเลื่อนไว้ (เลื่อนทั้ง start_date และ end_date เท่ากัน)
 * รันต่อเนื่องจนกว่า dependent ทุกตัวจะ start_date >= changedTask.end_date + lag_days แล้ว
 *
 * @param {object} changedTask - schedule_task ที่ผู้ใช้แก้ไขวันที่ (รูปแบบ createScheduleTask)
 * @param {Array} allTasks - schedule_tasks ทั้งหมดของโปรเจกต์
 * @returns {Array} schedule_tasks ใหม่ทั้งหมด (รวม changedTask และ dependents ที่ถูกเลื่อน)
 */
export function shiftDependents(changedTask, allTasks) {
  const result = allTasks.map(t => (t.id === changedTask.id ? { ...t, ...changedTask } : { ...t }));
  const byId = new Map(result.map(t => [t.id, t]));

  function cascade(task) {
    result.forEach(dependent => {
      if (!(dependent.depends_on_task_ids || []).includes(task.id)) return;

      const requiredStart = addDays(new Date(task.end_date), dependent.lag_days || 0);
      const currentStart = new Date(dependent.start_date);

      if (currentStart < requiredStart) {
        const durationDays = Math.max(1, diffDays(dependent.start_date, dependent.end_date));
        dependent.start_date = toISODate(requiredStart);
        dependent.end_date = toISODate(addDays(requiredStart, durationDays));
        cascade(dependent);
      }
    });
  }

  cascade(byId.get(changedTask.id) ?? changedTask);
  return result;
}

// ─────────────────────────────────────────────
// Sanity check (manual — ไม่ใช่ automated test)
// ─────────────────────────────────────────────
// รัน estimateConstructionDuration(elements, beamLibraryById, province, project) ด้วยข้อมูล
// โปรเจกต์สาธิต (บ้านพักอาศัย 2 ชั้น ลาดพร้าว 71, ~9 columns + 6 beams + 2 slabs) ควรได้
// estimated_recommended_days ในช่วงประมาณ 50-70 วัน (งานโครงสร้างบ้าน 2 ชั้น) — ถ้าตัวเลข
// ผิดเพี้ยนไปมาก (เช่น <10 หรือ >150) ให้ตรวจ date math (monthsSpanned/diffDays) ก่อน
// ไปแก้ EARLY_ESTIMATE_RATES/PRODUCTIVITY_RATES
