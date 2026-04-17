-- Migration 012: Web Push Subscriptions
-- Stores per-browser push subscription endpoints so the server-side cron
-- can dispatch check-in reminders even when the tab is closed.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL,          -- { p256dh, auth } from PushSubscription.toJSON()
  user_agent text,
  morning_time text DEFAULT '08:00',
  evening_time text DEFAULT '21:00',
  timezone text DEFAULT 'Pacific/Honolulu',
  enabled boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_enabled_idx
  ON push_subscriptions (enabled)
  WHERE enabled = true;
