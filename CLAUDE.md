# reshenova Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-28

## Active Technologies

- TypeScript 5.x, Node.js 20 + Hono (API), Solid.js + Tailwind CSS + Vite (frontend), Supabase JS SDK, Google Gemini SDK (`@google/generative-ai`), Google Sheets API (`googleapis`), Telegram Bot API via `node-fetch` (001-telegram-decision-tracker)

## Project Structure

```text
api/                   # Hono backend (Vercel serverless functions)
├── index.ts           # Hono app entry, mounts all routes
├── routes/            # webhook, projects, queue, candidates, log, missing
├── lib/               # extraction, sheets, telegram, supabase
└── middleware/auth.ts # Supabase JWT validation

frontend/              # Solid.js SPA (Vite build → Vercel static assets)
├── src/
│   ├── pages/         # Login, Projects, DecisionQueue, MissingFields, DecisionLog
│   ├── components/    # DecisionCard, ConfidenceBadge, PhaseDeadlineAlert
│   └── lib/           # api.ts (typed fetch), auth.ts (Supabase Auth)
└── vite.config.ts

supabase/migrations/
tests/
├── unit/extraction/
├── integration/       # webhook-handler, sheets-write, supabase-queries
└── e2e/               # decision-flow (webhook → review → confirm → sheet)
```

## Commands

```bash
npm run dev            # starts both api (hono) and frontend (vite) concurrently
npm test               # vitest unit + integration
npm run test:e2e       # playwright E2E
npm run lint           # eslint + tsc --noEmit
```

## Code Style

- TypeScript strict mode; no `any`
- Hono: one middleware chain, routes co-located by resource
- Solid.js: signals for local state, no unnecessary stores
- Supabase RLS must be enabled on all tables — never bypass with service role on the client

## Recent Changes

- 001-telegram-decision-tracker: Added TypeScript 5.x, Node.js 20 + Next.js 14 (App Router), Supabase JS SDK, Google Gemini SDK (`@google/generative-ai`), Google Sheets API (`googleapis`), Telegraf or raw Telegram Bot API via `node-fetch`

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
