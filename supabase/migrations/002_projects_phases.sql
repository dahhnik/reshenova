create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  telegram_chat_id bigint not null unique,
  google_sheet_id text not null,
  template_id uuid not null references templates(id),
  webhook_secret text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_telegram_chat_id_idx on projects(telegram_chat_id);
create index if not exists projects_owner_id_idx on projects(owner_id);

create table if not exists project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  deadline_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists project_phases_project_id_idx on project_phases(project_id);

create table if not exists phase_required_fields (
  phase_id uuid not null references project_phases(id) on delete cascade,
  template_field_id uuid not null references template_fields(id) on delete cascade,
  primary key (phase_id, template_field_id)
);
