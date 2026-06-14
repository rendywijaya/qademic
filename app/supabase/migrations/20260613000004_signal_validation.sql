-- Forward-cohort validation (QADEMIC.md §10) — the only "backtester" we build.
-- Pre-computed nightly from append-only score_history: "stocks we ranked high vs
-- stocks we ranked low, what happened next, and vs simply holding SPY." Public by
-- design — the live forward record is the moat. One row per (signal, window).

create table if not exists public.signal_validation (
  signal            text not null,            -- 'setup_score' | 'business_score'
  window_days       integer not null,
  cohorts           integer not null default 0,   -- matured cohort dates
  n_observations    integer not null default 0,   -- total stock-window observations
  top_avg_fwd       numeric(8,2),             -- avg fwd return % of the top decile
  bottom_avg_fwd    numeric(8,2),
  spread            numeric(8,2),             -- top − bottom (the signal's edge)
  universe_avg_fwd  numeric(8,2),             -- equal-weight all scored stocks
  spy_avg_fwd       numeric(8,2),             -- benchmark over the same windows
  top_quantile      numeric(4,2) not null default 0.10,
  first_cohort_date date,
  last_cohort_date  date,
  computed_at       timestamptz not null default now(),
  primary key (signal, window_days)
);

alter table public.signal_validation enable row level security;
drop policy if exists "signal_validation_select" on public.signal_validation;
create policy "signal_validation_select" on public.signal_validation for select using (true);
