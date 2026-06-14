-- Q7 scoring engine: add Q6/Q7 columns + score_method to stock_q7_scores
-- Run this migration before deploying the updated cron and analysis routes.

alter table stock_q7_scores
  add column if not exists score_method text check (score_method in ('algorithmic', 'ai', 'hybrid')) default 'algorithmic',
  add column if not exists q6_score     integer,
  add column if not exists q6_title     text,
  add column if not exists q6_analysis  text,
  add column if not exists q7_score     integer,
  add column if not exists q7_title     text,
  add column if not exists q7_analysis  text;

-- Back-fill existing rows so score_method is not null
update stock_q7_scores set score_method = 'ai' where score_method is null;

comment on column stock_q7_scores.score_method is
  'algorithmic = rule-based only; ai = Claude-only (legacy); hybrid = algorithm scores + Claude narrative';
