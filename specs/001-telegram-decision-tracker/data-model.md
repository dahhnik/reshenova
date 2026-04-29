# Data Model: Telegram Project Decision Tracker

**Phase**: 1 — Design
**Date**: 2026-04-28

---

## Entities and Relationships

```
Profile (1) ──── (many) Project
Project  (1) ──── (1)    Template
Template (1) ──── (many) TemplateField
Project  (1) ──── (many) ProjectPhase
Project  (1) ──── (many) Message
Project  (1) ──── (many) DecisionCandidate
Project  (1) ──── (many) DecisionLogEntry
DecisionCandidate (many) ── (many) Message       [via source_message_ids]
DecisionLogEntry  (1) ──── (1)    DecisionCandidate
ProjectPhase (many) ── (many) TemplateField      [via PhaseRequiredField]
```

---

## Entity Definitions

### Profile
Extends Supabase Auth user. One profile per contractor account.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK, references auth.users | |
| full_name | text | NOT NULL | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

---

### Template
A reusable project template defining which decision fields to track (e.g., "Residential Renovation", "Kitchen Remodel").

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK |  |
| owner_id | uuid | FK → profiles.id | Contractor who created it |
| name | text | NOT NULL | e.g., "Kitchen Remodel" |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

---

### TemplateField
A named slot within a template that a decision fills. Maps to a specific cell in the Google Sheet.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| template_id | uuid | FK → templates.id, NOT NULL | |
| name | text | NOT NULL | e.g., "Interior Paint Color" |
| category | text | NOT NULL | e.g., "Finishes", "Materials", "Schedule" |
| required | boolean | NOT NULL, DEFAULT true | |
| sheet_cell_ref | text | NOT NULL | e.g., "B5" — target cell in the Google Sheet |
| sort_order | integer | NOT NULL, DEFAULT 0 | Display order within category |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

---

### Project
Links a Telegram group, a Google Sheet, and a template into a managed project.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| owner_id | uuid | FK → profiles.id, NOT NULL | |
| name | text | NOT NULL | Human-readable project name |
| telegram_chat_id | bigint | NOT NULL, UNIQUE | Telegram group/channel numeric ID |
| google_sheet_id | text | NOT NULL | Google Sheets document ID from URL |
| template_id | uuid | FK → templates.id, NOT NULL | |
| webhook_secret | text | NOT NULL | Random secret used to validate incoming Telegram webhook calls |
| active | boolean | NOT NULL, DEFAULT true | Soft-delete; inactive projects stop processing |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

---

### ProjectPhase
A named milestone with a deadline, associated with a subset of required template fields.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| project_id | uuid | FK → projects.id, NOT NULL | |
| name | text | NOT NULL | e.g., "Pre-Construction Sign-Off" |
| deadline_date | date | NULLABLE | NULL means no deadline configured |
| sort_order | integer | NOT NULL, DEFAULT 0 | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

---

### PhaseRequiredField
Join table linking project phases to the template fields that must be filled before the phase deadline.

| Field | Type | Constraints |
|-------|------|-------------|
| phase_id | uuid | FK → project_phases.id |
| template_field_id | uuid | FK → template_fields.id |
| PRIMARY KEY | (phase_id, template_field_id) | |

---

### Message
A raw text message received from a Telegram group. Immutable once stored.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| project_id | uuid | FK → projects.id, NOT NULL | |
| telegram_message_id | bigint | NOT NULL | |
| sender_name | text | NULLABLE | Display name at time of message |
| sender_telegram_id | bigint | NULLABLE | Telegram user ID |
| content | text | NOT NULL | Raw message text |
| sent_at | timestamptz | NOT NULL | Original Telegram message timestamp |
| received_at | timestamptz | NOT NULL, DEFAULT now() | When our webhook received it |
| UNIQUE | (project_id, telegram_message_id) | | Deduplication guard |

---

### DecisionCandidate
An AI extraction result for a specific template field. One candidate per (message batch, field) pair. Can be pending review, auto-confirmed, confirmed by contractor, rejected, or superseded by a newer candidate.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| project_id | uuid | FK → projects.id, NOT NULL | |
| template_field_id | uuid | FK → template_fields.id, NOT NULL | |
| extracted_value | text | NOT NULL | Raw extracted value, e.g., "Benjamin Moore Chantilly Lace" |
| confidence | numeric(4,3) | NOT NULL, CHECK 0 ≤ confidence ≤ 1 | AI confidence score |
| status | text | NOT NULL, CHECK IN ('pending_review', 'auto_confirmed', 'confirmed', 'rejected', 'superseded') | |
| source_message_ids | uuid[] | NOT NULL | References to messages.id |
| is_contradiction | boolean | NOT NULL, DEFAULT false | True if conflicts with an existing confirmed decision |
| extraction_note | text | NULLABLE | AI's brief reasoning for the extraction |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

**State transitions**:
```
              [confidence ≥ 0.85 AND no contradiction]
created ──────────────────────────────────────────────► auto_confirmed ──► (decision_log entry written)
   │
   │  [confidence < 0.85 OR is_contradiction = true]
   └──────────────────────────────────► pending_review
                                              │
                                    contractor confirms ──► confirmed ──► (decision_log entry written)
                                              │
                                    contractor rejects ──► rejected
                                              │
                            newer candidate for same field ──► superseded
```

---

### DecisionLogEntry
The immutable audit record of every confirmed decision. One entry per confirmed field value. A field can have multiple entries over time if a decision is reversed.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| project_id | uuid | FK → projects.id, NOT NULL | |
| template_field_id | uuid | FK → template_fields.id, NOT NULL | |
| candidate_id | uuid | FK → decision_candidates.id, NOT NULL | The candidate that was confirmed |
| confirmed_value | text | NOT NULL | The authoritative value (may differ from extracted_value if contractor edited) |
| original_extracted_value | text | NOT NULL | The raw AI extraction — preserved for audit |
| confirmed_by | uuid | FK → profiles.id, NULLABLE | NULL if auto-confirmed |
| confirmed_at | timestamptz | NOT NULL, DEFAULT now() | |
| correction_note | text | NULLABLE | Set when contractor edited the extracted value |
| sheet_written_at | timestamptz | NULLABLE | When this value was written to Google Sheets; NULL if write pending or failed |
| superseded_by | uuid | FK → decision_log.id, NULLABLE | Points to the newer entry that replaced this one |

---

## Validation Rules

- A `DecisionCandidate` with `is_contradiction = true` is always routed to `pending_review` regardless of confidence score.
- When a new `auto_confirmed` or `confirmed` entry is written to `decision_log` for a field that already has an active (non-superseded) entry, the prior entry's `superseded_by` is set.
- `sheet_written_at` is set only after the Google Sheets write is confirmed successful. A background job retries any entries where `sheet_written_at` is NULL and `status` is `confirmed` or `auto_confirmed`.
- `DecisionCandidate.source_message_ids` must contain at least one valid `message.id` belonging to the same project.
- `TemplateField.sheet_cell_ref` must match the pattern `[A-Z]+[0-9]+` (e.g., B5, AB12).

---

## Indexes (performance-critical paths)

- `messages(project_id, sent_at)` — fetch messages since last processed timestamp
- `decision_candidates(project_id, status)` — load pending review queue
- `decision_log(project_id, template_field_id, superseded_by)` — find current active decision per field
- `projects(telegram_chat_id)` — webhook lookup by chat ID (hot path)
