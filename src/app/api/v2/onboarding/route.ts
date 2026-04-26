/**
 * /api/v2/onboarding
 *
 * GET  -> { onboarded: boolean }
 * POST -> save a single step's payload.
 *
 * Body shape for POST:
 *   { step: 'personal' | 'conditions' | 'medications' | 'insurance' | 'complete' | 'skip',
 *     data?: ... }
 *
 * Every write is scoped to the authenticated Supabase user. The
 * client cannot influence the user_id; we read it from the session
 * via requireUser().
 *
 * Voice rule: error messages stay short and human (no stack traces
 * exposed). Anything that would identify the underlying table or
 * column is wrapped in a generic phrase.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, UnauthenticatedError } from '@/lib/auth/get-user'
import {
  isOnboarded,
  markOnboarded,
  saveOnboardingPersonal,
  saveOnboardingMedications,
  saveOnboardingAllergies,
  saveOnboardingConditions,
  saveOnboardingInsurance,
} from '@/lib/v2/onboarding/state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PersonalSchema = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  date_of_birth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  age: z.number().int().min(0).max(120).optional(),
  sex: z.enum(['female', 'male', 'intersex', 'prefer_not']).optional(),
  height_cm: z.number().min(50).max(280).optional(),
  weight_kg: z.number().min(20).max(400).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
})

const MedicationItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dose: z.string().trim().max(80).optional(),
  schedule: z.string().trim().max(120).optional(),
})

const AllergyItemSchema = z.object({
  substance: z.string().trim().min(1).max(120),
  reaction: z.string().trim().max(160).optional(),
})

const ConditionsSchema = z.object({
  conditions: z.array(z.string().trim().min(1).max(120)).max(80),
})

const InsuranceSchema = z.object({
  planSlug: z.string().trim().min(1).max(80),
  memberId: z.string().trim().max(64).optional(),
  notes: z.string().trim().max(280).optional(),
})

const PostSchema = z.discriminatedUnion('step', [
  z.object({ step: z.literal('personal'), data: PersonalSchema }),
  z.object({ step: z.literal('medications'), data: z.array(MedicationItemSchema).max(80) }),
  z.object({ step: z.literal('allergies'), data: z.array(AllergyItemSchema).max(80) }),
  z.object({ step: z.literal('conditions'), data: ConditionsSchema }),
  z.object({ step: z.literal('insurance'), data: InsuranceSchema }),
  z.object({ step: z.literal('complete') }),
  z.object({ step: z.literal('skip') }),
])

export async function GET() {
  try {
    const user = await requireUser()
    const onboarded = await isOnboarded(user.id)
    return NextResponse.json({ onboarded })
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let user
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const parsed = PostSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const userId = user.id
  const body = parsed.data

  switch (body.step) {
    case 'personal': {
      const result = await saveOnboardingPersonal(userId, body.data)
      return result.ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: 'save failed' }, { status: 500 })
    }
    case 'medications': {
      const result = await saveOnboardingMedications(userId, body.data)
      return result.ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: 'save failed' }, { status: 500 })
    }
    case 'allergies': {
      const result = await saveOnboardingAllergies(userId, body.data)
      return result.ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: 'save failed' }, { status: 500 })
    }
    case 'conditions': {
      const result = await saveOnboardingConditions(userId, body.data.conditions)
      return result.ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: 'save failed' }, { status: 500 })
    }
    case 'insurance': {
      const result = await saveOnboardingInsurance(userId, body.data)
      return result.ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: 'save failed' }, { status: 500 })
    }
    case 'complete': {
      const result = await markOnboarded(userId)
      return result.ok
        ? NextResponse.json({ ok: true, onboarded: true })
        : NextResponse.json({ error: 'save failed' }, { status: 500 })
    }
    case 'skip': {
      const result = await markOnboarded(userId, { skipped: true })
      return result.ok
        ? NextResponse.json({ ok: true, onboarded: true, skipped: true })
        : NextResponse.json({ error: 'save failed' }, { status: 500 })
    }
  }
}
