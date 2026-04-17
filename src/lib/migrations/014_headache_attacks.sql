-- 014_headache_attacks.sql
-- Headache attack logging table. Captures one row per attack with
-- head zone locations, ICHD-3 aura categories, triggers, medications,
-- and denormalized cycle phase for fast menstrual-migraine correlation.
--
-- Additive only. No existing data is mutated.
-- Reference: docs/competitive/headache-diary/implementation-notes.md

CREATE TABLE IF NOT EXISTS headache_attacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL DEFAULT 'lanae',
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  severity int CHECK (severity >= 0 AND severity <= 10),
  head_zones jsonb DEFAULT '[]'::jsonb,
  aura_categories jsonb DEFAULT '[]'::jsonb,
  triggers jsonb DEFAULT '[]'::jsonb,
  medications_taken jsonb DEFAULT '[]'::jsonb,
  medication_relief_minutes int,
  notes text,
  cycle_phase text,
  hit6_score int,
  midas_grade text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_headache_attacks_started
  ON headache_attacks (started_at);

CREATE INDEX IF NOT EXISTS idx_headache_attacks_cycle_phase
  ON headache_attacks (cycle_phase);
