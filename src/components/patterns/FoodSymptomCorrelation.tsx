'use client'

/**
 * Food-Symptom Correlation Display
 *
 * Shows relationships between food intake and symptom flares.
 * "Your pain averages 2 points higher on days following high-dairy meals"
 *
 * This is one of our key differentiators -- no competitor does this well.
 */

import { useMemo } from 'react'

interface FoodSymptomProps {
  foodEntries: Array<{
    date: string
    food_items: string
    flagged_triggers: string[]
  }>
  dailyLogs: Array<{
    date: string
    overall_pain: number | null
    fatigue: number | null
    bloating: number | null
  }>
}

interface TriggerCorrelation {
  trigger: string
  occurrences: number
  avgPainAfter: number
  avgPainWithout: number
  painDelta: number
  avgBloatingAfter: number
  avgFatigueAfter: number
}

function getDeltaColor(delta: number): string {
  if (delta >= 2) return '#C62828'
  if (delta >= 1) return '#E65100'
  if (delta >= 0.5) return '#F57F17'
  return 'var(--text-muted)'
}

export default function FoodSymptomCorrelation({ foodEntries, dailyLogs }: FoodSymptomProps) {
  const correlations = useMemo(() => {
    if (foodEntries.length < 7 || dailyLogs.length < 7) return []

    // Build date -> symptoms map
    const symptomsByDate = new Map<string, { pain: number; fatigue: number; bloating: number }>()
    for (const log of dailyLogs) {
      if (log.overall_pain !== null) {
        symptomsByDate.set(log.date, {
          pain: log.overall_pain ?? 0,
          fatigue: log.fatigue ?? 0,
          bloating: log.bloating ?? 0,
        })
      }
    }

    // Collect all triggers and compute next-day symptom averages
    const triggerData = new Map<string, { painAfter: number[]; bloatingAfter: number[]; fatigueAfter: number[] }>()
    const allPainScores: number[] = []

    for (const entry of foodEntries) {
      if (!entry.flagged_triggers || entry.flagged_triggers.length === 0) continue

      // Look at symptoms the NEXT day (delayed reaction)
      const entryDate = new Date(entry.date)
      const nextDay = new Date(entryDate.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const nextSymptoms = symptomsByDate.get(nextDay)

      if (!nextSymptoms) continue

      for (const trigger of entry.flagged_triggers) {
        const t = trigger.toLowerCase().trim()
        if (!t) continue

        if (!triggerData.has(t)) {
          triggerData.set(t, { painAfter: [], bloatingAfter: [], fatigueAfter: [] })
        }
        const data = triggerData.get(t)!
        data.painAfter.push(nextSymptoms.pain)
        data.bloatingAfter.push(nextSymptoms.bloating)
        data.fatigueAfter.push(nextSymptoms.fatigue)
      }
    }

    // Compute baseline pain (all days)
    for (const [, symptoms] of symptomsByDate) {
      allPainScores.push(symptoms.pain)
    }
    const baselinePain = allPainScores.length > 0
      ? allPainScores.reduce((a, b) => a + b, 0) / allPainScores.length
      : 0

    // Build correlations
    const results: TriggerCorrelation[] = []

    for (const [trigger, data] of triggerData) {
      if (data.painAfter.length < 3) continue // Need at least 3 occurrences

      const avgPain = data.painAfter.reduce((a, b) => a + b, 0) / data.painAfter.length
      const avgBloating = data.bloatingAfter.reduce((a, b) => a + b, 0) / data.bloatingAfter.length
      const avgFatigue = data.fatigueAfter.reduce((a, b) => a + b, 0) / data.fatigueAfter.length

      results.push({
        trigger,
        occurrences: data.painAfter.length,
        avgPainAfter: Math.round(avgPain * 10) / 10,
        avgPainWithout: Math.round(baselinePain * 10) / 10,
        painDelta: Math.round((avgPain - baselinePain) * 10) / 10,
        avgBloatingAfter: Math.round(avgBloating * 10) / 10,
        avgFatigueAfter: Math.round(avgFatigue * 10) / 10,
      })
    }

    // Sort by pain impact (highest delta first)
    return results.sort((a, b) => b.painDelta - a.painDelta)
  }, [foodEntries, dailyLogs])

  if (correlations.length === 0) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Food-Symptom Connections
        </h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Keep logging meals with trigger flags and symptoms daily. We need at least 7 days of data to find patterns.
        </p>
      </div>
    )
  }

  const worstTriggers = correlations.filter(c => c.painDelta > 0)
  const bestFoods = correlations.filter(c => c.painDelta < 0)

  return (
    <div className="space-y-3">
      {/* Worst triggers */}
      {worstTriggers.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#FFEBEE', border: '1px solid #EF9A9A' }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: '#C62828' }}>
            Potential Food Triggers
          </h3>
          <p className="text-[10px] mb-3" style={{ color: '#E53935' }}>
            Pain averages higher the day after eating these
          </p>
          {worstTriggers.slice(0, 5).map(c => (
            <div key={c.trigger} className="flex items-center justify-between py-1.5"
              style={{ borderBottom: '1px solid #FFCDD2' }}>
              <div>
                <span className="text-sm font-medium capitalize" style={{ color: '#B71C1C' }}>
                  {c.trigger}
                </span>
                <span className="text-[10px] ml-2" style={{ color: '#E53935' }}>
                  ({c.occurrences} times)
                </span>
              </div>
              <span
                className="text-sm font-bold"
                style={{ color: getDeltaColor(c.painDelta) }}
              >
                +{c.painDelta} pain
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Beneficial foods */}
      {bestFoods.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--accent-sage-muted)', border: '1px solid var(--accent-sage)' }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--accent-sage)' }}>
            Potentially Helpful Foods
          </h3>
          <p className="text-[10px] mb-3" style={{ color: '#6B9080' }}>
            Pain tends to be lower the day after eating these
          </p>
          {bestFoods.slice(0, 5).map(c => (
            <div key={c.trigger} className="flex items-center justify-between py-1.5"
              style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                  {c.trigger}
                </span>
                <span className="text-[10px] ml-2" style={{ color: 'var(--text-muted)' }}>
                  ({c.occurrences} times)
                </span>
              </div>
              <span className="text-sm font-bold" style={{ color: 'var(--accent-sage)' }}>
                {c.painDelta} pain
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
        Based on next-day symptom analysis. Correlation does not mean causation -- discuss with your doctor.
      </p>
    </div>
  )
}
