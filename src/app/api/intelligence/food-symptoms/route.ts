/**
 * Food-Symptom Correlation API
 * GET /api/intelligence/food-symptoms
 *
 * Computes correlations between flagged food triggers and next-day symptoms.
 * Returns a matrix of food x symptom scores suitable for heatmap display.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export async function GET() {
  const sb = createServiceClient()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Fetch food entries with triggers
  const { data: foodData } = await sb
    .from('food_entries')
    .select('logged_at, food_items, flagged_triggers')
    .gte('logged_at', ninetyDaysAgo)

  // Fetch daily symptom logs
  const { data: logData } = await sb
    .from('daily_logs')
    .select('date, overall_pain, fatigue, bloating, stress')
    .gte('date', ninetyDaysAgo)

  if (!foodData || !logData || foodData.length < 5 || logData.length < 5) {
    return NextResponse.json({
      correlations: [],
      message: 'Need more food and symptom data to compute correlations',
    })
  }

  // Build date -> symptom map
  const symptomsByDate = new Map<string, Record<string, number>>()
  for (const log of logData) {
    symptomsByDate.set(log.date, {
      pain: log.overall_pain ?? 0,
      fatigue: log.fatigue ?? 0,
      bloating: log.bloating ?? 0,
      stress: log.stress ?? 0,
    })
  }

  // Compute baseline averages
  const allSymptoms = { pain: 0, fatigue: 0, bloating: 0, stress: 0 }
  let logCount = 0
  for (const log of logData) {
    if (log.overall_pain !== null) {
      allSymptoms.pain += log.overall_pain
      allSymptoms.fatigue += log.fatigue ?? 0
      allSymptoms.bloating += log.bloating ?? 0
      allSymptoms.stress += log.stress ?? 0
      logCount++
    }
  }
  const baseline = logCount > 0 ? {
    pain: allSymptoms.pain / logCount,
    fatigue: allSymptoms.fatigue / logCount,
    bloating: allSymptoms.bloating / logCount,
    stress: allSymptoms.stress / logCount,
  } : { pain: 0, fatigue: 0, bloating: 0, stress: 0 }

  // For each trigger, compute next-day symptom averages vs baseline
  const triggerSymptoms = new Map<string, {
    pain: number[]; fatigue: number[]; bloating: number[]; stress: number[]
  }>()

  for (const entry of foodData) {
    const triggers = entry.flagged_triggers ?? []
    if (triggers.length === 0) continue

    const entryDate = typeof entry.logged_at === 'string' ? entry.logged_at.slice(0, 10) : ''
    const nextDay = new Date(new Date(entryDate).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const nextSymptoms = symptomsByDate.get(nextDay)
    if (!nextSymptoms) continue

    for (const trigger of triggers) {
      const t = trigger.toLowerCase().trim()
      if (!t || t.length < 2) continue

      if (!triggerSymptoms.has(t)) {
        triggerSymptoms.set(t, { pain: [], fatigue: [], bloating: [], stress: [] })
      }
      const data = triggerSymptoms.get(t)!
      data.pain.push(nextSymptoms.pain)
      data.fatigue.push(nextSymptoms.fatigue)
      data.bloating.push(nextSymptoms.bloating)
      data.stress.push(nextSymptoms.stress)
    }
  }

  // Build correlation matrix
  const correlations: Array<{
    food: string
    symptom: string
    score: number  // -1 to +1
    occurrences: number
  }> = []

  for (const [trigger, data] of triggerSymptoms) {
    if (data.pain.length < 3) continue // Need at least 3 occurrences

    const symptoms = ['pain', 'fatigue', 'bloating', 'stress'] as const
    for (const symptom of symptoms) {
      const values = data[symptom]
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      const baselineVal = baseline[symptom]
      // Score: normalized difference from baseline (-1 to +1 range)
      const maxPossible = 10 // 0-10 scale
      const score = baselineVal > 0
        ? Math.max(-1, Math.min(1, (avg - baselineVal) / maxPossible * 2))
        : 0

      if (Math.abs(score) > 0.05) { // Only include meaningful correlations
        correlations.push({
          food: trigger,
          symptom,
          score: Math.round(score * 100) / 100,
          occurrences: values.length,
        })
      }
    }
  }

  // Sort by absolute score (strongest correlations first)
  correlations.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))

  return NextResponse.json({
    correlations: correlations.slice(0, 50), // Top 50
    totalTriggers: triggerSymptoms.size,
    daysAnalyzed: logData.length,
    foodEntriesAnalyzed: foodData.length,
  })
}
