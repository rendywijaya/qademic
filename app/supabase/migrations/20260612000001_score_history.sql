-- Score history: daily snapshot of Q7 setup scores per ticker
-- Used for score trend charts and signal performance backtesting

create table if not exists score_history (
  id           bigserial primary key,
  ticker       text        not null,
  scored_date  date        not null default current_date,
  setup_score  integer     not null,
  recommendation text,
  q1_score     integer,
  q2_score     integer,
  q3_score     integer,
  q4_score     integer,
  q5_score     integer,
  q6_score     integer,
  q7_score     integer,
  price        numeric(12,4),
  created_at   timestamptz not null default now()
);

create unique index if not exists score_history_ticker_date_idx on score_history (ticker, scored_date);
create index if not exists score_history_ticker_idx on score_history (ticker, scored_date desc);

-- fundamentals_cache: stores fetched fundamentals to reduce API calls
create table if not exists fundamentals_cache (
  ticker      text        primary key,
  data        jsonb       not null,
  updated_at  timestamptz not null default now()
);

-- RLS: allow authenticated reads
alter table score_history enable row level security;
alter table fundamentals_cache enable row level security;

create policy "score_history_select" on score_history for select using (true);
create policy "fundamentals_cache_select" on fundamentals_cache for select using (true);
