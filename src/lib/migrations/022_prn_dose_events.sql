-- Migration 022: prn_dose_events
--
-- Backs the Wave 2e Bearable F7 feature: PRN post-dose efficacy polling.
-- When Lanae logs an as-needed (PRN) medication dose, we schedule a
-- delayed (default 90 min) effectiveness check. She answers with a
-- 2-tap response: helped / no_change / worse.
--
-- IMPORTANT (non-shaming voice rule):
--   The question is "Did [med] help?" NOT "Did you take [med]?". This
--   feature must NEVER shame non-response. A missing poll_response is
--   a valid "ignored" state. Do not compute adherence percentages, do
--   not chase the user with repeat prompts, and do not tie to streaks.
--   The goal is pure efficacy signal capture over time, nothing else.
--
-- Schema notes:
--   - patient_id: text, defaults to 'lanae' (single-patient app today).
--   - medication_name: canonical med name the user dosed.
--   - dose_amount / dose_unit: optional numeric amount + unit
--     (e.g. 400 / 'mg'). Kept as separate columns so charts over time
--     can aggregate in the unit's native scale.
--   - dose_time: when the dose was taken (defaults to now()).
--   - reason: optional free-text trigger ("headache", "cramps").
--   - poll_scheduled_for: dose_time + configurable delay (default 90 min).
--     Configurability lives in application code so different meds can
--     override (e.g. sumatriptan peaks faster than naproxen).
--   - poll_sent_at: when the push / in-app surface was shown.
--   - poll_response: tri-state. NULL = never answered (valid outcome).
--   - poll_responded_at: when the 2-tap answer was recorded.
--
-- iOS PWA push reliability caveat: the companion server route may fail
-- to deliver on iOS. The application UI ALSO renders an in-app fallback
-- prompt when poll_scheduled_for has passed and poll_response is still
-- NULL, so the response path does not depend on notification delivery.
--
-- The table is entirely additive. Zero existing data is touched. Safe
-- to re-run; all DDL uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS prn_dose_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL DEFAULT 'lanae',
  medication_name text NOT NULL,
  dose_amount numeric,
  dose_unit text,
  dose_time timestamptz NOT NULL DEFAULT now(),
  reason text,
  poll_scheduled_for timestamptz,
  poll_sent_at timestamptz,
  poll_response text CHECK (poll_response IN ('helped', 'no_change', 'worse')),
  poll_responded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_prn_dose_events_dose_time
  ON prn_dose_events (dose_time DESC);

CREATE INDEX IF NOT EXISTS idx_prn_dose_events_medication_name
  ON prn_dose_events (medication_name);

-- Partial index used by the scheduler / cron route to find pending polls
-- efficiently (rows whose poll time has arrived but are still un-sent
-- and un-answered).
CREATE INDEX IF NOT EXISTS idx_prn_dose_events_pending_poll
  ON prn_dose_events (poll_scheduled_for)
  WHERE poll_sent_at IS NULL
    AND poll_response IS NULL
    AND poll_scheduled_for IS NOT NULL;
