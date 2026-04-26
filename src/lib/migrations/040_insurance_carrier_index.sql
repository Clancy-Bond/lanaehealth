-- Migration 040: insurance carrier lookup index on health_profile.
--
-- Per user direction (2026-04-25, "page for every insurance in the
-- book"): the insurance navigator now ships dedicated guides for 12
-- major US carriers + 2 government programs, plus the existing HMSA
-- QUEST baseline. The hub deep-links to the user's carrier page when
-- saved, and the AI chat permanent-core injects the carrier name so
-- advice can be tailored.
--
-- Storage stays in the existing EAV health_profile table to keep the
-- single-row-per-section pattern intact:
--
--   row: { section: 'insurance', content: { planSlug, memberId?, notes? } }
--
-- This migration only adds a partial GIN index on the JSON path so
-- carrier lookups are fast even as the table grows. Pure additive,
-- ZERO data loss, no schema changes to existing columns. Idempotent.
--
-- Future extension hook: if we ever migrate to a typed
-- insurance_carrier column, this index will be dropped first.

CREATE INDEX IF NOT EXISTS health_profile_insurance_plan_idx
  ON public.health_profile ((content->>'planSlug'))
  WHERE section = 'insurance';
