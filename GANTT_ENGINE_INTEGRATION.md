# Gantt Engine — Integration Guide

## Quick Start

Add to `planner.html`:

### 1. Link CSS
```html
<link rel="stylesheet" href="../css/planner-gantt.css">
```

### 2. Create Gantt Container
```html
<div id="gantt-container" style="height: 600px;"></div>
```

### 3. Initialize from Planner Module
```javascript
import { cp_renderGantt } from '../js/planner/gantt-engine.js';

// In your planner-index.js render function:
cp_renderGantt(scheduleTasks, 'gantt-container');
```

---

## Features

### 1. Hierarchical Grouping
- **Floor level** (F1, F2, RF) → collapsible
- **Work package** (เสา, คาน, พื้น, etc.) → collapsible
- **Individual tasks** with progress bars

Click the ▼ chevron to collapse/expand any group.

### 2. Critical Path Visualization
- Critical-path tasks (computed via `computeCriticalPath()`) show with **red/orange bar** and `.gantt-critical` class
- Normal tasks show with blue bar

### 3. Weather Buffer Visualization
- Main duration = solid bar color
- Weather buffer = striped pattern appended after bar
- Hover over buffer → tooltip shows weather reason (e.g., "เดือน มิ.ย. ฝนตก 21 วัน")

### 4. Today Line
- Vertical red line at current date position across entire Gantt
- Only shown if today falls within the project date range

### 5. Task Detail Drawer
- Click any task bar → opens right-side drawer
- Shows:
  - Task name, WBS, floor, trade
  - Duration calculation (volume, crew, productivity rate)
  - Progress slider (0-100%)
  - Dates (start, end, weather buffer)
  - Predecessor tasks (clickable chips → jump to that task)

### 6. View Filters
```javascript
// Filter by floors (F1, F2, RF, etc.)
window.cp_applyFilter('floors', ['F1', 'F2']);

// Filter by trade
window.cp_applyFilter('trades', ['steel_fixer', 'concrete_gang']);

// Filter by status
window.cp_applyFilter('statuses', ['in_progress', 'complete']);

// Clear filters (empty array = show all)
window.cp_applyFilter('floors', []);
```

### 7. Compact View
```javascript
// Toggle compact mode (floor-level aggregate bars)
window.cp_toggleCompactView();
```

---

## API Reference

### `cp_renderGantt(scheduleTasks, containerId, options)`

Renders the hierarchical Gantt chart.

**Parameters:**
- `scheduleTasks` (Array): Schedule task objects (from `schedule_tasks` in schema)
- `containerId` (string): ID of the container div
- `options` (Object, optional):
  - `pixelWidth` (number): Width of the Gantt chart in pixels (default: 2400)

**Example:**
```javascript
import { cp_renderGantt } from '../js/planner/gantt-engine.js';
import { getDemoDataByEngine } from '../js/shared/demo-seed.js';

const tasks = getDemoDataByEngine('planner').SCHEDULE_TASKS;
cp_renderGantt(tasks, 'gantt-container', { pixelWidth: 3000 });
```

### `cp_toggleGroup(groupId)`

Collapse/expand a floor or work-package group.

**Parameters:**
- `groupId` (string): e.g., `'floor-F1'`, `'wp-2.1'`

**Example:**
```javascript
window.cp_toggleGroup('floor-F1');  // Toggle F1
```

### `cp_openTaskDetail(taskId)`

Open the task detail drawer.

**Parameters:**
- `taskId` (string): Task ID

**Example:**
```javascript
window.cp_openTaskDetail('task-123');
```

### `cp_closeTaskDetail()`

Close the task detail drawer.

**Example:**
```javascript
window.cp_closeTaskDetail();
```

### `cp_updateProgress(taskId, value)`

Update task progress (0-100%).

**Parameters:**
- `taskId` (string): Task ID
- `value` (number): Progress percentage (0-100)

**Emits:** `gantt-progress-changed` event with `detail: { taskId, progress }`

**Example:**
```javascript
window.cp_updateProgress('task-123', 75);

// Listen for changes
window.addEventListener('gantt-progress-changed', (e) => {
  console.log(`Task ${e.detail.taskId} is now ${e.detail.progress}% complete`);
  // Trigger Planner pipeline re-render
});
```

### `cp_applyFilter(filterType, value)`

Apply view filters.

**Parameters:**
- `filterType` (string): `'floors'`, `'trades'`, or `'statuses'`
- `value` (Array): Array of values to show (empty = show all)

**Example:**
```javascript
// Show only F1 and F2
cp_applyFilter('floors', ['F1', 'F2']);

// Show only steel_fixer and concrete_gang trades
cp_applyFilter('trades', ['steel_fixer', 'concrete_gang']);

// Show only completed and in-progress tasks
cp_applyFilter('statuses', ['in_progress', 'complete']);

// Clear all filters
cp_applyFilter('floors', []);
cp_applyFilter('trades', []);
cp_applyFilter('statuses', []);
```

### `cp_toggleCompactView()`

Toggle between hierarchical and compact (floor-aggregate) view.

**Example:**
```javascript
window.cp_toggleCompactView();  // Switch to compact view
window.cp_toggleCompactView();  // Switch back to hierarchical
```

---

## Data Requirements

The Gantt engine expects `scheduleTasks` array where each task has:

```typescript
{
  id: string;
  activity_name: string;
  wbs_code: string;        // e.g., "2.1.1" (floor.workpackage.task)
  floor_level: string;     // e.g., "F1", "F2", "RF"
  start_date: string;      // ISO date
  end_date: string;        // ISO date
  base_duration_days: number;
  adjusted_duration_days: number;
  weather_buffer_factor: number;  // 0.0-0.4 (fractional days)
  quantity: number;
  unit: string;
  crew_size: number;
  productivity_rate: number;
  percent_complete: number;  // 0-100
  is_critical_path: boolean;
  is_critical: boolean;
  resource_group?: {
    primary_trade: string;  // 'steel_fixer', 'carpenter', 'concrete_gang', etc.
  };
  predecessor_task_ids: string[];
}
```

---

## Styling & Customization

### Color Palette (from design-tokens.css)

| Element | Color | CSS Variable |
|---|---|---|
| Normal bar | Blue gradient | `linear-gradient(135deg, #3b82f6, #2563eb)` |
| Critical path | Red gradient | `linear-gradient(135deg, #ef4444, #dc2626)` |
| Weather buffer | Amber striped | `rgba(245, 158, 11, ...)` |
| Today line | Red | `#ef4444` |

### Customization Example

Change the critical path color:
```css
.gantt-critical {
  background: linear-gradient(135deg, #f97316, #ea580c) !important;
}
```

Change the weather buffer pattern:
```css
.gantt-weather-buffer {
  background: repeating-linear-gradient(
    45deg,
    rgba(14, 165, 233, 0.3),
    rgba(14, 165, 233, 0.3) 8px,
    rgba(14, 165, 233, 0.15) 8px,
    rgba(14, 165, 233, 0.15) 16px
  ) !important;
}
```

---

## Integration with Planner Module

### Example: Full Planner Integration

```javascript
// js/planner/planner-index.js
import { cp_renderGantt, cp_applyFilter } from './gantt-engine.js';
import { projectStorageKey, getCurrentProjectId } from '../shared/project-store.js';
import { STORAGE_KEYS } from '../shared/pipeline.js';

let schedule = [];

function render() {
  // Load schedule tasks
  const raw = localStorage.getItem(projectStorageKey(STORAGE_KEYS.schedule, getCurrentProjectId()));
  schedule = raw ? JSON.parse(raw) : [];

  // Render Gantt
  cp_renderGantt(schedule, 'gantt-container');

  // Set up filter controls
  document.getElementById('filter-floor-select').addEventListener('change', (e) => {
    cp_applyFilter('floors', e.target.value ? [e.target.value] : []);
  });

  document.getElementById('toggle-compact').addEventListener('click', () => {
    cp_toggleCompactView();
  });
}

export const planner = { render };
```

### HTML Fragment for Filter Controls

```html
<div style="display: flex; gap: 12px; margin-bottom: 16px;">
  <label>
    Filter by floor:
    <select id="filter-floor-select">
      <option value="">All floors</option>
      <option value="F1">F1</option>
      <option value="F2">F2</option>
      <option value="RF">RF</option>
    </select>
  </label>

  <button id="toggle-compact">ย่อมุมมอง</button>
</div>

<div id="gantt-container" style="height: 600px;"></div>
```

---

## Events

The Gantt engine emits custom events that the Planner can listen to:

### `gantt-progress-changed`

Fired when task progress is updated via the detail drawer slider.

```javascript
window.addEventListener('gantt-progress-changed', (e) => {
  const { taskId, progress } = e.detail;
  console.log(`Task ${taskId} progress: ${progress}%`);

  // Update Planner's data and re-render
  const task = schedule.find(t => t.id === taskId);
  if (task) {
    task.percent_complete = progress;
    // Persist to localStorage
    // Dispatch PIPELINE_EVENT to re-render Overview, Resource Hub, etc.
  }
});
```

---

## Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| Desktop (≥768px) | Full Gantt with drawer on right side |
| Tablet (480-768px) | Gantt shrinks, drawer on right (smaller) |
| Mobile (<480px) | Drawer at bottom (half-screen height) |

---

## Performance Considerations

- The Gantt renders up to **300 tasks** comfortably
- For larger projects (>300 tasks), use filters to reduce visible scope
- Hierarchical grouping with collapsed groups reduces DOM nodes
- Today line and critical path highlighting are lightweight SVG-free implementations

---

## Known Limitations (Pre-Supabase)

- Data is from demo-seed currently
- No real-time synchronization with Supabase
- To connect to live data, replace the `getDemoDataByEngine()` call with Supabase queries

---

## Testing Checklist

- [ ] Gantt renders with demo data
- [ ] Floor groups collapse/expand
- [ ] Work package groups collapse/expand
- [ ] Critical-path tasks show in red
- [ ] Weather buffers display with striped pattern
- [ ] Today line appears at correct position
- [ ] Clicking a task bar opens detail drawer
- [ ] Detail drawer shows all task fields
- [ ] Progress slider updates % and re-renders bar
- [ ] Predecessor chips are clickable (jump to task)
- [ ] Floor filter works (hides/shows tasks)
- [ ] Trade filter works
- [ ] Status filter works
- [ ] Compact view toggles and shows floor-level bars
- [ ] Drawer closes on button click
- [ ] Responsive: drawer moves to bottom on mobile
