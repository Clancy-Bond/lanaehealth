/**
 * Nutrition Intelligence API
 * GET /api/intelligence/nutrition?goal=maintain
 *
 * Returns adaptive calorie/macro targets based on actual weight trends.
 * Goals: lose, maintain, gain
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdaptiveCalorieTarget, type GoalType } from '@/lib/ai/adaptive-calories'

export async function GET(req: NextRequest) {
  const goal = (req.nextUrl.searchParams.get('goal') ?? 'maintain') as GoalType
  const weight = req.nextUrl.searchParams.get('weight')
    ? parseFloat(req.nextUrl.searchParams.get('weight')!)
    : null

  if (!['lose', 'maintain', 'gain'].includes(goal)) {
    return NextResponse.json({ error: 'goal must be lose, maintain, or gain' }, { status: 400 })
  }

  try {
    const target = await getAdaptiveCalorieTarget(goal, weight)
    return NextResponse.json(target)
  } catch (e) {
    return NextResponse.json(
      { error: `Nutrition analysis failed: ${e instanceof Error ? e.message : 'Unknown'}` },
      { status: 500 },
    )
  }
}
