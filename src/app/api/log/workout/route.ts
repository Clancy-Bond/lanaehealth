// POST /api/log/workout
//
// Created this sweep (D-007 fix) so the WorkoutCard client component
// no longer needs createServiceClient. Body validated with zod;
// inserts one medical_timeline row.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth/require-user'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import { jsonError } from '@/lib/api/json-error'
import { zIsoDate, zOptionalNumber } from '@/lib/api/zod-forms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  date: zIsoDate,
  activityLabel: z.string().trim().min(1),
  position: z.enum(['recumbent', 'seated', 'standing', 'mixed']),
  intensity: z.enum(['gentle', 'moderate', 'vigorous']),
  duration: z.coerce.number().positive(),
  preSymptom: zOptionalNumber,
  postSymptom: zOptionalNumber,
  notes: z.string().nullish(),
})

export async function POST(req: NextRequest) {
  const gate = requireAuth(req)
  if (!gate.ok) return gate.response

  let userId: string
  try {
    userId = (await resolveUserId()).userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return jsonError(401, 'unauthenticated')
    }
    return jsonError(500, 'auth_check_failed')
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return jsonError(400, 'bad_body')
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return jsonError(400, 'workout_invalid', parsed.error)
  }
  const b = parsed.data

  const description = [
    `${b.duration} min`,
    b.intensity,
    `position: ${b.position}`,
    b.preSymptom !== undefined ? `pre-symptom: ${b.preSymptom}/5` : null,
    b.postSymptom !== undefined ? `post-symptom: ${b.postSymptom}/5` : null,
    b.notes || null,
  ]
    .filter(Boolean)
    .join(' | ')

  const sb = createServiceClient()
  const { error } = await sb.from('medical_timeline').insert({
    date: b.date,
    user_id: userId,
    event_type: 'test',
    title: `Workout: ${b.activityLabel}`,
    description,
    significance: 'normal',
    source: 'daily_log',
  })
  if (error) return jsonError(500, 'workout_insert_failed', error.message)

  return NextResponse.json({ ok: true }, { status: 200 })
}
