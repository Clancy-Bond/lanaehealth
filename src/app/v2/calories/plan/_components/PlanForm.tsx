'use client'

/*
 * PlanForm
 *
 * Composes the four editors into one form. Submits form-encoded to
 * /api/calories/plan. The route handler redirects to /calories/plan
 * for HTML form posts, which would skip our /v2 prefix, so we use
 * fetch + accept:application/json and route ourselves to keep the
 * user inside v2 on success (mirrors RecipeBuilderForm).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/v2/components/primitives'
import { recalcMacrosFromCalories, type NutritionGoals } from '@/lib/calories/goals'
import CalorieTargetEditor from './CalorieTargetEditor'
import MacroTargetEditor, { type MacroValues } from './MacroTargetEditor'
import WeightPlanEditor, { type WeightPlanValues, type WeightUnit } from './WeightPlanEditor'
import ActivityLevelSelect, { type ActivityLevel } from './ActivityLevelSelect'

export interface PlanFormProps {
  initial: NutritionGoals
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--v2-text-lg)',
  fontWeight: 'var(--v2-weight-semibold)',
  color: 'var(--v2-text-primary)',
  letterSpacing: 'var(--v2-tracking-tight)',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        <h2 style={sectionTitleStyle}>{title}</h2>
        {children}
      </div>
    </Card>
  )
}

export default function PlanForm({ initial }: PlanFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [calorieTarget, setCalorieTarget] = useState<number>(initial.calorieTarget)
  const [macros, setMacros] = useState<MacroValues>(initial.macros)
  const [macrosManual, setMacrosManual] = useState<boolean>(initial.macrosManual)
  const [weight, setWeight] = useState<WeightPlanValues>({
    ...initial.weight,
    targetDate: initial.weight.targetDate ?? defaultTargetDate(),
  })
  const [unit, setUnit] = useState<WeightUnit>('lb')
  const [activity, setActivity] = useState<ActivityLevel>(initial.activityLevel)

  // When auto-calc is on, calorie changes drive the visible macros so
  // the user sees the recomputed split before they save.
  const visibleMacros: MacroValues = macrosManual
    ? macros
    : { ...macros, ...recalcMacrosFromCalories(calorieTarget) }

  const onCalorieChange = (next: number) => {
    setCalorieTarget(next)
    if (!macrosManual) {
      setMacros((prev) => ({ ...prev, ...recalcMacrosFromCalories(next) }))
    }
  }

  const onManualChange = (nextManual: boolean) => {
    setMacrosManual(nextManual)
    if (!nextManual) {
      // Snap macros back to the auto split immediately.
      setMacros((prev) => ({ ...prev, ...recalcMacrosFromCalories(calorieTarget) }))
    }
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const body = new URLSearchParams()
    body.append('calorieTarget', String(calorieTarget))
    body.append('carbsG', String(visibleMacros.carbsG))
    body.append('proteinG', String(visibleMacros.proteinG))
    body.append('fatG', String(visibleMacros.fatG))
    body.append('fiberG', String(visibleMacros.fiberG))
    body.append('sodiumMg', String(visibleMacros.sodiumMg))
    body.append('calciumMg', String(visibleMacros.calciumMg))
    if (weight.currentKg != null) body.append('currentKg', String(weight.currentKg))
    if (weight.targetKg != null) body.append('targetKg', String(weight.targetKg))
    if (weight.targetDate) body.append('targetDate', weight.targetDate)
    body.append('activityLevel', activity)
    body.append('macrosManual', macrosManual ? 'true' : 'false')

    startTransition(async () => {
      try {
        const res = await fetch('/api/calories/plan', {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body: body.toString(),
        })
        if (!res.ok) {
          setError("That didn't go through. Want to try again?")
          return
        }
        router.push('/v2/calories/plan?saved=1')
        router.refresh()
      } catch {
        setError("That didn't go through. Want to try again?")
      }
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-5)' }}
    >
      <Section title="Calorie target">
        <CalorieTargetEditor value={calorieTarget} onChange={onCalorieChange} />
      </Section>

      <Section title="Macros">
        <MacroTargetEditor
          calorieTarget={calorieTarget}
          values={visibleMacros}
          manual={macrosManual}
          onChange={setMacros}
          onManualChange={onManualChange}
        />
      </Section>

      <Section title="Weight">
        <WeightPlanEditor
          values={weight}
          unit={unit}
          onUnitChange={setUnit}
          onChange={setWeight}
        />
      </Section>

      <Section title="Activity">
        <ActivityLevelSelect value={activity} onChange={setActivity} />
      </Section>

      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--v2-accent-warning)', fontSize: 'var(--v2-text-sm)' }}>
          {error}
        </p>
      )}

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'linear-gradient(to top, var(--v2-bg-primary) 65%, transparent)',
          paddingTop: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-4)',
          marginTop: 'var(--v2-space-2)',
        }}
      >
        <Button variant="primary" size="lg" fullWidth disabled={pending} type="submit">
          {pending ? 'Saving...' : 'Save plan'}
        </Button>
      </div>
    </form>
  )
}

function defaultTargetDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 60)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
