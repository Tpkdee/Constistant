# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Constistant" (Steel Calc) — a static, no-build, vanilla JS web app for Thai construction teams: rebar cut-list optimization (CSP), AI-driven drawing/quantity-takeoff scanning, and project save/load via Supabase. Built for STECON Group Innovation Challenge SS4.

There is no build step, package manager, or test runner — plain HTML/CSS/JS files served directly (e.g. via a static file server / Live Server).

## Setup

- Copy [supabase.example.js](supabase.example.js) to `supabase.js` and fill in real Supabase project URL + anon key (gitignored — never commit real keys).
- Pages of interest:
  - [contistant.html](contistant.html) — main app shell (sidebar/tabs/canvas layout)
  - [quantitake kak.html](quantitake kak.html) — Quantity Takeoff (QT) drawing-intelligence flow
  - [js/drawing/demo-runner.html](js/drawing/demo-runner.html) — standalone demo runner for the drawing pipeline

## Architecture

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

### Shared modules (`js/shared/`)
- `schema.js` — data contract described above; every feature folder imports `create*` factories from here
- `demo-seed.js` — seed/mock data for one demo project (`บ้านพักอาศัย 2 ชั้น ลาดพร้าว 71`), exposed via `getDemoDataByEngine(engine)` so each feature module can seed itself with consistent, cross-linked demo data without live API calls

### Feature modules (one folder per tab)
- `js/drawing/` — Drawing Intelligence pipeline:
  - `drawing-upload.js` — file selection, PDF→image conversion (pdf.js), thumbnails. Stores state on `globalThis` (`qt_selectedFile`, `qt_pdfPageDataUrls`, etc.)
  - `drawing-gemini.js` — calls Gemini API (`gemini-2.5-flash`) directly from the browser with retry/backoff for 429/503; normalizes raw responses
  - `drawing-parser.js` — parses normalized Gemini output into schema entities
  - `drawing-index.js` — orchestrates the QT (Quantity Takeoff) UI flow; exposes all `qt_*` functions on `window` for use from inline HTML event handlers
  - `drawing-ui.js` — rendering helpers for the QT review screens
- `js/readiness/readiness-index.js` — Readiness Check tab (RAG checklist), exposes `rc_*` on `window`
- `js/planner/planner-index.js` — Planner tab (schedule/Gantt task list), exposes `pl_*` on `window`
- `js/resource/resource-index.js` — Resource Hub tab (manpower/material/equipment costs), exposes `rh_*` on `window`

Each feature module is self-contained: persists its own state to `localStorage`, seeds itself from `js/shared/demo-seed.js` on first load, and renders into its own `<div id="*-app">` mount point in `contistant.html`.

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
