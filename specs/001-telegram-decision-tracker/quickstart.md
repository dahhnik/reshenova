# Quickstart: Telegram Project Decision Tracker

**Date**: 2026-04-28

Local development and first deployment. Complete in order.

---

## Prerequisites

- Node.js 20+
- A Google account with Google Cloud access
- A Telegram account
- A Supabase account (free)
- A Vercel account (free)
- A Google Gemini API key (free)

---

## 1. Telegram Bot Setup

1. Open Telegram, message `@BotFather`
2. `/newbot` → follow prompts → save the **Bot Token**
3. Disable privacy mode so the bot can read all group messages:
   - `/mybots` → select your bot → **Bot Settings** → **Group Privacy** → **Turn Off**
4. Add the bot to your Telegram project group as an **Admin** (this is required per-group)

---

## 2. Google Cloud Setup (Sheets API)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or use an existing one
3. Enable **Google Sheets API**
4. Create a **Service Account**: IAM & Admin → Service Accounts → Create
5. Download the service account JSON key file
6. Open each Google Sheet template → Share → add the service account email as **Editor**

---

## 3. Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key → save it

---

## 4. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Save your **Project URL** and **anon key** from Settings → API
3. Run the database migrations (from the repo once cloned):
   ```bash
   npx supabase db push
   ```
4. Enable email auth: Authentication → Providers → Email → Enable

---

## 5. Local Development

```bash
# Clone and install
git clone <repo-url>
cd reshenova
npm install

# Copy env template
cp .env.example .env.local

# Fill in .env.local:
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...
# TELEGRAM_BOT_TOKEN=...
# GEMINI_API_KEY=...
# GOOGLE_SERVICE_ACCOUNT_JSON=... (base64-encoded JSON key)

# Start local dev server
npm run dev
```

For local Telegram webhook testing, expose localhost with:
```bash
npx cloudflared tunnel --url http://localhost:3000
# or: npx ngrok http 3000
```

---

## 6. Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

In the Vercel dashboard → Settings → Environment Variables, add all variables from `.env.local`.

Your app URL will be `https://your-project.vercel.app`.

---

## 7. Register Telegram Webhook

Once deployed, register the webhook endpoint with Telegram. The app's setup flow does this automatically when you create a project. You can also do it manually:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://your-project.vercel.app/api/telegram/webhook" \
  -d "secret_token=<YOUR_WEBHOOK_SECRET>"
```

Verify registration:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

---

## 8. Create Your First Project

1. Log in to your deployed app
2. Click **New Project**
3. Enter a project name
4. Paste the Telegram group chat ID (get it from `@userinfobot` in the group)
5. Paste the Google Sheet document ID (from the sheet URL)
6. Select a template
7. Click **Create** — the app validates access and registers the webhook

Once created, any new message in the Telegram group is automatically processed.

---

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `TELEGRAM_BOT_TOKEN` | Token from BotFather |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Base64-encoded service account JSON |
