-- 015_weather_daily.sql
-- Adds columns to weather_daily (created in migration 009) needed for the
-- Open-Meteo sync pipeline and barometric-pressure correlation with POTS.
--
-- The table already exists from 009_bearable_killer.sql with these columns:
--   id, date (UNIQUE), barometric_pressure_hpa, temperature_c, humidity_pct,
--   weather_code, description, fetched_at.
--
-- This migration is additive and idempotent. IF NOT EXISTS guards on every
-- ADD COLUMN so it is safe to re-run. No mutations of existing rows.
-- Ref: docs/competitive/flaredown/implementation-notes.md (Feature 3)
-- Ref: docs/plans/2026-04-16-wave-2a-briefs.md (A3)

ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS patient_id text NOT NULL DEFAULT 'lanae';

ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS location_lat numeric NOT NULL DEFAULT 21.392;

ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS location_lon numeric NOT NULL DEFAULT -157.739;

ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS temp_high_c numeric;

ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS temp_low_c numeric;

ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS humidity_mean numeric;

ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS pressure_mean_hpa numeric;

ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS pressure_change_24h numeric;

ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS wind_mean_kmh numeric;

ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS precipitation_mm numeric;

ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS raw_json jsonb;

ALTER TABLE weather_daily
  ADD COLUMN IF NOT EXISTS synced_at timestamptz DEFAULT now();

-- Useful index for pressure correlations (POTS + barometric link)
CREATE INDEX IF NOT EXISTS idx_weather_pressure
  ON weather_daily (pressure_mean_hpa);

-- Useful index for range scans
CREATE INDEX IF NOT EXISTS idx_weather_daily_date
  ON weather_daily (date DESC);
