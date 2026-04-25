-- Migration 036: extend medical_narrative for structured user corrections.
--
-- The data-correction UI writes user-supplied fixes (e.g. "Oura missed
-- last night, I actually slept 7h45m, not 0h") as additive rows in
-- medical_narrative. The narrative table already exists and is read by
-- the Layer 1 permanent-core generator on every Claude API call, which
-- is exactly the durability surface we want for "remembers forever".
--
-- This migration only ADDS columns. No row is rewritten. No column is
-- dropped. Idempotent (safe to re-run). Backwards compatible: all
-- existing reads of medical_narrative ignore unknown columns.
--
-- New columns
-- -----------
--   kind         text    discriminates correction rows from other
--                        narrative content. NULL = legacy free-form
--                        section. 'user_correction' = correction row.
--   metadata     jsonb   structured payload for corrections:
--                          { tableName, rowId, fieldName,
--                            originalValue, correctedValue, reason,
--                            source }
--                        Generic jsonb so future kinds can co-exist.
--   created_at   timestamptz  insertion time. medical_narrative had
--                        only updated_at; we want "when did the user
--                        first record this correction" preserved
--                        independent of any later edits.
--
-- Indexes
-- -------
--   idx on (kind) so the corrections reader can scan only correction
--   rows in O(log n) without table-scanning years of free-form
--   narrative.
--   GIN on metadata so we can filter corrections by tableName +
--   rowId without unpacking jsonb in the where clause.

ALTER TABLE public.medical_narrative
  ADD COLUMN IF NOT EXISTS kind TEXT;

ALTER TABLE public.medical_narrative
  ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE public.medical_narrative
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_medical_narrative_kind
  ON public.medical_narrative (kind);

CREATE INDEX IF NOT EXISTS idx_medical_narrative_metadata
  ON public.medical_narrative USING GIN (metadata);

-- Existing rows do not have created_at populated. Backfill to
-- updated_at so the column has values for every row, then leave the
-- DEFAULT NOW() in place for new inserts.
UPDATE public.medical_narrative
  SET created_at = COALESCE(created_at, updated_at, NOW())
  WHERE created_at IS NULL;
