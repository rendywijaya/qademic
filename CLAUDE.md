# WorldContrarian — Development Guide

## The Mission (what we want to achieve)
**A living intelligence for contrarian, multibagger investing.** Most people buy stories late, size randomly, and never define what would make them sell. We are building the opposite: a system that understands the whole picture — the business, the cycle, what the world is currently doing, the demand, the money flow — *interconnects all of it*, and uses that map to find the companies positioned for the **next wave before it is obvious** (the NVIDIA → SanDisk / second-order-beneficiary pattern), then teaches the operator a little more every day.

It is **not** a prediction engine, a trading app, or a financial advisor. The edge is **variant perception + patience + discipline**, not data speed. Real-time is deliberately avoided — multibaggers are won over months and years. Two hard rules of the house:
1. **`opportunity_score` is a research prompt — where to look — never a buy signal.** No buy/sell/hold labels anywhere. Distributions and reasoning, not advice (general information only).
2. **Edge quality is the whole game.** A wrong interconnection graph produces confident garbage, so every AI-built edge carries cited evidence + a confidence score and is validated against curated ground truth before it is trusted.

## What the system does (the loop)
**auto-ingest → AI-built interconnection graph → deterministic ranking → AI stress-test → daily teaching brief → weekly new-wave discovery.** Runs nightly; the operator wakes up to a diff, not a data dump.

WorldContrarian consolidates the earlier **Qademic** platform (regime, sector rotation, factor scoring, expectations/reverse-DCF, thesis cards, monitoring — all still here and load-bearing) and adds the missing centerpiece: the **Interconnection / Wave-Propagation engine**.

## Project Structure
- `/app` — Next.js 16 web app (TypeScript + Tailwind + Supabase). The whole product. **All logic lives here.**
- `/supabase` — schema + migrations (the single source of truth).
- `/skills`, `/claude-skills` — local + extended skill libraries (reference/tooling; not part of the deployable product, git-ignored).
- `/autoresearch` — Karpathy's overnight autonomous-loop pattern; the template for the nightly "edit → run → log what changed" cadence (git-ignored reference).

## The Interconnection Engine (what makes this WorldContrarian)
The knowledge base and the graph are **one object**: nodes (companies / commodities / themes / sectors) carry living AI-written explainers; edges encode who-supplies / buys-from / competes-with / depends-on whom. A demand shock at an origin node propagates outward along weighted benefit-flow edges; each node is scored:

> **`opportunity_score = percentile(causal exposure) − percentile(already priced-in)`**  — high = strongly exposed to the wave but not yet repriced.

Where it lives in `/app/src`:
- `lib/propagation.ts` — deterministic weighted diffusion (no AI; auditable). `lib/waves.ts` — load graph + priced-in (from `stock_signals` momentum) + run.
- `lib/ai/extract-edges.ts` — AI discovers supplier/customer/competitor edges (tool-use, cited evidence, validated vs the curated seed in `lib/seed/`).
- `lib/ai/detect-waves.ts` — AI scans regime + momentum to discover the **next** emerging wave and auto-builds it (origin theme → beneficiaries → edges).
- `app/api/waves/explain` — AI explains **and stress-tests** a node's exposure (the false-edge killer).
- `lib/ai/explainers.ts` — living business + sector explainers (the knowledge library). `lib/ai/daily-brief.ts` — the daily teaching brief.
- Surfaces: `/dashboard/waves` (the interconnection graph + ranked un-repriced beneficiaries) and `/dashboard/today` (daily brief + knowledge library).
- Tables (migration `supabase/migrations/*_interconnection.sql`): `graph_entities`, `graph_edges`, `wave_shocks`, `wave_propagation`, `business_explainers`, `sector_explainers`, `daily_briefs`.
- Nightly/weekly crons (in `vercel.json`): `propagate-waves`, `daily-brief`, `detect-waves`, alongside the inherited data pipeline.

**Run it:** `cd app && npm run dev`. **Migrations:** `supabase db push` (project `iukckhoqkdlcsxuntsmi`). **Scripts:** `npx tsx --env-file=.env.local scripts/<name>.ts` (seed-waves, extract-edges, detect-waves, generate-explainers, generate-brief).

## Current state (honest)
Working, verified end-to-end **MVP of the engine** on the consolidated platform. Built & validated: propagation, AI edge extraction (NVDA 19 / MSFT 28 links, validated vs seed), AI stress-test, wave auto-detection (auto-found a GLP-1 second-order wave), 33 business + 4 sector explainers, daily brief, 2 live waves. **Not yet:** deployed (local only), no user account yet, UI not visually smoke-tested, graph coverage is a demo slice (43 nodes / 2 waves — the full "every sector, every company" map is the largest remaining work), no auto thesis-drafting / refresh-explainers cron / forward-validation harness. `mobile/` (Flutter) was left in the prior repo.

---

## MANDATORY SKILL USAGE

Skills MUST be invoked proactively — not only when asked. Before starting any task, identify which skills apply and invoke them. Never skip a relevant skill.

### How to invoke
- System skills (listed in sidebar): `Skill("skill-name", args="context")`
- Local skills: read SKILL.md from `/skills/skills/<name>/SKILL.md`
- Claude-skills: read SKILL.md from `/claude-skills/<domain>/<name>/skills/<name>/SKILL.md`

---

## Skills by Task Type

### UI / Frontend Work
**ALWAYS invoke before building or modifying any UI:**

| Skill | Location | When to use |
|---|---|---|
| `frontend-design` | `/skills/skills/frontend-design` | Every UI build/redesign — enforces distinctive, production-grade aesthetics |
| `senior-frontend` | `/claude-skills/engineering-team/senior-frontend.zip` | Next.js, React, TypeScript, Tailwind component patterns |
| `apple-hig-expert` | `/claude-skills/product-team/apple-hig-expert` | Flutter/mobile screens — iOS native patterns, HIG compliance |
| `a11y-audit` | `/claude-skills/engineering-team/a11y-audit` | Accessibility — WCAG 2.2 compliance on all UI |
| `theme-factory` | `/skills/skills/theme-factory` | Design token generation, theming system |
| `canvas-design` | `/skills/skills/canvas-design` | Complex visual layouts, custom graphics |
| `algorithmic-art` | `/skills/skills/algorithmic-art` | Generative backgrounds, visual effects |

### Backend / API Work
**Invoke before building any backend feature:**

| Skill | Location | When to use |
|---|---|---|
| `senior-backend` | `/claude-skills/engineering-team/senior-backend.zip` | API design, database patterns, Supabase Edge Functions |
| `senior-fullstack` | `/claude-skills/engineering-team/senior-fullstack.zip` | Full-stack architecture, data flow design |
| `senior-architect` | `/claude-skills/engineering-team/senior-architect.zip` | System design decisions, scalability planning |
| `docker-development` | `/claude-skills/engineering/docker-development` | Containerisation for Python FastAPI service |
| `workflow-builder` | `/claude-skills/engineering/workflow-builder` | Async workflows, job queues, background processing |

### AI / ML Features
**Invoke before building any AI-powered feature:**

| Skill | Location | When to use |
|---|---|---|
| `claude-api` | `/skills/skills/claude-api` | Claude API integration, prompt caching, tool use |
| `senior-ml-engineer` | `/claude-skills/engineering-team/senior-ml-engineer.zip` | ML pipelines, model integration, embeddings |
| `senior-data-scientist` | `/claude-skills/engineering-team/senior-data-scientist.zip` | Quant analysis, backtesting logic, statistical models |
| `senior-data-engineer` | `/claude-skills/engineering-team/senior-data-engineer.zip` | Financial data pipelines, ETL, caching strategy |
| `llm-cost-optimizer` | `/claude-skills/engineering/llm-cost-optimizer` | Optimise Claude API costs, prompt efficiency |
| `prompt-governance` | `/claude-skills/engineering/prompt-governance` | Prompt quality, consistency, safety |
| `statistical-analyst` | `/claude-skills/engineering/statistical-analyst` | Quant finance calculations, backtesting stats |

### Security
**Invoke before any auth, API, or data handling work:**

| Skill | Location | When to use |
|---|---|---|
| `senior-security` | `/claude-skills/engineering-team/senior-security.zip` | Auth security, API security, input validation |
| `security-guidance` | `/claude-skills/engineering/security-guidance` | Pre-tool security hook — prevent injection, XSS, SQLi |
| `senior-secops` | `/claude-skills/engineering-team/senior-secops.zip` | Infrastructure security, secrets management |

### Code Quality
**Invoke before writing or reviewing any non-trivial code:**

| Skill | Location | When to use |
|---|---|---|
| `karpathy-coder` | `/claude-skills/engineering/karpathy-coder` | Surface assumptions, keep simple, surgical changes only |
| `code-reviewer` | `/claude-skills/engineering-team/code-reviewer.zip` | Review diffs before committing |
| `tdd-guide` | `/claude-skills/engineering-team/tdd-guide.zip` | Test-driven development, writing tests first |
| `senior-qa` | `/claude-skills/engineering-team/senior-qa.zip` | QA strategy, test coverage, edge cases |
| `webapp-testing` | `/skills/skills/webapp-testing` | End-to-end testing, browser testing |

### DevOps / Infrastructure
**Invoke before deployment, CI/CD, or infrastructure work:**

| Skill | Location | When to use |
|---|---|---|
| `senior-devops` | `/claude-skills/engineering-team/senior-devops.zip` | CI/CD pipelines, deployment strategy |
| `slo-architect` | `/claude-skills/engineering/slo-architect` | SLOs, error budgets, reliability |
| `chaos-engineering` | `/claude-skills/engineering/chaos-engineering` | Resilience testing |

### Product / Strategy
**Invoke for product decisions, roadmap, or feature planning:**

| Skill | Location | When to use |
|---|---|---|
| `agile-product-owner` | `/claude-skills/product-team/agile-product-owner` | User stories, sprint planning, backlog |
| `code-to-prd` | `/claude-skills/product-team/code-to-prd` | Reverse-engineer codebase into PRD |
| `tech-stack-evaluator` | `/claude-skills/engineering-team/tech-stack-evaluator.zip` | Evaluating technology choices |
| `business-investment-advisor` | `/claude-skills/finance/skills/business-investment-advisor` | Financial modelling, unit economics, pricing |

### Content / Documentation
**Invoke for documentation, API docs, or content work:**

| Skill | Location | When to use |
|---|---|---|
| `handoff` | `/claude-skills/engineering/handoff` | Session handoffs, context preservation |
| `doc-coauthoring` | `/skills/skills/doc-coauthoring` | Technical documentation |
| `mcp-builder` | `/skills/skills/mcp-builder` | MCP server integration |
| `web-artifacts-builder` | `/skills/skills/web-artifacts-builder` | Standalone HTML artifacts, demos |

### Marketing / Growth (when needed)
| Skill | Location | When to use |
|---|---|---|
| `content-creator` | `/claude-skills/marketing-skill/content-creator.zip` | Social media content for Qademic |
| `app-store-optimization` | `/claude-skills/marketing-skill/app-store-optimization.zip` | App Store listing, keywords, screenshots |
| `marketing-strategy-pmm` | `/claude-skills/marketing-skill/marketing-strategy-pmm.zip` | Go-to-market strategy |

### Executive / Advisory (for big decisions)
| Skill | Location | When to use |
|---|---|---|
| `cto-advisor` | `/claude-skills/c-level-advisor/cto-advisor.zip` | Architecture decisions, tech strategy |
| `ceo-advisor` | `/claude-skills/c-level-advisor/ceo-advisor.zip` | Business strategy, fundraising |
| `chief-ai-officer-advisor` | `/claude-skills/c-level-advisor/chief-ai-officer-advisor` | AI product decisions, model selection |
| `general-counsel-advisor` | `/claude-skills/c-level-advisor/general-counsel-advisor` | Legal, contracts, regulatory (finance laws) |

---

## Design System — "Precision Terminal"

**Aesthetic:** Bloomberg Terminal DNA + Linear's restraint. Data-dense, serious, premium.

### Fonts — NEVER use Inter, Roboto, Arial, Space Grotesk
```
Display/Headings:  Bricolage Grotesque (400/500/600/700/800)
Data/Numbers:      JetBrains Mono — ALL prices, %, metrics, tickers (tabular-nums)
Body:              DM Sans (400/500/600)
```

### Colors
```
Background:     #050810    Surface:        #0D1117
Surface-2:      #111827    Border:         #1F2937

Amber (PRIMARY): #F59E0B   ← brand accent, NOT blue
Amber-dim:      rgba(245,158,11,0.08)
Amber-border:   rgba(245,158,11,0.25)

Positive:       #10B981    Negative:       #F87171
Text:           #F9FAFB    Text-muted:     #9CA3AF

Q1 Macro:       #A78BFA    Q2 Sector:      #38BDF8
Q3 Fundamental: #34D399    Q4 Quant:       #F59E0B
Q5 Sentiment:   #FB7185
```

### Visual Rules
1. Cards: transparent bg + `border border-[#1F2937]` — NOT filled dark cards
2. Hover: `hover:border-[rgba(245,158,11,0.25)] hover:shadow-[0_0_20px_rgba(245,158,11,0.06)]`
3. All numbers: JetBrains Mono, tabular-nums
4. CTAs: amber bg (#F59E0B) + dark text (#050810)
5. Active nav: amber color + amber border indicator
6. Section labels: 10px uppercase, letter-spacing 0.12em, textMuted
7. Corner radius: `rounded-lg` max — sharp, not bubbly
8. Flutter: NEVER non-uniform Border + borderRadius — use ClipRRect + colored Container

### Logo
- "Q" in amber (#F59E0B), "ademic" in white — always
- Icon: amber rounded square with chart icon, dark text

---

## Architecture Rules
1. All business logic in backend (Supabase Edge Functions or Python FastAPI on Railway)
2. Frontends are display layers only — fetch and render, no logic
3. Never call external APIs directly from Flutter or Next.js components
4. All AI/Claude API calls server-side only
5. Supabase: auth, database, realtime — single source of truth
6. Python FastAPI: backtesting engine, quant calculations, heavy compute
7. Next.js API routes: AI analysis calls, news aggregation

## Code Standards
- Karpathy-coder first: simplicity, surgical changes, no premature abstractions
- TypeScript strict mode on web, Dart null safety on mobile
- No `console.log` or `print` in production
- Every component typed — no `any` in TypeScript

## Supabase
- URL: https://iukckhoqkdlcsxuntsmi.supabase.co
- Web: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
- Mobile: --dart-define=SUPABASE_URL + --dart-define=SUPABASE_ANON_KEY
