-- ============================================================
-- Migration 001: Context Engine Tables
-- Creates 8 new tables for the LanaeHealth context engine.
-- Uses IF NOT EXISTS to be safe against re-runs.
-- Does NOT modify or delete any existing tables.
-- ============================================================

-- 1. context_summaries - Pre-computed AI summaries for Layer 2
CREATE TABLE IF NOT EXISTS context_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(50) NOT NULL UNIQUE,
  content TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  data_range_start DATE,
  data_range_end DATE,
  token_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_context_summaries_topic ON context_summaries (topic);

-- 2. session_handoffs - Cross-session continuity
CREATE TABLE IF NOT EXISTS session_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type VARCHAR(30) NOT NULL,
  what_accomplished TEXT NOT NULL,
  what_discovered TEXT NOT NULL,
  what_left_undone TEXT NOT NULL,
  next_session_needs TEXT NOT NULL,
  user_messages_verbatim JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_handoffs_created_at ON session_handoffs (created_at DESC);

-- 3. health_profile - Structured patient profile (replaces hardcoded JSON)
CREATE TABLE IF NOT EXISTS health_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section VARCHAR(50) NOT NULL UNIQUE,
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(50) DEFAULT 'user'
);

-- 4. medical_narrative - Free-form story sections
CREATE TABLE IF NOT EXISTS medical_narrative (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  section_order INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_narrative_section_order ON medical_narrative (section_order);

-- 5. medical_timeline - Key medical events
CREATE TABLE IF NOT EXISTS medical_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('diagnosis', 'symptom_onset', 'test', 'medication_change', 'appointment', 'imaging', 'hospitalization')),
  title VARCHAR(300) NOT NULL,
  description TEXT,
  significance VARCHAR(20) DEFAULT 'normal' CHECK (significance IN ('normal', 'important', 'critical')),
  linked_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_timeline_event_date ON medical_timeline (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_medical_timeline_event_type ON medical_timeline (event_type);

-- 6. active_problems - Unresolved medical issues
CREATE TABLE IF NOT EXISTS active_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem VARCHAR(300) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'improving', 'resolved')),
  onset_date DATE,
  latest_data TEXT,
  linked_diagnoses TEXT[],
  linked_symptoms TEXT[],
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. imaging_studies - Radiology metadata
CREATE TABLE IF NOT EXISTS imaging_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_date DATE NOT NULL,
  modality VARCHAR(20) NOT NULL CHECK (modality IN ('CT', 'XR', 'MRI', 'US')),
  body_part VARCHAR(100) NOT NULL,
  indication TEXT,
  findings_summary TEXT,
  raw_data_path TEXT,
  report_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imaging_studies_study_date ON imaging_studies (study_date DESC);

-- 8. correlation_results - Pre-computed pattern analysis
CREATE TABLE IF NOT EXISTS correlation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_a VARCHAR(100) NOT NULL,
  factor_b VARCHAR(100) NOT NULL,
  correlation_type VARCHAR(30) NOT NULL CHECK (correlation_type IN ('spearman', 'mann_whitney', 'granger', 'event_triggered')),
  coefficient REAL,
  p_value REAL,
  effect_size REAL,
  effect_description TEXT,
  confidence_level VARCHAR(20) CHECK (confidence_level IN ('suggestive', 'moderate', 'strong')),
  sample_size INTEGER,
  lag_days INTEGER DEFAULT 0,
  cycle_phase VARCHAR(20),
  passed_fdr BOOLEAN DEFAULT FALSE,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correlation_results_confidence ON correlation_results (confidence_level);
