-- Migration 032: Materialize Oura breathing disturbance index on oura_daily
--
-- The /usercollection/daily_spo2 endpoint returns two top-level signals
-- per day:
--   spo2_percentage.average           -- already extracted as spo2_avg
--   breathing_disturbance_index       -- never read, never persisted
--
-- Breathing disturbance index (BDI) is Oura's apnea-screening proxy:
-- elevated BDI tracks with sleep-disordered breathing and inflammation.
-- For a patient with chronic sinus disease, fatigue, suspected POTS, and
-- unexplained nocturnal awakenings, BDI is a high-value signal.
--
-- Storage: integer (Oura returns whole-number index 0-N). Nullable.
-- Idempotent via IF NOT EXISTS. Pure ADD COLUMN, no data modification.

ALTER TABLE oura_daily
  ADD COLUMN IF NOT EXISTS breathing_disturbance_index integer;
