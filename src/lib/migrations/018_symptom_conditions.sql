-- Migration 018: symptom_conditions
--
-- Additive junction table that tags each row in `symptoms` with zero or
-- more rows from `active_problems`. This lets the doctor-prep views
-- (SpecialistToggle + DataFindings + QuickTimeline) filter symptoms by
-- condition so an OB/GYN sees pelvic/menstrual symptoms while a
-- cardiologist sees POTS-tagged symptoms.
--
-- Additive-migration guarantees (enforced by review):
--   - `symptoms` and `active_problems` are NOT touched. No columns are
--     added, no rows are updated, no schema changes anywhere else.
--   - All DDL uses IF NOT EXISTS. Safe to re-run.
--   - Foreign keys guarantee referential integrity. ON DELETE CASCADE
--     cleans up tags when a parent row is removed. In practice both
--     parent tables are append-only for Lanae, so cascade never fires.
--
-- Confidence tier:
--   'explicit' - the user tagged the symptom from the ConditionTagSelector.
--   'inferred' - a rule or heuristic tagged it (future; not used yet).
--
-- A symptom that is tagged to zero conditions is intentionally left
-- orphaned. The doctor views treat "no tags" as "visible everywhere"
-- so existing 1,490 days of legacy symptoms continue to surface under
-- the PCP catch-all view without any backfill.

CREATE TABLE IF NOT EXISTS symptom_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_id uuid NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
  condition_id uuid NOT NULL REFERENCES active_problems(id) ON DELETE CASCADE,
  confidence text NOT NULL DEFAULT 'explicit'
    CHECK (confidence IN ('explicit', 'inferred')),
  tagged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symptom_id, condition_id)
);

CREATE INDEX IF NOT EXISTS idx_symptom_conditions_symptom_id
  ON symptom_conditions (symptom_id);

CREATE INDEX IF NOT EXISTS idx_symptom_conditions_condition_id
  ON symptom_conditions (condition_id);

CREATE INDEX IF NOT EXISTS idx_symptom_conditions_tagged_at
  ON symptom_conditions (tagged_at DESC);
