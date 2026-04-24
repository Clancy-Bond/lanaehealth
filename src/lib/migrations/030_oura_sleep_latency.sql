-- Migration 030: Materialize Oura sleep latency on oura_daily
--
-- Sleep latency (time from going to bed to falling asleep) lives in
-- raw_json.oura.sleep_detail.latency in seconds. The /api/oura/sync route
-- already extracts six other fields from sleep_detail but skips this one.
-- The /v2/sleep page has a SleepLatencyExplainer wired with a
-- sleepLatencyMin prop slot that always received null because the column
-- did not exist.
--
-- Per audit (Wave 1 Oura utilization): sleep latency is one of the most
-- behaviourally actionable sleep signals. Long latency (>30 min) tracks
-- with caffeine timing, screens, and racing thoughts; very short latency
-- (<5 min) often signals sleep debt.
--
-- Storage: integer minutes. Source values are seconds, divided by 60 and
-- rounded at sync time. Nullable because not every night has a clean
-- latency reading. Idempotent via IF NOT EXISTS.
--
-- Zero data loss: pure ADD COLUMN, default NULL.

ALTER TABLE oura_daily
  ADD COLUMN IF NOT EXISTS sleep_latency_min integer;
