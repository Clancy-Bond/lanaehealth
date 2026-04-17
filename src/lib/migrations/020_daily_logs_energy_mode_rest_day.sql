-- Migration 020: Energy Mode + Rest Day on daily_logs
--
-- Adds two additive columns to daily_logs to support the Finch-inspired
-- energy-adaptive goal scaling and rest-day action features. Both columns
-- are nullable (rest_day defaults to false) so existing rows are unaffected.
--
-- Audit (2026-04-16) confirmed this ALTER is safe. Uses IF NOT EXISTS per
-- the precedent set by migration 009 so re-running the migration is idempotent
-- and has zero-data-loss guarantees on existing daily_logs rows.
--
-- energy_mode: one of 'minimal', 'gentle', 'full' or NULL (not yet set).
--   - minimal: low energy day, show only the most essential log rows
--   - gentle:  medium day, show essentials + one or two extras
--   - full:    normal capacity, show the full check-in layout
--
-- rest_day: boolean. TRUE when the user has explicitly marked today a rest
--   day via the RestDayCard. A rest day is a POSITIVE log, not a null log.
--   Analysis pipelines MUST exclude rest_day=true rows from any adherence
--   or completeness denominator so rest days never register as "missing".

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS energy_mode text
  CHECK (energy_mode IS NULL OR energy_mode IN ('minimal','gentle','full'))
  DEFAULT NULL;

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS rest_day boolean
  DEFAULT false;
