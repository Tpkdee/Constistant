# Project Header Component — Integration Guide

## Quick Integration

Add to: `overview.html`, `planner.html`, `resources.html`, `boq.html`, etc.

### Step 1: Link the CSS (in `<head>`)

```html
<link rel="stylesheet" href="../css/project-header.css">
```

### Step 2: Add the container (before main content)

```html
<main class="pg-content">
  <div id="project-header"></div>
  <!-- Rest of your page content here -->
</main>
```

### Step 3: Add initialization script (at end of `<body>`)

```html
<script type="module">
  import { renderProjectHeader } from '../js/shared/project-header.js';
  
  window.addEventListener('DOMContentLoaded', async () => {
    await renderProjectHeader('project-header');
  });
</script>
```

---

## What It Shows

### Expanded State (Default on Desktop)
- **Project Name** with location, type, number of floors
- **RAG Status Badge**: 🟢 On Track, 🟡 Caution, 🔴 At Risk (from latest readiness check)
- **Weather Alert**: ⚠️ ฤดูฝน if current month is in wet season (May-Oct)
- **Progress Bar**: Overall project % complete (average of all task progress)
- **Key Dates**: Start date, Target completion date, Days remaining

### Collapsed State (Default on Mobile)
- Single horizontal bar: Project name + RAG badge + % complete + ▼ chevron
- Click anywhere on the bar to expand

---

## Behavior

- **Persistent State**: Collapse/expand state saved to localStorage
- **Mobile Responsive**: Auto-collapses on screens < 768px
- **Smooth Animations**: 200ms transitions between states
- **Sticky Header**: Always visible at top of content area (z-index: 99)
- **Click to Toggle**: Click anywhere in the header to collapse/expand

---

## Data Sources (Currently Demo)

The component currently pulls data from:

```javascript
getDemoProject()                      // Project: name, location, type, floors, etc.
getDemoDataByEngine('readiness')      // RAG status from readiness_checks
getDemoDataByEngine('schedule')       // Progress % from schedule_tasks
```

### Future: Supabase Integration

Replace `ph_fetchProjectData()` in `project-header.js`:

```javascript
// Current (demo):
export async function ph_fetchProjectData(projectId) {
  const project = getDemoProject();
  const readiness = getDemoDataByEngine('readiness');
  const schedule = getDemoDataByEngine('schedule');
  return { project, readiness, schedule };
}

// Future (Supabase):
export async function ph_fetchProjectData(projectId) {
  const project = await supabase.from('projects').select('*').eq('id', projectId).single();
  const readiness = await supabase.from('readiness_checks').select('*')
    .eq('project_id', projectId).order('created_at', { ascending: false }).limit(1);
  const schedule = await supabase.from('schedule_tasks').select('percent_complete')
    .eq('project_id', projectId);
  return { project, readiness, schedule.data, };
}
```

No changes needed in the HTML files — the swap happens entirely in `project-header.js`.

---

## API Reference

### `renderProjectHeader(containerId, projectData)`

Renders the header in the specified container.

**Parameters:**
- `containerId` (string): ID of the container div (default: `'project-header'`)
- `projectData` (object, optional): Project data object
  - If omitted, fetches from `ph_fetchProjectData(getCurrentProjectId())`

**Example:**
```javascript
await renderProjectHeader('project-header');

// Or with custom data:
const customData = { project: {...}, readiness: {...}, schedule: [...] };
await renderProjectHeader('project-header', customData);
```

### `toggleProjectHeader(containerId)`

Toggles between collapsed and expanded states, persists to localStorage.

**Parameters:**
- `containerId` (string, optional): ID of the container (default: `'project-header'`)

**Example:**
```javascript
window.ph_toggleProjectHeader();
// Or with custom container:
window.ph_toggleProjectHeader('custom-header-id');
```

### `ph_fetchProjectData(projectId)`

Async function to fetch project + readiness + schedule data.

**Returns:** Promise resolving to `{ project, readiness, schedule }`

---

## Styling & Customization

All colors use CSS design tokens (from `shell.css`):

```css
--color-text-primary    /* #1f2937 — headings, main text */
--color-text-secondary  /* #6b7280 — labels, secondary text */
--color-border-default  /* #e5e7eb — borders */
```

To customize colors, edit `css/project-header.css`:

- `.ph-project-name` — project title font size/color
- `.ph-progress-fill` — progress bar gradient
- `.ph-badge--rag` — RAG badge styling
- `.ph-dates-section` — date grid layout

---

## Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| Desktop (≥768px) | Expanded by default, click to collapse |
| Tablet (480-768px) | Dates in 2-column grid |
| Mobile (<480px) | Collapsed by default, dates in 1 column |

Window resize events automatically adjust the state.

---

## LocalStorage

- **Key**: `constistant_header_collapsed`
- **Values**: `'0'` (expanded) or `'1'` (collapsed)
- **Reset**: Clear localStorage to return to default (collapsed on mobile, expanded on desktop)

---

## Example: Full Integration (overview.html)

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Overview — Constistant</title>
  <link rel="stylesheet" href="../css/project-header.css">
  <link rel="stylesheet" href="../css/common.css">
</head>
<body>
  <header class="pg-topbar">
    <!-- Your existing topbar -->
  </header>

  <main class="pg-content">
    <!-- PROJECT HEADER COMPONENT -->
    <div id="project-header"></div>

    <!-- Your page content here -->
    <div id="overview-app"></div>
  </main>

  <script type="module">
    import { renderProjectHeader } from '../js/shared/project-header.js';
    
    window.addEventListener('DOMContentLoaded', async () => {
      await renderProjectHeader('project-header');
    });
  </script>

  <script type="module" src="../js/overview/overview-index.js"></script>
</body>
</html>
```

---

## Testing

### Manual Testing

1. Open `overview.html` in browser
2. Verify header shows project info, RAG status, progress, dates
3. Click header to collapse → smooth animation
4. Click again to expand
5. Refresh page → state persists from localStorage
6. Resize to mobile (< 768px) → should collapse automatically
7. Current month May-Oct → "⚠️ ฤดูฝน" badge appears

### Browser Console

```javascript
// Check stored state
localStorage.getItem('constistant_header_collapsed')

// Manually toggle
window.ph_toggleProjectHeader()

// Re-render with fresh data
await window.ph_renderProjectHeader('project-header')
```

---

## Known Limitations (Pre-Supabase)

- Data is from demo seed, doesn't reflect actual project data yet
- Readiness status is static demo data
- Progress % is hard-coded demo percentages
- To use real data, implement `ph_fetchProjectData()` with Supabase queries

---

## Future Enhancements

- [ ] Live updates: polling or WebSocket for real-time progress/RAG changes
- [ ] Click RAG badge to open readiness detail modal
- [ ] Click progress bar to jump to schedule/planner
- [ ] Export project metadata as JSON
- [ ] Print-friendly compact view
- [ ] Multi-language support (i18n)
