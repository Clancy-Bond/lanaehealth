/**
 * Parallel data loader for the v2 home screen.
 *
 * Home needs six independent queries and they all fire on every cold
 * render, so we fan them out via Promise.all. Any individual query
 * that errors returns null so one bad table cannot take the home
 * screen down.
 *
 * Caller ownership: this function is the ONLY place the home page
 * hits the database. Tiles, insight cards, and the chip strip all
 * consume the returned shape; no per-component queries.
 *
 * Multi-user scoping (PR #115 follow-up): the home page resolves the
 * signed-in user via getCurrentUser() and passes the id here. Each
 * query scopes by user_id with a graceful pre-migration fallback (see
 * src/lib/auth/scope-query.ts). Null userId keeps the legacy
 * single-user view working.
 */

import { createServiceClient } from '@/lib/supabase'
import { loadCycleContext, type CycleContext } from '@/lib/cycle/load-cycle-context'
import { getOuraData } from '@/lib/api/oura'
import { getDayTotals, type DayTotals } from '@/lib/calories/home-data'
import { runScopedQuery } from '@/lib/auth/scope-query'
import type { DailyLog, OuraDaily, Appointment } from '@/lib/types'

/**
 * Minimal correlation row shape used by v2 home surfaces. Mirrors the
 * canonical CorrelationResult in @/components/patterns/PatternsClient
 * but lives here so the server-rendered lib layer doesn't import from
 * a 'use client' module.
 */
export interface CorrelationRow {
  id: string
  factor_a: string
  factor_b: string
  correlation_type: string
  coefficient: number | null
  effect_size: number | null
  effect_description: string | null
  confidence_level: 'suggestive' | 'moderate' | 'strong'
  sample_size: number | null
  lag_days: number | null
  cycle_phase: string | null
  computed_at: string
}

export interface HomeContext {
  today: string
  dailyLog: DailyLog | null
  cycle: CycleContext | null
  ouraTrend: OuraDaily[]
  calories: DayTotals | null
  topCorrelation: CorrelationRow | null
  nextAppointment: Appointment | null
  symptomsToday: number
}

function sevenDaysAgo(todayIso: string): string {
  const t = new Date(todayIso + 'T00:00:00Z').getTime()
  return new Date(t - 7 * 86_400_000).toISOString().slice(0, 10)
}

async function safe<T>(p: PromiseLike<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch {
    return fallback
  }
}

export async function loadHomeContext(
  todayIso: string,
  userId?: string | null,
): Promise<HomeContext> {
  const sb = createServiceClient()
  const weekAgo = sevenDaysAgo(todayIso)

  const [dailyLog, cycle, ouraTrend, calories, topCorrelation, nextAppointment, symptomsToday] =
    await Promise.all([
      safe(
        runScopedQuery({
          table: 'daily_logs',
          userId,
          withFilter: () =>
            sb
              .from('daily_logs')
              .select('*')
              .eq('date', todayIso)
              .eq('user_id', userId as string)
              .maybeSingle(),
          withoutFilter: () =>
            sb
              .from('daily_logs')
              .select('*')
              .eq('date', todayIso)
              .maybeSingle(),
        }).then(({ data }) => (data as DailyLog | null) ?? null),
        null,
      ),
      safe(loadCycleContext(todayIso, userId), null as CycleContext | null),
      safe(getOuraData(weekAgo, todayIso, userId), [] as OuraDaily[]),
      safe(getDayTotals(todayIso, userId), null as DayTotals | null),
      safe(
        runScopedQuery({
          table: 'correlation_results',
          userId,
          withFilter: () =>
            sb
              .from('correlation_results')
              .select('*')
              .in('confidence_level', ['strong', 'moderate'])
              .eq('user_id', userId as string)
              .order('computed_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          withoutFilter: () =>
            sb
              .from('correlation_results')
              .select('*')
              .in('confidence_level', ['strong', 'moderate'])
              .order('computed_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
        }).then(({ data }) => (data as CorrelationRow | null) ?? null),
        null,
      ),
      safe(
        runScopedQuery({
          table: 'appointments',
          userId,
          withFilter: () =>
            sb
              .from('appointments')
              .select('*')
              .gte('date', todayIso)
              .eq('user_id', userId as string)
              .order('date', { ascending: true })
              .limit(1)
              .maybeSingle(),
          withoutFilter: () =>
            sb
              .from('appointments')
              .select('*')
              .gte('date', todayIso)
              .order('date', { ascending: true })
              .limit(1)
              .maybeSingle(),
        }).then(({ data }) => (data as Appointment | null) ?? null),
        null,
      ),
      safe(
        runScopedQuery<{ count: number | null }>({
          table: 'symptoms',
          userId,
          withFilter: () =>
            sb
              .from('symptoms')
              .select('id', { count: 'exact', head: true })
              .gte('logged_at', `${todayIso}T00:00:00`)
              .lte('logged_at', `${todayIso}T23:59:59`)
              .eq('user_id', userId as string)
              .then(({ count, error }) => ({ data: { count: count ?? null }, error })),
          withoutFilter: () =>
            sb
              .from('symptoms')
              .select('id', { count: 'exact', head: true })
              .gte('logged_at', `${todayIso}T00:00:00`)
              .lte('logged_at', `${todayIso}T23:59:59`)
              .then(({ count, error }) => ({ data: { count: count ?? null }, error })),
        }).then(({ data }) => data?.count ?? 0),
        0,
      ),
    ])

  return {
    today: todayIso,
    dailyLog,
    cycle,
    ouraTrend,
    calories,
    topCorrelation,
    nextAppointment,
    symptomsToday,
  }
}
