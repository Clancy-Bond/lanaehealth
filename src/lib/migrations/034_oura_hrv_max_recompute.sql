-- Migration 034: Document hrv_max recompute (no schema change)
--
-- Pre-fix behaviour in /api/oura/sync:
--   dateMap[day].hrv_max = entry.highest_hrv ?? null
-- The /usercollection/sleep endpoint never returns highest_hrv. It returns
-- average_hrv at the daily level and a 5-minute time-series under
-- raw_json.oura.sleep_detail.hrv.items. So hrv_max was always null for
-- every row ever synced.
--
-- This migration adds nothing to the schema; the column already exists.
-- The fix is purely in the sync route, which now computes max from the
-- intraday hrv.items array. Migration filename retained so the historical
-- record of the fix is preserved alongside the related changes.
--
-- Defensive no-op: ensures the column type is integer (in case any
-- legacy environment created it as something else). Safe and idempotent.

ALTER TABLE oura_daily
  ADD COLUMN IF NOT EXISTS hrv_max integer;
