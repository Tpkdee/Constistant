# JavaScript modules

Application code organized by feature. All modules are ES modules loaded directly in the browser (no bundler).

## Core (`shared/`)

Start here when tracing data flow.

| File | Role |
|---|---|
| `schema.js` | Entity factories (`create*`) and reference tables — **single source of truth** |
| `project-store.js` | Multi-project localStorage, `projectStorageKey()`, `PROJECT_EVENT` |
| `pipeline.js` | `runPipeline()` — BOQ → BBS → schedule → resources → readiness |
| `timeline-engine.js` | Duration estimation, budget impact, task grouping |
| `demo-seed.js` | Demo project data for development |

## Shell & wizard

| Folder | Entry | Role |
|---|---|---|
| `shell/` | `shell-index.js` | Tab switching, project switcher, pipeline button, wizard gate |
| `wizard/` | `wz-index.js` | 4-step onboarding wizard (`wz-step1`–`wz-step4`) |

## Feature tabs (mounted in `contistant.html`)

| Folder | Entry | Window prefix | Reads from pipeline |
|---|---|---|---|
| `overview/` | `overview-index.js` | — | All entities (KPIs, charts) |
| `drawing/` | `drawing-index.js` | `qt_*` | Writes `drawing_uploads`, `beam_library`, `drawing_elements` |
| `bbs/` | `bbs-index.js` | — | `bbs_items` |
| `readiness/` | `readiness-index.js` | `rc_*` | `readiness_checks` |
| `planner/` | `planner-index.js` | `pl_*` | `schedule_tasks` |
| `resource/` | `resource-index.js` | `rh_*` | `resource_items` |

### Drawing Intelligence internals

```
drawing-index.js     orchestrator, mounts template
drawing-upload.js    PDF → images
drawing-gemini.js    Gemini API calls
drawing-parser.js    API response → schema entities
drawing-bridge.js    saves extraction to project-store
drawing-calc.js      quantity math
drawing-ui.js        review screen rendering
```

UI template: `templates/drawing/quantitake-panel.html`

## Standalone pages

| Folder | Entry | Page |
|---|---|---|
| `boq/` | `boq-summary.js` | `pages/boq-summary.html` |
| `catalog/` | `material-catalog.js` | `pages/material-catalog.html` |

## Import rules

- Feature modules import from `../shared/` — never from sibling feature folders (except wizard → drawing).
- `boq-summary.js` may import from `catalog/` for price linking.
- Never construct entities without `create*` from `schema.js`.
