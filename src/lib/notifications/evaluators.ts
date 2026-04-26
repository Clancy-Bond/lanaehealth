/**
 * Trigger evaluators for the bubble-up cron.
 *
 * Each evaluator inspects the database (or already-loaded context) and
 * returns either null (nothing to send) or a NotificationPayload ready
 * for sendNotification(). Evaluators are pure with respect to their
 * inputs once the read is done; the cron handler calls them in order
 * and dispatches the results.
 *
 * Idempotency is enforced by NotificationPayload.notificationKey, which
 * MUST be stable per "thing the user should know about". For example,
 * the period prediction key includes the predicted local date so the
 * cron can re-run hourly without firing twice.
 *
 * NC voice on every body string: short, kind, explanatory.
 */
import { createServiceClient } from '@/lib/supabase'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import type { NotificationPayload } from './dispatch'
import type { NotificationCategory } from './categories'

function formatLocalDate(timezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}

/**
 * Period likely starting tomorrow.
 *
 * Fires on the day before the predicted period date when the cron
 * window crosses a person's local morning. Quiet otherwise.
 */
export async function evalCyclePrediction(timezone: string): Promise<NotificationPayload | null> {
  const todayLocal = formatLocalDate(timezone)
  try {
    const ctx = await loadCycleContext(todayLocal)
    const predicted = ctx.periodPrediction.predictedDate
    if (!predicted) return null
    const daysUntil = ctx.periodPrediction.daysUntil
    if (daysUntil == null) return null
    if (daysUntil !== 1) return null

    return {
      category: 'cycle_predictions',
      notificationKey: `cycle:predict:${predicted}`,
      title: 'Period likely starting tomorrow',
      body: 'Heads up so you can pack what you need today. Tap to review the prediction.',
      url: '/v2/cycle/predict',
    }
  } catch {
    return null
  }
}

/**
 * Fertile window opening today.
 *
 * Fires on the morning the window opens. We rely on the cycle context
 * already-computed fertile prediction and the daysUntilWindow value.
 */
export async function evalFertileWindow(timezone: string): Promise<NotificationPayload | null> {
  const todayLocal = formatLocalDate(timezone)
  try {
    const ctx = await loadCycleContext(todayLocal)
    const f = ctx.fertilePrediction
    if (!f.rangeStart) return null
    if (f.daysUntilWindow !== 0 || f.status !== 'in_window') return null

    return {
      category: 'cycle_predictions',
      notificationKey: `cycle:fertile:${f.rangeStart}`,
      title: 'Fertile window opening today',
      body: 'Based on your cycle so far. Tap for the full window range.',
      url: '/v2/cycle/predict',
    }
  } catch {
    return null
  }
}

/**
 * Daily check-in nudge.
 *
 * Fires once per local day if there has been no daily_logs row in
 * the last 24 hours. Notification key includes the local date so a
 * second cron run inside the same day is a no-op.
 */
export async function evalDailyCheckin(timezone: string): Promise<NotificationPayload | null> {
  const sb = createServiceClient()
  const todayLocal = formatLocalDate(timezone)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await sb
    .from('daily_logs')
    .select('date, created_at')
    .gte('created_at', twentyFourHoursAgo)
    .limit(1)

  if (error) return null
  if (data && data.length > 0) return null

  return {
    category: 'daily_checkin',
    notificationKey: `checkin:daily:${todayLocal}`,
    title: 'Time to log how you are feeling',
    body: '30 seconds. Anything you noticed today helps the patterns get sharper.',
    url: '/v2/log',
  }
}

/**
 * Doctor visit reminders: 24h and 1h before.
 *
 * Returns up to two payloads since a single appointment can trigger
 * both reminders inside the same hourly window. Idempotency keys
 * encode the appointment id and the offset.
 */
export async function evalDoctorVisits(): Promise<NotificationPayload[]> {
  const sb = createServiceClient()
  const now = new Date()
  const horizonEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000)

  const { data, error } = await sb
    .from('appointments')
    .select('id, date, doctor_name, specialty')
    .gte('date', now.toISOString().slice(0, 10))
    .lte('date', horizonEnd.toISOString().slice(0, 10))

  if (error || !data) return []

  const out: NotificationPayload[] = []
  type Row = { id: string; date: string; doctor_name: string | null; specialty: string | null }
  // The schema (src/lib/types.ts Appointment) only persists `date`, not
  // a clock time, so we treat 9am local as the de-facto appointment hour
  // for offset math. The 1h reminder is still useful even when the user
  // has not entered a precise time because it catches the morning of.
  for (const appt of data as Row[]) {
    const apptAt = new Date(`${appt.date}T09:00:00`)
    if (Number.isNaN(apptAt.getTime())) continue
    const hoursAway = (apptAt.getTime() - now.getTime()) / (60 * 60 * 1000)

    const who = appt.doctor_name ?? appt.specialty ?? 'your appointment'

    if (hoursAway > 23 && hoursAway <= 25) {
      out.push({
        category: 'doctor_visits',
        notificationKey: `appt:24h:${appt.id}`,
        title: 'Visit tomorrow',
        body: `${who} is on the calendar for tomorrow. Tap to open the doctor brief.`,
        url: '/v2/doctor',
      })
    }
    if (hoursAway > 0.5 && hoursAway <= 1.5) {
      out.push({
        category: 'doctor_visits',
        notificationKey: `appt:1h:${appt.id}`,
        title: 'Visit in about an hour',
        body: `Heading to ${who}? The doctor brief has your latest summary.`,
        url: '/v2/doctor',
      })
    }
  }
  return out
}

/**
 * Pattern discoveries.
 *
 * Reads correlation_results computed in the last 7 days at
 * confidence_level 'moderate' or 'strong' (suggestive findings are
 * too noisy for a push). Idempotency key is the row id, so each
 * computed correlation fires at most once. We send the
 * highest-confidence finding in the window per run.
 */
export async function evalPatternDiscoveries(): Promise<NotificationPayload | null> {
  const sb = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await sb
    .from('correlation_results')
    .select('id, factor_a, factor_b, effect_description, confidence_level, computed_at')
    .gte('computed_at', sevenDaysAgo)
    .in('confidence_level', ['moderate', 'strong'])
    .order('computed_at', { ascending: false })
    .limit(5)

  if (error || !data) return null

  type Row = {
    id: string
    factor_a: string
    factor_b: string
    effect_description: string | null
    confidence_level: string | null
  }
  for (const row of data as Row[]) {
    const fa = (row.factor_a ?? '').trim()
    const fb = (row.factor_b ?? '').trim()
    if (!fa || !fb) continue
    const detail = (row.effect_description ?? '').trim()
    const body = detail
      ? detail.length > 140
        ? detail.slice(0, 137) + '...'
        : detail
      : `${fa} appears to track with ${fb}. Tap for the full pattern.`
    return {
      category: 'pattern_discoveries',
      notificationKey: `pattern:${row.id}`,
      title: 'New pattern noticed',
      body,
      url: '/v2/cycle/insights',
    }
  }
  return null
}

/**
 * Red-flag health alerts.
 *
 * Reads active_problems whose status was updated to 'investigating'
 * in the last 24 hours. The schema (migration 001) has no severity
 * column, so we treat 'investigating' (recently flagged for medical
 * attention) as the trigger for a push. notification_key encodes
 * the problem id + status so a status flip fires once.
 */
export async function evalHealthAlerts(): Promise<NotificationPayload[]> {
  const sb = createServiceClient()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await sb
    .from('active_problems')
    .select('id, problem, status, updated_at')
    .eq('status', 'investigating')
    .gte('updated_at', oneDayAgo)
    .limit(5)

  if (error || !data) return []
  const out: NotificationPayload[] = []
  type Row = { id: string; problem: string | null; status: string | null; updated_at: string | null }
  for (const row of data as Row[]) {
    const label = row.problem ?? 'a tracked condition'
    const status = row.status ?? 'investigating'
    const dayBucket = (row.updated_at ?? '').slice(0, 10)
    out.push({
      category: 'health_alerts',
      notificationKey: `health:${row.id}:${status}:${dayBucket}`,
      title: 'Worth a closer look',
      body: `${label} is being investigated. Tap to see what changed.`,
      url: '/v2/today',
    })
  }
  return out
}

/**
 * Insurance reminders.
 *
 * Insurance is stored in health_profile (section='insurance', content
 * jsonb with planSlug, memberId, optional notes/dueDay). When the user
 * has set a monthly premium dueDay (1-28) we fire a single reminder
 * three days before that day-of-month. notification_key encodes the
 * year+month so the reminder fires at most once per billing cycle.
 */
export async function evalInsurance(): Promise<NotificationPayload[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('health_profile')
    .select('content')
    .eq('section', 'insurance')
    .maybeSingle()

  if (error || !data) return []
  const content = (data.content ?? {}) as { planSlug?: string; dueDay?: number; carrierName?: string }
  const dueDay = content.dueDay
  if (typeof dueDay !== 'number' || dueDay < 1 || dueDay > 28) return []

  const now = new Date()
  const today = now.getDate()
  const daysUntilDue = (dueDay - today + 31) % 31
  if (daysUntilDue !== 3) return []

  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const carrier = content.carrierName ?? 'your insurance'

  return [
    {
      category: 'insurance_reminders',
      notificationKey: `insurance:premium:${ym}`,
      title: 'Premium coming up',
      body: `${carrier} premium is due in 3 days. Tap to review.`,
      url: '/v2/insurance',
    },
  ]
}
