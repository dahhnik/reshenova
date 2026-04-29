create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- owner_id nullable to support system-owned seed templates
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists templates_owner_id_idx on templates(owner_id);

create table if not exists template_fields (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  name text not null,
  category text not null,
  required boolean not null default true,
  sheet_cell_ref text not null check (sheet_cell_ref ~ '^[A-Z]+[0-9]+$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists template_fields_template_id_idx on template_fields(template_id);
