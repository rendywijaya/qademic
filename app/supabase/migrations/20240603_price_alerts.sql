create table if not exists price_alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  company_name text,
  target_price numeric(20,6) not null check (target_price > 0),
  direction text not null check (direction in ('above', 'below')),
  triggered boolean default false not null,
  triggered_at timestamptz,
  created_at timestamptz default now() not null
);
alter table price_alerts enable row level security;
create policy "Users can manage own alerts" on price_alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists price_alerts_user_id_idx on price_alerts (user_id);
