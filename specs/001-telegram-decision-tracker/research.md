# Research: Telegram Project Decision Tracker

**Phase**: 0 — Stack evaluation and architecture decisions
**Date**: 2026-04-28

---

## 1. Stack Cost Analysis

| Service | Free Tier Viable? | Paid Cost | Key Limits | Verdict |
|---------|-------------------|-----------|------------|---------|
| **Vercel Hobby** | Yes (non-commercial) | Pro: $20/dev/mo | 1M invocations/mo, 4 CPU-hrs/mo, 60s max function duration, cron: once/day, 100 GB bandwidth | Viable for webhook receiver + Next.js UI at this volume. Cron limit is irrelevant — we use webhooks, not polling. |
| **Supabase Free** | Yes | Pro: $25/mo | 500 MB DB (~2-5M rows), unlimited API calls, 50K MAUs, 2 active projects. **Pauses after 1 week of inactivity.** | Handles 10K rows/month easily. Inactivity pause is a non-issue as long as the Telegram bot is active in at least one group (webhook traffic keeps it alive). |
| **Gemini Flash (free)** | Yes, with batching | ~$0.15/MTok in, $0.60/MTok out | 250 RPD, 10 RPM, 250K TPM | 250 req/day is enough if we batch project messages per cycle (one Gemini call per incoming webhook, not one per message). At 500 msgs/day batched into ≤250 calls, fits comfortably. |
| **Google Sheets API** | Yes | Free at all scales for this volume | 300 reads/min, 300 writes/min per project | No cost concern. Comfortably handles confirmed-decision writes (~50/day). |
| **Telegram Bot API** | Yes (free) | Free | **Privacy mode ON by default** — bot only receives @mentions. Must disable via BotFather OR grant bot admin rights to read all group messages. | Completely free. Privacy mode configuration is a one-time setup step per project. |
| **Claude Sonnet 4.6** | No free tier | $3/MTok in, $15/MTok out. Batch API: 50% off. Cache reads: $0.30/MTok. | — | Realistic monthly cost at this volume: **$5-10/mo** with Batch API + prompt caching. Excellent quality; not zero cost. Use as a quality upgrade path if Gemini extraction accuracy is insufficient. |
| **Claude Haiku 4.5** | No free tier | $1/MTok in, $5/MTok out | — | ~$1-3/mo at this volume. Middle-ground option between Gemini free and Sonnet quality. |
| **Google Apps Script** | Partial | Free | 90 min/day trigger runtime, 6-min max execution, no persistent server, no background tasks | Viable only as a prototype. Cannot run reliably in production at this scale. |

### Cost Decision

- **Recommended stack: $0/month** — Telegram + Gemini Flash (free) + Vercel Hobby + Supabase Free + Google Sheets
- **Upgrade path**: If Gemini extraction quality is insufficient, swap to Claude Haiku 4.5 (~$2/mo) or Sonnet 4.6 (~$8/mo with Batch API)
- **Commercial deployment**: Vercel Hobby is non-commercial. If this becomes a paid product, Vercel Pro ($20/mo) is required

---

## 2. Architecture Decision: Webhooks vs. Polling

**Decision**: Use Telegram webhooks exclusively. No polling.

**Rationale**:
- Vercel is serverless — there is no persistent process to run a polling loop
- Vercel Hobby cron runs at most once/day, far too infrequent for practical use
- Webhooks are event-driven: Telegram POSTs each update the instant it arrives, Vercel invokes the function only on incoming messages (zero idle compute cost)
- At 500 messages/day, webhook invocations are trivially within the 1M/month free limit
- Telegram queues undelivered updates for 24 hours and retries on failure — resilient against brief cold starts

**Trade-off acknowledged**: Local development has no public HTTPS URL. Developers use `ngrok` or Cloudflare Tunnel locally to expose a webhook endpoint, or fall back to `getUpdates` polling during development only.

---

## 3. Telegram Bot Group Message Access

**Problem**: Telegram bots have privacy mode enabled by default. In privacy mode, a bot only receives messages that begin with `/` (commands) or that directly mention the bot. This is insufficient for passively monitoring contractor conversations.

**Solutions** (either works):
- A) Disable privacy mode for the bot via BotFather → bot receives all messages in groups where it's a member
- B) Grant the bot admin rights in each Telegram group → same effect without globally disabling privacy mode

**Decision**: Require project owners to grant bot admin rights per group (Option B). This is more controlled and is a one-time setup step per project, documented in quickstart.md.

---

## 4. AI Extraction Design

**Input**: A batch of raw Telegram messages (text content, sender name, timestamp)

**Output**: Structured extraction — for each template field in the project's template, either a extracted value + confidence score, or null

**Approach**: Single Gemini Flash call per incoming webhook event (or per batch of messages received within the same second, if deduplication groups them). System prompt contains the template field definitions. User prompt contains the new messages. Gemini returns JSON with field → value + confidence mappings.

**Confidence thresholds**:
- `≥ 0.85`: Auto-confirm → write directly to Google Sheet + decision log
- `< 0.85`: Queue for contractor review

**Contradiction handling**: If an incoming message yields an extraction that conflicts with an existing confirmed decision for the same field, the candidate is always routed to the review queue regardless of confidence, flagged as a potential reversal.

---

## 5. Technology Stack — Final Decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Language | TypeScript | Type safety across full stack; native Next.js + Supabase SDK support |
| Framework | Next.js (App Router) | Single deployment unit to Vercel; API routes handle webhook; React UI for contractor dashboard |
| Database | Supabase (PostgreSQL) | Free tier; built-in Auth; row-level security for multi-contractor isolation; realtime optional |
| AI Extraction | Google Gemini Flash | Free tier (250 RPD); good structured extraction quality; Google ecosystem synergy with Sheets |
| Sheets Integration | Google Sheets API v4 | Free; no alternative needed |
| Telegram | Bot API via webhook | Free; event-driven; serverless-compatible |
| Auth | Supabase Auth | Included; email/password and OAuth; pairs with RLS for data isolation |
| Testing | Vitest + Playwright | Fast unit tests; E2E for the primary user journey |
| Deployment | Vercel | Zero-config Next.js deployment; auto-HTTPS; preview deployments per branch |

---

## 6. Key Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Gemini free tier rate limit (250 RPD) hit by high-volume group | Low for initial use | Batch messages within a webhook event; add queue + retry with exponential backoff; upgrade to paid Gemini if needed |
| Supabase project pauses due to inactivity | Low (any active project prevents pause) | Telegram webhook traffic is sufficient; add a weekly Vercel cron ping as belt-and-suspenders |
| Telegram webhook delivery gap during Vercel cold start | Very low (Telegram retries for 24h) | No action needed; Telegram handles retries automatically |
| Google Sheets API write conflict (concurrent confirms) | Low | Serialize sheet writes through a Supabase queue; write only on contractor confirmation |
| Contractor on Vercel Hobby using this commercially | Medium | Document the non-commercial restriction; Vercel Pro path is $20/mo |
