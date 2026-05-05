# Tasks: Telegram Project Decision Tracker

**Input**: Design documents from `/specs/001-telegram-decision-tracker/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/api.md ✅ quickstart.md ✅

**Tests**: Included in every phase — constitution mandates TDD (NON-NEGOTIABLE). Write tests first, confirm they fail, then implement.

**Organization**: Grouped by user story. Each phase is independently testable and deployable.

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Parallelizable (different files, no shared dependencies)
- **[US?]**: User story label (US1–US5 maps to spec.md priorities P1–P5)
- **No label**: Setup or foundational task

---

## Phase 1: Setup

**Purpose**: Repo structure, tooling, and deployment config. No application logic.

- [x] T001 Create directory structure: `api/`, `src/routes/`, `src/lib/`, `src/middleware/`, `frontend/src/`, `frontend/src/pages/`, `frontend/src/components/`, `frontend/src/lib/`, `supabase/migrations/`, `tests/unit/`, `tests/integration/`, `tests/e2e/` — **note**: app code lives in `src/` (not `api/`) to avoid Vercel treating every file as a function; `api/index.ts` is the sole Vercel entry point
- [x] T002 Init Hono backend — `package.json` (hono, @hono/node-server, @supabase/supabase-js, @google/generative-ai, googleapis), `tsconfig.json` (strict, covers api/ src/ tests/), `vitest.config.ts`
- [x] T003 [P] Init Solid.js + Tailwind + Vite frontend — `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/index.html`
- [x] T004 [P] Configure ESLint + Prettier at repo root — `eslint.config.js`, `.prettierrc`, root `package.json` with scripts (`dev`, `dev:api`, `dev:frontend`, `test`, `test:e2e`, `lint`, `build`)
- [x] T005 Create environment variable template — `.env.example` with all required vars
- [x] T006 Create Vercel routing config — `vercel.json` routing `/api/*` to `api/index.ts` (Node.js 20, `includeFiles: src/**`) and SPA fallback for `/*`
- [x] T007 Configure Playwright for E2E — `playwright.config.ts` targeting `http://localhost:5173`, auto-starts dev server

**Checkpoint**: `npm run dev` starts both Hono (port 3000) and Vite (port 5173) concurrently. `npm test` runs Vitest. `npm run test:e2e` runs Playwright.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, auth plumbing, and typed clients. Nothing in Phase 3+ can begin until this is complete.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [x] T008 Write Supabase migration 001 — `supabase/migrations/001_profiles_templates.sql`: `profiles`, `templates`, `template_fields` tables with all columns, constraints, and indexes from data-model.md
- [x] T009 Write Supabase migration 002 — `supabase/migrations/002_projects_phases.sql`: `projects`, `project_phases`, `phase_required_fields` tables
- [x] T010 Write Supabase migration 003 — `supabase/migrations/003_messages_candidates.sql`: `messages` (with unique constraint on `project_id, telegram_message_id`), `decision_candidates` (with confidence check, status enum, source_message_ids array)
- [x] T011 Write Supabase migration 004 — `supabase/migrations/004_decision_log.sql`: `decision_log` table with `superseded_by` self-reference and `sheet_written_at` nullable timestamp
- [x] T012 [P] Write RLS policies — `supabase/migrations/005_rls_policies.sql`: enable RLS on all tables; contractors can only read/write rows where `owner_id = auth.uid()` or project chain resolves to their `owner_id`
- [x] T013 [P] Write seed migration — `supabase/migrations/006_seed_templates.sql`: one "Residential Renovation" template with 12 common fields (paint color, tile material, grout color, cabinet hardware, countertop, flooring, fixture finish, start date, completion date, permit number, total budget, contractor notes) mapped to sheet cells A2–A13
- [x] T014 Implement typed Supabase server client — `src/lib/supabase.ts`: factory returning a Supabase client initialized with service role key for server-side use; export typed Database interface generated from schema
- [x] T015 Implement Hono app entry point — `src/app.ts` (Hono app) + `api/index.ts` (Vercel entry importing from src/app.ts): create Hono app, register CORS, JSON body parser, and error-handling middleware; export as Vercel serverless handler
- [x] T016 Implement Supabase JWT auth middleware — `src/middleware/auth.ts`: validate `Authorization: Bearer <jwt>` header using `supabase.auth.getUser(token)`; attach `userId` to Hono context; return 401 on invalid token
- [x] T017 [P] Implement typed API fetch wrapper — `frontend/src/lib/api.ts`: typed `apiFetch<T>` function that attaches the Supabase session JWT to every request; throws typed errors on non-2xx responses
- [x] T018 [P] Implement Supabase Auth browser client — `frontend/src/lib/auth.ts`: `signIn`, `signOut`, `getSession`, `onAuthStateChange` wrappers using `@supabase/supabase-js`
- [x] T019 Implement Login page + auth guard — `frontend/src/pages/Login.tsx` (email/password form using `auth.signIn`); `frontend/src/main.tsx` Solid Router setup with `<AuthGuard>` component redirecting unauthenticated users to `/login`

**Checkpoint**: `supabase db push` applies all migrations. Login page renders, accepts credentials, and redirects to `/` on success. Auth middleware rejects requests with missing or expired JWTs.

---

## Phase 3: User Story 1 — Contractor Reviews Extracted Decisions (Priority: P1) 🎯 MVP

**Goal**: Contractor can see pending and auto-confirmed decisions, confirm or reject each, and confirmed decisions are written to the linked Google Sheet.

**Independent Test**: Seed a project + decision candidates at varied confidence levels directly into the DB. Open the queue page, confirm one pending decision with an edited value, reject another. Verify the Google Sheet cell is updated and the decision log entry is created. Seeded data makes this testable without a live Telegram group.

### Tests — write first, confirm they fail before implementing

- [x] T020 Write failing unit tests for confidence threshold routing — `tests/unit/extraction/confidence-threshold.test.ts`: assert candidates with confidence ≥ 0.85 are status `auto_confirmed`; candidates < 0.85 are `pending_review`; contradictions are always `pending_review` regardless of score
- [x] T021 [P] Write failing integration tests for GET `/projects/:id/decisions/queue` — `tests/integration/supabase-queries.test.ts`: assert pending and recent auto-confirmed candidates are returned with source messages; assert candidates from other projects are not returned
- [x] T022 [P] Write failing integration tests for PATCH confirm and reject — `tests/integration/supabase-queries.test.ts`: assert confirm creates a `decision_log` entry with correct `confirmed_value`; assert reject sets status to `rejected` with no sheet write

### Implementation

- [x] T023 [P] [US1] Implement Google Sheets cell write — `api/lib/sheets.ts`: `writeCell(sheetId, cellRef, value)` using Google Sheets API v4 with service account credentials from `GOOGLE_SERVICE_ACCOUNT_JSON` env var
- [x] T024 [P] [US1] Implement decision queue route — `api/routes/queue.ts`: GET `/projects/:id/decisions/queue` returning `pending_review` candidates and `auto_confirmed` candidates from last 48 hours, each with `source_messages`, `template_field`, and `confidence`; apply auth middleware; verify project belongs to requesting user
- [x] T025 [US1] Implement candidate confirm route — `api/routes/candidates.ts`: PATCH `/projects/:id/candidates/:cid/confirm` accepting optional `confirmed_value` and `correction_note`; create `decision_log` entry; call `sheets.writeCell`; set candidate status to `confirmed`; if field had prior active log entry set `superseded_by`
- [x] T026 [US1] Implement candidate reject route — `api/routes/candidates.ts`: PATCH `/projects/:id/candidates/:cid/reject`; set candidate status to `rejected`; no sheet write
- [x] T027 [P] [US1] Implement ConfidenceBadge component — `frontend/src/components/ConfidenceBadge.tsx`: green "Auto-confirmed" badge for confidence ≥ 0.85; amber "Needs review" for < 0.85; shows numeric score on hover
- [x] T028 [P] [US1] Implement DecisionCard component — `frontend/src/components/DecisionCard.tsx`: displays template field name + category, quoted source message(s) with sender and timestamp, extracted value (editable input), ConfidenceBadge, Confirm and Reject buttons; calls `api.confirmCandidate` or `api.rejectCandidate`; removes card from list on action
- [x] T029 [US1] Implement DecisionQueue page — `frontend/src/pages/DecisionQueue.tsx`: fetches queue from API on mount; renders two sections ("Needs Your Review" and "Auto-Confirmed Today"); shows empty state when queue is clear; loading skeleton during fetch
- [x] T030 [US1] Register queue and candidates routes — `api/index.ts`: mount `queueRoute` and `candidatesRoute` under `/projects/:id`; apply auth middleware to both
- [x] T031 [US1] Add test data seed script — `tests/fixtures/seed-decision-queue.ts`: inserts a project with 3 pending candidates (confidence 0.62, 0.45, 0.71) and 2 auto-confirmed candidates (confidence 0.91, 0.88) for local development and integration testing

**Checkpoint**: Seed test data, open `/projects/:id/decisions`, confirm a pending card with an edited value, verify the Google Sheet cell is updated and a decision log row exists in Supabase.

---

## Phase 4: User Story 2 — Automatic Message Extraction on Recurring Schedule (Priority: P2)

**Goal**: Every new Telegram group message is automatically processed; decision candidates appear in the queue without any manual trigger.

**Independent Test**: POST a crafted Telegram update payload to `/api/telegram/webhook` with a known secret token. Assert a `message` row is created, Gemini is called with the message content, and a `decision_candidate` row appears with correct status based on confidence.

### Tests — write first, confirm they fail before implementing

- [x] T032 Write failing unit tests for Gemini response parsing — `tests/unit/extraction/parse-candidates.test.ts`: assert valid JSON responses are parsed into `DecisionCandidate` inserts; assert malformed/empty responses produce zero candidates; assert contradiction detection fires when extracted field already has a confirmed log entry
- [x] T033 [P] Write failing integration tests for POST `/telegram/webhook` — `tests/integration/webhook-handler.test.ts`: assert valid secret token → 200 response immediately; assert message row is created; assert invalid secret → 401; assert non-text message type is skipped without error

### Implementation

- [x] T034 [P] [US2] Implement Telegram webhook secret validator and `getChat` helper — `api/lib/telegram.ts`: `validateWebhookSecret(header, projectSecret) → boolean`; `getChat(chatId) → { title }` for project setup validation
- [x] T035 [US2] Implement Gemini Flash extraction — `api/lib/extraction.ts`: `extractDecisions(messages, templateFields) → DecisionCandidate[]`; system prompt describes all template fields by name/category; user prompt contains message batch as JSON; parse structured JSON response; assign confidence scores; flag contradictions against existing confirmed decisions passed as context
- [x] T036 [US2] Implement webhook route — `api/routes/webhook.ts`: POST `/telegram/webhook`; validate `X-Telegram-Bot-Api-Secret-Token` header; return 200 immediately; async: look up project by `chat_id`, skip non-text messages, store `message` row (dedup on `telegram_message_id`), call `extraction.extractDecisions`, insert `decision_candidate` rows, auto-confirm candidates with confidence ≥ 0.85 (call `sheets.writeCell` + insert `decision_log`), route remainder to `pending_review`
- [x] T037 [US2] Register webhook route — `api/index.ts`: mount `webhookRoute` at `/telegram/webhook` (no auth middleware — authenticated via Telegram secret token instead)

**Checkpoint**: Start ngrok, register webhook, post a message in the Telegram group containing a decision (e.g. "paint is Chantilly Lace"), verify candidate appears in the queue page.

---

## Phase 5: User Story 3 — Missing Decision Detection and Deadline Alerts (Priority: P3)

**Goal**: Contractor sees which required fields are still unfilled per project phase, with an alert when a deadline is ≤ 7 days away.

**Independent Test**: Seed a project with two phases (one deadline in 5 days, one in 30 days). Confirm decisions for some fields but not others. Call GET `/projects/:id/missing` and assert unfilled required fields appear under the correct phases, with `alert: true` only on the near-deadline phase.

### Tests — write first, confirm they fail before implementing

- [ ] T038 Write failing integration tests for GET `/projects/:id/missing` — `tests/integration/supabase-queries.test.ts`: assert unfilled required fields grouped by phase; assert `alert: true` when deadline ≤ 7 days and fields remain; assert filled fields absent from response; assert fields from other projects not returned

### Implementation

- [ ] T039 [P] [US3] Implement missing fields route — `api/routes/missing.ts`: GET `/projects/:id/missing`; query all required `template_fields` for the project's template; left-join active `decision_log` entries; return unfilled fields grouped by `project_phases` with `days_until_deadline` and `alert` (≤ 7 days); include `unphased_missing` for required fields not tied to any phase
- [ ] T040 [P] [US3] Implement PhaseDeadlineAlert component — `frontend/src/components/PhaseDeadlineAlert.tsx`: amber warning banner showing phase name, deadline date, and count of missing fields; only renders when `alert === true`
- [ ] T041 [US3] Implement MissingFields page — `frontend/src/pages/MissingFields.tsx`: fetches `/projects/:id/missing` on mount; renders phase sections each with optional `PhaseDeadlineAlert`; lists missing fields as chips with category label; empty state when all fields are filled
- [ ] T042 [US3] Register missing route and add page to router — `api/index.ts`: mount `missingRoute`; `frontend/src/main.tsx`: add `/projects/:id/missing` route

**Checkpoint**: Seed project with partial decisions and a near deadline, open the Missing Fields page, verify the correct fields appear and the alert banner shows for the near-deadline phase.

---

## Phase 6: User Story 4 — Decision Log and Audit Trail (Priority: P4)

**Goal**: Contractor can view a full, filterable chronological log of all confirmed decisions with source message traceability.

**Independent Test**: Confirm several decisions across different categories via the queue. Open the decision log, verify entries appear in reverse-chronological order with source message, sender, and confirmation metadata. Filter by category and verify only matching entries show.

### Tests — write first, confirm they fail before implementing

- [ ] T043 Write failing integration tests for GET `/projects/:id/log` — `tests/integration/supabase-queries.test.ts`: assert paginated results returned in descending `confirmed_at` order; assert `category` filter returns only matching entries; assert superseded entries appear with `superseded_by` set; assert entries from other projects not returned

### Implementation

- [ ] T044 [P] [US4] Implement decision log route — `api/routes/log.ts`: GET `/projects/:id/log` with `page`, `per_page` (max 100), `category`, and `field_id` query params; join `template_fields` for names; join `messages` for source content; return paginated response with `total` count
- [ ] T045 [US4] Implement DecisionLog page — `frontend/src/pages/DecisionLog.tsx`: fetches log on mount and on pagination; renders entries as timeline rows showing field name, confirmed value, sender, timestamp, source message quote (expandable), and correction note if present; category filter dropdown; load-more pagination
- [ ] T046 [US4] Register log route and add page to router — `api/index.ts`: mount `logRoute`; `frontend/src/main.tsx`: add `/projects/:id/log` route

**Checkpoint**: Open decision log for a project with confirmed decisions, verify source messages are traceable, verify category filter narrows the list correctly.

---

## Phase 7: User Story 5 — Project Setup and Template Linking (Priority: P5)

**Goal**: Contractor creates a project by linking a Telegram group and Google Sheet, and the app validates access and registers the webhook automatically.

**Independent Test**: Fill the project setup form with a valid Telegram chat ID and Google Sheet ID using test credentials. Submit — verify the project row is created in Supabase, Telegram webhook is registered, and the project appears in the project list.

### Tests — write first, confirm they fail before implementing

- [ ] T047 Write failing integration tests for POST `/projects` — `tests/integration/webhook-handler.test.ts`: assert valid inputs create a project row and call `telegram.setWebhook`; assert `TELEGRAM_ACCESS_DENIED` returned when bot is not in the chat; assert `SHEETS_ACCESS_DENIED` when service account lacks access; assert `CHAT_ALREADY_LINKED` when chat ID is in use

### Implementation

- [ ] T048 [P] [US5] Implement `setWebhook` and Sheets access validation helpers — `api/lib/telegram.ts`: `setWebhook(chatId, webhookUrl, secret)`; `api/lib/sheets.ts`: `validateSheetAccess(sheetId) → { title }` (attempts a read to verify service account permission)
- [ ] T049 [P] [US5] Implement validate route — `api/routes/validate.ts`: POST `/projects/validate`; call `telegram.getChat` and `sheets.validateSheetAccess`; return `{ telegram: { valid, chat_title }, sheets: { valid, sheet_title } }` or field-level errors; no DB writes
- [ ] T050 [US5] Implement projects route — `api/routes/projects.ts`: GET `/projects` (list with `pending_review_count`, `missing_required_count`, `next_deadline`); POST `/projects` (validate access → generate `webhook_secret` → insert project → call `telegram.setWebhook`); DELETE `/projects/:id` (set `active = false`, call `telegram.deleteWebhook`)
- [ ] T051 [P] [US5] Implement Projects list page — `frontend/src/pages/Projects.tsx`: fetches project list on mount; renders project cards showing name, pending count badge, missing fields count, next deadline; "New Project" button; empty state for new accounts
- [ ] T052 [US5] Implement ProjectSetup page — `frontend/src/pages/ProjectSetup.tsx`: form with project name, Telegram chat ID (with instructions link), Google Sheet ID, template selector (fetches available templates); "Validate Access" button calls `/projects/validate` and shows inline success/error per field; "Create Project" submits on both fields valid; redirects to project queue on success
- [ ] T053 [US5] Register project routes and wire navigation — `api/index.ts`: mount `projectsRoute` and `validateRoute`; `frontend/src/main.tsx`: add `/projects`, `/projects/new`, and per-project sub-routes; add nav links in project layout to Queue, Missing, and Log pages

**Checkpoint**: Create a real project using a test Telegram group and test Google Sheet, confirm webhook is registered via `getWebhookInfo`, post a test message, see a candidate appear in the queue.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T054 Write E2E test — `tests/e2e/decision-flow.test.ts`: full flow using Playwright — log in, open seeded project, confirm one pending decision with edited value, reject another, verify queue count decrements and decision log shows new entry
- [ ] T055 [P] Add consistent loading states and error handling — all async fetch calls in `frontend/src/pages/*.tsx` must show a skeleton loader during fetch and a user-readable error banner on failure; error messages must match spec terminology
- [ ] T056 [P] Harden webhook idempotency — `api/routes/webhook.ts`: wrap message insert and candidate creation in a single DB transaction; verify unique constraint on `(project_id, telegram_message_id)` prevents duplicate processing on Telegram retries
- [ ] T057 [P] Add Supabase inactivity keepalive — `api/routes/health.ts`: GET `/health` returning 200; configure a Vercel cron (once/day) to ping it and prevent Supabase free tier project pause
- [ ] T058 Validate end-to-end via quickstart.md — follow `quickstart.md` from scratch on a clean machine: deploy to Vercel, configure env vars, create a project, post a decision message, confirm it from the dashboard, verify Google Sheet is updated

**Checkpoint**: All 54 prior tasks complete. E2E test passes. App deployed and working against a real Telegram group and Google Sheet.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks all user stories**
- **Phases 3–7 (User Stories)**: All depend on Phase 2 completion; can proceed in priority order or in parallel if staffed
- **Phase 8 (Polish)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Needs Phase 2 only — can run with seeded data, no dependency on other stories
- **US2 (P2)**: Needs Phase 2 only — depends on `extraction.ts` and `sheets.ts` partially built in US1
- **US3 (P3)**: Needs Phase 2 + US1 (decision_log must exist to determine "missing")
- **US4 (P4)**: Needs Phase 2 + US1 (reads decision_log entries created by confirm flow)
- **US5 (P5)**: Needs Phase 2 + partial US2 (`telegram.ts` helpers needed for project creation)

### Within Each Phase

1. Write tests → confirm they **fail**
2. Implement models / lib functions
3. Implement API routes
4. Implement frontend components + pages
5. Run tests → confirm they **pass**
6. Commit

### Parallel Opportunities Within a Phase

```
# Phase 3 (US1) — can parallelize after T020-T022 tests pass:
T023 (sheets.ts)        T024 (queue route)       T027 (ConfidenceBadge)
                        T025 (confirm route) ─── T028 (DecisionCard) ───► T029 (DecisionQueue page)
                        T026 (reject route)
```

```
# Phase 2 — can parallelize:
T008–T013 (migrations)  ─── T014 (supabase.ts)
                            T015 (hono entry)   ─── T016 (auth middleware)
T017 (api.ts)           ─── T018 (auth.ts)     ─── T019 (login page + router)
```

---

## Implementation Strategy

### MVP (User Story 1 only — ~25 tasks)

1. Phase 1: Setup (T001–T007)
2. Phase 2: Foundational (T008–T019)
3. Phase 3: US1 — Decision Review Queue (T020–T031)
4. **Stop and validate**: seed test data, confirm decisions, verify Sheets write
5. Deploy to Vercel — contractors can manually seed decisions and use the review UI

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. + Phase 3 (US1) → **MVP**: review and confirm seeded decisions
3. + Phase 4 (US2) → **Automated**: real Telegram messages create candidates
4. + Phase 5 (US3) → **Proactive**: missing fields + deadline alerts
5. + Phase 6 (US4) → **Auditable**: full decision log
6. + Phase 7 (US5) → **Self-serve**: contractors onboard their own projects

---

## Notes

- `[P]` tasks touch different files — safe to work concurrently
- TDD is non-negotiable (constitution): every test task must be written and verified failing before its implementation tasks begin
- Each phase ends with an explicit checkpoint — stop to validate before proceeding
- Supabase RLS is the data isolation layer — never filter by `owner_id` in application code when RLS already enforces it
- Total: **58 tasks** across 8 phases
