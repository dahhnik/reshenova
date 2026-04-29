alter table profiles enable row level security;
alter table templates enable row level security;
alter table template_fields enable row level security;
alter table projects enable row level security;
alter table project_phases enable row level security;
alter table phase_required_fields enable row level security;
alter table messages enable row level security;
alter table decision_candidates enable row level security;
alter table decision_log enable row level security;

-- Profiles: own row only
create policy "profiles_own" on profiles
  for all using (id = auth.uid());

-- Templates: own templates + system templates (owner_id IS NULL) are readable by all
create policy "templates_select" on templates
  for select using (owner_id = auth.uid() or owner_id is null);

create policy "templates_write" on templates
  for insert with check (owner_id = auth.uid());

create policy "templates_update" on templates
  for update using (owner_id = auth.uid());

create policy "templates_delete" on templates
  for delete using (owner_id = auth.uid());

-- Template fields: readable if template is own or system; writable if own template
create policy "template_fields_select" on template_fields
  for select using (
    template_id in (
      select id from templates where owner_id = auth.uid() or owner_id is null
    )
  );

create policy "template_fields_write" on template_fields
  for insert with check (
    template_id in (select id from templates where owner_id = auth.uid())
  );

create policy "template_fields_update" on template_fields
  for update using (
    template_id in (select id from templates where owner_id = auth.uid())
  );

create policy "template_fields_delete" on template_fields
  for delete using (
    template_id in (select id from templates where owner_id = auth.uid())
  );

-- Projects: own rows only
create policy "projects_own" on projects
  for all using (owner_id = auth.uid());

-- Project phases: accessible via project ownership
create policy "project_phases_own" on project_phases
  for all using (
    project_id in (select id from projects where owner_id = auth.uid())
  );

-- Phase required fields: accessible via project → phase chain
create policy "phase_required_fields_own" on phase_required_fields
  for all using (
    phase_id in (
      select pp.id from project_phases pp
      join projects p on p.id = pp.project_id
      where p.owner_id = auth.uid()
    )
  );

-- Messages: accessible via project ownership
create policy "messages_own" on messages
  for all using (
    project_id in (select id from projects where owner_id = auth.uid())
  );

-- Decision candidates: accessible via project ownership
create policy "decision_candidates_own" on decision_candidates
  for all using (
    project_id in (select id from projects where owner_id = auth.uid())
  );

-- Decision log: accessible via project ownership
create policy "decision_log_own" on decision_log
  for all using (
    project_id in (select id from projects where owner_id = auth.uid())
  );
