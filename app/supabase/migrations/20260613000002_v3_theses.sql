-- v3 foundation (QADEMIC.md) — self-contained and idempotent. Run the whole file.
-- Supersedes the never-applied 20260613000001_phase0_v2_foundation.sql (deleted):
-- the swing-setup layer it created is gone from the strategy; regime/journal/score
-- columns it carried are recreated here in their v3 shape.

-- 1. Business/Timing score columns (Phase 1 engine writes these)
alter table public.stock_q7_scores
  add column if not exists business_score integer,
  add column if not exists timing_score integer,
  add column if not exists grade text check (grade in ('A','B','C','D','F')),
  add column if not exists methodology_version text not null default 'v1';

alter table public.score_history
  add column if not exists business_score integer,
  add column if not exists timing_score integer,
  add column if not exists grade text,
  add column if not exists methodology_version text not null default 'v1';

comment on column public.stock_q7_scores.grade is
  'Entry-quality grade A-F. Describes analysis quality — never a buy/sell recommendation.';

-- 2. Daily market regime — public read, it is free-tier content
create table if not exists public.regime_daily (
  date                       date primary key,
  trend_score                smallint not null,
  breadth_score              smallint not null,
  vol_score                  smallint not null,
  credit_score               smallint not null,
  curve_score                smallint not null,
  total                      smallint not null,
  state                      text not null check (state in ('risk_on','neutral','risk_off')),
  exposure_multiplier        numeric(3,2) not null,
  spy_close                  numeric(12,4),
  spy_sma200                 numeric(12,4),
  pct_sectors_above_200dma   numeric(5,2),
  vix                        numeric(8,2),
  hy_oas                     numeric(6,2),
  yield_curve                numeric(6,2),
  created_at                 timestamptz not null default now()
);
alter table public.regime_daily enable row level security;
drop policy if exists "regime_daily_select" on public.regime_daily;
create policy "regime_daily_select" on public.regime_daily for select using (true);

-- 3. Theses — claim + evidence + kill conditions, written BEFORE entry (QADEMIC.md §4)
create table if not exists public.theses (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  ticker                   text not null,
  theme                    text,            -- rotation theme / industry tag
  status                   text not null default 'watching'
                             check (status in ('watching','active','closed')),
  claim                    text not null,   -- what must become true, one paragraph
  evidence                 jsonb,           -- rotation/business/catalyst snapshot at entry
  priced_in                text,            -- what the current price already assumes
  kill_conditions          jsonb not null default '[]',
    -- [{kind:'quant'|'qual', description, metric, op, value, triggered_at}]
    -- quant conditions are checked nightly by the thesis monitor (Phase 2)
  trend_failsafe           boolean not null default true,
    -- close < 200dma + relative-strength breakdown => forced review
  size_tier                text check (size_tier in ('starter','standard','high_conviction')),
  entry_date               date,
  entry_price              numeric(12,4),
  exit_date                date,
  exit_price               numeric(12,4),
  outcome_pct              numeric(8,2),
  followed_plan            boolean,
  review_notes             text,
  business_score_at_entry  integer,
  timing_score_at_entry    integer,
  regime_at_entry          text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists theses_user_idx on public.theses (user_id, status, created_at desc);
create index if not exists theses_ticker_idx on public.theses (ticker);

alter table public.theses enable row level security;
drop policy if exists "theses_select_own" on public.theses;
create policy "theses_select_own" on public.theses
  for select using (auth.uid() = user_id);
drop policy if exists "theses_insert_own" on public.theses;
create policy "theses_insert_own" on public.theses
  for insert with check (auth.uid() = user_id);
drop policy if exists "theses_update_own" on public.theses;
create policy "theses_update_own" on public.theses
  for update using (auth.uid() = user_id);
drop policy if exists "theses_delete_own" on public.theses;
create policy "theses_delete_own" on public.theses
  for delete using (auth.uid() = user_id);

-- 4. Trades — the execution journal. Multiple adds per thesis is the doctrine;
--    'core' rows are the long-term compounder sleeve (no thesis card required).
create table if not exists public.trades (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  ticker                   text not null,
  mode                     text not null check (mode in ('thesis','core')),
  thesis_id                uuid references public.theses(id) on delete set null,
  entry_date               date not null,
  entry_price              numeric(12,4) not null,
  shares                   numeric(14,4) not null,
  exit_date                date,
  exit_price               numeric(12,4),
  followed_plan            boolean,
  review_notes             text,
  business_score_at_entry  integer,
  timing_score_at_entry    integer,
  regime_at_entry          text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists trades_user_idx on public.trades (user_id, entry_date desc);
create index if not exists trades_thesis_idx on public.trades (thesis_id);

alter table public.trades enable row level security;
drop policy if exists "trades_select_own" on public.trades;
create policy "trades_select_own" on public.trades
  for select using (auth.uid() = user_id);
drop policy if exists "trades_insert_own" on public.trades;
create policy "trades_insert_own" on public.trades
  for insert with check (auth.uid() = user_id);
drop policy if exists "trades_update_own" on public.trades;
create policy "trades_update_own" on public.trades
  for update using (auth.uid() = user_id);
drop policy if exists "trades_delete_own" on public.trades;
create policy "trades_delete_own" on public.trades
  for delete using (auth.uid() = user_id);

-- 5. Account size — powers "size for your account" (Pro)
alter table public.profiles
  add column if not exists account_size numeric(14,2);
