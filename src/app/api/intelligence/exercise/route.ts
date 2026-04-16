/**
 * Exercise Intelligence API
 * GET /api/intelligence/exercise
 *
 * Returns chronic illness exercise analysis: safe ceilings,
 * position progression (POTS), best/worst activities, weekly capacity.
 */

import { NextResponse } from 'next/server'
import { analyzeExerciseIntelligence } from '@/lib/ai/exercise-intelligence'

export const maxDuration = 30

export async function GET() {
  try {
    const intelligence = await analyzeExerciseIntelligence()
    return NextResponse.json(intelligence)
  } catch (e) {
    return NextResponse.json(
      { error: `Exercise analysis failed: ${e instanceof Error ? e.message : 'Unknown'}` },
      { status: 500 },
    )
  }
}
