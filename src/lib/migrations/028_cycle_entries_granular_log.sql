-- Migration 028: Granular daily logging on cycle_entries
--
-- Adds 4 nullable columns to capture NC-style granular symptom + activity logging
-- on cycle_entries. All columns are nullable so existing rows remain valid and
-- the /api/cycle/log pre-migration fallback pattern (retry without new columns
-- on "column does not exist" error) still works cleanly.
--
-- Columns:
--   symptoms          text[]  general symptom tags (cramping, backache, headache, etc.)
--   sex_activity_type text    enum-lite: 'none' | 'vaginal_protected' | 'vaginal_unprotected' | 'other'
--   skin_state        text    enum-lite: 'dry' | 'oily' | 'puffy' | 'acne' | 'glowing' | 'normal'
--   mood_emoji        text    single-char emoji string
--
-- Zero data loss: all columns default NULL. Existing rows are untouched.

ALTER TABLE cycle_entries
  ADD COLUMN IF NOT EXISTS symptoms text[],
  ADD COLUMN IF NOT EXISTS sex_activity_type text,
  ADD COLUMN IF NOT EXISTS skin_state text,
  ADD COLUMN IF NOT EXISTS mood_emoji text;

-- Useful for querying "did the user have X symptom this cycle?" without full-scan.
CREATE INDEX IF NOT EXISTS idx_cycle_entries_symptoms_gin
  ON cycle_entries USING GIN (symptoms);
