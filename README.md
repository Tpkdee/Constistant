# Constistant (Steel Calc)

A static, no-build vanilla JS web app for Thai construction teams: AI-driven drawing/quantity takeoff, BOQ/BBS generation, scheduling, resource planning, and readiness checks. Built for STECON Group Innovation Challenge SS4.

## Quick start

1. Serve the repo as static files (e.g. Live Server, `npx serve .`).
2. Open [`contistant.html`](contistant.html) — the main app shell.
3. Copy [`config/supabase.example.js`](config/supabase.example.js) to `supabase.js` at the repo root and add your Supabase URL + anon key (gitignored).

## Project layout

```
Constistant/
├── contistant.html          # Main app entry (shell + tabs)
├── supabase.js              # Your credentials (create from config/supabase.example.js)
│
├── config/                  # App configuration templates
├── css/                     # Global stylesheets
├── js/                      # Application code (ES modules)
│   ├── shared/              # Core data layer — start here
│   ├── shell/               # App chrome (tabs, project switcher)
│   ├── wizard/              # Onboarding wizard (wz_*)
│   ├── drawing/             # Drawing Intelligence / QuantiTake (qt_*)
│   ├── overview/            # Dashboard KPIs and charts
│   ├── bbs/                 # Bar Bending Schedule view
│   ├── planner/             # Schedule / Gantt (pl_*)
│   ├── resource/            # Resource Hub (rh_*)
│   ├── readiness/           # Readiness Check (rc_*)
│   ├── boq/                 # BOQ Summary (standalone page)
│   └── catalog/             # Material price catalog
│
├── pages/                   # Standalone pages outside the shell
├── templates/               # HTML fragments loaded at runtime
├── demo/                    # Dev/demo utilities
├── legacy/                  # Superseded prototypes (reference only)
├── database/                # Supabase SQL schemas
├── docs/                    # Architecture, planning, team guides
└── research/                # Domain research reports
```

## Data flow

All feature modules share one data contract defined in [`js/shared/schema.js`](js/shared/schema.js). Never construct entity objects ad-hoc — always use the `create*` factory functions.

### Entity dependency chain

```
projects
  └── project_config          (wizard)
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

### Pipeline (Engine 2 → 5)

[`js/shared/pipeline.js`](js/shared/pipeline.js) runs the cross-engine calculation:

```
drawing_elements + beam_library
  → computeBOQ()        → boq_items
  → computeBBS()        → bbs_items
  → computeSchedule()   → schedule_tasks
  → computeResources()  → resource_items
  → computeReadiness()  → readiness_checks
```

Triggered by:
- **Calculate Project** button in the shell topbar (`constistant_runPipeline()`)
- Wizard Step 4 after project configuration
- Planner date changes (partial recalc via `timeline-engine.js`)

### User journey

```
New project created
  → Wizard Step 1: upload PDF → classify sheets → extract elements
  → Wizard Step 2: review/correct drawing_elements
  → Wizard Step 3: set province, timeline, budget impact → project_config
  → Wizard Step 4: runPipeline() → all downstream entities
  → Overview tab: KPIs, charts, readiness RAG

Demo project: wizard skipped — pre-seeded by js/shared/demo-seed.js
```

### Event bus

| Event | Fired by | Purpose |
|---|---|---|
| `constistant:project-changed` | `project-store.js` | Project switch — all tabs re-render |
| `constistant:pipeline-updated` | `pipeline.js` | Pipeline complete — BOQ/BBS/schedule refresh |
| `constistant:wizard-step-changed` | `wz-index.js` | Wizard step transitions |

### Storage

- **localStorage** (project-scoped via `projectStorageKey()`): all entities above, namespaced per project
- **Supabase** (when logged in): `material_prices` catalog; full project sync planned

## Module map (tabs → code)

| Tab / Page | Mount point | Module | Prefix |
|---|---|---|---|
| Overview | `#overview-app` | `js/overview/overview-index.js` | — |
| Drawing Intelligence | `#qt-module` | `js/drawing/drawing-index.js` | `qt_*` |
| BBS | `#bbs-app` | `js/bbs/bbs-index.js` | — |
| Readiness Check | `#readiness-app` | `js/readiness/readiness-index.js` | `rc_*` |
| Planner | `#planner-app` | `js/planner/planner-index.js` | `pl_*` |
| Resource Hub | `#resource-app` | `js/resource/resource-index.js` | `rh_*` |
| BOQ Summary | `pages/boq-summary.html` | `js/boq/boq-summary.js` | — |
| Material Catalog | `pages/material-catalog.html` | `js/catalog/material-catalog.js` | — |

## Documentation

| Doc | Location |
|---|---|
| AI assistant guide | [`CLAUDE.md`](CLAUDE.md) |
| Onboarding wizard architecture | [`docs/architecture/ARCHITECTURE_ONBOARDING_WIZARD.md`](docs/architecture/ARCHITECTURE_ONBOARDING_WIZARD.md) |
| Build plan | [`docs/planning/ENDGAME_BUILD_PLAN.md`](docs/planning/ENDGAME_BUILD_PLAN.md) |
| Team roles & DB schema | [`docs/team/STEEL_CALC_TEAM_GUIDE.md`](docs/team/STEEL_CALC_TEAM_GUIDE.md) |
| Database SQL | [`database/`](database/) |
| Research reports | [`research/`](research/) |
