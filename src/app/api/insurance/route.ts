/**
 * Insurance Profile API Route (v2 navigator).
 *
 *   GET  /api/insurance  -> { profile, definitions }
 *   PUT  /api/insurance  -> upsert { planSlug, memberId?, notes? }
 *
 * Backed by the EAV helpers in src/lib/api/insurance.ts. No new
 * migration: the profile lives in the existing health_profile table
 * under section='insurance'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getInsuranceProfile,
  setInsuranceProfile,
  INSURANCE_PLAN_DEFINITIONS,
  type InsuranceProfile,
} from '@/lib/api/insurance'
import { jsonError } from '@/lib/api/json-error'

const SLUG_VALUES = INSURANCE_PLAN_DEFINITIONS.map((p) => p.slug) as [
  string,
  ...string[],
]

const BodySchema = z.object({
  planSlug: z.enum(SLUG_VALUES),
  memberId: z.string().optional(),
  notes: z.string().optional(),
})

export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getInsuranceProfile()
  return NextResponse.json({
    profile,
    definitions: INSURANCE_PLAN_DEFINITIONS,
  })
}

export async function PUT(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return jsonError(400, 'bad_body')
  }

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return jsonError(400, 'insurance_invalid', parsed.error)
  }

  const result = await setInsuranceProfile(parsed.data as InsuranceProfile)
  if (!result.ok) {
    return jsonError(500, 'insurance_save_failed', result.error)
  }
  return NextResponse.json(result)
}
