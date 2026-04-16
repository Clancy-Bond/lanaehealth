-- 011_endometriosis_mode.sql
--
-- Adds endometriosis-specific tracking fields to cycle_entries.
-- These fields are optional and only surfaced when the user has
-- endometriosis in their conditions array (user_preferences).
--
-- Research basis:
-- - Bowel symptoms (dyschezia) occur in 40-60% of endo patients
-- - Bladder symptoms (dysuria) in 15-40%
-- - Dyspareunia (deep painful intercourse) in 40-70%
-- - Clot tracking for heavy menstrual bleeding (HMB) assessment
--
-- Following the ZERO data loss rule: adding new nullable columns only.

ALTER TABLE cycle_entries
  ADD COLUMN IF NOT EXISTS bowel_symptoms text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bladder_symptoms text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dyspareunia boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dyspareunia_intensity smallint CHECK (dyspareunia_intensity IS NULL OR (dyspareunia_intensity BETWEEN 0 AND 10)),
  ADD COLUMN IF NOT EXISTS clots_present boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS clot_size text CHECK (clot_size IS NULL OR clot_size IN ('small', 'medium', 'large', 'very_large')),
  ADD COLUMN IF NOT EXISTS clot_count smallint,
  ADD COLUMN IF NOT EXISTS endo_notes text;

-- Index to help query endo-heavy-bleeding patterns for clinical reports
CREATE INDEX IF NOT EXISTS idx_cycle_entries_clots
  ON cycle_entries (date, clots_present)
  WHERE clots_present = true;
