create table if not exists decision_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  template_field_id uuid not null references template_fields(id) on delete cascade,
  candidate_id uuid not null references decision_candidates(id) on delete cascade,
  confirmed_value text not null,
  original_extracted_value text not null,
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz not null default now(),
  correction_note text,
  sheet_written_at timestamptz,
  superseded_by uuid references decision_log(id)
);

create index if not exists decision_log_project_field_superseded_idx
  on decision_log(project_id, template_field_id, superseded_by);
