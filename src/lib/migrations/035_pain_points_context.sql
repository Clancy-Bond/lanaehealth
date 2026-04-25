-- Migration 035: Multi-dimensional pain context on pain_points
--
-- Adds a JSONB context column to capture clinically validated
-- multi-dimensional pain data without breaking existing pain_points
-- consumers.
--
-- The new /v2/log/pain surface implements:
--   * NRS 0-10 (canonical, written to daily_logs.overall_pain)
--   * Wong-Baker FACES alternative (also stored as 0-10)
--   * MPQ sensory descriptors (chip multi-select for "quality")
--   * PEG-style functional interference (2 sliders 0-10; intensity
--     stays on daily_logs.overall_pain)
--   * HIT-6-style severity question for migraine days
--   * COMPASS-31 orthostatic micro-question for POTS days
--
-- Validation citations live in code comments next to each component
-- and in /tmp/pain-scales-research.md.
--
-- pain_points already carries: x, y, body_region, intensity,
-- pain_type, duration_minutes. The new context_json column adds the
-- PEG / HIT-6 / COMPASS dimensions plus a list of MPQ qualities so a
-- single pain_point row can hold the full snapshot.
--
-- Shape (TypeScript: PainContextJson):
--   {
--     scale_used: 'nrs' | 'faces',
--     qualities: PainQuality[],          -- MPQ-derived chips
--     peg?: { enjoyment: number, activity: number },
--     hit6_severity?: 'never' | 'rarely' | 'sometimes' | 'very_often' | 'always',
--     compass_orthostatic?: 'none' | 'mild' | 'moderate' | 'severe',
--     trigger_guess?: string             -- free-text user note
--   }
--
-- Zero data loss: pure ADD COLUMN with a JSONB DEFAULT '{}'.
-- Existing rows still load. Existing consumers ignore the column.
--
-- Idempotent via IF NOT EXISTS.

ALTER TABLE pain_points
  ADD COLUMN IF NOT EXISTS context_json jsonb DEFAULT '{}'::jsonb;

-- A GIN index lets us filter by quality or scale later (e.g. all
-- pain_points where context_json->'qualities' contains 'throbbing').
CREATE INDEX IF NOT EXISTS pain_points_context_json_gin
  ON pain_points USING GIN (context_json);
