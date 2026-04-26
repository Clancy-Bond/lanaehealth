/**
 * Notification categories for the v2 push system.
 *
 * The hourly /api/cron/notifications job reads these and decides
 * which triggers to evaluate per subscription. Adding a category
 * here means: (1) add the opt-in checkbox to NotificationsCard,
 * (2) wire the matching trigger in evaluators.ts, (3) add an entry
 * to CATEGORY_LABELS so the settings UI labels it correctly.
 *
 * All copy follows NC voice: short, kind, explanatory. No alarms,
 * no shouted words, no em-dashes.
 */

export type NotificationCategory =
  | 'health_alerts'        // red flag, severe interactions, critical changes
  | 'doctor_visits'        // 24h + 1h appointment reminders
  | 'daily_checkin'        // gentle nudge if 24h since last log
  | 'cycle_predictions'    // period start, fertile window opening
  | 'pattern_discoveries'  // symptom-radar found a new cluster
  | 'insurance_reminders'  // premium due, claim follow-ups

export interface CategoryDef {
  key: NotificationCategory
  label: string
  subtext: string
}

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    key: 'health_alerts',
    label: 'Important health alerts',
    subtext:
      'Red-flag symptoms, severe medication interactions, and critical status changes. Off by default. We will only send these when something matters.',
  },
  {
    key: 'doctor_visits',
    label: 'Doctor visit reminders',
    subtext:
      'A nudge 24 hours before, and again about an hour ahead. Quiet otherwise.',
  },
  {
    key: 'daily_checkin',
    label: 'Daily check-in nudge',
    subtext:
      'If you have not logged in 24 hours, a single soft reminder. Never twice in a day.',
  },
  {
    key: 'cycle_predictions',
    label: 'Cycle predictions',
    subtext:
      'A heads-up the day before your predicted period and on the morning your fertile window is likely to open.',
  },
  {
    key: 'pattern_discoveries',
    label: 'Pattern discoveries',
    subtext:
      'When the app spots a new cluster (e.g. headaches landing on day 18 of your cycle), we let you know once.',
  },
  {
    key: 'insurance_reminders',
    label: 'Insurance reminders',
    subtext:
      'Premium due dates and outstanding claim follow-ups, only when there is something to do.',
  },
]

export const ALL_CATEGORY_KEYS: NotificationCategory[] = CATEGORY_DEFS.map(c => c.key)

export function isValidCategory(key: string): key is NotificationCategory {
  return ALL_CATEGORY_KEYS.includes(key as NotificationCategory)
}
