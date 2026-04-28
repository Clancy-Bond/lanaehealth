-- Migration 048: enable RLS + canonical owner policies on user_recipes.
--
-- Migration 039_recipes_table.sql created public.user_recipes intentionally
-- WITHOUT enabling RLS, deferring the security sweep to a follow-up. This
-- IS that follow-up.
--
-- Same canonical policy shape as the 22 PHI tables in 038:
--   <table>_deny_anon         FOR ALL TO anon USING (false) WITH CHECK (false)
--   <table>_user_select       FOR SELECT TO authenticated USING (auth.uid() = user_id)
--   <table>_user_insert       FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)
--   <table>_user_update       FOR UPDATE TO authenticated USING (...) WITH CHECK (...)
--   <table>_user_delete       FOR DELETE TO authenticated USING (auth.uid() = user_id)
--
-- service_role has rolbypassrls=true so server-side route handlers using
-- createServiceClient continue to read/write user_recipes without policy
-- evaluation. The policies guard any future code path that uses the anon
-- key with a user JWT.
--
-- Idempotent: ENABLE RLS is a no-op on a table that already has it on,
-- and every policy is wrapped in DROP POLICY IF EXISTS first.

ALTER TABLE public.user_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_recipes_deny_anon ON public.user_recipes;
CREATE POLICY user_recipes_deny_anon
  ON public.user_recipes FOR ALL TO anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS user_recipes_user_select ON public.user_recipes;
CREATE POLICY user_recipes_user_select
  ON public.user_recipes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_recipes_user_insert ON public.user_recipes;
CREATE POLICY user_recipes_user_insert
  ON public.user_recipes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_recipes_user_update ON public.user_recipes;
CREATE POLICY user_recipes_user_update
  ON public.user_recipes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_recipes_user_delete ON public.user_recipes;
CREATE POLICY user_recipes_user_delete
  ON public.user_recipes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
