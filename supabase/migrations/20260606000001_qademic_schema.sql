-- Qademic Database Schema
-- Migration: 20260606000001_qademic_schema
-- Covers: profiles, academy, portfolios, watchlists, screener, community, news, settings, subscriptions

-- ─────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- UTILITY: auto-update updated_at
-- ─────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─────────────────────────────────────────
-- 1. PROFILES
-- Extends auth.users with Qademic-specific data
-- ─────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique,
  full_name       text,
  avatar_url      text,
  bio             text,
  subscription_tier text not null default 'free'
                    check (subscription_tier in ('free','growth','pro','teams')),
  subscription_status text not null default 'active'
                    check (subscription_status in ('active','cancelled','past_due','trialing')),
  onboarding_completed boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function update_updated_at();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────
-- 2. USER SETTINGS
-- ─────────────────────────────────────────
create table if not exists public.user_settings (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  theme                 text not null default 'dark' check (theme in ('dark','light')),
  notifications_enabled boolean not null default true,
  email_digest          boolean not null default false,
  risk_tolerance        text not null default 'moderate'
                          check (risk_tolerance in ('conservative','moderate','aggressive')),
  investment_style      text not null default 'blend'
                          check (investment_style in ('value','growth','quant','blend')),
  updated_at            timestamptz not null default now()
);

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function update_updated_at();

-- Auto-create settings on signup
create or replace function handle_new_user_settings()
returns trigger as $$
begin
  insert into public.user_settings (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created_settings
  after insert on public.profiles
  for each row execute function handle_new_user_settings();

-- ─────────────────────────────────────────
-- 3. ACADEMY PROGRESS
-- ─────────────────────────────────────────
create table if not exists public.academy_progress (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  module_id   int not null,
  lesson_id   int not null,
  completed   boolean not null default false,
  quiz_score  int check (quiz_score >= 0 and quiz_score <= 100),
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, module_id, lesson_id)
);

create trigger academy_progress_updated_at
  before update on public.academy_progress
  for each row execute function update_updated_at();

create index idx_academy_progress_user on public.academy_progress(user_id);

-- ─────────────────────────────────────────
-- 4. PORTFOLIOS
-- ─────────────────────────────────────────
create table if not exists public.portfolios (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'My Portfolio',
  description text,
  currency    text not null default 'USD',
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger portfolios_updated_at
  before update on public.portfolios
  for each row execute function update_updated_at();

create index idx_portfolios_user on public.portfolios(user_id);

-- ─────────────────────────────────────────
-- 5. PORTFOLIO HOLDINGS
-- ─────────────────────────────────────────
create table if not exists public.portfolio_holdings (
  id              uuid primary key default gen_random_uuid(),
  portfolio_id    uuid not null references public.portfolios(id) on delete cascade,
  ticker          text not null,
  company_name    text,
  shares          numeric(18,6) not null check (shares > 0),
  avg_cost_usd    numeric(18,6) not null check (avg_cost_usd >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(portfolio_id, ticker)
);

create trigger portfolio_holdings_updated_at
  before update on public.portfolio_holdings
  for each row execute function update_updated_at();

create index idx_holdings_portfolio on public.portfolio_holdings(portfolio_id);

-- ─────────────────────────────────────────
-- 6. WATCHLISTS
-- ─────────────────────────────────────────
create table if not exists public.watchlists (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  ticker       text not null,
  company_name text,
  notes        text,
  alert_price  numeric(18,6),
  added_at     timestamptz not null default now(),
  unique(user_id, ticker)
);

create index idx_watchlists_user on public.watchlists(user_id);

-- ─────────────────────────────────────────
-- 7. SCREENER HISTORY
-- ─────────────────────────────────────────
create table if not exists public.screener_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  query       text not null,
  filters     jsonb,
  results     jsonb,
  result_count int,
  created_at  timestamptz not null default now()
);

create index idx_screener_user on public.screener_history(user_id);
create index idx_screener_created on public.screener_history(created_at desc);

-- ─────────────────────────────────────────
-- 8. INVESTMENT THESES (community)
-- ─────────────────────────────────────────
create table if not exists public.investment_theses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  ticker          text not null,
  company_name    text,
  title           text not null,
  thesis_text     text not null,
  direction       text not null check (direction in ('bullish','bearish','neutral')),
  q5_layers       jsonb,              -- which Q5 layers were used
  ai_score        int check (ai_score >= 0 and ai_score <= 100),
  ai_feedback     text,
  ai_risks        text[],
  skill_score     numeric(5,2),       -- alpha vs luck, calculated separately
  is_public       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger investment_theses_updated_at
  before update on public.investment_theses
  for each row execute function update_updated_at();

create index idx_theses_user on public.investment_theses(user_id);
create index idx_theses_ticker on public.investment_theses(ticker);
create index idx_theses_public on public.investment_theses(is_public, created_at desc);

-- ─────────────────────────────────────────
-- 9. THESIS REACTIONS
-- ─────────────────────────────────────────
create table if not exists public.thesis_reactions (
  id          uuid primary key default gen_random_uuid(),
  thesis_id   uuid not null references public.investment_theses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  reaction    text not null check (reaction in ('like','insightful','disagree')),
  created_at  timestamptz not null default now(),
  unique(thesis_id, user_id)
);

create index idx_reactions_thesis on public.thesis_reactions(thesis_id);

-- ─────────────────────────────────────────
-- 10. NEWS CACHE
-- Populated by backend jobs — read-only for users
-- ─────────────────────────────────────────
create table if not exists public.news_cache (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,
  headline     text not null,
  summary      text,              -- AI-generated summary
  url          text unique,
  image_url    text,
  published_at timestamptz not null,
  q5_layer     int check (q5_layer between 1 and 5),
  tickers      text[],
  sentiment    text check (sentiment in ('positive','negative','neutral')),
  created_at   timestamptz not null default now()
);

create index idx_news_published on public.news_cache(published_at desc);
create index idx_news_q5 on public.news_cache(q5_layer);
create index idx_news_tickers on public.news_cache using gin(tickers);

-- ─────────────────────────────────────────
-- 11. SUBSCRIPTIONS (Stripe)
-- ─────────────────────────────────────────
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  plan                   text not null default 'free'
                           check (plan in ('free','growth','pro','teams')),
  status                 text not null default 'active'
                           check (status in ('active','cancelled','past_due','trialing','incomplete')),
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique(user_id)
);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table public.profiles            enable row level security;
alter table public.user_settings       enable row level security;
alter table public.academy_progress    enable row level security;
alter table public.portfolios          enable row level security;
alter table public.portfolio_holdings  enable row level security;
alter table public.watchlists          enable row level security;
alter table public.screener_history    enable row level security;
alter table public.investment_theses   enable row level security;
alter table public.thesis_reactions    enable row level security;
alter table public.news_cache          enable row level security;
alter table public.subscriptions       enable row level security;

-- Profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- User settings
create policy "Users can view own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

-- Academy progress
create policy "Users can manage own academy progress"
  on public.academy_progress for all
  using (auth.uid() = user_id);

-- Portfolios
create policy "Users can manage own portfolios"
  on public.portfolios for all
  using (auth.uid() = user_id);

create policy "Users can view public portfolios"
  on public.portfolios for select
  using (is_public = true);

-- Portfolio holdings (via portfolio ownership)
create policy "Users can manage own holdings"
  on public.portfolio_holdings for all
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

create policy "Users can view public portfolio holdings"
  on public.portfolio_holdings for select
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.is_public = true
    )
  );

-- Watchlists
create policy "Users can manage own watchlist"
  on public.watchlists for all
  using (auth.uid() = user_id);

-- Screener history
create policy "Users can manage own screener history"
  on public.screener_history for all
  using (auth.uid() = user_id);

-- Investment theses
create policy "Users can manage own theses"
  on public.investment_theses for all
  using (auth.uid() = user_id);

create policy "Users can view public theses"
  on public.investment_theses for select
  using (is_public = true);

-- Thesis reactions
create policy "Users can manage own reactions"
  on public.thesis_reactions for all
  using (auth.uid() = user_id);

create policy "Anyone authenticated can view reactions"
  on public.thesis_reactions for select
  using (auth.role() = 'authenticated');

-- News cache — authenticated read, service role write
create policy "Authenticated users can read news"
  on public.news_cache for select
  using (auth.role() = 'authenticated');

-- Subscriptions — users can only read their own
create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);
