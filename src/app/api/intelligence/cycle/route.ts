/**
 * Cycle Intelligence API
 * GET /api/intelligence/cycle
 *
 * Returns multi-signal cycle analysis: current phase, ovulation detection,
 * period prediction, fertile window, and clinical flags.
 */

import { NextResponse } from 'next/server'
import { analyzeCycleIntelligence } from '@/lib/ai/cycle-intelligence'

export const maxDuration = 30

export async function GET() {
  try {
    const intelligence = await analyzeCycleIntelligence()
    return NextResponse.json(intelligence)
  } catch (e) {
    return NextResponse.json(
      { error: `Cycle analysis failed: ${e instanceof Error ? e.message : 'Unknown'}` },
      { status: 500 },
    )
  }
}
