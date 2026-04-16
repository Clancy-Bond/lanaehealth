-- Migration 010: Integration Hub tokens table
-- Stores OAuth tokens for all wearable/app integrations
-- All changes are ADDITIVE ONLY

-- ── Integration Tokens ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id text NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  scopes text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_tokens_id ON integration_tokens(integration_id);

-- ── Import History (tracks all universal imports) ──────────────────
CREATE TABLE IF NOT EXISTS import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  format text NOT NULL,
  file_name text,
  source_app text,
  records_imported integer DEFAULT 0,
  records_by_type jsonb DEFAULT '{}',
  date_range_start date,
  date_range_end date,
  warnings text[] DEFAULT '{}',
  errors text[] DEFAULT '{}',
  imported_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_history_date ON import_history(imported_at DESC);

-- ── User Preferences (modular feature system) ─────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_archetype text CHECK (user_archetype IN ('aggregator', 'power_tracker', 'condition_manager', 'health_curious')),
  enabled_modules text[] DEFAULT '{}',
  conditions text[] DEFAULT '{}',
  connected_apps text[] DEFAULT '{}',
  log_section_order text[] DEFAULT '{}',
  hidden_sections text[] DEFAULT '{}',
  onboarding_completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
