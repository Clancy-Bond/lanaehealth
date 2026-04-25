-- Migration 039: user_recipes table for Edamam + URL imports.
--
-- Per user direction (2026-04-24): "millions of recipes and foods, that
-- have been put in with all the weights that you possibly can use."
-- PR #67 covered foods via Open Food Facts. This migration adds the
-- recipe equivalent: a user-scoped table that holds recipes imported
-- from Edamam Recipe Search API or scraped from URLs. The existing
-- legacy custom recipes (health_profile.section='recipes') continue
-- to coexist untouched.
--
-- Design choice: a separate table (not health_profile section) for two
-- reasons:
--   1) Volume. A user can save hundreds of recipes; the
--      single-jsonb-document pattern in health_profile starts to hurt
--      at that size.
--   2) Source provenance. We need to remember whether each recipe came
--      from Edamam, a user-pasted URL, or hand-entered, plus the
--      external id for re-fetching nutrition updates.
--
-- ZERO data loss: pure CREATE TABLE IF NOT EXISTS plus indexes. Does
-- not touch any existing rows. Does not enable RLS in this migration
-- (RLS sweep is tracked separately).
--
-- Idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.user_recipes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  source      text NOT NULL CHECK (source IN ('edamam', 'user_url', 'user_custom')),
  source_id   text,
  name        text NOT NULL,
  data        jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_recipes_user_id_idx
  ON public.user_recipes(user_id);

CREATE INDEX IF NOT EXISTS user_recipes_source_id_idx
  ON public.user_recipes(source, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_recipes_created_at_idx
  ON public.user_recipes(created_at DESC);
