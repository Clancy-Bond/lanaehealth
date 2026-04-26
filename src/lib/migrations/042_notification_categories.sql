-- Migration 042: Notification categories + idempotency log
--
-- Extends push_subscriptions (introduced in 012) with a per-category
-- opt-in array so the bubble-up cron knows which kinds of pushes a
-- given device wants. Also adds notification_log for idempotency:
-- once a notification with a given key has been sent to a subscription
-- we never send it again (prevents duplicate "Period likely starts
-- tomorrow" pings if the cron fires twice in a window).
--
-- Default opt-in: empty array. New subscriptions receive nothing
-- beyond the existing morning/evening check-in until the user picks
-- categories in /v2/settings -> Notifications.

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS enabled_types text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  notification_key text NOT NULL,           -- e.g. 'cycle:predict:2026-04-30'
  category text NOT NULL,                   -- one of enabled_types values
  title text NOT NULL,
  body text NOT NULL,
  url text,                                 -- target route on tap
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered boolean NOT NULL DEFAULT true,  -- false if web-push raised
  error text,
  read_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_log_unique_key
  ON notification_log (subscription_id, notification_key);

CREATE INDEX IF NOT EXISTS notification_log_sent_at_idx
  ON notification_log (sent_at DESC);

CREATE INDEX IF NOT EXISTS notification_log_unread_idx
  ON notification_log (subscription_id, read_at)
  WHERE read_at IS NULL;
