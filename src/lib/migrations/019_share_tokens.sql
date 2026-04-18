-- Migration 019: share_tokens
--
-- Backs the Care Card "share link" feature (Wave 2d, Brief D6).
-- A share token is a cryptographically random string that grants
-- read-only, time-limited access to a public Care Card view at
-- /share/<token>. No PII is encoded in the token itself; the token
-- is an opaque lookup key against this table.
--
-- Schema notes:
--   - token: PRIMARY KEY, the base64url-encoded random string (32+
--     bytes of entropy). Stored as-is for O(1) lookup. Since the
--     token is essentially a password, it is NEVER logged in
--     Supabase query logs (which we do not forward anywhere) and is
--     only transmitted over TLS.
--   - resource_type: 'care_card' for this brief. Extensible later
--     for other sharable resources (full doctor report, cycle
--     report, etc.).
--   - resource_id: optional scoping. NULL for single-patient
--     resources like the Care Card in Lanae's app.
--   - issued_at: when the token was created.
--   - expires_at: hard cutoff after which /share/<token> returns
--     410 Gone. Default 7 days from issuance.
--   - revoked_at: set by admin revoke; non-NULL = invalid.
--   - one_time: if true, the token is valid for exactly one view.
--   - used_at: set when the token is consumed (only meaningful
--     when one_time = true).
--
-- The table is additive. Zero existing rows are touched anywhere.
-- Safe to re-run; all DDL uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS share_tokens (
  token text PRIMARY KEY,
  resource_type text NOT NULL,
  resource_id text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  one_time boolean NOT NULL DEFAULT false,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_expires_at
  ON share_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_share_tokens_resource_type
  ON share_tokens (resource_type);
