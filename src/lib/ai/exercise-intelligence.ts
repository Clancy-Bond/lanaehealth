/**
 * Chronic Illness Exercise Intelligence
 *
 * Calculates safe exercise ceiling based on post-exertional malaise (PEM) history.
 * Tracks which combinations of activity type, duration, intensity, and position
 * cause symptom flares within 12-48 hours.
 *
 * Unique to LanaeHealth -- no fitness app considers PEM or exercise intolerance.
 *
 * Outputs:
 * - Safe ceiling per intensity level (max duration without flare)
 * - Position progression tracker (recumbent -> standing for POTS)
 * - Post-exercise symptom correlation scores
 * - Personalized recommendations based on history
 */

import { createServiceClient } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────

export interface ExerciseCeiling {
  intensity: 'gentle' | 'moderate' | 'vigorous'
  maxSafeMinutes: number | null    // Max duration without triggering PEM
  avgSafeMinutes: number           // Average safe duration
  flareRate: number                // 0-100%: what % of workouts at this intensity cause flares
  sampleSize: number               // Number of workouts analyzed
  recommendation: string
}

export interface PositionProgression {
  recumbent: { count: number; avgDuration: number; flareRate: number }
  seated: { count: number; avgDuration: number; flareRate: number }
  standing: { count: number; avgDuration: number; flareRate: number }
  mixed: { count: number; avgDuration: number; flareRate: number }
  currentLevel: 'recumbent' | 'seated' | 'standing' | 'mixed'
  readyToProgress: boolean
  progressionMessage: string
}

export interface ExerciseIntelligence {
  ceilings: ExerciseCeiling[]
  positionProgression: PositionProgression
  bestActivityTypes: Array<{ type: string; avgFlareRate: number; count: number }>
  worstActivityTypes: Array<{ type: string; avgFlareRate: number; count: number }>
  weeklyCapacity: {
    estimatedMinutes: number       // Total safe exercise minutes per week
    currentUsage: number           // Minutes exercised this week
    remaining: number
  }
  overallRecommendation: string
}

interface WorkoutRecord {
  date: string
  type: string
  duration: number
  intensity: string
  position: string
  preSymptom: number | null
  postSymptom: number | null
  nextDayPain: number | null       // Pain from next day's daily_log
}

// ── Analysis Functions ─────────────────────────────────────────────

/**
 * Determine if a workout caused a flare.
 * Flare = post-symptom >= 4 OR next-day pain increased by 2+ points.
 */
function isFlare(workout: WorkoutRecord): boolean {
  if (workout.postSymptom !== null && workout.postSymptom >= 4) return true
  if (workout.preSymptom !== null && workout.nextDayPain !== null) {
    if (workout.nextDayPain - workout.preSymptom >= 2) return true
  }
  if (workout.nextDayPain !== null && workout.nextDayPain >= 7) return true
  return false
}

/**
 * Calculate safe exercise ceiling per intensity.
 */
function calculateCeilings(workouts: WorkoutRecord[]): ExerciseCeiling[] {
  const byIntensity = new Map<string, WorkoutRecord[]>()

  for (const w of workouts) {
    const key = w.intensity || 'gentle'
    if (!byIntensity.has(key)) byIntensity.set(key, [])
    byIntensity.get(key)!.push(w)
  }

  const results: ExerciseCeiling[] = []

  for (const intensity of ['gentle', 'moderate', 'vigorous'] as const) {
    const intensityWorkouts = byIntensity.get(intensity) ?? []

    if (intensityWorkouts.length === 0) {
      results.push({
        intensity,
        maxSafeMinutes: null,
        avgSafeMinutes: 0,
        flareRate: 0,
        sampleSize: 0,
        recommendation: `No ${intensity} workouts logged yet. Start with short sessions and track symptoms.`,
      })
      continue
    }

    const safeWorkouts = intensityWorkouts.filter(w => !isFlare(w))
    const flareWorkouts = intensityWorkouts.filter(w => isFlare(w))
    const flareRate = Math.round(flareWorkouts.length / intensityWorkouts.length * 100)

    const maxSafe = safeWorkouts.length > 0
      ? Math.max(...safeWorkouts.map(w => w.duration))
      : null

    const avgSafe = safeWorkouts.length > 0
      ? Math.round(safeWorkouts.reduce((s, w) => s + w.duration, 0) / safeWorkouts.length)
      : 0

    let recommendation = ''
    if (flareRate >= 50) {
      recommendation = `High flare rate (${flareRate}%). Consider reducing ${intensity} intensity or switching to a lower level.`
    } else if (flareRate >= 25) {
      recommendation = `Moderate flare rate (${flareRate}%). Stay under ${maxSafe ?? avgSafe} minutes for ${intensity} workouts.`
    } else if (maxSafe) {
      recommendation = `Looking good! Your safe ceiling is ~${maxSafe} minutes at ${intensity} intensity.`
    } else {
      recommendation = `Keep logging workouts with symptom checks to build your profile.`
    }

    results.push({
      intensity,
      maxSafeMinutes: maxSafe,
      avgSafeMinutes: avgSafe,
      flareRate,
      sampleSize: intensityWorkouts.length,
      recommendation,
    })
  }

  return results
}

/**
 * Analyze position progression for POTS patients.
 * Levine/Dallas protocol: recumbent -> seated -> standing over months.
 */
function analyzePositionProgression(workouts: WorkoutRecord[]): PositionProgression {
  const byPosition = new Map<string, WorkoutRecord[]>()

  for (const w of workouts) {
    const pos = w.position || 'mixed'
    if (!byPosition.has(pos)) byPosition.set(pos, [])
    byPosition.get(pos)!.push(w)
  }

  const positionStats = (pos: string) => {
    const ws = byPosition.get(pos) ?? []
    return {
      count: ws.length,
      avgDuration: ws.length > 0
        ? Math.round(ws.reduce((s, w) => s + w.duration, 0) / ws.length)
        : 0,
      flareRate: ws.length > 0
        ? Math.round(ws.filter(w => isFlare(w)).length / ws.length * 100)
        : 0,
    }
  }

  const recumbent = positionStats('recumbent')
  const seated = positionStats('seated')
  const standing = positionStats('standing')
  const mixed = positionStats('mixed')

  // Determine current level and readiness to progress
  let currentLevel: 'recumbent' | 'seated' | 'standing' | 'mixed' = 'recumbent'
  let readyToProgress = false
  let progressionMessage = 'Start with recumbent exercises (rowing, recumbent bike, swimming).'

  if (standing.count >= 3 && standing.flareRate < 30) {
    currentLevel = 'standing'
    progressionMessage = 'You are tolerating standing exercise well. Maintain and gradually increase duration.'
  } else if (seated.count >= 3 && seated.flareRate < 30) {
    currentLevel = 'seated'
    readyToProgress = seated.count >= 5 && seated.flareRate < 20
    progressionMessage = readyToProgress
      ? 'Ready to try short standing exercises (5-10 min walks).'
      : 'Continue building tolerance with seated exercises before progressing.'
  } else if (recumbent.count >= 3 && recumbent.flareRate < 30) {
    currentLevel = 'recumbent'
    readyToProgress = recumbent.count >= 5 && recumbent.flareRate < 20
    progressionMessage = readyToProgress
      ? 'Ready to try short seated exercises (seated strength, chair yoga).'
      : 'Continue building tolerance with recumbent exercises.'
  }

  return {
    recumbent,
    seated,
    standing,
    mixed,
    currentLevel,
    readyToProgress,
    progressionMessage,
  }
}

// ── Main Function ──────────────────────────────────────────────────

/**
 * Run full exercise intelligence analysis.
 */
export async function analyzeExerciseIntelligence(): Promise<ExerciseIntelligence> {
  const sb = createServiceClient()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Fetch workout data from medical_timeline (where workouts are stored)
  const { data: workoutEvents } = await sb
    .from('medical_timeline')
    .select('date, title, description')
    .ilike('title', '%workout%')
    .gte('date', ninetyDaysAgo)
    .order('date')

  // Fetch daily pain data for next-day correlation
  const { data: dailyLogs } = await sb
    .from('daily_logs')
    .select('date, overall_pain')
    .gte('date', ninetyDaysAgo)
    .order('date')

  const painByDate = new Map<string, number>()
  for (const log of dailyLogs ?? []) {
    if (log.overall_pain !== null) {
      painByDate.set(log.date, log.overall_pain)
    }
  }

  // Parse workout events into structured records
  const workouts: WorkoutRecord[] = (workoutEvents ?? []).map(event => {
    const desc = (event.description as string) ?? ''
    const parts = desc.split(' | ')

    const durationMatch = parts.find(p => p.includes('min'))
    const duration = durationMatch ? parseInt(durationMatch) : 30

    const intensity = parts.find(p =>
      ['gentle', 'moderate', 'vigorous'].includes(p.trim())
    ) ?? 'gentle'

    const positionMatch = parts.find(p => p.startsWith('position:'))
    const position = positionMatch?.replace('position:', '').trim() ?? 'mixed'

    const preMatch = parts.find(p => p.startsWith('pre-symptom:'))
    const preSymptom = preMatch ? parseInt(preMatch.replace('pre-symptom:', '')) : null

    const postMatch = parts.find(p => p.startsWith('post-symptom:'))
    const postSymptom = postMatch ? parseInt(postMatch.replace('post-symptom:', '')) : null

    const nextDay = new Date(new Date(event.date as string).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const nextDayPain = painByDate.get(nextDay) ?? null

    // Extract activity type from title
    const typeMatch = (event.title as string).match(/Workout: (.+)/)
    const type = typeMatch?.[1] ?? 'Unknown'

    return {
      date: event.date as string,
      type,
      duration,
      intensity,
      position,
      preSymptom,
      postSymptom,
      nextDayPain,
    }
  })

  // Analyze
  const ceilings = calculateCeilings(workouts)
  const positionProgression = analyzePositionProgression(workouts)

  // Best/worst activity types
  const byType = new Map<string, WorkoutRecord[]>()
  for (const w of workouts) {
    if (!byType.has(w.type)) byType.set(w.type, [])
    byType.get(w.type)!.push(w)
  }

  const typeStats = Array.from(byType.entries())
    .filter(([, ws]) => ws.length >= 2)
    .map(([type, ws]) => ({
      type,
      avgFlareRate: Math.round(ws.filter(w => isFlare(w)).length / ws.length * 100),
      count: ws.length,
    }))
    .sort((a, b) => a.avgFlareRate - b.avgFlareRate)

  const bestTypes = typeStats.filter(t => t.avgFlareRate < 30).slice(0, 3)
  const worstTypes = typeStats.filter(t => t.avgFlareRate >= 30).slice(-3).reverse()

  // Weekly capacity estimate
  const gentleCeiling = ceilings.find(c => c.intensity === 'gentle')
  const safeMinutes = (gentleCeiling?.maxSafeMinutes ?? 30) * 4 // 4 gentle sessions per week

  const thisWeekStart = new Date()
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay())
  const weekStartStr = thisWeekStart.toISOString().slice(0, 10)
  const thisWeekWorkouts = workouts.filter(w => w.date >= weekStartStr)
  const currentUsage = thisWeekWorkouts.reduce((s, w) => s + w.duration, 0)

  // Overall recommendation
  let overallRecommendation = 'Log more workouts with pre/post symptom checks to build your exercise profile.'
  if (workouts.length >= 10) {
    const avgFlareRate = workouts.length > 0
      ? Math.round(workouts.filter(w => isFlare(w)).length / workouts.length * 100)
      : 0

    if (avgFlareRate >= 40) {
      overallRecommendation = `High overall flare rate (${avgFlareRate}%). Focus on ${positionProgression.currentLevel} exercises at gentle intensity, under ${gentleCeiling?.avgSafeMinutes ?? 15} minutes.`
    } else if (avgFlareRate >= 20) {
      overallRecommendation = `Moderate flare rate (${avgFlareRate}%). Stay within your safe ceilings and ${positionProgression.progressionMessage}`
    } else {
      overallRecommendation = `Good tolerance (${avgFlareRate}% flare rate). ${positionProgression.progressionMessage}`
    }
  }

  return {
    ceilings,
    positionProgression,
    bestActivityTypes: bestTypes,
    worstActivityTypes: worstTypes,
    weeklyCapacity: {
      estimatedMinutes: safeMinutes,
      currentUsage,
      remaining: Math.max(0, safeMinutes - currentUsage),
    },
    overallRecommendation,
  }
}
