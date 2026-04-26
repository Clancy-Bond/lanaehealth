-- Migration 041: per-user uniqueness on health_profile.section.
--
-- The original schema (Migration 001) made `section` globally UNIQUE.
-- That was correct for the single-user era (only Lanae's rows existed).
-- Multi-user (PR #69 + #86 + #92) means two users can both have a
-- 'personal' section, a 'medications' section, etc. Without a per-user
-- constraint, the second user's upsert collides on the global UNIQUE.
--
-- This migration:
--   1. Drops the global `section UNIQUE` constraint (if present).
--   2. Adds a `(user_id, section) UNIQUE` constraint so each user has
--      at most one row per section. Rows with NULL user_id (legacy
--      pre-#86 inserts) are excluded by the partial index, so they
--      keep working until backfilled.
--
-- Pure additive plus a swap of one constraint. ZERO data loss.
-- Idempotent: the DROP is conditional and the new index uses
-- IF NOT EXISTS.
--
-- After this lands, application code can use
--   `.upsert(row, { onConflict: 'user_id,section' })`
-- and two users uploading the same section never collide.

DO $$
BEGIN
  -- Drop the legacy global UNIQUE on section if it still exists.
  -- The constraint name follows Postgres' default
  -- table_column_key naming, but we look it up generically in case
  -- a DBA named it manually.
  PERFORM 1
    FROM pg_constraint
    WHERE conrelid = 'public.health_profile'::regclass
      AND contype  = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(section)';
  IF FOUND THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.health_profile DROP CONSTRAINT ' || quote_ident(conname)
      FROM pg_constraint
      WHERE conrelid = 'public.health_profile'::regclass
        AND contype  = 'u'
        AND pg_get_constraintdef(oid) ILIKE '%(section)'
      LIMIT 1
    );
  END IF;
END $$;

-- Per-user uniqueness. Partial index: only enforce when user_id is
-- present so legacy rows with NULL user_id (the single-user era) do
-- not block this migration. The PR #86 backfill should have already
-- populated user_id for every existing row, but we stay defensive.
CREATE UNIQUE INDEX IF NOT EXISTS health_profile_user_section_uq
  ON public.health_profile (user_id, section)
  WHERE user_id IS NOT NULL;

COMMENT ON INDEX public.health_profile_user_section_uq IS
  'Per-user uniqueness on (user_id, section) so each user has at most one row per profile section. Migration 041.';
