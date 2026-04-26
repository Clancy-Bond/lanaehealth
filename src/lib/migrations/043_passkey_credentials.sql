-- Migration 043: Store WebAuthn passkey credentials per user.
--
-- A user can register multiple passkeys (one per device).
-- Each row holds the credential public key, counter, and the device
-- name we surface in /v2/settings.
--
-- We also store a transient challenge per (user_id, kind, expires_at)
-- so registration and authentication can verify the challenge that
-- the browser signed. Challenges expire after 5 minutes.

CREATE TABLE IF NOT EXISTS public.passkey_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_name text NOT NULL DEFAULT 'Passkey',
  backup_eligible boolean NOT NULL DEFAULT false,
  backup_state boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS passkey_credentials_user_id_idx
  ON public.passkey_credentials (user_id);

CREATE INDEX IF NOT EXISTS passkey_credentials_credential_id_idx
  ON public.passkey_credentials (credential_id);

ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;

-- The route handlers always use the service-role client when verifying
-- WebAuthn assertions because the requesting user is anonymous at the
-- moment of authentication. RLS still locks down anon and forces every
-- authenticated read to scope by user_id.
DROP POLICY IF EXISTS passkey_credentials_deny_anon ON public.passkey_credentials;
CREATE POLICY passkey_credentials_deny_anon
  ON public.passkey_credentials FOR ALL TO anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS passkey_credentials_user_select ON public.passkey_credentials;
CREATE POLICY passkey_credentials_user_select
  ON public.passkey_credentials FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS passkey_credentials_user_insert ON public.passkey_credentials;
CREATE POLICY passkey_credentials_user_insert
  ON public.passkey_credentials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS passkey_credentials_user_update ON public.passkey_credentials;
CREATE POLICY passkey_credentials_user_update
  ON public.passkey_credentials FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS passkey_credentials_user_delete ON public.passkey_credentials;
CREATE POLICY passkey_credentials_user_delete
  ON public.passkey_credentials FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Challenges live in a separate table, scoped by user_id once the
-- user is known (registration) or by anon-session-id when discovering
-- the user from the credential (authentication).
CREATE TABLE IF NOT EXISTS public.passkey_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  kind text NOT NULL CHECK (kind IN ('register', 'authenticate')),
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS passkey_challenges_session_id_idx
  ON public.passkey_challenges (session_id);

CREATE INDEX IF NOT EXISTS passkey_challenges_user_id_idx
  ON public.passkey_challenges (user_id);

CREATE INDEX IF NOT EXISTS passkey_challenges_expires_at_idx
  ON public.passkey_challenges (expires_at);

ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS passkey_challenges_deny_anon ON public.passkey_challenges;
CREATE POLICY passkey_challenges_deny_anon
  ON public.passkey_challenges FOR ALL TO anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS passkey_challenges_user_select ON public.passkey_challenges;
CREATE POLICY passkey_challenges_user_select
  ON public.passkey_challenges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
