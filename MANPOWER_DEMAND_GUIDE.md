# Manpower Demand Analysis — Integration Guide

## Overview

The Manpower Demand system automatically analyzes workforce requirements based on the project schedule and highlights overallocation issues with smart task-shifting suggestions.

**Features:**
1. **Daily demand calculation** — headcount needed per trade per day
2. **Weekly aggregation** — visualized as stacked bar chart by trade
3. **Available crew management** — editable inputs with sensible defaults
4. **Overallocation detection** — warnings when demand exceeds available crew
5. **Smart suggestions** — recommend shifting flexible (non-critical) tasks to resolve conflicts
6. **Summary cards** — peak demand, total person-days, warning count

---

## Architecture

### Data Flow

```
Schedule Tasks
    ↓
rh_calculateDailyDemand()
    ↓ (spreads crew_size across task duration)
Daily Demand [{ date, trade, headcount_required, tasks }]
    ↓
rh_aggregateToWeekly()
    ↓
Weekly Buckets [{ week, date, trade, headcount_required }]
    ↓
rh_checkOverallocation(daily_demand, availableCrew)
    ↓
Overallocation Warnings [{ date, trade, shortfall, suggestion }]
```

### State Structure

**`rh_state` additions:**
```javascript
{
  daily_demand: [],              // [{ date, trade, headcount_required, tasks }]
  weekly_demand_buckets: [],     // [{ week, date, trade, headcount_required }]
  available_crew: {},            // { trade: count, ... }
  overallocation_warnings: [],   // [{ date, trade, shortfall, suggestion }]
  peak_demand: {                 // metrics object
    peak_date,
    peak_trade,
    peak_headcount,
    total_person_days,
    ...
  }
}
```

**Storage:** `constistant_manpower_config_v1` (localStorage)
- Persists user-edited available crew counts per project

---

## Integration Points

### 1. Module Imports

Resource Hub (`resource-index.js`) imports from `rh_manpower.js`:

```javascript
import {
  rh_loadAvailableCrew,
  rh_saveAvailableCrew,
  rh_calculateDailyDemand,
  rh_aggregateToWeekly,
  rh_checkOverallocation,
  rh_calculatePeakDemand,
  rh_formatOverallocationWarning,
} from './rh_manpower.js';
```

### 2. Render Flow

**Manpower Tab Content:**
```
renderPeakDemandCards()          ← 3 summary cards
  ↓
renderAvailableCrewTable()       ← Editable inputs
  ↓
renderManpowerChart()            ← Stacked bar chart (weekly)
  ↓
renderOverallocationWarnings()   ← Alert list with suggestions
  ↓
renderManpowerTab()              ← Crew cards (existing)
```

### 3. User Interactions

**Update Available Crew:**
```javascript
// User changes input: <input onchange="rh_updateAvailableCrew('steel_fixer', '10')" />
export function rh_updateAvailableCrew(trade, value) {
  // Updates state.available_crew[trade]
  // Saves to localStorage
  // Rebuilds state (recomputes overallocation)
  // Re-renders
}
```

**Apply Suggestion:**
```javascript
// User clicks "นำไปใช้" button
export function rh_applySuggestion(taskId, shiftDays) {
  // Shifts task.start_date and task.end_date forward by shiftDays
  // Persists to STORAGE_KEYS.schedule
  // Rebuilds state
  // Re-renders (overallocation warnings may disappear)
}
```

---

## Key Algorithms

### Daily Demand Calculation

For each schedule task:
1. Distribute `crew_size` evenly across task duration (start_date to end_date)
2. Group by (date, trade)
3. Sum headcounts for overlapping tasks

```javascript
function rh_calculateDailyDemand(scheduleTasks) {
  // Returns: [{ date: '2026-06-15', trade: 'steel_fixer', headcount_required: 5.2, tasks: [...] }]
}
```

**Inputs:**
- `scheduleTasks`: from `schedule_tasks` (has crew_size, start_date, end_date, trade/resource_group.primary_trade)

**Output:**
- Daily demand entries sorted by date

### Overallocation Detection

For each (date, trade) combination:
1. Compare `headcount_required` vs `availableCrew[trade]`
2. If required > available, flag as overallocated with `shortfall = required - available`
3. Find contributing tasks
   - **Critical path tasks:** can't move (is_critical_path = true)
   - **Flexible tasks:** can move (candidates for shifting)
4. Suggest shifting smallest flexible task by `ceil(shortfall / taskHeadcount)` days

```javascript
function rh_checkOverallocation(dailyDemand, availableCrew, scheduleTasks) {
  // Returns: [{ date, trade, headcount_required, headcount_available, shortfall, suggestion }]
  // suggestion = { taskId, taskName, shiftDays, reason }
}
```

### Peak Demand Metrics

```javascript
function rh_calculatePeakDemand(dailyDemand) {
  return {
    peak_date,           // Date of highest single-trade demand
    peak_trade,          // Which trade has peak
    peak_headcount,      // Value at peak
    project_peak_date,   // Date of highest total demand (all trades)
    project_peak_total,  // Sum of all trades on that date
    total_person_days,   // Sum of (headcount × days) for entire project
  };
}
```

---

## Default Available Crew

```javascript
const DEFAULT_AVAILABLE_CREW = {
  steel_fixer:    6,
  carpenter:      6,
  concrete_gang:  8,
  mason:          4,
  electrician:    2,
  plumber:        2,
  painter:        2,
  surveyor:       1,
  piling:         0,
  site_foreman:   1,
  other:          2,
};
```

**Rationale:** Typical small-to-medium SME project (8-story residential, ~40-50 person team)

**Customization:** Users edit in the "แรงงานที่มีอยู่" table, changes persist to localStorage.

---

## Visualizations

### Summary Cards

Three KPI cards above the crew table:

| Card | Shows | Color |
|------|-------|-------|
| 📈 Peak Demand | Max headcount by trade (date + trade label) | Amber |
| 👥 Total Person-Days | Sum of (headcount × days) for project | Blue |
| ⚠️ Warnings | Count of overallocation dates | Red (if >0) / Green (if 0) |

### Available Crew Table

Two-column editable table:
- Trade name + icon (left)
- Numeric input (right, `min="0"`)
- Saves on change via `rh_updateAvailableCrew()`

### Manpower Chart

Stacked bar chart, X-axis = months (YYYY-MM), Y-axis = headcount:
- Each bar is a stack of colored segments (one color per trade)
- Colors from `CREW_CHART_COLORS` (reuses existing palette)
- Legend below shows trade colors

**Bucket size:** Monthly (1 bar per month of project timeline)

### Overallocation Warnings

Red alert boxes, sorted by date:
```
⚠️ มิ.ย. 15 (ช่างเหล็ก): ต้องการ 12 คน แต่มีเพียง 6 คน — 
  ช่วชดเชย 6 คนโดยเลื่อน "Formwork F2" ออก 3 วัน [นำไปใช้]
```

---

## Storage & Persistence

### LocalStorage Keys

**Available crew config:**
- Key: `constistant_manpower_config_v1:::${projectId}`
- Value: JSON stringified object `{ trade: count, ... }`
- Scope: Per project

**Schedule tasks (linked):**
- Key: `constistant_schedule:::${projectId}`
- Modified by `rh_applySuggestion()` when shifting tasks

### Data Flow on Save

1. `rh_updateAvailableCrew()` → `rh_saveAvailableCrew()`
   - Saves available crew config to localStorage
   - Triggers `rebuildState()` (recomputes overallocation)
   - Triggers `render()`

2. `rh_applySuggestion()` → modifies task.start_date/end_date
   - Saves to `STORAGE_KEYS.schedule`
   - Triggers `rebuildState()`
   - Triggers `render()` (overallocation warnings may clear)

---

## Example Usage

### Load & Display

```javascript
// In resource-index.js, rebuildState() calls:
rh_state.available_crew = rh_loadAvailableCrew();
rh_state.daily_demand = rh_calculateDailyDemand(_scheduleTasks);
rh_state.overallocation_warnings = rh_checkOverallocation(
  rh_state.daily_demand,
  rh_state.available_crew,
  _scheduleTasks
);

// Then renderManpowerTab() displays all three sections
```

### Adjust Available Crew

User clicks manpower tab, edits "แรงงานที่มีอยู่" table:
```html
<input type="number" min="0" value="6" 
  onchange="rh_updateAvailableCrew('steel_fixer', this.value)" />
```

Result:
- Available crew count updates → localStorage saves
- Overallocation re-checked (some warnings may disappear if now within capacity)
- Chart and warnings re-render

### Apply Suggestion

User sees warning:
```
⚠️ มิ.ย. 15 (ช่างเหล็ก): ต้องการ 12 คน แต่มีเพียง 6 คน — 
  ช่วชดเชย 6 คนโดยเลื่อน "Formwork F2" ออก 3 วัน [นำไปใช้]
```

User clicks "นำไปใช้":
1. Confirm dialog: "เลื่อนงาน 'Formwork F2' ออก 3 วันหรือไม่?"
2. If confirmed:
   - Task.start_date += 3 days
   - Task.end_date += 3 days
   - Saved to localStorage
   - Overallocation re-checked (warning should clear if only this task was causing shortfall)
   - Re-render

---

## Testing Checklist

- [ ] Manpower tab loads with summary cards visible
- [ ] Available crew table shows all trades with default values
- [ ] Edit crew count → value persists after page reload
- [ ] Demand chart renders with stacked bars by trade
- [ ] Overallocation warnings appear when crew < demand
- [ ] Suggestions are generated for flexible tasks only
- [ ] Click "นำไปใช้" → task dates shift forward
- [ ] After task shift, warnings should clear if resolved
- [ ] Peak demand card shows correct metrics
- [ ] Total person-days calculated correctly

---

## Known Limitations (Pre-Supabase)

- Data sourced from demo seed currently
- No real-time collaboration (single localStorage per browser)
- Task shifting is local only (no server sync)
- Future: Supabase will enable:
  - Multi-user real-time updates to crew config
  - Persistent task scheduling changes
  - Audit trail of task shifts
  - Integration with HR/payroll systems

---

## Future Enhancements

- [ ] Time-series plot (daily headcount over project timeline)
- [ ] Trade-specific capacity alerts with recommendation to hire/subcontract
- [ ] Export crew plan as Excel with shift schedule
- [ ] Integration with payroll system (actual vs. budgeted labor cost)
- [ ] Crew skill matrix (cross-training recommendations)
- [ ] Weather impact on productivity (auto-adjust crew for rainy periods)
