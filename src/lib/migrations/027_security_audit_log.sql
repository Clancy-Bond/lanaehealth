-- Migration 027 - security audit log
--
-- Additive only. Tracks every access to sensitive PHI endpoints so the
-- record of "who asked for what and when" survives the request lifecycle.
-- Called by src/lib/security/audit-log.ts from export, share, chat, and
-- report routes.
--
-- Shipped by security sweep Track B (2026-04-19). If Track A introduces
-- a real user model the `actor` column should remain compatible (it
-- holds either the session-token identifier, the request IP, or the
-- literal 'unauthenticated').

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  endpoint     text NOT NULL,
  actor        text NOT NULL,
  outcome      text NOT NULL CHECK (outcome IN ('allow', 'deny', 'error')),
  status       integer NOT NULL,
  ip           text,
  user_agent   text,
  bytes        bigint,
  reason       text,
  meta         jsonb
);

CREATE INDEX IF NOT EXISTS security_audit_log_created_at_idx
  ON public.security_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS security_audit_log_endpoint_idx
  ON public.security_audit_log (endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS security_audit_log_outcome_idx
  ON public.security_audit_log (outcome);

-- RLS posture: writes go through the service-role client. Reads are
-- admin-only. Enable RLS with no policies so anon / authenticated roles
-- get zero access; Track A can layer a read policy for admins later.
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
