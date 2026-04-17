-- Migration 023: Seed custom_trackables with the 28 POTS / endo / chronic
-- illness toggles that power the Wave 2e F2 Lite Log card.
--
-- IMPORTANT: This migration is PURELY ADDITIVE. It inserts rows into
-- custom_trackables only. Existing rows (from migration 009's baseline
-- seed, or any user-authored rows) are preserved via ON CONFLICT DO
-- NOTHING against the UNIQUE(name) constraint already on the table.
--
-- The canonical list lives in src/lib/lite-log/activities.ts. Any edits
-- must be made in both places so the grid UI and the DB stay in sync.

INSERT INTO custom_trackables (name, category, input_type, icon, display_order)
VALUES
  ('Compression socks',     'activity',   'toggle', 'socks',            10),
  ('Salt + electrolytes',   'activity',   'toggle', 'droplets',         20),
  ('Lying flat',            'activity',   'toggle', 'bed',              30),
  ('Heat pad',              'activity',   'toggle', 'flame',            40),
  ('Hydration goal met',    'activity',   'toggle', 'droplet',          50),
  ('Protein-forward meal',  'activity',   'toggle', 'salad',            60),
  ('Gentle movement',       'activity',   'toggle', 'footprints',       70),
  ('Recumbent exercise',    'activity',   'toggle', 'dumbbell',         80),
  ('Cool shower',           'activity',   'toggle', 'shower-head',      90),
  ('Paced rest',            'activity',   'toggle', 'armchair',        100),
  ('Grounding practice',    'activity',   'toggle', 'flower-2',        110),
  ('Social connection',     'activity',   'toggle', 'users',           120),
  ('Outdoor time',          'activity',   'toggle', 'sun',             130),
  ('Early wind-down',       'activity',   'toggle', 'moon',            140),
  ('Dizzy on standing',     'symptom',    'toggle', 'waves',           200),
  ('Cramps',                'symptom',    'toggle', 'zap-off',         210),
  ('Brain fog',             'symptom',    'toggle', 'brain',           220),
  ('Heavy flow',            'symptom',    'toggle', 'droplet',         230),
  ('Migraine / headache',   'symptom',    'toggle', 'eye-closed',      240),
  ('Racing heart',          'symptom',    'toggle', 'heart-pulse',     250),
  ('Standing > 1 hour',     'factor',     'toggle', 'footprints',      300),
  ('Skipped meal',          'factor',     'toggle', 'utensils-crossed', 310),
  ('Hot weather / hot bath','factor',     'toggle', 'thermometer-sun', 320),
  ('Poor sleep night',      'factor',     'toggle', 'cloud-sun-rain',  330),
  ('Caffeine',              'factor',     'toggle', 'coffee',          340),
  ('Travel / car ride',     'factor',     'toggle', 'car',             350),
  ('Beta blocker taken',    'supplement', 'toggle', 'pill',            400),
  ('PRN pain med',          'supplement', 'toggle', 'pill-bottle',     410)
ON CONFLICT (name) DO NOTHING;
