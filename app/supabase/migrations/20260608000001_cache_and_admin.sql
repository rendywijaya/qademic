-- Add is_admin to profiles
alter table public.profiles add column if not exists is_admin boolean default false not null;

-- Market snapshot (SPY, QQQ, BTC, VIX, etc.) — updated every 30 min by cron
create table if not exists public.market_snapshot (
  symbol text primary key,
  name text not null,
  price numeric(20,6),
  change_amt numeric(10,4),
  change_pct numeric(10,4),
  updated_at timestamptz default now() not null
);
alter table public.market_snapshot enable row level security;
create policy "Auth users read market snapshot" on public.market_snapshot
  for select using (auth.role() = 'authenticated');

-- Macro data snapshot — updated daily by cron
create table if not exists public.macro_snapshot (
  indicator_id text primary key,
  label text not null,
  value text not null,
  previous_value text not null,
  change text not null,
  direction text not null check (direction in ('up','down','flat')),
  unit text not null,
  description text not null,
  series_date text not null,
  updated_at timestamptz default now() not null
);
alter table public.macro_snapshot enable row level security;
create policy "Auth users read macro snapshot" on public.macro_snapshot
  for select using (auth.role() = 'authenticated');

-- Fundamentals cache — keyed by ticker, updated daily
create table if not exists public.fundamentals_cache (
  ticker text primary key,
  data jsonb not null,
  updated_at timestamptz default now() not null
);
alter table public.fundamentals_cache enable row level security;
create policy "Auth users read fundamentals" on public.fundamentals_cache
  for select using (auth.role() = 'authenticated');

-- Price history cache — 1 year of daily closes per ticker
create table if not exists public.price_history_cache (
  ticker text primary key,
  data jsonb not null, -- [{date, close, volume}]
  updated_at timestamptz default now() not null
);
alter table public.price_history_cache enable row level security;
create policy "Auth users read price history" on public.price_history_cache
  for select using (auth.role() = 'authenticated');

-- AI output cache — shared across all users (macro brief, etc.)
create table if not exists public.ai_output_cache (
  cache_key text primary key,
  content text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null
);
alter table public.ai_output_cache enable row level security;
create policy "Auth users read ai cache" on public.ai_output_cache
  for select using (auth.role() = 'authenticated');

-- AI usage log — for admin analytics
create table if not exists public.ai_usage_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  feature text not null,
  model text,
  cache_hit boolean default false,
  created_at timestamptz default now() not null
);
alter table public.ai_usage_log enable row level security;
create policy "Admins read ai usage" on public.ai_usage_log
  for select using (exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  ));
create policy "Insert ai usage" on public.ai_usage_log
  for insert with check (true);
