// js/resource/rh_manpower.js
// Advanced manpower demand analysis: daily loading, crew availability, overallocation warnings

import { computeManpowerDemand, CREW_TYPES, PRODUCTIVITY_RATES } from '../shared/schema.js';
import { projectStorageKey, getCurrentProjectId } from '../shared/project-store.js';

const MANPOWER_STORAGE_KEY = 'constistant_manpower_config_v1';

/**
 * Default available crew counts (adjusted by project size)
 * Small SME typical: 8-story residential ~40-50 person team
 */
const DEFAULT_AVAILABLE_CREW = {
  steel_fixer: 6,
  carpenter: 6,
  concrete_gang: 8,
  mason: 4,
  electrician: 2,
  plumber: 2,
  painter: 2,
  surveyor: 1,
  piling: 0,
  site_foreman: 1,
  other: 2,
};

/**
 * Date utilities
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function dateRange(start, end) {
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function weekKey(dateStr) {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const week = Math.ceil((d.getDate() + 6 - d.getDay()) / 7);
  return `${year}-W${week}`;
}

/**
 * Load available crew from localStorage or use defaults
 */
export function rh_loadAvailableCrew() {
  const stored = localStorage.getItem(projectStorageKey(MANPOWER_STORAGE_KEY, getCurrentProjectId()));
  return stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(DEFAULT_AVAILABLE_CREW));
}

/**
 * Save available crew to localStorage
 */
export function rh_saveAvailableCrew(config) {
  localStorage.setItem(projectStorageKey(MANPOWER_STORAGE_KEY, getCurrentProjectId()), JSON.stringify(config));
}

/**
 * Calculate daily demand from schedule tasks
 * Returns: [{ date, trade, headcount_required }]
 */
export function rh_calculateDailyDemand(scheduleTasks) {
  const byDate = new Map();

  scheduleTasks.forEach(task => {
    if (!task.start_date || !task.end_date) return;

    const trade = task.trade || task.resource_group?.primary_trade || task.resource_group?.crew_type || 'other';
    const duration = task.adjusted_duration_days ?? task.base_duration_days ?? 1;
    const volume = task.quantity || 0;
    const unit = String(task.unit || '').toLowerCase();

    // Simple headcount = crew_size (direct from task)
    const headcount = task.crew_size || 0;

    if (!headcount) return;

    // Distribute headcount evenly across task duration (daily)
    const headcountPerDay = headcount / Math.max(1, duration);
    const dates = dateRange(task.start_date, task.end_date);

    dates.forEach(date => {
      const key = `${date}::${trade}`;
      const current = byDate.get(key) || { date, trade, headcount_required: 0, tasks: [] };
      current.headcount_required = parseFloat((current.headcount_required + headcountPerDay).toFixed(2));
      current.tasks = current.tasks || [];
      current.tasks.push({ taskId: task.id, taskName: task.activity_name || '', headcount: headcountPerDay });
      byDate.set(key, current);
    });
  });

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aggregate daily demand into weekly buckets
 */
export function rh_aggregateToWeekly(dailyDemand) {
  const byWeek = new Map();

  dailyDemand.forEach(day => {
    const week = weekKey(day.date);
    const key = `${week}::${day.trade}`;
    const current = byWeek.get(key) || { week, date: day.date, trade: day.trade, headcount_required: 0, days: 0 };
    current.headcount_required = parseFloat((current.headcount_required + day.headcount_required).toFixed(2));
    current.days = (current.days || 0) + 1;
    byWeek.set(key, current);
  });

  return Array.from(byWeek.values()).sort((a, b) => a.week.localeCompare(b.week));
}

/**
 * Check for overallocation
 * Returns: [{ date, week, trade, headcount_required, headcount_available, shortfall, critical_tasks, suggestions }]
 */
export function rh_checkOverallocation(dailyDemand, availableCrew, scheduleTasks) {
  const overallocated = [];
  const demandByTrade = new Map();

  // Group by trade+date
  dailyDemand.forEach(day => {
    const key = `${day.date}::${day.trade}`;
    demandByTrade.set(key, day);
  });

  // Check each date+trade combination
  demandByTrade.forEach((day, key) => {
    const available = availableCrew[day.trade] || 0;
    if (day.headcount_required > available) {
      const shortfall = parseFloat((day.headcount_required - available).toFixed(1));

      // Find contributing tasks (non-critical)
      const criticalTasks = [];
      const flexibleTasks = [];
      (day.tasks || []).forEach(taskRef => {
        const task = scheduleTasks.find(t => t.id === taskRef.taskId);
        if (task && task.is_critical_path) {
          criticalTasks.push({ taskId: task.id, taskName: task.activity_name, isCritical: true, headcount: taskRef.headcount });
        } else if (task) {
          flexibleTasks.push({ taskId: task.id, taskName: task.activity_name, isCritical: false, headcount: taskRef.headcount });
        }
      });

      // Suggest shifting flexible task with lowest priority (smallest headcount first)
      let suggestion = null;
      if (flexibleTasks.length > 0) {
        const target = flexibleTasks.sort((a, b) => a.headcount - b.headcount)[0];
        const daysNeeded = Math.ceil(shortfall / target.headcount) + 1;
        suggestion = {
          taskId: target.taskId,
          taskName: target.taskName,
          shiftDays: daysNeeded,
          reason: `ช่วชดเชย ${shortfall.toFixed(1)} คนโดยเลื่อน "${target.taskName}" ออก ${daysNeeded} วัน`,
        };
      }

      overallocated.push({
        date: day.date,
        week: weekKey(day.date),
        trade: day.trade,
        trade_label: (CREW_TYPES[day.trade]?.name_th || day.trade),
        headcount_required: day.headcount_required,
        headcount_available: available,
        shortfall,
        critical_count: criticalTasks.length,
        flexible_count: flexibleTasks.length,
        suggestion,
      });
    }
  });

  return overallocated.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate peak demand metrics
 */
export function rh_calculatePeakDemand(dailyDemand) {
  if (!dailyDemand.length) return { peak_date: null, peak_trade: null, peak_headcount: 0, peak_total: 0, total_person_days: 0 };

  // Find peak by trade across all dates
  const byTrade = new Map();
  let totalPersonDays = 0;

  dailyDemand.forEach(day => {
    const trade = day.trade;
    const current = byTrade.get(trade) || { trade, max_headcount: 0, days_count: 0, total_headcount: 0 };
    current.max_headcount = Math.max(current.max_headcount, day.headcount_required);
    current.total_headcount += day.headcount_required;
    current.days_count += 1;
    byTrade.set(trade, current);
    totalPersonDays += day.headcount_required;
  });

  // Find overall peak
  let peakEntry = null;
  let peakHeadcount = 0;
  byTrade.forEach(entry => {
    if (entry.max_headcount > peakHeadcount) {
      peakHeadcount = entry.max_headcount;
      peakEntry = entry;
    }
  });

  // Find date of peak
  let peakDate = null;
  dailyDemand.forEach(day => {
    if (peakEntry && day.trade === peakEntry.trade && day.headcount_required === peakHeadcount) {
      if (!peakDate || day.date < peakDate) peakDate = day.date;
    }
  });

  // Calculate total project peak (sum across all trades on single day)
  const dailyTotals = new Map();
  dailyDemand.forEach(day => {
    const current = (dailyTotals.get(day.date) || 0) + day.headcount_required;
    dailyTotals.set(day.date, current);
  });
  const projectPeakTotal = Math.max(...dailyTotals.values(), 0);
  const projectPeakDate = dailyTotals.size > 0 ? Array.from(dailyTotals.entries()).sort((a, b) => b[1] - a[1])[0][0] : null;

  return {
    peak_date: peakDate,
    peak_trade: peakEntry?.trade || null,
    peak_trade_label: peakEntry ? (CREW_TYPES[peakEntry.trade]?.name_th || peakEntry.trade) : null,
    peak_headcount: peakHeadcount,
    project_peak_date: projectPeakDate,
    project_peak_total: projectPeakTotal,
    total_person_days: parseFloat(totalPersonDays.toFixed(1)),
  };
}

/**
 * Format warning message for UI
 */
export function rh_formatOverallocationWarning(warning) {
  const dateObj = new Date(warning.date);
  const dateStr = dateObj.toLocaleDateString('th-TH', { weekday: 'short', month: 'short', day: 'numeric' });

  let msg = `⚠️ ${dateStr} (${warning.trade_label}): ต้องการ ${warning.headcount_required.toFixed(1)} คน แต่มีเพียง ${warning.headcount_available} คน`;

  if (warning.suggestion) {
    msg += ` — ${warning.suggestion.reason}`;
  }

  return msg;
}

/**
 * Export window functions
 */
window.rh_loadAvailableCrew = rh_loadAvailableCrew;
window.rh_saveAvailableCrew = rh_saveAvailableCrew;
window.rh_calculateDailyDemand = rh_calculateDailyDemand;
window.rh_aggregateToWeekly = rh_aggregateToWeekly;
window.rh_checkOverallocation = rh_checkOverallocation;
window.rh_calculatePeakDemand = rh_calculatePeakDemand;
window.rh_formatOverallocationWarning = rh_formatOverallocationWarning;
