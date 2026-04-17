-- 013_orthostatic_tests.sql
-- Tracks active-stand / tilt tests for POTS workup.
-- A test is "positive" when standing_hr_peak - resting_hr >= 30 bpm
-- sustained for 10 minutes. Three positives on separate days
-- ≥2 weeks apart meet POTS diagnostic criteria.

CREATE TABLE IF NOT EXISTS orthostatic_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_date DATE NOT NULL,
  test_time TIME NOT NULL DEFAULT (now()::time),

  resting_hr_bpm INTEGER NOT NULL,
  resting_bp_systolic INTEGER,
  resting_bp_diastolic INTEGER,

  standing_hr_1min INTEGER,
  standing_hr_3min INTEGER,
  standing_hr_5min INTEGER,
  standing_hr_10min INTEGER,
  standing_bp_systolic_10min INTEGER,
  standing_bp_diastolic_10min INTEGER,

  -- Peak rise computed server-side: max(standing_*) - resting_hr_bpm
  peak_rise_bpm INTEGER GENERATED ALWAYS AS (
    GREATEST(
      COALESCE(standing_hr_1min, 0),
      COALESCE(standing_hr_3min, 0),
      COALESCE(standing_hr_5min, 0),
      COALESCE(standing_hr_10min, 0)
    ) - resting_hr_bpm
  ) STORED,

  symptoms_experienced TEXT,  -- dizziness, lightheaded, palpitations, etc.
  notes TEXT,
  hydration_ml INTEGER,       -- water intake in the 2 hours prior
  caffeine_mg INTEGER,        -- caffeine consumed in the 2 hours prior

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orthostatic_test_date
  ON orthostatic_tests (test_date DESC);

CREATE INDEX IF NOT EXISTS idx_orthostatic_peak_rise
  ON orthostatic_tests (peak_rise_bpm DESC);
