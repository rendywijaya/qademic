-- Migration: 20260608000001_cleanup_q7
-- Remove Academy (not in product), rename Q5 references to Q7 throughout

-- ─── Drop Academy ───────────────────────────────────────────────────────────

drop trigger if exists academy_progress_updated_at on public.academy_progress;
drop table if exists public.academy_progress;

-- ─── news_cache: q5_layer → q7_layer (supports Q1–Q7 now) ──────────────────

alter table public.news_cache
  drop constraint if exists news_cache_q5_layer_check;

alter table public.news_cache
  rename column q5_layer to q7_layer;

alter table public.news_cache
  add constraint news_cache_q7_layer_check check (q7_layer between 1 and 7);

drop index if exists idx_news_q5;
create index idx_news_q7 on public.news_cache(q7_layer);

-- ─── investment_theses: q5_layers → q7_layers ───────────────────────────────

alter table public.investment_theses
  rename column q5_layers to q7_layers;

-- ─────────────────────────────────────────────────────────────────────────────
-- Future tables (not yet built — listed here so the schema tells the full story)
-- These will be added in separate migrations once each data pipeline is ready.
--
-- ohlcv_daily          -- 20yr daily price history per ticker (Polygon / FMP)
-- stock_q7_scores      -- pre-computed nightly Q7 scores for all tracked tickers
-- setup_scores         -- synthesised Setup Score (0-100) + percentile + historical match count
-- insider_transactions -- structured SEC Form 4 data
-- institutional_holdings -- 13F data by fund + ticker
-- sec_filings          -- 8-K, 10-K records with AI summaries
-- earnings_calendar    -- upcoming dates, consensus estimates, historical beat rates
-- options_flow         -- unusual options activity per ticker
-- ─────────────────────────────────────────────────────────────────────────────
