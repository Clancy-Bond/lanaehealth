-- Migration 035: add user_id columns to PHI tables (additive only).
--
-- Productization step 1: prepare PHI tables for multi-user. This
-- migration ONLY adds columns and indexes. No existing rows are
-- modified. No RLS is enabled. No service-role bypass changes.
--
-- A separate backfill (035_backfill_lanae_user_id.sql, run AFTER
-- the live Lanae auth.users row exists) will tag her existing rows
-- with her user_id. RLS enforcement is the next PR.
--
-- All ALTER TABLE ... ADD COLUMN IF NOT EXISTS statements are
-- idempotent. Safe to re-run.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'daily_logs',
    'pain_points',
    'symptoms',
    'cycle_entries',
    'food_entries',
    'oura_daily',
    'lab_results',
    'appointments',
    'documents',
    'chat_messages',
    'analysis_runs',
    'analysis_findings',
    'medical_identifiers',
    'health_profile',
    'medical_narrative',
    'medical_timeline',
    'active_problems',
    'imaging_studies',
    'correlation_results',
    'health_embeddings',
    'context_summaries',
    'session_handoffs'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id)',
        t || '_user_id_idx', t
      );
      RAISE NOTICE 'user_id added to %', t;
    ELSE
      RAISE NOTICE 'skipping % (table not present)', t;
    END IF;
  END LOOP;
END $$;
