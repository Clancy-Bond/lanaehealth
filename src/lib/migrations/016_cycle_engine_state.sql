-- 016_cycle_engine_state.sql
-- Cached per-cycle state for the multi-signal cycle intelligence engine.
-- Reimplements the Natural Cycles algorithm (cover line + biphasic shift +
-- six-day fertile window per Scherwitzl 2015 / 2017, FDA DEN170052) extended
-- with Oura HRV/RHR signals.
--
-- CONSTRAINT: this table is write-forward-only. Past predictions are never
-- retroactively mutated. New data arriving for a cycle writes a NEW row
-- with an incremented computation_number. The most recent row per
-- cycle_start_date is the current truth, older rows are audit history.
-- Rationale: NC's retroactive silent day re-coloring damaged user trust
-- (see docs/competitive/natural-cycles/patterns.md section 2).
--
-- References:
--   Scherwitzl et al. 2015, Eur J Contracept Reprod Health Care
--     PMID 25592280
--   Scherwitzl et al. 2017, Contraception, PMC5669828
--   FDA De Novo DEN170052, August 2018

CREATE TABLE IF NOT EXISTS cycle_engine_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL DEFAULT 'lanae',

  -- Cycle identity
  cycle_start_date DATE NOT NULL,
  cycle_end_date DATE,          -- null until the next period starts
  cycle_number INTEGER,         -- sequential count, e.g. 42 = Lanae's 42nd tracked cycle

  -- Cover line (follicular baseline + 0.05-0.1 C per Scherwitzl 2015)
  follicular_baseline_c NUMERIC(5,3),
  cover_line_c NUMERIC(5,3),
  baseline_days_used INTEGER,   -- how many follicular readings contributed

  -- Ovulation
  predicted_ovulation_date DATE,
  confirmed_ovulation_date DATE,      -- set only after three elevated readings
  ovulation_uncertainty_days INTEGER, -- +/- band width
  lh_surge_date DATE,                 -- LH+ day if recorded

  -- Fertile window (six days: ovulation - 5 through ovulation + 1)
  fertile_window_start DATE,
  fertile_window_end DATE,

  -- Next period prediction
  predicted_period_start DATE,
  period_uncertainty_days INTEGER,

  -- Luteal phase
  luteal_length_days INTEGER,   -- filled in once the cycle closes
  short_luteal_flag BOOLEAN DEFAULT FALSE,

  -- Anovulatory flag mirrors anovulatory-detection output for this cycle.
  -- We store it denormalized here so consumers do not need a cross-table
  -- join just to render a phase card.
  anovulatory_status TEXT
    CHECK (
      anovulatory_status IS NULL
      OR anovulatory_status IN ('likely_ovulatory','likely_anovulatory','insufficient_data')
    ),

  -- Multi-signal fusion
  confidence_score NUMERIC(4,3),      -- 0.000 to 1.000
  signals_used JSONB DEFAULT '[]',    -- e.g. ["bbt","oura_temp","hrv","rhr","lh"]
  signal_breakdown JSONB DEFAULT '{}',
    -- {"bbt_shift":{contributed:true,weight:0.5,...}, "hrv":{contributed:true,weight:0.2,...}, ...}
  excluded_data JSONB DEFAULT '[]',
    -- [{"date":"2026-03-14","reason":"fever","source":"daily_logs"}]

  -- Audit trail: computation_number increments each time we recompute
  -- for the same cycle_start_date. The highest number is the current truth.
  computation_number INTEGER NOT NULL DEFAULT 1,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  engine_version TEXT NOT NULL DEFAULT 'cycle-engine-v1',

  UNIQUE (patient_id, cycle_start_date, computation_number)
);

CREATE INDEX IF NOT EXISTS idx_cycle_engine_state_start
  ON cycle_engine_state (patient_id, cycle_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_cycle_engine_state_computed_at
  ON cycle_engine_state (computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_cycle_engine_state_current
  ON cycle_engine_state (patient_id, cycle_start_date DESC, computation_number DESC);

COMMENT ON TABLE cycle_engine_state IS
  'Cached per-cycle predictions from src/lib/intelligence/cycle-engine. Write-forward-only: each recompute writes a new row with incremented computation_number. See 016_cycle_engine_state.sql header for references.';
