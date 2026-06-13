# Database

Supabase (Postgres) schema definitions. Apply via the Supabase SQL editor or migrations.

| File | Purpose |
|---|---|
| [schema.sql](schema.sql) | Core project tables (projects, drawing elements, BOQ, BBS, schedule, resources, readiness) |
| [SCHEMA.md](SCHEMA.md) | Human-readable schema reference |
| [material_prices.sql](material_prices.sql) | User-scoped material price catalog (used by `js/catalog/material-catalog.js`) |

## Data model alignment

JavaScript entity shapes are defined in [`js/shared/schema.js`](../js/shared/schema.js). Database columns use snake_case; JS objects use camelCase. When adding a field, update both `schema.js` factory functions and the matching SQL table here.

## Connection

Copy [`config/supabase.example.js`](../config/supabase.example.js) to `supabase.js` at the repo root with your project URL and anon key.
