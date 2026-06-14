-- Stock Q7 pre-computed scores table
-- Nightly batch job writes here; stock pages read from here instantly

CREATE TABLE IF NOT EXISTS stock_q7_scores (
  ticker              text PRIMARY KEY,
  name                text NOT NULL DEFAULT '',
  sector              text NOT NULL DEFAULT '',
  industry            text NOT NULL DEFAULT '',
  price               numeric,
  market_cap          numeric,
  -- Synthesised Setup Score (0–100): avg of Q1–Q5 pillar scores
  setup_score         integer NOT NULL DEFAULT 0,
  recommendation      text NOT NULL DEFAULT 'hold'
    CONSTRAINT valid_rec CHECK (recommendation IN ('strong_buy','buy','hold','sell','strong_sell')),
  confidence          integer NOT NULL DEFAULT 50,
  -- Q1 Macro
  q1_score            integer,
  q1_title            text,
  q1_analysis         text,
  -- Q2 Sector
  q2_score            integer,
  q2_title            text,
  q2_analysis         text,
  -- Q3 Fundamental
  q3_score            integer,
  q3_title            text,
  q3_analysis         text,
  -- Q4 Quant
  q4_score            integer,
  q4_title            text,
  q4_analysis         text,
  -- Q5 Insider & Sentiment
  q5_score            integer,
  q5_title            text,
  q5_analysis         text,
  -- Overall verdict
  verdict             text,
  -- When this record was last scored
  scored_at           timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup when showing watchlist scores
CREATE INDEX IF NOT EXISTS idx_q7_scores_setup ON stock_q7_scores(setup_score DESC);
CREATE INDEX IF NOT EXISTS idx_q7_scores_scored_at ON stock_q7_scores(scored_at DESC);

-- RLS: anyone authenticated can read scores (they are public market data)
ALTER TABLE stock_q7_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read q7 scores"
  ON stock_q7_scores FOR SELECT
  USING (true);

-- Only service role (cron/backend) can write
CREATE POLICY "service role can upsert q7 scores"
  ON stock_q7_scores FOR ALL
  USING (auth.role() = 'service_role');
