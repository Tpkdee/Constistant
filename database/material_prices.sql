-- Material Price Catalog
-- User-level persistent price list, used to enrich BOQ items (boq_items.unit_rate_thb)
-- via js/catalog/material-catalog.js + js/boq/boq-summary.js (linkCatalogPrices)

create table if not exists material_prices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,

  material_key text not null,
  category text not null,
  label_th text not null,
  unit text not null,
  price decimal(12,2) not null,
  price_vat decimal(12,2),
  source_code text not null default 'manual',
  source_label text,
  source_date date,
  region text default 'central',
  brand text,
  notes text,
  uploaded_file text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_active boolean default true
);

create index if not exists idx_material_prices_key on material_prices(material_key);
create index if not exists idx_material_prices_project on material_prices(project_id);
create index if not exists idx_material_prices_category on material_prices(category);

create index if not exists material_prices_user_id_idx on material_prices(user_id);
create index if not exists material_prices_type_unit_idx on material_prices(material_type, unit);
create index if not exists material_prices_subtype_idx on material_prices(material_subtype);

-- RLS: users see only their own rows
alter table material_prices enable row level security;

drop policy if exists "Users manage own prices" on material_prices;
create policy "Users manage own prices" on material_prices
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh on edit
create or replace function material_prices_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists material_prices_updated_at on material_prices;
create trigger material_prices_updated_at
  before update on material_prices
  for each row
  execute function material_prices_set_updated_at();
