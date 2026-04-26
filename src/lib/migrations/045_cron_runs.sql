-- Migration 045: cron_runs
--
-- Audit table for every Vercel cron invocation. Solves a basic ops
-- visibility gap: today the only way to know whether the hourly
-- notifications cron actually fired is to scroll Vercel cron logs by
-- hand. Once this table exists, /api/cron/_health can answer
-- "when did each cron last succeed, and how many failures in the
-- last 24 hours" with a single query.
--
-- Each cron route writes one row at start (status='running') and
-- updates the same row at end (status='success' or 'failed'). Row
-- carries no PHI: cron_name is the route path, payload_summary is a
-- bounded string (counters, never patient data), error_message is
-- the JS Error.message which we accept may contain incidental query
-- text but never patient identifiers.
--
-- Append-only by design. We retain everything; if the table grows
-- past the no-look-back horizon (~90 days at current volumes) we
-- can prune at that time, but for now retaining history is the
-- single best forensic tool we have for "the cron stopped firing
-- at 02:00 last Thursday, what changed?".
--
-- ZERO data loss: pure CREATE TABLE IF NOT EXISTS. Idempotent.

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name         text NOT NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  status            text NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'success', 'failed')),
  duration_ms       integer,
  payload_summary   text,
  error_message     text
);

CREATE INDEX IF NOT EXISTS cron_runs_cron_name_started_at_idx
  ON public.cron_runs (cron_name, started_at DESC);

CREATE INDEX IF NOT EXISTS cron_runs_status_started_at_idx
  ON public.cron_runs (status, started_at DESC);

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cron_runs_deny_anon ON public.cron_runs;
CREATE POLICY cron_runs_deny_anon
  ON public.cron_runs FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- Authenticated users see nothing here; this is system observability.
-- The /api/cron/_health route uses service-role to read.
DROP POLICY IF EXISTS cron_runs_deny_authed ON public.cron_runs;
CREATE POLICY cron_runs_deny_authed
  ON public.cron_runs FOR SELECT TO authenticated
  USING (false);
