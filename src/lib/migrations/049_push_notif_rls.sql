-- Migration 049: RLS sweep for push_subscriptions + notification_log.
--
-- Migration 012_push_subscriptions.sql created push_subscriptions WITHOUT
-- user_id and was not part of the 22-table 038 sweep. Migration 042
-- added the notification_log table referencing push_subscriptions(id) by
-- subscription_id and also did not enable RLS. This migration closes
-- both gaps in a single coordinated apply because notification_log's
-- owner check has to traverse the subscription_id -> push_subscriptions
-- FK to reach a user_id, so push_subscriptions has to grow user_id first.
--
-- Order matters:
--   1. ADD COLUMN user_id to push_subscriptions (additive)
--   2. Backfill the existing rows with the canonical owner UUID
--   3. ENABLE RLS + canonical 5 policies on push_subscriptions
--   4. ENABLE RLS + traversal policies on notification_log
--
-- Idempotent. Safe to re-run. Uses the same Lanae-by-email lookup as 035
-- so the canonical UUID isn't hard-coded.

-- ─── 1. Add user_id to push_subscriptions ────────────────────────────

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

-- Idempotent FK guard: if the column existed before this migration ran
-- (from a prior partial attempt) the ADD COLUMN above is a no-op and
-- the inline FK is skipped. Add an explicit constraint if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class cl ON c.conrelid = cl.oid
    JOIN pg_namespace n ON cl.relnamespace = n.oid
    JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND cl.relname = 'push_subscriptions'
      AND a.attname = 'user_id'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── 2. Backfill ─────────────────────────────────────────────────────

DO $$
DECLARE
  lanae_email constant text := 'lanaeamalianichols@gmail.com';
  lanae_id uuid;
  affected bigint;
BEGIN
  SELECT id INTO lanae_id FROM auth.users WHERE email = lanae_email LIMIT 1;
  IF lanae_id IS NULL THEN
    RAISE EXCEPTION 'OWNER_NOT_FOUND: no auth.users row for %', lanae_email;
  END IF;

  UPDATE public.push_subscriptions
    SET user_id = lanae_id
    WHERE user_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'push_subscriptions backfilled: % rows tagged with %', affected, lanae_id;
END $$;

-- ─── 3. RLS + policies on push_subscriptions ─────────────────────────

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_deny_anon ON public.push_subscriptions;
CREATE POLICY push_subscriptions_deny_anon
  ON public.push_subscriptions FOR ALL TO anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS push_subscriptions_user_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_user_select
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_user_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_user_insert
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_user_update ON public.push_subscriptions;
CREATE POLICY push_subscriptions_user_update
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_user_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_user_delete
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ─── 4. RLS + traversal policies on notification_log ─────────────────
--
-- notification_log has no direct user_id column. Owner check goes via
-- subscription_id -> push_subscriptions(user_id). We use EXISTS rather
-- than a JOIN so the policy planner can short-circuit on no-match.
--
-- Writes go through service_role from the cron route; the user-side
-- policies are defense-in-depth for any future code path that uses the
-- anon key with a user JWT.

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_log_deny_anon ON public.notification_log;
CREATE POLICY notification_log_deny_anon
  ON public.notification_log FOR ALL TO anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS notification_log_user_select ON public.notification_log;
CREATE POLICY notification_log_user_select
  ON public.notification_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.push_subscriptions ps
      WHERE ps.id = notification_log.subscription_id
        AND ps.user_id = auth.uid()
    )
  );

-- The notification_log read policy is the only authenticated-side
-- policy we add. Inserts come from cron (service_role); updates
-- (read_at marking) and deletes are not user-facing operations today.
-- If a future surface needs them we'll add the corresponding policies
-- in a separate migration.

COMMENT ON TABLE public.notification_log IS
  'Per-notification dispatch log. Idempotent on (subscription_id, notification_key). '
  'Inserts via service_role from /api/push/send + /api/cron/notifications. '
  'User-side reads gated through push_subscriptions ownership.';
