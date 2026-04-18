-- 014b_headache_attacks_drift.sql
--
-- Idempotent drift-repair for prod Supabase. The prod database has a
-- pre-014 headache_attacks table with a different (older) shape than
-- what the app code expects, and plain CREATE TABLE IF NOT EXISTS
-- cannot update it. This script drops the old empty table (verified
-- empty on 2026-04-17) and recreates it with the migration-014 schema
-- plus the hit6/midas columns the app code reads.
--
-- HOW TO RUN:
--   1. Open Supabase Studio > SQL Editor
--   2. Paste this entire file
--   3. Click Run
--
-- Safety: the DROP is guarded by a row-count check. If the existing
-- table ever gains data, the script aborts rather than silently
-- deleting it.

DO $$
DECLARE
  existing_rows bigint;
BEGIN
  SELECT count(*) INTO existing_rows
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'headache_attacks';

  IF existing_rows > 0 THEN
    EXECUTE 'SELECT count(*) FROM public.headache_attacks' INTO existing_rows;
    IF existing_rows > 0 THEN
      RAISE EXCEPTION
        'headache_attacks has % rows. Refusing to drop. '
        'Manually migrate data before rerunning this script.',
        existing_rows;
    END IF;
    EXECUTE 'DROP TABLE public.headache_attacks CASCADE';
  END IF;
END
$$;

CREATE TABLE public.headache_attacks (
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
  ON public.headache_attacks (started_at);

CREATE INDEX IF NOT EXISTS idx_headache_attacks_cycle_phase
  ON public.headache_attacks (cycle_phase);

-- Verification query. Should return the 15 expected columns.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'headache_attacks'
ORDER BY ordinal_position;
