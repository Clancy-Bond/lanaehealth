/**
 * /api/v2/cycle/messages
 *
 * GET  : list the user's messages (newest first).
 * POST : generate fresh phase-aware messages for the user.
 *
 * Generation pulls cycle context once, runs the pure generator, and
 * persists with idempotent upsert. Safe to call on every /v2/cycle
 * visit.
 */
import { NextResponse } from 'next/server'
import { requireUser, UnauthenticatedError } from '@/lib/auth/get-user'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { generateCycleMessages } from '@/lib/cycle/messages'
import {
  listMessages,
  persistMessages,
  lastInsightSampleSize,
} from '@/lib/cycle/messages-store'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const user = await requireUser()
    const messages = await listMessages(user.id, { limit: 50 })
    return NextResponse.json({ messages })
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const user = await requireUser()
    const today = new Date().toISOString().slice(0, 10)
    const ctx = await loadCycleContext(today)

    const todayBbt = ctx.bbtReadings.some((r) => r.date === today)
    const sb = createServiceClient()
    const { data: cycleRow } = await sb
      .from('cycle_entries')
      .select('menstruation')
      .eq('date', today)
      .maybeSingle()
    const periodLoggedToday =
      (cycleRow as { menstruation: boolean | null } | null)?.menstruation === true

    const lastSize = await lastInsightSampleSize(user.id)
    const candidates = generateCycleMessages({
      ctx,
      today,
      bbtLoggedToday: todayBbt,
      periodLoggedToday,
      lastInsightSampleSize: lastSize,
    })

    const newCount = await persistMessages(user.id, candidates)
    return NextResponse.json({ generated: candidates.length, persisted: newCount })
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
