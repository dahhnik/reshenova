# API Contracts: Telegram Project Decision Tracker

**Date**: 2026-04-28

All endpoints are served by Next.js API routes deployed on Vercel. All requests (except the Telegram webhook) require a valid Supabase Auth session cookie. All responses are JSON. Errors follow `{ error: string, code: string }`.

---

## Telegram Webhook

### POST /api/telegram/webhook

Receives Telegram update events. Called by Telegram servers only.

**Authentication**: Validated via `X-Telegram-Bot-Api-Secret-Token` header matching the project's `webhook_secret`. Returns 401 if invalid. Returns 200 immediately on all valid calls (Telegram requires a fast response).

**Request body** (Telegram Update object, subset):
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 42,
    "from": {
      "id": 987654321,
      "first_name": "Anna",
      "last_name": "Contractor"
    },
    "chat": {
      "id": -1001234567890,
      "title": "Kitchen Reno - Smith House",
      "type": "supergroup"
    },
    "date": 1714300000,
    "text": "Confirmed - paint color is Benjamin Moore Chantilly Lace OC-65"
  }
}
```

**Processing** (async, after 200 returned):
1. Look up project by `message.chat.id`
2. Store message in `messages` table
3. Call Gemini Flash with message content + project template fields
4. For each extracted field: create `DecisionCandidate`, auto-confirm if confidence ≥ 0.85 and no contradiction
5. Write auto-confirmed decisions to Google Sheets

**Response**: `200 OK` with empty body (always, once secret validated)

---

## Projects

### GET /api/projects

List all projects for the authenticated contractor.

**Response**:
```json
[
  {
    "id": "uuid",
    "name": "Smith Kitchen Renovation",
    "telegram_chat_id": -1001234567890,
    "google_sheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
    "active": true,
    "pending_review_count": 3,
    "missing_required_count": 7,
    "next_deadline": "2026-05-15",
    "next_deadline_phase": "Pre-Construction Sign-Off",
    "created_at": "2026-04-01T10:00:00Z"
  }
]
```

---

### POST /api/projects

Create a new project and configure the Telegram webhook.

**Request body**:
```json
{
  "name": "Smith Kitchen Renovation",
  "telegram_chat_id": -1001234567890,
  "google_sheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
  "template_id": "uuid"
}
```

**Validation**:
- Verifies Telegram bot has access to the chat (calls `getChat`)
- Verifies write access to the Google Sheet
- Calls Telegram `setWebhook` with the generated endpoint and secret token

**Response**: `201 Created` with the created project object

**Error codes**:
- `TELEGRAM_ACCESS_DENIED` — bot is not a member or not an admin of the chat
- `SHEETS_ACCESS_DENIED` — service account lacks write permission on the sheet
- `CHAT_ALREADY_LINKED` — another project is already using this Telegram chat

---

### DELETE /api/projects/:id

Deactivate a project. Stops processing new messages. Does not delete data.

**Response**: `204 No Content`

---

## Decision Queue

### GET /api/projects/:id/decisions/queue

Returns all pending review candidates and recently auto-confirmed decisions (last 48 hours) for contractor awareness.

**Query params**:
- `status` (optional): `pending_review` | `auto_confirmed` | `all` (default: `all`)

**Response**:
```json
{
  "pending_review": [
    {
      "id": "uuid",
      "template_field": {
        "id": "uuid",
        "name": "Tile Grout Color",
        "category": "Finishes"
      },
      "extracted_value": "Mapei Warm Gray",
      "confidence": 0.72,
      "is_contradiction": false,
      "source_messages": [
        {
          "id": "uuid",
          "sender_name": "Anna",
          "content": "Let's go with the warm gray grout to match the countertops",
          "sent_at": "2026-04-28T14:30:00Z"
        }
      ],
      "extraction_note": "Sender confirmed grout color preference with brand reference",
      "created_at": "2026-04-28T14:30:05Z"
    }
  ],
  "auto_confirmed": [
    {
      "id": "uuid",
      "template_field": { "id": "uuid", "name": "Cabinet Hardware Finish", "category": "Finishes" },
      "extracted_value": "Matte Black",
      "confidence": 0.93,
      "confirmed_at": "2026-04-28T13:00:00Z"
    }
  ]
}
```

---

### PATCH /api/projects/:id/decisions/:candidateId/confirm

Contractor confirms a decision candidate, optionally with a corrected value.

**Request body**:
```json
{
  "confirmed_value": "Mapei Warm Gray 112",
  "correction_note": "Added full product code from sample sheet"
}
```
Both fields are optional. If `confirmed_value` is omitted, `extracted_value` is used as-is.

**Response**: `200 OK` with the created `DecisionLogEntry`

**Side effects**: Writes `confirmed_value` to the linked Google Sheet cell. Updates `DecisionCandidate.status` to `confirmed`.

---

### PATCH /api/projects/:id/decisions/:candidateId/reject

Contractor rejects an extracted decision candidate.

**Request body**: empty

**Response**: `200 OK`

**Side effects**: Sets `DecisionCandidate.status` to `rejected`. No sheet write.

---

## Decision Log

### GET /api/projects/:id/log

Returns the full, paginated decision log for a project.

**Query params**:
- `page` (default: 1)
- `per_page` (default: 50, max: 100)
- `category` (optional): filter by template field category
- `field_id` (optional): filter by specific template field

**Response**:
```json
{
  "total": 42,
  "page": 1,
  "per_page": 50,
  "entries": [
    {
      "id": "uuid",
      "template_field": { "id": "uuid", "name": "Interior Paint Color", "category": "Finishes" },
      "confirmed_value": "Benjamin Moore Chantilly Lace OC-65",
      "original_extracted_value": "Benjamin Moore Chantilly Lace OC-65",
      "confirmed_by": null,
      "confirmed_at": "2026-04-28T09:00:00Z",
      "correction_note": null,
      "sheet_written_at": "2026-04-28T09:00:02Z",
      "superseded_by": null,
      "source_messages": [
        {
          "sender_name": "Anna",
          "content": "Paint is confirmed - Chantilly Lace OC-65 from Benjamin Moore",
          "sent_at": "2026-04-28T08:59:00Z"
        }
      ]
    }
  ]
}
```

---

## Missing Fields

### GET /api/projects/:id/missing

Returns all required template fields that have no active confirmed decision, grouped by phase.

**Response**:
```json
{
  "phases": [
    {
      "id": "uuid",
      "name": "Pre-Construction Sign-Off",
      "deadline_date": "2026-05-15",
      "days_until_deadline": 17,
      "alert": true,
      "missing_fields": [
        { "id": "uuid", "name": "Flooring Material", "category": "Materials" },
        { "id": "uuid", "name": "Window Style", "category": "Fixtures" }
      ]
    }
  ],
  "unphased_missing": [
    { "id": "uuid", "name": "Backsplash Tile Pattern", "category": "Finishes" }
  ]
}
```

`alert: true` when `days_until_deadline ≤ 7` and missing fields remain.

---

## Project Setup Validation

### POST /api/projects/validate

Validates Telegram and Google Sheets access before creating a project. Non-destructive — does not create any records.

**Request body**:
```json
{
  "telegram_chat_id": -1001234567890,
  "google_sheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
}
```

**Response**:
```json
{
  "telegram": { "valid": true, "chat_title": "Kitchen Reno - Smith House" },
  "sheets": { "valid": true, "sheet_title": "Smith Kitchen Template" }
}
```
