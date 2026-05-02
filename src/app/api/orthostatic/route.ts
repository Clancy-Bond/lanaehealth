import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api/require-user'
import { safeErrorMessage, safeErrorResponse } from '@/lib/api/safe-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/orthostatic?limit=20
export async function GET(request: Request) {
  try {
    await requireUser(request)
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)

    const sb = createServiceClient()
    const { data, error } = await sb
      .from('orthostatic_tests')
      .select('*')
      .order('test_date', { ascending: false })
      .order('test_time', { ascending: false })
      .limit(limit)

    if (error) {
      // Table may not exist yet. Return empty list rather than 500 so the
      // rest of the UI continues to function.
      if (/relation .* does not exist/i.test(error.message)) {
        return NextResponse.json({ tests: [], tableExists: false })
      }
      return NextResponse.json({ error: safeErrorMessage(error, "orthostatic_list_failed") }, { status: 500 })
    }

    return NextResponse.json({ tests: data ?? [], tableExists: true })
  } catch (err) {
    return safeErrorResponse(err, 'orthostatic_list_failed')
  }
}

interface OrthostaticInput {
  test_date?: string
  resting_hr_bpm?: number
  resting_bp_systolic?: number | null
  resting_bp_diastolic?: number | null
  standing_hr_1min?: number | null
  standing_hr_3min?: number | null
  standing_hr_5min?: number | null
  standing_hr_10min?: number | null
  standing_bp_systolic_10min?: number | null
  standing_bp_diastolic_10min?: number | null
  symptoms_experienced?: string | null
  notes?: string | null
  hydration_ml?: number | null
  caffeine_mg?: number | null
}

// POST /api/orthostatic
export async function POST(request: Request) {
  try {
    await requireUser(request)
    const body = (await request.json()) as OrthostaticInput

    if (typeof body.resting_hr_bpm !== 'number' || body.resting_hr_bpm <= 0) {
      return NextResponse.json(
        { error: 'resting_hr_bpm (number) is required' },
        { status: 400 },
      )
    }

    const payload = {
      test_date: body.test_date ?? new Date().toISOString().slice(0, 10),
      resting_hr_bpm: body.resting_hr_bpm,
      resting_bp_systolic: body.resting_bp_systolic ?? null,
      resting_bp_diastolic: body.resting_bp_diastolic ?? null,
      standing_hr_1min: body.standing_hr_1min ?? null,
      standing_hr_3min: body.standing_hr_3min ?? null,
      standing_hr_5min: body.standing_hr_5min ?? null,
      standing_hr_10min: body.standing_hr_10min ?? null,
      standing_bp_systolic_10min: body.standing_bp_systolic_10min ?? null,
      standing_bp_diastolic_10min: body.standing_bp_diastolic_10min ?? null,
      symptoms_experienced: body.symptoms_experienced ?? null,
      notes: body.notes ?? null,
      hydration_ml: body.hydration_ml ?? null,
      caffeine_mg: body.caffeine_mg ?? null,
    }

    const sb = createServiceClient()
    const { data, error } = await sb
      .from('orthostatic_tests')
      .insert(payload)
      .select()
      .single()

    if (error) {
      if (/relation .* does not exist/i.test(error.message)) {
        return NextResponse.json(
          {
            error:
              'orthostatic_tests table not yet created. Apply migration 013 via the Supabase SQL editor.',
          },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: safeErrorMessage(error, "orthostatic_insert_failed") }, { status: 500 })
    }

    return NextResponse.json({ test: data })
  } catch (err) {
    return safeErrorResponse(err, 'orthostatic_insert_failed')
  }
}
