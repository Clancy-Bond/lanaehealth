-- Migration 021: micro_care_completions
--
-- Records each time Lanae taps through a 30-second micro-care action
-- (salt tablet, hydrate, box breathing, 5-4-3-2-1 grounding, etc.).
--
-- IMPORTANT (non-shaming voice rule):
--   This table is for POSITIVE self-reported behavior tracking only.
--   It must NEVER be used to compute streaks, adherence percentages,
--   or deficit framing in Lanae's UI. A missed tap is not a failure.
--   "Quick action. 30 seconds." - that is the entire mental model.
--
-- Schema notes:
--   - patient_id: text, defaults to 'lanae' (single-patient app for now).
--   - action_slug: the registry slug from src/lib/micro-care/actions.ts
--     (e.g. 'salt-tablet', 'elevate-legs', 'box-breathing').
--   - completed_at: timestamptz, when the action finished (or was logged
--     without running the in-app timer).
--   - duration_seconds: optional, populated when an in-app timer ran.
--   - felt_better: optional tri-state (true/false/null). Never required.
--   - notes: optional free text; not surfaced in UI for now.
--
-- The table is entirely additive. Zero existing data is touched. Safe
-- to re-run; all DDL uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS micro_care_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL DEFAULT 'lanae',
  action_slug text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds int,
  felt_better boolean,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_micro_care_completions_completed_at
  ON micro_care_completions (completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_micro_care_completions_action_slug
  ON micro_care_completions (action_slug);
