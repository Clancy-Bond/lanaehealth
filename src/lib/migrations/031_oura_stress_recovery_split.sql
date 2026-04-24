-- Migration 031: Split Oura stress and recovery into separate columns
--
-- Data quality bug fix per audit (Wave 1 Oura utilization).
--
-- Pre-fix behaviour in /api/oura/sync:
--   dateMap[day].stress_score = entry.stress_high ?? entry.recovery_high ?? null
-- Two completely different metrics were conflated into one column. On any
-- low-stress day where stress_high was null, the column silently received
-- recovery_high (minutes spent in recovery), making correlation analysis
-- between stress and pain / cycle / fatigue total noise.
--
-- New columns:
--   stress_high_min    -- minutes of high-stress reading (Oura's stress_high)
--   recovery_high_min  -- minutes spent in recovery (Oura's recovery_high)
--
-- Backward compat: the existing stress_score column is preserved as the
-- single-number stress signal; sync route now writes ONLY entry.stress_high
-- (defaulting to 0 when the day was all-recovery), eliminating the
-- conflation while leaving historical readers untouched.
--
-- Idempotent via IF NOT EXISTS. No existing data is modified or dropped.

ALTER TABLE oura_daily
  ADD COLUMN IF NOT EXISTS stress_high_min integer,
  ADD COLUMN IF NOT EXISTS recovery_high_min integer;
