# Implementation Plan: Telegram Project Decision Tracker

**Branch**: `001-telegram-decision-tracker` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)

---

## Summary

Build a lightweight web application that monitors Telegram group conversations via webhooks, extracts renovation project decisions using Google Gemini Flash (free tier), queues ambiguous results for contractor review, and writes confirmed decisions to Google Sheets. Zero monthly cost on the free tiers of Vercel + Supabase + Gemini + Google Sheets.

---

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20
**Primary Dependencies**: Hono (API + webhook server), Solid.js + Tailwind CSS (frontend, built with Vite), Supabase JS SDK, Google Gemini SDK (`@google/generative-ai`), Google Sheets API (`googleapis`), Telegram Bot API via `node-fetch`
**Storage**: Supabase (PostgreSQL) — decision log, candidates, messages, projects; Google Sheets — output only
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (serverless, Node.js 20 runtime) — Hono deployed as Vercel functions; Solid.js frontend as static assets
**Project Type**: Decoupled — Hono API backend + Solid.js SPA frontend
**Performance Goals**: Webhook response latency < 500ms (Telegram requires fast response); contractor dashboard P95 < 2s; decision review screen loads in < 1s
**Constraints**: Gemini free tier 250 RPD and 10 RPM — batch messages per webhook event; Vercel Hobby 1M invocations/month, 60s function timeout; Supabase free 500 MB DB
**Scale/Scope**: 5–20 concurrent projects, 100–500 Telegram messages/day total, 5–50 contractor-review actions/day

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | ✅ | Single-responsibility modules; no speculative abstractions (e.g., no abstraction layer over Gemini in v1 — call it directly) |
| II. Test-First Development | ✅ | All extraction logic, webhook handler, and confirmation flow written test-first |
| III. Testing Standards | ✅ | Unit: extraction parsing; Integration: Telegram webhook handler, Sheets write, Supabase queries; E2E: full flow from fake Telegram message to confirmed decision in sheet |
| IV. UX Consistency | ✅ | Contractor dashboard uses consistent terminology from spec ("Decision Queue", "Missing Fields", "Decision Log"); loading states on all async actions |
| V. Performance Requirements | ✅ | Webhook handler returns 200 immediately, processes async; dashboard respects P95 ≤ 2s; decision log paginated (max 100/page) |

No violations. No Complexity Tracking entries required.

---

## Project Structure

### Documentation (this feature)

```
specs/001-telegram-decision-tracker/
├── plan.md              ← this file
├── research.md          ← Phase 0: stack decisions and cost analysis
├── data-model.md        ← Phase 1: entity definitions and relationships
├── contracts/
│   └── api.md           ← Phase 1: REST endpoint contracts
├── quickstart.md        ← Phase 1: local dev and deployment guide
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code

```
api/                                       # Hono backend — deployed as Vercel serverless functions
├── index.ts                               # Hono app entry point, mounts all routes
├── routes/
│   ├── webhook.ts                         # POST /telegram/webhook
│   ├── projects.ts                        # GET /projects, POST /projects, DELETE /projects/:id
│   ├── validate.ts                        # POST /projects/validate
│   ├── queue.ts                           # GET /projects/:id/decisions/queue
│   ├── candidates.ts                      # PATCH /projects/:id/candidates/:cid/confirm|reject
│   ├── log.ts                             # GET /projects/:id/log
│   └── missing.ts                         # GET /projects/:id/missing
├── lib/
│   ├── extraction.ts                      # Gemini Flash call + response parsing
│   ├── sheets.ts                          # Google Sheets read/write
│   ├── telegram.ts                        # Bot API helpers (getChat, setWebhook)
│   └── supabase.ts                        # Typed Supabase client factory
└── middleware/
    └── auth.ts                            # Supabase JWT validation middleware

frontend/                                  # Solid.js SPA — built with Vite, deployed as static assets
├── src/
│   ├── main.tsx                           # App entry point + router
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Projects.tsx                   # Project list
│   │   ├── ProjectSetup.tsx               # New project form
│   │   ├── DecisionQueue.tsx              # Pending + auto-confirmed decisions
│   │   ├── MissingFields.tsx              # Phase-grouped missing fields
│   │   └── DecisionLog.tsx                # Paginated audit log
│   ├── components/
│   │   ├── DecisionCard.tsx               # Single candidate: source message, value, confidence, actions
│   │   ├── ConfidenceBadge.tsx            # Visual indicator for auto-confirm vs review
│   │   └── PhaseDeadlineAlert.tsx
│   └── lib/
│       ├── api.ts                         # Typed fetch wrapper for all API calls
│       └── auth.ts                        # Supabase Auth client
├── index.html
└── vite.config.ts

supabase/
└── migrations/                            # SQL migration files

tests/
├── unit/
│   └── extraction/
│       ├── parse-candidates.test.ts
│       └── confidence-threshold.test.ts
├── integration/
│   ├── webhook-handler.test.ts
│   ├── sheets-write.test.ts
│   └── supabase-queries.test.ts
└── e2e/
    └── decision-flow.test.ts              # Fake webhook → review → confirm → sheet write
```

**Structure Decision**: Decoupled Hono API + Solid.js SPA. Vercel treats every `.ts` file in subdirectories of `api/` as a serverless function, so all Hono application code lives in `src/` (not `api/`). The sole file in `api/` is `api/index.ts`, which is the Vercel entry point and imports the Hono app from `src/app.ts`. `vercel.json` uses `includeFiles: src/**` to bundle the source with the function. Frontend builds to `frontend/dist/` and is served as static assets. Shared types are defined in `src/lib/` and imported by the frontend's `api.ts` wrapper.

---

## Stack Decision Summary

| Choice | Selected | Alternative | Reason |
|--------|----------|-------------|--------|
| AI extraction | Google Gemini Flash (free) | Claude Sonnet 4.6 (~$8/mo) | Zero cost; free tier covers 250 RPD with batching; quality sufficient for structured entity extraction |
| Message delivery | Telegram webhooks | Polling (`getUpdates`) | Serverless requires webhook; polling needs persistent process |
| Backend framework | Hono | Next.js API routes | Lighter, no framework overhead, clean TypeScript routing without Next.js dependency |
| Frontend | Solid.js + Tailwind + Vite | React / Next.js | Fine-grained reactivity suits dynamic queue UI; much lighter bundle than React; Tailwind co-locates styles |
| Database | Supabase | PlanetScale / Neon | Built-in Auth + RLS; free tier stable; no extra auth service needed |
| Auth | Supabase Auth | Clerk / Auth.js | Already included with Supabase; JWT validated in Hono middleware; RLS enforces data isolation automatically |

### Upgrade Path (when free tier is insufficient)

1. **Gemini free tier hit**: Upgrade to Gemini paid (~$0.15/MTok) or swap to Claude Haiku 4.5 (~$1-3/mo)
2. **Vercel Hobby → commercial use**: Upgrade to Vercel Pro ($20/mo)
3. **Supabase free pause risk**: Add a weekly Vercel cron ping to keep project active (1 cron/day Hobby limit is sufficient)
