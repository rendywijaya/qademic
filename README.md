# qademic

**WorldContrarian** — a living intelligence for contrarian, multibagger investing.

A system that maps the whole picture (business → cycle → demand → money flow), **interconnects all of it**, and uses that map to find companies positioned for the *next wave before it's obvious* (the NVIDIA → SanDisk second-order-beneficiary pattern) — then teaches the operator a little more every day.

Not a prediction engine, trading app, or advisor. The edge is **variant perception + patience + discipline**, not data speed.

## The loop
```
auto-ingest → AI-built interconnection graph → deterministic ranking
  → AI stress-test → daily teaching brief → weekly new-wave discovery
```

## Core ideas
- **Interconnection graph = knowledge base.** Nodes (companies/commodities/themes) carry living AI-written explainers; edges encode who supplies / buys-from / competes-with / depends-on whom.
- **Wave propagation.** A demand shock diffuses along weighted edges; each node scores `opportunity = percentile(exposure) − percentile(already-priced-in)`. High = exposed to the wave but not yet repriced.
- **AI does the reasoning, deterministic math does the ranking** — so it's intelligent *and* auditable.
- **Two house rules:** `opportunity_score` is a research prompt, never a buy signal (no advice). And edge quality is the whole game — every AI edge is cited, confidence-scored, and validated against ground truth.

## Stack
Next.js 16 · TypeScript · Supabase · Claude (Anthropic) · FMP / FRED / EDGAR / Finnhub.

## Run
```bash
cd app && npm install && npm run dev
```
Migrations: `supabase db push`. Scripts: `npx tsx --env-file=.env.local scripts/<name>.ts`.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture and current state.

> General information only — not investment advice.
