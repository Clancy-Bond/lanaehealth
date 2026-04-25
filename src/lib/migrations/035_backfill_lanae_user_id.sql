-- Migration 035 backfill: link Lanae's existing PHI rows to her
-- Supabase auth.users id.
--
-- Run this AFTER:
--   1. 035_user_id_phi_tables.sql has applied
--   2. Lanae has signed up via /v2/signup with her email
--      (LANAE_EMAIL env var, defaults to lanae@lanaehealth.dev)
--
-- Idempotent: only fills rows where user_id IS NULL.

DO $$
DECLARE
  lanae_email text := COALESCE(current_setting('lanae.email', true), 'lanae@lanaehealth.dev');
  lanae_id uuid;
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
  affected bigint;
  total bigint := 0;
BEGIN
  SELECT id INTO lanae_id FROM auth.users WHERE email = lanae_email LIMIT 1;
  IF lanae_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row for % - sign up first via /v2/signup', lanae_email;
  END IF;

  RAISE NOTICE 'Backfilling user_id = % for owner email %', lanae_id, lanae_email;

  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'UPDATE public.%I SET user_id = $1 WHERE user_id IS NULL',
        t
      ) USING lanae_id;
      GET DIAGNOSTICS affected = ROW_COUNT;
      total := total + affected;
      RAISE NOTICE '  %: % rows', t, affected;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % rows tagged with user_id %', total, lanae_id;
END $$;
