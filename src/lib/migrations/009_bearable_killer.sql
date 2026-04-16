-- Migration 009: Bearable Killer - New tables for mood, custom trackables, sleep details, gratitude, weather, clinical scales, medication reminders, onboarding
-- All changes are ADDITIVE ONLY - no existing tables modified or deleted

-- ── Mood Entries ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mood_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  mood_score integer NOT NULL CHECK (mood_score >= 1 AND mood_score <= 5),
  emotions text[] DEFAULT '{}',
  logged_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mood_entries_log_id ON mood_entries(log_id);

-- ── Custom Trackables (definitions) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_trackables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('symptom', 'factor', 'activity', 'supplement', 'other')),
  input_type text NOT NULL CHECK (input_type IN ('toggle', 'scale_5', 'scale_10', 'number', 'text')),
  icon text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name)
);

-- ── Custom Trackable Entries (daily values) ─────────────────────────
CREATE TABLE IF NOT EXISTS custom_trackable_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  trackable_id uuid NOT NULL REFERENCES custom_trackables(id) ON DELETE CASCADE,
  value numeric,
  text_value text,
  toggled boolean,
  logged_at timestamptz DEFAULT now(),
  UNIQUE(log_id, trackable_id)
);
CREATE INDEX IF NOT EXISTS idx_custom_trackable_entries_log_id ON custom_trackable_entries(log_id);

-- ── Sleep Details ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sleep_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  bedtime timestamptz,
  wake_time timestamptz,
  sleep_latency_min integer,
  wake_episodes jsonb DEFAULT '[]',
  sleep_quality_factors text[] DEFAULT '{}',
  naps jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(log_id)
);

-- ── Gratitude Entries ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gratitude_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  content text NOT NULL,
  entry_type text DEFAULT 'gratitude' CHECK (entry_type IN ('gratitude', 'win', 'positive')),
  logged_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gratitude_entries_log_id ON gratitude_entries(log_id);

-- ── Weather Daily ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weather_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  barometric_pressure_hpa numeric,
  temperature_c numeric,
  humidity_pct numeric,
  weather_code text,
  description text,
  fetched_at timestamptz DEFAULT now()
);

-- ── Clinical Scale Responses ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinical_scale_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scale_type text NOT NULL CHECK (scale_type IN ('PHQ-9', 'GAD-7', 'PROMIS-Pain', 'PROMIS-Fatigue')),
  date date NOT NULL,
  responses jsonb NOT NULL,
  total_score integer NOT NULL,
  severity text CHECK (severity IN ('minimal', 'mild', 'moderate', 'moderately_severe', 'severe')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinical_scale_date ON clinical_scale_responses(date);

-- ── Medication Reminders ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medication_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_name text NOT NULL,
  reminder_times jsonb DEFAULT '[]',
  days_of_week integer[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ── User Onboarding ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conditions text[] DEFAULT '{}',
  tracking_goals text[] DEFAULT '{}',
  onboarding_step integer DEFAULT 0,
  completed_at timestamptz,
  log_section_order text[] DEFAULT '{}',
  hidden_sections text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ── New columns on daily_logs (all nullable, safe additive change) ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_logs' AND column_name = 'mood_score') THEN
    ALTER TABLE daily_logs ADD COLUMN mood_score integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_logs' AND column_name = 'log_period') THEN
    ALTER TABLE daily_logs ADD COLUMN log_period text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_logs' AND column_name = 'completed_sections') THEN
    ALTER TABLE daily_logs ADD COLUMN completed_sections text[] DEFAULT '{}';
  END IF;
END $$;
