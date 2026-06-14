-- v3: recommendation labels are never produced (grades + scores instead).
-- Relax the legacy column so it can be nulled out; clear stale labels.
alter table public.stock_q7_scores alter column recommendation drop not null;
alter table public.stock_q7_scores drop constraint if exists valid_rec;
update public.stock_q7_scores set recommendation = null;
