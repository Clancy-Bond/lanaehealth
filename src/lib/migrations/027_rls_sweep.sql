-- Migration 027: RLS sweep
--
-- Defense-in-depth: enables row-level security on every app-owned
-- table and adds a conservative policy set. Service-role bypasses
-- RLS unconditionally (Supabase behavior) so existing server-side
-- code that uses createServiceClient() continues to work unchanged.
-- Anonymous / authenticated-role connections are locked down.
--
-- Supabase service-role DDL is blocked by PostgREST (see prior
-- MIGRATION_011_APPLY.md discovery). Apply this file by pasting it
-- into the Supabase dashboard SQL editor and running it. It is
-- idempotent: every statement uses IF NOT EXISTS or DO-block guards.
--
-- Zero data-loss: this migration does NOT alter, drop, or move any
-- data. It only toggles RLS flags and adds deny-by-default policies.
--
-- Applied: PENDING (paste into dashboard and set to APPLIED when done)
-- Security sweep reference: docs/security/2026-04-19-sweep/track-a-auth-database.md

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
    'nc_imported',
    'documents',
    'chat_messages',
    'analysis_runs',
    'analysis_findings',
    'medical_identifiers',
    'api_cache',
    'gene_disease_network',
    'food_nutrient_cache',
    'oura_tokens',
    'context_summaries',
    'session_handoffs',
    'health_profile',
    'medical_narrative',
    'medical_timeline',
    'active_problems',
    'imaging_studies',
    'correlation_results',
    'health_embeddings',
    'user_preferences',
    'integration_tokens',
    'import_history',
    'push_subscriptions',
    'orthostatic_tests',
    'headache_attacks',
    'weather_daily',
    'cycle_engine_state',
    'user_nutrient_targets',
    'daily_logs_energy',
    'micro_care_completions',
    'lite_log_activities',
    'privacy_prefs',
    'medical_expenses',
    'user_onboarding',
    'custom_trackables',
    'bowel_movements',
    'favorites',
    'mood',
    'gratitude',
    'share_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Only act on tables that actually exist in this database. Some
    -- names in the array above are speculative (they appear in
    -- application code but may not all be provisioned yet).
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      -- Deny-by-default for anon. Service-role bypasses RLS
      -- automatically, which is why our server code keeps working.
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        t || '_deny_anon',
        t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
        t || '_deny_anon',
        t
      );

      -- Allow authenticated role read+write (single-patient app;
      -- authorization happens in requireAuth at the API boundary).
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        t || '_authed_all',
        t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t || '_authed_all',
        t
      );
    END IF;
  END LOOP;
END$$;

-- Verification: after applying, run this query to confirm every
-- listed table has rowsecurity = true. Any row with rowsecurity=false
-- means the table did not exist when the migration ran; re-run after
-- creating it.
--
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname='public' ORDER BY tablename;
