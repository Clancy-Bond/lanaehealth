/**
 * Vitals Intelligence API
 * GET /api/intelligence/vitals
 * POST /api/intelligence/vitals - Save orthostatic test result
 *
 * GET: Returns positional vitals intelligence (latest orthostatic,
 * 30-day trend, outlier detection, recommendations).
 *
 * POST: Saves an orthostatic test and returns calculated deltas.
 * Body: { supineHR, standingHR, supineBP?, standingBP? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getVitalsIntelligence, saveOrthostaticResult } from '@/lib/ai/vitals-intelligence'

export const maxDuration = 30

export async function GET() {
  try {
    const intelligence = await getVitalsIntelligence()
    return NextResponse.json(intelligence)
  } catch (e) {
    return NextResponse.json(
      { error: `Vitals analysis failed: ${e instanceof Error ? e.message : 'Unknown'}` },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { supineHR, standingHR, supineBP, standingBP } = body

    if (!supineHR || !standingHR) {
      return NextResponse.json(
        { error: 'supineHR and standingHR are required' },
        { status: 400 },
      )
    }

    const today = new Date().toISOString().slice(0, 10)
    const result = await saveOrthostaticResult(today, supineHR, standingHR, supineBP, standingBP)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: `Save failed: ${e instanceof Error ? e.message : 'Unknown'}` },
      { status: 500 },
    )
  }
}
