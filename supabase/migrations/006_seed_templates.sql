-- Seed: "Residential Renovation" system template (owner_id NULL = system-owned)
-- Idempotent via ON CONFLICT; safe to re-run.

insert into templates (id, owner_id, name, created_at)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  null,
  'Residential Renovation',
  now()
) on conflict (id) do nothing;

insert into template_fields
  (id, template_id, name, category, required, sheet_cell_ref, sort_order, created_at)
values
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'Interior Paint Color',  'Finishes',        true,  'A2',  0,  now()),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'Tile Material',         'Materials',       true,  'A3',  1,  now()),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', 'Grout Color',           'Finishes',        true,  'A4',  2,  now()),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', 'Cabinet Hardware',      'Finishes',        true,  'A5',  3,  now()),
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000001', 'Countertop Material',   'Materials',       true,  'A6',  4,  now()),
  ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0000-000000000001', 'Flooring Material',     'Materials',       true,  'A7',  5,  now()),
  ('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0000-000000000001', 'Fixture Finish',        'Fixtures',        true,  'A8',  6,  now()),
  ('00000000-0000-0000-0001-000000000008', '00000000-0000-0000-0000-000000000001', 'Start Date',            'Schedule',        true,  'A9',  7,  now()),
  ('00000000-0000-0000-0001-000000000009', '00000000-0000-0000-0000-000000000001', 'Completion Date',       'Schedule',        true,  'A10', 8,  now()),
  ('00000000-0000-0000-0001-000000000010', '00000000-0000-0000-0000-000000000001', 'Permit Number',         'Administrative',  false, 'A11', 9,  now()),
  ('00000000-0000-0000-0001-000000000011', '00000000-0000-0000-0000-000000000001', 'Total Budget',          'Administrative',  true,  'A12', 10, now()),
  ('00000000-0000-0000-0001-000000000012', '00000000-0000-0000-0000-000000000001', 'Contractor Notes',      'Administrative',  false, 'A13', 11, now())
on conflict (id) do nothing;
