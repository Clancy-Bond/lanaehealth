-- Migration 033: Materialize Oura activity score and intensity buckets
--
-- The /usercollection/daily_activity endpoint is already fetched and
-- stored under raw_json.oura.daily_activity, but only steps and calories
-- are read by downstream callers (src/lib/calories/activity.ts). The
-- activity score itself, the four intensity buckets, and the six
-- contributors are all available in raw_json but never accessible without
-- raw_json archaeology.
--
-- Per audit (Wave 1 Oura utilization), these feed POTS pacing analysis:
-- a POTS-suspected patient who repeatedly exceeds their high-activity
-- band the day before a presyncope spike should see that signal surfaced.
--
-- New columns:
--   activity_score        -- 0-100 daily activity score
--   sedentary_min         -- minutes spent inactive
--   low_activity_min      -- minutes of light activity
--   medium_activity_min   -- minutes of moderate activity
--   high_activity_min     -- minutes of high-intensity activity
--
-- Storage: integer minutes / score. All nullable. Idempotent via
-- IF NOT EXISTS. Activity contributors (stay_active, recovery_time,
-- move_every_hour, training_volume, meet_daily_targets,
-- training_frequency) remain in raw_json.oura.daily_activity.contributors;
-- they are addressed via OuraContributors interface and read directly
-- at consumption time without a dedicated column.

ALTER TABLE oura_daily
  ADD COLUMN IF NOT EXISTS activity_score integer,
  ADD COLUMN IF NOT EXISTS sedentary_min integer,
  ADD COLUMN IF NOT EXISTS low_activity_min integer,
  ADD COLUMN IF NOT EXISTS medium_activity_min integer,
  ADD COLUMN IF NOT EXISTS high_activity_min integer;
