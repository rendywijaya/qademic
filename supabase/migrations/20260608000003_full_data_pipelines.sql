-- ─────────────────────────────────────────────────────────────────────────────
-- Full data pipeline tables for Qademic hedge-fund grade feature set
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Daily OHLCV price history (20yr, all US stocks)
CREATE TABLE IF NOT EXISTS ohlcv_daily (
  ticker        text        NOT NULL,
  date          date        NOT NULL,
  open          numeric     NOT NULL,
  high          numeric     NOT NULL,
  low           numeric     NOT NULL,
  close         numeric     NOT NULL,
  adj_close     numeric,
  volume        bigint,
  PRIMARY KEY (ticker, date)
);
CREATE INDEX IF NOT EXISTS idx_ohlcv_ticker_date ON ohlcv_daily(ticker, date DESC);

-- 2. Computed quant signals (derived nightly from OHLCV)
CREATE TABLE IF NOT EXISTS stock_signals (
  ticker          text      PRIMARY KEY,
  -- Moving averages
  sma_20          numeric,
  sma_50          numeric,
  sma_200         numeric,
  price           numeric,
  price_vs_sma20  numeric,   -- % above/below
  price_vs_sma50  numeric,
  price_vs_sma200 numeric,
  -- Momentum (%)
  momentum_1m     numeric,
  momentum_3m     numeric,
  momentum_6m     numeric,
  momentum_12m    numeric,
  -- Oscillators
  rsi_14          numeric,
  atr_14          numeric,   -- Average True Range
  -- Volume
  volume_avg_20   bigint,
  volume_ratio    numeric,   -- today vs 20d avg
  -- Signal composite
  quant_score     integer,   -- 0-100 Q4 sub-score
  computed_at     timestamptz NOT NULL DEFAULT now()
);

-- 3. Cross-sectional universe rankings (percentile vs all stocks + vs sector)
CREATE TABLE IF NOT EXISTS universe_rankings (
  ticker              text    PRIMARY KEY,
  sector              text,
  -- Universe percentiles (0-100, higher = better)
  rsi_pct             integer,
  momentum_1m_pct     integer,
  momentum_3m_pct     integer,
  momentum_6m_pct     integer,
  momentum_12m_pct    integer,
  -- Sector percentiles
  sector_rsi_pct      integer,
  sector_mom_3m_pct   integer,
  -- Setup score percentile in universe
  setup_score_pct     integer,
  ranked_at           timestamptz NOT NULL DEFAULT now()
);

-- 4. Earnings call transcript NLP analysis
CREATE TABLE IF NOT EXISTS earnings_transcript_analysis (
  ticker              text        NOT NULL,
  quarter             integer     NOT NULL,
  year                integer     NOT NULL,
  transcript_date     date,
  -- Phrase frequency tracking (jsonb: { phrase: count })
  phrase_counts       jsonb,
  -- Prior quarter for delta calculation
  prior_phrase_counts jsonb,
  -- Scores 1-10
  mgmt_confidence     integer,
  prior_confidence    integer,
  -- Classifications
  guidance_tone       text,   -- conservative/neutral/aggressive
  analyst_sentiment   text,   -- routine/probing/hostile
  -- Deltas
  tone_delta          text,   -- "significantly more cautious than Q2"
  new_topics          jsonb,  -- risks that appeared this quarter
  removed_topics      jsonb,  -- topics that disappeared
  -- Key outputs
  key_changes         text[], -- top 3 changes Claude identified
  claude_summary      text,
  scored_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, quarter, year)
);

-- 5. SEC filings (8-K, 10-K, 10-K delta)
CREATE TABLE IF NOT EXISTS sec_filings (
  id              text        PRIMARY KEY,  -- accession number
  ticker          text        NOT NULL,
  filing_type     text        NOT NULL,     -- 8-K, 10-K, 10-Q, 13F
  title           text,
  filed_at        timestamptz NOT NULL,
  period_of_report date,
  url             text,
  -- AI processed fields
  ai_summary      text,       -- 3-sentence summary for 8-K
  ai_sentiment    text,       -- positive/neutral/negative/warning
  key_points      text[],     -- bullet points
  -- 10-K delta fields
  delta_added     text[],     -- new risk factors / language added
  delta_removed   text[],     -- risk factors / language removed
  processed_at    timestamptz,
  is_processed    boolean     NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_sec_filings_ticker ON sec_filings(ticker, filed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_filings_unprocessed ON sec_filings(is_processed) WHERE is_processed = false;

-- 6. Institutional holdings (13F quarterly)
CREATE TABLE IF NOT EXISTS institutional_holdings (
  ticker          text        NOT NULL,
  fund_name       text        NOT NULL,
  cik             text,
  quarter         text        NOT NULL,  -- "2024-Q3"
  shares          bigint,
  value_usd       bigint,
  change_shares   bigint,     -- positive = added, negative = reduced
  change_type     text,       -- new/increased/reduced/closed
  filed_at        date,
  PRIMARY KEY (ticker, fund_name, quarter)
);
CREATE INDEX IF NOT EXISTS idx_institutional_ticker ON institutional_holdings(ticker, quarter DESC);

-- 7. Management quality scores (Q6)
CREATE TABLE IF NOT EXISTS management_scores (
  ticker                  text    PRIMARY KEY,
  ceo_name                text,
  is_founder_led          boolean,
  insider_ownership_pct   numeric,  -- % of shares owned by insiders
  roic_1yr                numeric,
  roic_3yr_avg            numeric,
  roic_5yr_avg            numeric,
  roic_trend              text,     -- improving/stable/deteriorating
  fcf_conversion          numeric,  -- FCF / Net Income ratio
  debt_trend              text,     -- improving/stable/deteriorating
  capital_alloc_score     integer,  -- 0-100 composite
  mgmt_score              integer,  -- 0-100 Q6 sub-score
  scored_at               timestamptz NOT NULL DEFAULT now()
);

-- 8. Forensic accounting / earnings quality signals
CREATE TABLE IF NOT EXISTS forensic_signals (
  ticker                    text    PRIMARY KEY,
  -- Accruals analysis
  accruals_ratio            numeric,  -- (NI - OCF) / Total Assets
  accruals_flag             boolean,  -- true = concern (> 5%)
  -- Revenue quality
  receivables_growth        numeric,  -- % YoY
  revenue_growth            numeric,  -- % YoY
  rev_vs_receivables_flag   boolean,  -- receivables growing > revenue
  -- Margin quality
  gross_margin_delta        numeric,  -- bps change YoY
  gross_margin_flag         boolean,  -- declining > 200bps
  -- Beneish M-Score components
  beneish_m_score           numeric,  -- > -1.78 = possible manipulation
  beneish_flag              boolean,
  -- Overall
  overall_flag              text,     -- clean/watch/warning
  forensic_score            integer,  -- 0-100 (100 = clean)
  scored_at                 timestamptz NOT NULL DEFAULT now()
);

-- 9. Insider pattern intelligence (per person, cross-stock accuracy)
CREATE TABLE IF NOT EXISTS insider_patterns (
  ticker                  text    NOT NULL,
  insider_name            text    NOT NULL,
  insider_title           text,
  -- Transaction history
  total_purchases         integer DEFAULT 0,
  total_sales             integer DEFAULT 0,
  -- Predictive accuracy (buys only - predicting upside)
  buy_count_tracked       integer DEFAULT 0,
  buy_accuracy_90d        numeric,  -- % of buys where stock was up 90 days later
  buy_accuracy_180d       numeric,
  avg_return_after_buy_90d  numeric,
  avg_return_after_buy_180d numeric,
  -- Signals
  is_cluster_buy          boolean DEFAULT false,  -- multiple insiders buying same period
  last_transaction_date   date,
  last_transaction_type   text,  -- purchase/sale
  last_transaction_value  bigint,
  scored_at               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, insider_name)
);
CREATE INDEX IF NOT EXISTS idx_insider_patterns_ticker ON insider_patterns(ticker);

-- 10. Stock alerts (generated by pipelines, served to users)
CREATE TABLE IF NOT EXISTS stock_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker          text        NOT NULL,
  alert_type      text        NOT NULL,  -- 8k_filing/insider_buy/options_unusual/q_score_change/institutional_new
  severity        text        NOT NULL DEFAULT 'info',  -- critical/warning/info/positive
  title           text        NOT NULL,
  body            text        NOT NULL,
  source_url      text,
  metadata        jsonb,      -- alert-type specific data
  generated_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz  -- null = permanent
);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_ticker ON stock_alerts(ticker, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_recent ON stock_alerts(generated_at DESC);

-- RLS policies --

ALTER TABLE ohlcv_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings_transcript_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE sec_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutional_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE management_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE insider_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

-- All public market data: authenticated users can read
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ohlcv_daily','stock_signals','universe_rankings',
    'earnings_transcript_analysis','sec_filings','institutional_holdings',
    'management_scores','forensic_signals','insider_patterns','stock_alerts'
  ] LOOP
    EXECUTE format('CREATE POLICY "auth users read %I" ON %I FOR SELECT USING (auth.role() = ''authenticated'')', t, t);
    EXECUTE format('CREATE POLICY "service role write %I" ON %I FOR ALL USING (auth.role() = ''service_role'')', t, t);
  END LOOP;
END $$;
