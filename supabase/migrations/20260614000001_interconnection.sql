-- ─────────────────────────────────────────────────────────────────────────────
-- WorldContrarian — Interconnection / Wave-Propagation engine + Living Knowledge Base
-- The causal graph of the market (nodes + edges), demand-shock propagation, and the
-- AI-written explainers that live on every node. The graph IS the knowledge base.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Graph nodes: companies, commodities, themes, macro drivers, sectors
CREATE TABLE IF NOT EXISTS graph_entities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL,                 -- company | commodity | theme | macro_driver | sector
  ticker      text,                          -- nullable; set for companies (links to ohlcv_daily / universe_rankings)
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,          -- stable url key
  sector      text,                          -- GICS sector when kind=company
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_entities_ticker ON graph_entities(ticker) WHERE ticker IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_graph_entities_kind ON graph_entities(kind);

-- 2. Graph edges: who supplies / buys-from / competes / depends-on whom
CREATE TABLE IF NOT EXISTS graph_edges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  src_id        uuid NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
  dst_id        uuid NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
  relation      text NOT NULL,                -- supplies_to | buys_from | competes_with | consumes_commodity | exposed_to_theme | co_owned | depends_on
  weight        numeric NOT NULL DEFAULT 0.5, -- 0..1 strength of the dependency (how much dst depends on src)
  evidence      text,                         -- cited quote / rationale for this edge
  source        text NOT NULL DEFAULT 'manual', -- manual | fmp_peers | sector | edgar | transcript | 13f | ai
  confidence    numeric NOT NULL DEFAULT 0.5, -- 0..1 how sure we are this edge is real
  as_of         date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (src_id, dst_id, relation)
);
CREATE INDEX IF NOT EXISTS idx_graph_edges_src ON graph_edges(src_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_dst ON graph_edges(dst_id);

-- 3. Wave shocks: a demand/supply shock originating at a node (the "next wave")
CREATE TABLE IF NOT EXISTS wave_shocks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  origin_id     uuid REFERENCES graph_entities(id) ON DELETE SET NULL,
  magnitude     numeric NOT NULL DEFAULT 1.0, -- relative shock size
  thesis        text,                         -- the causal story (AI or human authored)
  stage         text NOT NULL DEFAULT 'emerging', -- emerging | building | consensus | fading
  active        boolean NOT NULL DEFAULT true,
  detected_by   text NOT NULL DEFAULT 'manual',   -- manual | ai
  started_at    timestamptz NOT NULL DEFAULT now(),
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_wave_shocks_active ON wave_shocks(active) WHERE active;

-- 4. Wave propagation results — append-only nightly log = "what changed today"
CREATE TABLE IF NOT EXISTS wave_propagation (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shock_id          uuid NOT NULL REFERENCES wave_shocks(id) ON DELETE CASCADE,
  entity_id         uuid NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
  ticker            text,
  hops              integer,                  -- shortest causal distance from origin
  raw_exposure      numeric,                  -- diffusion score 0..1
  exposure_pct      integer,                  -- percentile within this run (0..100)
  priced_in         numeric,                  -- 0..1 (momentum + implied growth proxy)
  priced_in_pct     integer,
  opportunity_score numeric,                  -- exposure_pct - priced_in_pct (higher = more un-repriced)
  rationale         text,                     -- short why (derived / AI)
  computed_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wave_prop_shock_time ON wave_propagation(shock_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_wave_prop_entity ON wave_propagation(entity_id, computed_at DESC);

-- 5. Business explainers — living, per-company knowledge (one document per node)
CREATE TABLE IF NOT EXISTS business_explainers (
  ticker              text PRIMARY KEY,
  name                text,
  what_they_do        text,                   -- plain language
  how_they_make_money text,                   -- unit economics, margins
  value_chain         text,                   -- where they sit; who they depend on / who depends on them
  bull_case           text,
  bear_case           text,
  what_breaks_it      text,                   -- thesis risks / kill conditions
  full_md             text,                   -- full markdown explainer
  source_filing       text,                   -- filing/date that drove this refresh
  model               text,
  freshness           timestamptz NOT NULL DEFAULT now()
);

-- 6. Sector & industry explainers — living, per-sector knowledge
CREATE TABLE IF NOT EXISTS sector_explainers (
  slug            text PRIMARY KEY,           -- e.g. 'technology' or 'semiconductors'
  level           text NOT NULL DEFAULT 'sector', -- sector | industry
  name            text NOT NULL,
  how_it_works    text,
  demand_drivers  text,
  cycle           text,                       -- cyclicality / seasonality / current stage
  value_chain     text,
  key_players     text,
  full_md         text,
  freshness       timestamptz NOT NULL DEFAULT now()
);

-- 7. Daily briefs — the learning feed (one global per day; per-user optional)
CREATE TABLE IF NOT EXISTS daily_briefs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date      date NOT NULL,
  user_id         uuid,                       -- null = global brief
  headline        text,
  regime_note     text,
  flows_note      text,
  waves_note      text,
  deep_dive_title text,
  deep_dive_md    text,
  full_md         text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_briefs_date ON daily_briefs(brief_date DESC);
-- one global brief per day, and one per (date,user)
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_briefs_global ON daily_briefs(brief_date) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_briefs_user ON daily_briefs(brief_date, user_id) WHERE user_id IS NOT NULL;

-- ─── RLS: authenticated users read, service_role writes (matches existing convention) ──
ALTER TABLE graph_entities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_edges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wave_shocks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wave_propagation    ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_explainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector_explainers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_briefs        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'graph_entities','graph_edges','wave_shocks','wave_propagation',
    'business_explainers','sector_explainers','daily_briefs'
  ] LOOP
    EXECUTE format('CREATE POLICY "auth read %I" ON %I FOR SELECT USING (auth.role() = ''authenticated'')', t, t);
    EXECUTE format('CREATE POLICY "service write %I" ON %I FOR ALL USING (auth.role() = ''service_role'')', t, t);
  END LOOP;
END $$;
