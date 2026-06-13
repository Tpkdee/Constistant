# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Constistant" (Steel Calc) — a static, no-build, vanilla JS web app for Thai construction teams: rebar cut-list optimization (CSP), AI-driven drawing/quantity-takeoff scanning, and project save/load via Supabase. Built for STECON Group Innovation Challenge SS4.

There is no build step, package manager, or test runner — plain HTML/CSS/JS files served directly (e.g. via a static file server / Live Server).

## Setup

- Copy [supabase.example.js](supabase.example.js) to `supabase.js` and fill in real Supabase project URL + anon key (gitignored — never commit real keys).
- Pages of interest:
  - [contistant.html](contistant.html) — main app shell (sidebar/tabs/canvas layout). The shell's CSS now lives in `css/shell.css`, `css/quantitake.css`, `css/feature-panels.css` (extracted from a former inline `<style>` block) and its tab/sidebar/project-switcher behavior lives in `js/shell/shell-index.js`.
  - [pages/boq-summary.html](pages/boq-summary.html) and [pages/material-catalog.html](pages/material-catalog.html) — standalone pages (own topbar/nav, `pages/shared-pages.css`), outside the `contistant.html` shell, mounting `js/boq/boq-summary.js` and `js/catalog/material-catalog.js` respectively
  - [quantitake kak.html](quantitake kak.html) — legacy standalone Quantity Takeoff (QT) drawing-intelligence flow (superseded inside the shell by the dynamically-mounted `js/drawing/quantitake-panel.html`, see below)
  - [js/drawing/demo-runner.html](js/drawing/demo-runner.html) — standalone demo runner for the drawing pipeline

## Architecture

### Shell (`contistant.html` + `js/shell/`, `css/`)
`contistant.html` is now a thin shell: topbar (project switcher, "Calculate Project" button), sidebar, tab bar, and one `<div class="canvas-panel">`/`<div class="app-panel" id="*-app">` per feature tab (Overview, Drawing Intelligence, Readiness Check, Planner, Resource Hub). `js/shell/shell-index.js` wires tab switching, sidebar selection, the project switcher (`getProjects`/`selectProject`/`addProject` from `project-store.js`), and the global `constistant_runPipeline()` button (calls `runPipeline()` from `pipeline.js`). All shell styling is in `css/shell.css` (layout/topbar/sidebar/tabs), `css/quantitake.css` (QT panel), and `css/feature-panels.css` (shared `.fp-*`/`.rh-*`-style form/table primitives reused by feature tabs).

### Data contract: `js/shared/schema.js`
This is the single source of truth for all object shapes, used by every feature module. **Rule enforced in the codebase: never construct entity objects ad-hoc — always use the `create*` factory functions from this file.** Schema changes propagate from here.

Entity dependency chain:
```
projects
  └── drawing_uploads
        ├── beam_library        (Pass 1: section detail sheets)
        └── drawing_elements    (Pass 2: floor plan counts)
              ├── boq_items
              │     └── bbs_items
              │           └── schedule_tasks
              │                 ├── weather_snapshots
              │                 └── resource_items
              └── readiness_checks
```

In addition to entity factories, `schema.js` exports shared lookup/reference tables consumed by `pipeline.js` and feature modules: waste/lap/bend factors (`CONCRETE_WASTE_FACTOR`, `REBAR_WASTE_FACTOR`, `REBAR_GRADES`, `BEND_DEDUCTION_D`, `CONCRETE_GRADES`), cost factors (`EQUIPMENT_COST_FACTOR`, `CONTINGENCY_FACTOR`, `OVERTIME_COST_MULTIPLIER`), and Resource Hub reference data (`CREW_TYPES`, `EQUIPMENT_TYPES`, `EQUIPMENT_RATES`, `MATERIAL_LEAD_TIMES`). `createBOQItem` carries a `status: 'ok' | 'needs_review'` field set by `pipeline.js` based on extraction confidence.

### Shared modules (`js/shared/`)
- `schema.js` — data contract described above; every feature folder imports `create*` factories and reference tables from here
- `demo-seed.js` — seed/mock data for one demo project (`บ้านพักอาศัย 2 ชั้น ลาดพร้าว 71`), exposed via `getDemoDataByEngine(engine)` so each feature module can seed itself with consistent, cross-linked demo data without live API calls. The `'resource'` engine additionally returns `resource_plan_seed` (crew confirmations, material order/receive status, equipment booking status) used to seed the Resource Hub.
- `pipeline.js` — `runPipeline()` recomputes BOQ → BBS → schedule → resources → readiness from drawing elements, applying the waste/lap/bend/cost factors from `schema.js`; writes each stage to `localStorage` under `STORAGE_KEYS` (project-scoped) and fires `PIPELINE_EVENT` with the results/totals.
- `project-store.js` — multi-project support: `getCurrentProject()`/`getCurrentProjectId()`/`selectProject()`/`addProject()`/`deleteProject()`, `projectStorageKey(baseKey, projectId?)` for namespacing localStorage keys per project, `PROJECT_SCOPED_KEYS` (base keys wiped on project delete — includes BOQ/BBS/schedule/resources/readiness plus `constistant_resource_plan_v1`), and `PROJECT_EVENT` fired on project switch.

### Feature modules (one folder per tab)
- `js/overview/overview-index.js` — Overview tab: project dashboard (RAG readiness status, KPIs, BOQ cost breakdown chart, schedule chart, element summary). Reads pipeline output from `localStorage` via `STORAGE_KEYS`/`projectStorageKey`, falling back to `demo-seed.js` for the demo project when `runPipeline()` hasn't been run yet.
- `js/drawing/` — Drawing Intelligence pipeline:
  - `drawing-upload.js` — file selection, PDF→image conversion (pdf.js), thumbnails. Stores state on `globalThis` (`qt_selectedFile`, `qt_pdfPageDataUrls`, etc.)
  - `drawing-gemini.js` — calls Gemini API (`gemini-2.5-flash`) directly from the browser with retry/backoff for 429/503; normalizes raw responses
  - `drawing-parser.js` — parses normalized Gemini output into schema entities
  - `drawing-calc.js` — quantity-takeoff math (concrete/formwork/rebar weights per element, incl. slabs) via `qt_calcElement`; exposes `qt_initSteelGlobals` (seeds `globalThis.qt_UW`/`qt_steelUW`/`qt_elementsData`/`qt_API_KEY`), `qt_runCalculate`, `qt_copyResult`
  - `quantitake-panel.html` — the QT screen markup, fetched at runtime and injected into `#qt-module` by `drawing-index.js`'s `qt_mountPanel()` (keeps the large QT markup out of `contistant.html`)
  - `drawing-index.js` — orchestrates the QT (Quantity Takeoff) UI flow; mounts `quantitake-panel.html`, wires its DOM events, and exposes all `qt_*` functions on `window`/`globalThis` for use from inline HTML event handlers
  - `drawing-ui.js` — rendering helpers for the QT review screens
- `js/readiness/readiness-index.js` — Readiness Check tab (RAG checklist), exposes `rc_*` on `window`
- `js/planner/planner-index.js` — Planner tab (schedule/Gantt task list), exposes `pl_*` on `window`
- `js/resource/resource-index.js` — Resource Hub tab: sticky KPI header (budget split, weekly readiness %, critical shortage count, schedule impact days), a 3-tab board (แรงงาน manpower cards / วัสดุ materials table / เครื่องจักร equipment cards, each with a red/green count badge), a shortage-alert sidebar, and a pure-SVG weekly labor-demand chart, plus an onboarding state when no schedule/resource data exists yet. Self-contained (injects its own `<style>`), persists confirmations/order status/equipment booking to the project-scoped `constistant_resource_plan_v1` key, and exposes `rh_*` on `window` (`rh_switchTab`, `rh_updateCrew`, `rh_updateMaterial`, `rh_updateEquipment`, `rh_focusResource`, `rh_generateFromPlan`, `rh_init`).
- `js/boq/boq-summary.js` and `js/catalog/material-catalog.js` (+ `js/catalog/catalog-seed.js`, `js/catalog/csv-utils.js`) — back the standalone `pages/boq-summary.html` and `pages/material-catalog.html` pages (outside the shell, see Setup).

Each feature module is self-contained: persists its own state to `localStorage`, seeds itself from `js/shared/demo-seed.js` on first load, and renders into its own `<div id="*-app">` mount point in `contistant.html` (or the relevant `pages/*.html` for BOQ Summary / Material Catalog).

### Module conventions
- ES modules (`export`/`import`), but most functions are also attached to `window`/`globalThis` (prefixed per feature: `qt_` for Drawing Intelligence/QuantiTake, `rc_` for Readiness Check, `pl_` for Planner, `rh_` for Resource Hub) because the HTML uses inline `onclick="..."` handlers — when adding a new UI action, both export it and assign it to `window`.
- Cross-module mutable state lives on `globalThis` (e.g. `qt_elementsData`, `qt_selectedFile`) rather than module-local state, since multiple modules need shared access without a bundler.
- Comments and identifiers mix Thai and English; follow existing language usage per file/section.

### Three-layer model (per team guide)
1. Frontend (HTML/CSS/JS) — UI only
2. Supabase JS SDK (`supabase.js`) — all DB read/write calls
3. Supabase (Postgres + Auth) — managed via dashboard, schema defined in `schema.js`

## Reference docs
- [STEEL_CALC_TEAM_GUIDE.md](STEEL_CALC_TEAM_GUIDE.md) — team roles, build stages, scoring rubric, full DB schema description
- `research/` — market and technical research reports (Thai construction market, BOQ/BBS automation, vision-language models for engineering drawings, etc.) — consult when implementing features that depend on domain assumptions
