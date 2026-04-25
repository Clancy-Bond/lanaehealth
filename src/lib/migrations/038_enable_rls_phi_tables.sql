-- Migration 038: Enforce RLS on the 22 PHI tables.
-- See commit message for full context.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'daily_logs','pain_points','symptoms','cycle_entries','food_entries',
    'oura_daily','lab_results','appointments','documents','chat_messages',
    'analysis_runs','analysis_findings','medical_identifiers','health_profile',
    'medical_narrative','medical_timeline','active_problems','imaging_studies',
    'correlation_results','health_embeddings','context_summaries','session_handoffs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_authed_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_deny_anon', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)', t || '_deny_anon', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_user_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t || '_user_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_user_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t || '_user_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_user_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t || '_user_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_user_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t || '_user_delete', t);
  END LOOP;
END $$;
