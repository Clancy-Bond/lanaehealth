/**
 * PRN Medication Intelligence API
 * GET /api/intelligence/prn?medication=Tylenol
 * GET /api/intelligence/prn?medication=Tylenol&analysis=frequency
 *
 * Returns real-time PRN dose status (time-since-last, max warnings)
 * or frequency analysis (escalation, symptom correlation, cycle patterns).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPrnDoseStatus, analyzePrnFrequency } from '@/lib/ai/prn-intelligence'

export async function GET(req: NextRequest) {
  const medication = req.nextUrl.searchParams.get('medication')
  const analysis = req.nextUrl.searchParams.get('analysis')

  if (!medication) {
    return NextResponse.json({ error: 'medication parameter required' }, { status: 400 })
  }

  try {
    if (analysis === 'frequency') {
      const report = await analyzePrnFrequency(medication)
      return NextResponse.json(report)
    }

    const status = await getPrnDoseStatus(medication)
    return NextResponse.json(status)
  } catch (e) {
    return NextResponse.json(
      { error: `PRN analysis failed: ${e instanceof Error ? e.message : 'Unknown'}` },
      { status: 500 },
    )
  }
}
