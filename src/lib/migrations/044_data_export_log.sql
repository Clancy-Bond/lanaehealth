-- Migration 044: data_export_log
--
-- HIPAA / GDPR-style data portability requires an auditable record of
-- every data export request. This table answers two operational
-- questions independent of the security_audit_log:
--
--   1. "When did this user last export their data?" Used to enforce the
--      one-export-per-24h rate limit at the application layer (the
--      in-memory rate limiter resets on each lambda cold start).
--   2. "How big was the export, and did it complete?" Useful for
--      capacity planning and for surfacing a "your last export"
--      indicator in the UI.
--
-- Designed to be append-only; rows are never deleted. status moves
-- from 'pending' -> 'completed' or 'failed' once the ZIP finishes.
-- file_size_bytes is null until the export completes.
--
-- ZERO data loss: pure CREATE TABLE IF NOT EXISTS plus indexes plus
-- RLS. Does not touch any existing rows.
--
-- Idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.data_export_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at      timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  file_size_bytes   bigint,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'failed')),
  failure_reason    text,
  ip                text,
  user_agent        text
);

CREATE INDEX IF NOT EXISTS data_export_log_user_id_requested_at_idx
  ON public.data_export_log (user_id, requested_at DESC);

ALTER TABLE public.data_export_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_export_log_deny_anon ON public.data_export_log;
CREATE POLICY data_export_log_deny_anon
  ON public.data_export_log FOR ALL TO anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS data_export_log_user_select ON public.data_export_log;
CREATE POLICY data_export_log_user_select
  ON public.data_export_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Inserts and updates are performed exclusively by the service-role
-- client inside the export route handler, so we deliberately do not
-- grant insert/update to authenticated users.
