# Migration 012: Apply push_subscriptions table

Paste this SQL in Supabase SQL Editor, then run.

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL,
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
```

After apply, POST `/api/push/send` will discover subscriptions and send reminders.
Cron fires `/api/push/send` every 10 minutes. Subscriptions are only sent to when
current time falls within 10 minutes after the user's configured morning or evening
time, with a 30-minute minimum gap between sends.

Verify after apply:

```sql
SELECT count(*) FROM push_subscriptions;  -- expect 0 initially
```
