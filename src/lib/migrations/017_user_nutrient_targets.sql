-- 017_user_nutrient_targets.sql
-- Per-nutrient, per-patient intake targets. Seed values for the 25
-- priority nutrients come from nutrients-list.ts (NIH ODS RDAs for
-- adult females 19-30). Presets (endo, pots, thyroid, iron-deficiency)
-- write additional rows with source='preset:<name>'. User overrides
-- write source='user'. Application resolver prefers user > preset > rda.
--
-- Additive migration: creates one new table, nothing else mutated.
-- food_entries and lab_results remain READ-ONLY for this table path.

CREATE TABLE IF NOT EXISTS user_nutrient_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL DEFAULT 'lanae',
  nutrient TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  target_unit TEXT NOT NULL,
  source TEXT NOT NULL,
  rationale TEXT,
  citation TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (patient_id, nutrient)
);

CREATE INDEX IF NOT EXISTS idx_user_nutrient_targets_patient
  ON user_nutrient_targets (patient_id);

CREATE INDEX IF NOT EXISTS idx_user_nutrient_targets_source
  ON user_nutrient_targets (source);

CREATE INDEX IF NOT EXISTS idx_user_nutrient_targets_active
  ON user_nutrient_targets (patient_id, active)
  WHERE active = TRUE;
