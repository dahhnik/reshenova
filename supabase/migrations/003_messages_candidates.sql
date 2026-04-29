create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  telegram_message_id bigint not null,
  sender_name text,
  sender_telegram_id bigint,
  content text not null,
  sent_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique (project_id, telegram_message_id)
);

create index if not exists messages_project_id_sent_at_idx on messages(project_id, sent_at);

create table if not exists decision_candidates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  template_field_id uuid not null references template_fields(id) on delete cascade,
  extracted_value text not null,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  status text not null check (
    status in ('pending_review', 'auto_confirmed', 'confirmed', 'rejected', 'superseded')
  ),
  source_message_ids uuid[] not null,
  is_contradiction boolean not null default false,
  extraction_note text,
  created_at timestamptz not null default now()
);

create index if not exists decision_candidates_project_id_status_idx
  on decision_candidates(project_id, status);
