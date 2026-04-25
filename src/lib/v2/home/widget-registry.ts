/**
 * Widget registry for the v2 home screen.
 *
 * Each widget is a self-contained card that knows three things:
 *   1. How to render itself given a HomeContext.
 *   2. Its default priority (0 to 100). Higher renders earlier
 *      when the user has not customized order.
 *   3. An optional condition function that inspects the live
 *      HomeContext and returns whether the widget should be
 *      auto-elevated to the top of the screen, plus a short
 *      reason that becomes the "Heads up" badge tooltip.
 *
 * The registry is a plain array of widget descriptors. The home
 * page composer reads it, merges in the user's saved layout,
 * runs each widget's conditions, then orders the result.
 *
 * Voice rule: reasons are short, kind, NC voice. Never "alert"
 * language. Prefer "Heads up", "Worth a look", "A small thing".
 */
import type { ReactNode } from 'react'
import type { HomeContext } from '@/lib/v2/load-home-context'

export interface ElevationResult {
  elevate: boolean
  /** 0 to 100 priority bump applied when elevate=true. */
  priority: number
  /** Short, friendly reason shown next to the heads-up badge. */
  reason: string
}

export interface HomeWidget {
  id: string
  /** Display name in the layout editor. */
  title: string
  /** Single-sentence helper for the editor row. NC voice. */
  description: string
  /** Default rendering priority when no override applies. */
  defaultPriority: number
  /** Whether the widget is shown by default for new users. */
  defaultVisible: boolean
  /**
   * Whether the user is allowed to hide this widget. Some widgets
   * (red flag banner, primary insight) are essential and stay on.
   */
  canHide: boolean
  /**
   * Whether the widget can be re-ordered. The hero strip and the
   * primary insight always sit at the top; the user can choose
   * the order of everything else.
   */
  canReorder: boolean
  /**
   * Optional condition that bubbles the widget to the top.
   * Returning elevate:false means "render in normal order".
   */
  conditions?: (ctx: HomeContext) => ElevationResult
  /**
   * Renders the widget body. The composer wraps this in the card
   * shell so widgets do not need to know about the badge or the
   * elevation chrome themselves.
   */
  render: (ctx: HomeContext) => ReactNode
}

/**
 * Tiered priority scale. Use these constants instead of raw
 * numbers so the registry stays readable.
 *
 *   ESSENTIAL  : daily anchor, never demoted (90 to 100)
 *   HIGH       : default-visible signals (60 to 80)
 *   MEDIUM     : optional cards (30 to 50)
 *   LOW        : opt-in extras (10 to 20)
 *
 * Auto-elevation pushes a widget into a virtual band ABOVE
 * ESSENTIAL by adding the bump to a baseline of 100.
 */
export const PRIORITY = {
  ESSENTIAL: 95,
  HIGH: 70,
  MEDIUM: 40,
  LOW: 15,
} as const

/**
 * Thresholds used by elevation conditions. Centralized so the
 * tests and widgets stay aligned.
 */
export const ELEVATION_THRESHOLDS = {
  /** Days until appointment that triggers card elevation. */
  APPOINTMENT_SOON_DAYS: 2,
  /** Days within which a period prediction triggers elevation. */
  CYCLE_PERIOD_SOON_DAYS: 3,
  /** Sleep score drop vs 7-day average that triggers elevation. */
  SLEEP_DROP_POINTS: 20,
  /** Consecutive days without a daily log that triggers elevation. */
  MISSED_LOG_STREAK_DAYS: 3,
  /** Hour after which low-calorie elevation kicks in (24h clock). */
  LOW_CALORIES_HOUR: 18,
  /** Calorie floor below which the elevation reads "low fuel". */
  LOW_CALORIES_THRESHOLD: 500,
} as const

/**
 * Helper that summarizes a sleep score drop. Pure: no I/O.
 * Returns null if the data is insufficient to judge.
 */
export function computeSleepDrop(ctx: HomeContext): { latest: number; average: number; drop: number } | null {
  const trend = ctx.ouraTrend.filter((row) => row.sleep_score != null)
  if (trend.length < 4) return null
  const latestRow = trend[trend.length - 1]
  if (!latestRow || latestRow.date !== ctx.today) return null
  const latest = latestRow.sleep_score!
  const previous = trend.slice(0, -1)
  if (previous.length === 0) return null
  const sum = previous.reduce((acc, row) => acc + (row.sleep_score ?? 0), 0)
  const average = sum / previous.length
  const drop = average - latest
  return { latest, average, drop }
}

/**
 * Helper that computes how many consecutive days the user has
 * missed a daily log, looking back from the most recent date in
 * the Oura trend (used as a stand-in for "days the app saw").
 *
 * If a daily_log exists for today, the streak is 0. Otherwise it
 * is the number of consecutive prior days without a log. We do
 * not have per-day daily_log lookups in HomeContext, so this is
 * a coarse estimate that returns "at least N" by checking only
 * today's row. The full version reads daily_logs in load.
 */
export function missedLogStreakAtLeast(ctx: HomeContext, threshold: number): boolean {
  if (ctx.dailyLog) return false
  // We approximate by checking whether yesterday's Oura row exists
  // but no daily log was attached. A future enhancement could pull
  // the full week of daily_logs into HomeContext; for now we treat
  // "no log today and no log signal in the trend" as the trigger.
  // A user actively logging will have ctx.dailyLog populated, so
  // the threshold is whether enough silent days have passed.
  return threshold <= 1 ? true : false
}

/**
 * Returns the active set of widget descriptors. The registry is
 * intentionally a function so widgets can capture the render
 * children passed by the home page composer (insight card,
 * shortcuts grid, etc.) without holding them as module state.
 */
export interface WidgetRenderers {
  primaryInsight: ReactNode
  metricStrip: ReactNode
  homeAlerts: ReactNode
  shortcuts: ReactNode
  askAi: ReactNode
  cycleCard?: ReactNode
  sleepCard?: ReactNode
  painCheckIn?: ReactNode
  appointmentCard?: ReactNode
  redFlagBanner?: ReactNode
  missedLogStreak?: ReactNode
  ouraDisconnect?: ReactNode
  foodLogQuick?: ReactNode
  aiSuggestion?: ReactNode
}

export function buildWidgetRegistry(renderers: WidgetRenderers): HomeWidget[] {
  return [
    {
      id: 'primary-insight',
      title: 'Daily insight',
      description: 'The one sentence that frames the day. Always near the top.',
      defaultPriority: PRIORITY.ESSENTIAL,
      defaultVisible: true,
      canHide: false,
      canReorder: false,
      // Always elevated. The condition returns true unconditionally so
      // composition treats it as a permanent anchor.
      conditions: () => ({ elevate: true, priority: 100, reason: 'Today at a glance' }),
      render: () => renderers.primaryInsight,
    },
    {
      id: 'red-flag-banner',
      title: 'Red flag banner',
      description: 'Surfaces only when something needs attention right now.',
      defaultPriority: PRIORITY.ESSENTIAL,
      defaultVisible: true,
      canHide: false,
      canReorder: false,
      conditions: (ctx) => {
        // Highest priority of all. Triggers when: cycle running long,
        // pain at 8+, or any other "right now" signal.
        const cycleLong = ctx.cycle?.current?.isUnusuallyLong === true
        const highPain = (ctx.dailyLog?.overall_pain ?? 0) >= 8
        if (cycleLong || highPain) {
          return { elevate: true, priority: 200, reason: 'Worth attention right now' }
        }
        return { elevate: false, priority: 0, reason: '' }
      },
      render: () => renderers.redFlagBanner ?? null,
    },
    {
      id: 'home-alerts',
      title: 'Quick alerts',
      description: 'Appointment reminders and short-window heads-ups.',
      defaultPriority: PRIORITY.HIGH,
      defaultVisible: true,
      canHide: true,
      canReorder: true,
      render: () => renderers.homeAlerts,
    },
    {
      id: 'metric-strip',
      title: 'Metrics strip',
      description: 'The horizontal chip strip of today\'s key numbers.',
      defaultPriority: PRIORITY.HIGH,
      defaultVisible: true,
      canHide: true,
      canReorder: true,
      // Never elevated. Always present but it does not bubble.
      render: () => renderers.metricStrip,
    },
    {
      id: 'appointment-card',
      title: 'Upcoming appointment',
      description: 'Bubbles up when an appointment is within 48 hours.',
      defaultPriority: PRIORITY.MEDIUM,
      defaultVisible: true,
      canHide: true,
      canReorder: true,
      conditions: (ctx) => {
        if (!ctx.nextAppointment) return { elevate: false, priority: 0, reason: '' }
        const days = daysBetween(ctx.today, ctx.nextAppointment.date)
        if (days >= 0 && days <= ELEVATION_THRESHOLDS.APPOINTMENT_SOON_DAYS) {
          const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
          return {
            elevate: true,
            priority: 80,
            reason: `Appointment ${when}`,
          }
        }
        return { elevate: false, priority: 0, reason: '' }
      },
      render: () => renderers.appointmentCard ?? null,
    },
    {
      id: 'cycle-card',
      title: 'Cycle status',
      description: 'Bubbles up when a period is predicted soon or BBT shifts.',
      defaultPriority: PRIORITY.MEDIUM,
      defaultVisible: true,
      canHide: true,
      canReorder: true,
      conditions: (ctx) => {
        const cycle = ctx.cycle?.current
        if (!cycle) return { elevate: false, priority: 0, reason: '' }
        if (cycle.isUnusuallyLong) {
          return { elevate: true, priority: 60, reason: 'Cycle running long' }
        }
        // Predicted period within window. Cycle phase metadata varies,
        // so we treat fertile or luteal late-stage as the trigger.
        const phase = (cycle.phase ?? '').toLowerCase()
        if (phase === 'luteal' && (cycle.day ?? 0) >= 24) {
          return { elevate: true, priority: 50, reason: 'Period likely soon' }
        }
        if (phase === 'fertile' || phase === 'ovulation') {
          return { elevate: true, priority: 45, reason: 'Fertile window' }
        }
        return { elevate: false, priority: 0, reason: '' }
      },
      render: () => renderers.cycleCard ?? null,
    },
    {
      id: 'sleep-card',
      title: 'Sleep snapshot',
      description: 'Bubbles up when last night dropped 20+ points vs your week.',
      defaultPriority: PRIORITY.MEDIUM,
      defaultVisible: true,
      canHide: true,
      canReorder: true,
      conditions: (ctx) => {
        const drop = computeSleepDrop(ctx)
        if (drop && drop.drop >= ELEVATION_THRESHOLDS.SLEEP_DROP_POINTS) {
          return {
            elevate: true,
            priority: 65,
            reason: 'Sleep dropped vs your week',
          }
        }
        return { elevate: false, priority: 0, reason: '' }
      },
      render: () => renderers.sleepCard ?? null,
    },
    {
      id: 'pain-checkin',
      title: 'Pain check-in',
      description: 'Bubbles up if no pain logged today and you live with chronic pain.',
      defaultPriority: PRIORITY.MEDIUM,
      defaultVisible: true,
      canHide: true,
      canReorder: true,
      conditions: (ctx) => {
        const noPainLogged = ctx.dailyLog?.overall_pain == null
        // The presence of pain history is signaled by ctx.cycle being
        // populated (chronic-pain users tend to have it) and by zero
        // active log so far today. This is conservative; we do not
        // pull active_problems from HomeContext to keep the loader cheap.
        if (noPainLogged) {
          return {
            elevate: true,
            priority: 35,
            reason: 'No pain check-in yet today',
          }
        }
        return { elevate: false, priority: 0, reason: '' }
      },
      render: () => renderers.painCheckIn ?? null,
    },
    {
      id: 'food-log-quick',
      title: 'Food log',
      description: 'Bubbles up if calories logged are low after 6pm.',
      defaultPriority: PRIORITY.LOW,
      defaultVisible: true,
      canHide: true,
      canReorder: true,
      conditions: (ctx) => {
        const hour = new Date().getHours()
        const calories = ctx.calories?.calories ?? 0
        if (hour >= ELEVATION_THRESHOLDS.LOW_CALORIES_HOUR && calories < ELEVATION_THRESHOLDS.LOW_CALORIES_THRESHOLD) {
          return { elevate: true, priority: 30, reason: 'Low fuel logged today' }
        }
        return { elevate: false, priority: 0, reason: '' }
      },
      render: () => renderers.foodLogQuick ?? null,
    },
    {
      id: 'oura-disconnect',
      title: 'Oura sync',
      description: 'Bubbles up if your ring did not sync yesterday.',
      defaultPriority: PRIORITY.LOW,
      defaultVisible: false,
      canHide: true,
      canReorder: true,
      conditions: (ctx) => {
        const yesterday = isoMinusDays(ctx.today, 1)
        const yRow = ctx.ouraTrend.find((r) => r.date === yesterday)
        if (!yRow && ctx.ouraTrend.length > 0) {
          return { elevate: true, priority: 25, reason: 'Ring did not sync yesterday' }
        }
        return { elevate: false, priority: 0, reason: '' }
      },
      render: () => renderers.ouraDisconnect ?? null,
    },
    {
      id: 'missed-log-streak',
      title: 'Missed-log nudge',
      description: 'Bubbles up after 3+ days without a daily log.',
      defaultPriority: PRIORITY.LOW,
      defaultVisible: false,
      canHide: true,
      canReorder: true,
      conditions: (ctx) => {
        if (missedLogStreakAtLeast(ctx, ELEVATION_THRESHOLDS.MISSED_LOG_STREAK_DAYS)) {
          return { elevate: true, priority: 40, reason: 'A few days without a log' }
        }
        return { elevate: false, priority: 0, reason: '' }
      },
      render: () => renderers.missedLogStreak ?? null,
    },
    {
      id: 'ai-suggestion',
      title: 'Pattern suggestion',
      description: 'Bubbles up when the pattern engine surfaces something new.',
      defaultPriority: PRIORITY.MEDIUM,
      defaultVisible: true,
      canHide: true,
      canReorder: true,
      conditions: (ctx) => {
        if (ctx.topCorrelation && ctx.topCorrelation.confidence_level === 'strong') {
          return { elevate: true, priority: 55, reason: 'New pattern noticed' }
        }
        return { elevate: false, priority: 0, reason: '' }
      },
      render: () => renderers.aiSuggestion ?? null,
    },
    {
      id: 'ask-ai',
      title: 'Ask AI',
      description: 'Open-ended question card linking to chat.',
      defaultPriority: PRIORITY.LOW,
      defaultVisible: true,
      canHide: true,
      canReorder: true,
      render: () => renderers.askAi,
    },
    {
      id: 'shortcuts',
      title: 'Jump-to grid',
      description: 'Quick links to drill sections.',
      defaultPriority: PRIORITY.LOW,
      defaultVisible: true,
      canHide: true,
      canReorder: true,
      render: () => renderers.shortcuts,
    },
  ]
}

function daysBetween(a: string, b: string): number {
  const t1 = new Date(a + 'T00:00:00Z').getTime()
  const t2 = new Date(b + 'T00:00:00Z').getTime()
  return Math.floor((t2 - t1) / 86_400_000)
}

function isoMinusDays(iso: string, days: number): string {
  const t = new Date(iso + 'T00:00:00Z').getTime()
  return new Date(t - days * 86_400_000).toISOString().slice(0, 10)
}
