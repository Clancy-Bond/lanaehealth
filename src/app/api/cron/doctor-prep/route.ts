/**
 * Cron: /api/cron/doctor-prep
 *
 * Fires `mode=doctor_prep` on the analyze pipeline when an upcoming
 * appointment is within DAYS_BEFORE_APPT and the hypothesis tracker
 * hasn't been refreshed in STALE_HOURS.
 *
 * Wired via vercel.json to run every 6 hours. Also safe to hit manually
 * for debugging.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` OR Vercel's
 * internal cron signature. Returns 401 otherwise so arbitrary callers
 * can't trigger expensive pipelines.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const DAYS_BEFORE_APPT = 3
const STALE_HOURS = 24

interface AppointmentRow {
  id: string
  date: string
  specialty: string | null
  doctor_name: string | null
}

function isAuthorized(req: Request): boolean {
  // Vercel Cron sets its own header; we also accept a shared secret.
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  if (req.headers.get('x-vercel-cron') === '1') return true
  return false
}

async function trackerAgeHours(): Promise<number | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('clinical_knowledge_base')
    .select('generated_at')
    .eq('document_id', 'hypothesis_tracker')
    .maybeSingle()
  if (!data?.generated_at) return null
  return (Date.now() - new Date(data.generated_at).getTime()) / (1000 * 60 * 60)
}

async function findUpcomingAppointment(): Promise<AppointmentRow | null> {
  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await sb
    .from('appointments')
    .select('id, date, specialty, doctor_name')
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const daysUntil =
    (new Date((data as AppointmentRow).date + 'T00:00:00').getTime() -
      Date.now()) /
    (1000 * 60 * 60 * 24)
  return daysUntil <= DAYS_BEFORE_APPT ? (data as AppointmentRow) : null
}

async function triggerAnalyze(reason: string, targetAppt: string): Promise<{ status: number; body: unknown }> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL ?? 'lanaehealth.vercel.app'}`
    : 'http://localhost:3005'

  const resp = await fetch(`${base}/api/intelligence/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'doctor_prep',
      reason,
      target_appointment: targetAppt,
    }),
  })
  return { status: resp.status, body: await resp.json().catch(() => null) }
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const upcoming = await findUpcomingAppointment()
  if (!upcoming) {
    return NextResponse.json({ skipped: true, reason: `no appointment within ${DAYS_BEFORE_APPT} days` })
  }

  const age = await trackerAgeHours()
  const stale = age === null || age > STALE_HOURS
  if (!stale) {
    return NextResponse.json({
      skipped: true,
      reason: `tracker fresh (age: ${age?.toFixed(1)}h, threshold: ${STALE_HOURS}h)`,
      upcomingAppointment: upcoming,
    })
  }

  const triggered = await triggerAnalyze(
    `doctor-prep cron: ${upcoming.specialty ?? 'appt'} on ${upcoming.date}`,
    upcoming.date,
  )

  return NextResponse.json({
    triggered: true,
    upcomingAppointment: upcoming,
    analyzerStatus: triggered.status,
    analyzerBody: triggered.body,
    trackerAgeHours: age,
  })
}
