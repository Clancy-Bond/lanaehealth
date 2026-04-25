/**
 * Smart-logging Messages.
 *
 * NC sends phase-aware reminders to a Messages inbox (NOT push). The
 * shape we mirror:
 *   - "Time for your morning temperature reading" when wake time has
 *     passed and no BBT is logged today.
 *   - "We're approaching your fertile window" when fertile window is
 *     2-3 days out.
 *   - "Period might start today" when the predicted-period range
 *     starts today and no period is logged yet.
 *   - "Cycle insight ready" when a new completed cycle has appeared.
 *
 * Backed by the `cycle_messages` table (migration 039). Generated on
 * demand whenever the user visits /v2/cycle and stored idempotently
 * via a (user_id, dedupe_key) uniqueness constraint, so a daily cron
 * is optional.
 *
 * Voice rules (NC):
 *   - Short, kind, explanatory.
 *   - Never alarmist.
 *   - Never imperative without a reason ("Tap to log" not "LOG NOW").
 */
import type { CycleContext } from './load-cycle-context'

export type MessageKind =
  | 'morning_temp_reminder'
  | 'fertile_window_approaching'
  | 'period_start_predicted'
  | 'cycle_insight_ready'

export interface CycleMessage {
  /** Unique stable id within the day for idempotency. */
  id: string
  kind: MessageKind
  title: string
  body: string
  /**
   * Stable per-(user,kind) key for the day. Used by the persistence
   * layer to avoid generating duplicates. Includes the date so each
   * day's reminder is its own row.
   */
  dedupeKey: string
  /** ISO datetime when the message logically applies. */
  createdAt: string
}

export interface MessageGenerationInputs {
  /** Cycle context for `today`. */
  ctx: CycleContext
  /** Today's ISO date. */
  today: string
  /** When the user typically wakes; default 07:30 local. */
  wakeTimeMinutes?: number
  /** The current time in minutes since local midnight. */
  nowMinutes?: number
  /** Whether the user has logged a BBT reading for today. */
  bbtLoggedToday: boolean
  /** Whether the user has logged a menstruation entry for today. */
  periodLoggedToday: boolean
  /**
   * The number of completed cycles when the last
   * 'cycle_insight_ready' message was generated. The generator emits
   * a fresh insight message only when sampleSize advances past this.
   */
  lastInsightSampleSize?: number
}

const DEFAULT_WAKE_MINUTES = 7 * 60 + 30 // 07:30

/**
 * Generate the set of messages that should exist for today. Pure
 * function: callers pass the resolved cycle context plus the current
 * "what is logged" state and receive the candidate cards. Persistence
 * happens in src/lib/cycle/messages-store.ts.
 */
export function generateCycleMessages(input: MessageGenerationInputs): CycleMessage[] {
  const messages: CycleMessage[] = []
  const wake = input.wakeTimeMinutes ?? DEFAULT_WAKE_MINUTES
  const now = input.nowMinutes ?? minutesFromIso(new Date().toISOString())
  const stamp = new Date().toISOString()

  // 1. Morning temperature reminder.
  if (now >= wake && !input.bbtLoggedToday) {
    messages.push({
      id: `${input.today}:morning_temp`,
      kind: 'morning_temp_reminder',
      dedupeKey: `morning_temp:${input.today}`,
      title: 'Time for your morning temperature',
      body: 'BBT taken right after waking gives the cleanest signal. Your tracker on /v2/cycle picks it up automatically once you log it.',
      createdAt: stamp,
    })
  }

  // 2. Approaching fertile window: 2-3 days out.
  const fertile = input.ctx.fertilePrediction
  if (
    fertile.status === 'out_window' &&
    fertile.daysUntilWindow !== null &&
    fertile.daysUntilWindow >= 2 &&
    fertile.daysUntilWindow <= 3
  ) {
    messages.push({
      id: `${input.today}:fertile_window`,
      kind: 'fertile_window_approaching',
      dedupeKey: `fertile_window:${input.today}`,
      title: 'Your fertile window is a few days out',
      body: `In about ${fertile.daysUntilWindow} days you are likely entering your fertile window. Logging cervical mucus or a positive LH test will narrow the prediction.`,
      createdAt: stamp,
    })
  }

  // 3. Period might start today: today is inside the predicted range
  //    and no period has been logged.
  const period = input.ctx.periodPrediction
  if (
    period.status === 'projected' &&
    period.rangeStart !== null &&
    period.rangeEnd !== null &&
    input.today >= period.rangeStart &&
    input.today <= period.rangeEnd &&
    !input.periodLoggedToday
  ) {
    messages.push({
      id: `${input.today}:period_start`,
      kind: 'period_start_predicted',
      dedupeKey: `period_start:${input.today}`,
      title: 'Your period might start today',
      body: 'You are inside the predicted-period range. If it has started, logging it now keeps the predictions calibrated. If not, this card will tidy itself up tomorrow.',
      createdAt: stamp,
    })
  }

  // 4. Cycle insight ready: a fresh completed cycle landed since the
  //    last insight message went out.
  const sampleSize = input.ctx.stats.sampleSize
  const last = input.lastInsightSampleSize ?? 0
  if (sampleSize > last && sampleSize >= 1) {
    messages.push({
      id: `${input.today}:insight_ready_${sampleSize}`,
      kind: 'cycle_insight_ready',
      dedupeKey: `insight_ready:${sampleSize}`,
      title: 'A new cycle insight is ready',
      body: `You have ${sampleSize} completed ${sampleSize === 1 ? 'cycle' : 'cycles'} on file. Tap to see how your numbers compare with the population averages.`,
      createdAt: stamp,
    })
  }

  return messages
}

function minutesFromIso(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}
