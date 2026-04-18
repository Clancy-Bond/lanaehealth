-- Migration 025: privacy_prefs
--
-- Backs the Wave 2e F10 privacy settings panel. One row per patient
-- (single-patient app for now, default patient_id 'lanae'). Controls
-- three independent toggles:
--
--   - allow_claude_context:      Hard gate on src/lib/context/assembler.ts.
--     When false, NO patient data (permanent core, handoff, summaries,
--     KB, retrieval) is injected into Claude API calls. The static
--     system prompt is still sent, but the dynamic context is empty.
--   - allow_correlation_analysis: Gates the background correlation job
--     in src/lib/intelligence/correlations.ts. When false, new rows
--     are not computed; existing rows are unaffected.
--   - retain_history_beyond_2y:   Reserved for future retention sweep.
--     Defaults true; a future cron will prune older rows when false.
--
-- Schema notes:
--   - patient_id: PRIMARY KEY, defaults to 'lanae'. Upsert on this key.
--   - Each boolean defaults to true so the app behaves identically to
--     pre-migration behavior until the user explicitly opts out.
--   - updated_at: refreshed via the application layer on every toggle.
--
-- The table is additive. Zero existing rows are touched anywhere.
-- Safe to re-run; all DDL uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS privacy_prefs (
  patient_id text PRIMARY KEY DEFAULT 'lanae',
  allow_claude_context boolean NOT NULL DEFAULT true,
  allow_correlation_analysis boolean NOT NULL DEFAULT true,
  retain_history_beyond_2y boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the default 'lanae' row so the app has something to read even
-- before the user visits /settings/privacy. Insert is a no-op if the
-- row already exists.
INSERT INTO privacy_prefs (patient_id)
  VALUES ('lanae')
  ON CONFLICT (patient_id) DO NOTHING;
