'use client'

import { useMemo, useState, useEffect } from 'react'

interface AdaptiveTarget {
  dailyCalories: number
  protein: number
  fat: number
  carbs: number
  tdeeEstimate: number
  weeklyAdjustment: number
  confidence: string
  explanation: string
}

interface DailyNutrients {
  date: string
  calories: number
  protein: number
  fat: number
  carbs: number
  fiber: number
  iron: number
  vitaminC: number
  calcium: number
}

interface NutrientDashboardProps {
  data: DailyNutrients[]
}

// RDA (Recommended Daily Allowance) for a 24-year-old female
const RDA: Record<string, { amount: number; unit: string; label: string }> = {
  calories: { amount: 2000, unit: 'kcal', label: 'Calories' },
  protein: { amount: 46, unit: 'g', label: 'Protein' },
  fat: { amount: 65, unit: 'g', label: 'Fat' },
  carbs: { amount: 300, unit: 'g', label: 'Carbs' },
  fiber: { amount: 25, unit: 'g', label: 'Fiber' },
  iron: { amount: 18, unit: 'mg', label: 'Iron' },
  vitaminC: { amount: 75, unit: 'mg', label: 'Vitamin C' },
  calcium: { amount: 1000, unit: 'mg', label: 'Calcium' },
}

function getPercentColor(pct: number): string {
  if (pct >= 90) return 'var(--accent-sage)'
  if (pct >= 60) return '#6B9080'
  if (pct >= 30) return '#F57F17'
  return '#C62828'
}

export default function NutrientDashboard({ data }: NutrientDashboardProps) {
  const [adaptiveTarget, setAdaptiveTarget] = useState<AdaptiveTarget | null>(null)

  // Fetch adaptive calorie target
  useEffect(() => {
    fetch('/api/intelligence/nutrition?goal=maintain')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && !data.error) setAdaptiveTarget(data) })
      .catch(() => {})
  }, [])

  const averages = useMemo(() => {
    if (data.length === 0) return null

    const last7 = data.slice(-7)
    const avg = (key: keyof DailyNutrients) => {
      const vals = last7.map(d => d[key] as number).filter(v => v > 0)
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    }

    return {
      calories: Math.round(avg('calories')),
      protein: Math.round(avg('protein')),
      fat: Math.round(avg('fat')),
      carbs: Math.round(avg('carbs')),
      fiber: Math.round(avg('fiber') * 10) / 10,
      iron: Math.round(avg('iron') * 10) / 10,
      vitaminC: Math.round(avg('vitaminC')),
      calcium: Math.round(avg('calcium')),
    }
  }, [data])

  if (!averages || data.length === 0) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
          No nutrition data yet. Log meals or import from MyNetDiary/Cronometer.
        </p>
      </div>
    )
  }

  const nutrients = Object.entries(RDA).map(([key, rda]) => {
    const value = averages[key as keyof typeof averages] as number
    const pct = Math.min(Math.round((value / rda.amount) * 100), 200)
    return { key, value, pct, ...rda }
  })

  // Separate macros from micros
  const macros = nutrients.filter(n => ['calories', 'protein', 'fat', 'carbs', 'fiber'].includes(n.key))
  const micros = nutrients.filter(n => ['iron', 'vitaminC', 'calcium'].includes(n.key))

  return (
    <div className="space-y-3">
      {/* Adaptive Target Banner */}
      {adaptiveTarget && (
        <div className="rounded-xl p-4" style={{ background: 'var(--accent-sage-muted)', border: '1px solid var(--accent-sage)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--accent-sage)' }}>
              Adaptive Daily Target
            </p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
              background: adaptiveTarget.confidence === 'high' ? 'var(--accent-sage)' : '#F57F17',
              color: '#fff',
            }}>
              {adaptiveTarget.confidence}
            </span>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {adaptiveTarget.dailyCalories}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>kcal/day</p>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {adaptiveTarget.protein}g P
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {adaptiveTarget.fat}g F | {adaptiveTarget.carbs}g C
              </p>
            </div>
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {adaptiveTarget.explanation}
          </p>
          {adaptiveTarget.weeklyAdjustment !== 0 && (
            <p className="text-[10px] font-semibold mt-0.5" style={{
              color: adaptiveTarget.weeklyAdjustment > 0 ? 'var(--accent-sage)' : '#E65100',
            }}>
              {adaptiveTarget.weeklyAdjustment > 0 ? '+' : ''}{adaptiveTarget.weeklyAdjustment} cal/day adjustment this week
            </p>
          )}
        </div>
      )}

      {/* Macros */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
          7-Day Average Macros
        </p>
        <div className="space-y-2.5">
          {macros.map(n => (
            <div key={n.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {n.label}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {n.value}{n.unit} / {n.amount}{n.unit}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(n.pct, 100)}%`,
                    background: getPercentColor(n.pct),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Micronutrients (especially iron for endo) */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
          Key Micronutrients
        </p>
        <div className="grid grid-cols-3 gap-3">
          {micros.map(n => {
            const color = getPercentColor(n.pct)
            return (
              <div key={n.key} className="text-center">
                {/* Circular progress */}
                <div className="relative mx-auto" style={{ width: 64, height: 64 }}>
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="var(--bg-elevated)" strokeWidth="4" />
                    <circle
                      cx="32" cy="32" r="28"
                      fill="none"
                      stroke={color}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.min(n.pct, 100) * 1.76} 176`}
                      transform="rotate(-90 32 32)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold" style={{ color }}>
                      {n.pct}%
                    </span>
                  </div>
                </div>
                <p className="text-xs font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
                  {n.label}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {n.value}{n.unit} / {n.amount}{n.unit}
                </p>
              </div>
            )
          })}
        </div>

        {/* Iron absorption context for endo patients */}
        {averages.iron < 18 && (
          <div
            className="mt-3 rounded-lg p-3"
            style={{ background: '#FFF3E0', border: '1px solid #FFE082' }}
          >
            <p className="text-xs font-medium" style={{ color: '#E65100' }}>
              Iron intake is below RDA ({averages.iron}mg vs 18mg recommended)
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: '#F57F17' }}>
              Pair iron-rich foods with vitamin C to boost absorption.
              Avoid calcium, coffee, and tea within 1 hour of iron-rich meals.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
