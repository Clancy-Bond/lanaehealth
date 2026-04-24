'use client'

/*
 * PhotoCaptureFlow
 *
 * Three states:
 *   1. Picker. Big tap target -> file input with capture="environment"
 *      so iOS pops the camera. Static intro copy.
 *   2. Identifying. Spinner-like shimmer while /api/food/identify
 *      runs Claude Vision + USDA enrichment.
 *   3. Review. List each identified food with calories, meal type,
 *      and a Log button that POSTs to /api/food/log.
 *
 * Errors are honest: if Claude returns no foods, we say so and let the
 * user retake or jump to search. No silent failures.
 */

import { useRef, useState } from 'react'
import { Button, Card, EmptyState, Banner } from '@/v2/components/primitives'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

interface IdentifiedFood {
  name: string
  estimatedGrams: number
  estimatedCalories: number
  mealType: string
  fdcId: number | null
  usdaMatch: string | null
  nutrients: {
    calories: number
    protein: number | null
    fat: number | null
    carbs: number | null
    fiber: number | null
    iron: number | null
    vitaminC: number | null
  } | null
}

interface IdentifyResponse {
  foods: IdentifiedFood[]
  mealDescription: string
  totalCalories?: number
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

function isMealType(s: string): s is MealType {
  return s === 'breakfast' || s === 'lunch' || s === 'dinner' || s === 'snack'
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') resolve(result)
      else reject(new Error('Could not read file.'))
    }
    reader.onerror = () => reject(new Error('Could not read file.'))
    reader.readAsDataURL(file)
  })
}

export interface PhotoCaptureFlowProps {
  date: string
  defaultMeal: string
}

export default function PhotoCaptureFlow({ date, defaultMeal }: PhotoCaptureFlowProps) {
  const fallbackMeal: MealType = isMealType(defaultMeal) ? defaultMeal : 'breakfast'
  const [phase, setPhase] = useState<'picker' | 'identifying' | 'review' | 'error'>('picker')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [foods, setFoods] = useState<IdentifiedFood[]>([])
  const [mealDescription, setMealDescription] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loggedIndices, setLoggedIndices] = useState<Set<number>>(new Set())
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const reset = () => {
    setPhase('picker')
    setPreviewUrl(null)
    setFoods([])
    setMealDescription('')
    setError(null)
    setLoggedIndices(new Set())
    setPendingIndex(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = async (file: File) => {
    setError(null)
    setPhase('identifying')
    try {
      const dataUrl = await readFileAsDataURL(file)
      setPreviewUrl(dataUrl)
      const mediaType = file.type || 'image/jpeg'
      const res = await fetch('/api/food/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, mediaType }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(errBody.error ?? `Identify failed (${res.status}).`)
      }
      const data = (await res.json()) as IdentifyResponse
      setFoods(data.foods ?? [])
      setMealDescription(data.mealDescription ?? '')
      setPhase('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not identify the photo.')
      setPhase('error')
    }
  }

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  const logFood = async (idx: number, food: IdentifiedFood, mealType: MealType) => {
    if (!food.fdcId) {
      setError('USDA could not match that food. Try search instead.')
      return
    }
    setPendingIndex(idx)
    try {
      const fd = new FormData()
      fd.set('fdcId', String(food.fdcId))
      fd.set('meal_type', mealType)
      // Per /api/food/log contract: gramsPerUnit is total grams for one
      // pick of the selected portion, servings is the multiplier. Claude
      // gave us estimated grams as a single portion -> servings = 1.
      fd.set('gramsPerUnit', String(food.estimatedGrams))
      fd.set('servings', '1')
      fd.set('portionLabel', `~${Math.round(food.estimatedGrams)} g (photo)`)
      fd.set('date', date)
      const res = await fetch('/api/food/log', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(errBody.error ?? `Log failed (${res.status}).`)
      }
      setLoggedIndices((prev) => {
        const next = new Set(prev)
        next.add(idx)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log that food.')
    } finally {
      setPendingIndex(null)
    }
  }

  if (phase === 'picker') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        <Card padding="md">
          <p
            style={{
              margin: 0, fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-primary)', lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Snap a meal and we{'\u2019'}ll try to identify it. Quick check before logging.
          </p>
        </Card>

        <label
          htmlFor="photo-meal-input"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 'var(--v2-space-3)',
            padding: 'var(--v2-space-8) var(--v2-space-4)',
            minHeight: 220,
            border: '2px dashed var(--v2-border)',
            borderRadius: 'var(--v2-radius-lg)',
            background: 'var(--v2-bg-card)',
            cursor: 'pointer', textAlign: 'center',
            color: 'var(--v2-text-primary)',
          }}
        >
          <span aria-hidden style={{ fontSize: 48 }}>{'\uD83D\uDCF7'}</span>
          <span style={{ fontSize: 'var(--v2-text-lg)', fontWeight: 'var(--v2-weight-semibold)' }}>
            Take or pick a photo
          </span>
          <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
            Logging into {MEAL_LABELS[fallbackMeal]} on {date}
          </span>
        </label>
        <input
          ref={fileInputRef}
          id="photo-meal-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPickFile}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
      </div>
    )
  }

  if (phase === 'identifying') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Your meal"
            style={{
              width: '100%', maxHeight: 320, objectFit: 'cover',
              borderRadius: 'var(--v2-radius-lg)',
            }}
          />
        )}
        <Card padding="md">
          <div
            style={{
              display: 'flex', flexDirection: 'column',
              gap: 'var(--v2-space-2)', alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 'var(--v2-text-base)', color: 'var(--v2-text-primary)' }}>
              Looking at your meal{'\u2026'}
            </span>
            <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
              This usually takes 5 to 15 seconds.
            </span>
          </div>
        </Card>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        <Banner intent="warning" title="Could not identify" body={error ?? 'Please try again.'} />
        <Button variant="primary" size="lg" fullWidth onClick={reset}>
          Try another photo
        </Button>
      </div>
    )
  }

  // review
  if (foods.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Your meal"
            style={{
              width: '100%', maxHeight: 220, objectFit: 'cover',
              borderRadius: 'var(--v2-radius-lg)',
            }}
          />
        )}
        <EmptyState
          headline="No foods spotted"
          subtext={mealDescription || 'Try a clearer photo, or search by name.'}
          cta={
            <Button variant="primary" size="lg" onClick={reset}>
              Try another photo
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Your meal"
          style={{
            width: '100%', maxHeight: 220, objectFit: 'cover',
            borderRadius: 'var(--v2-radius-lg)',
          }}
        />
      )}
      {error && <Banner intent="warning" title={'One didn\u2019t log'} body={error} />}
      <Card padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            We think we see
          </span>
          <p
            style={{
              margin: 0, fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-primary)', lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {mealDescription || 'A few items. Confirm each one below.'}
          </p>
        </div>
      </Card>

      {foods.map((food, idx) => (
        <FoodReviewRow
          key={`${food.name}-${idx}`}
          index={idx}
          food={food}
          fallbackMeal={fallbackMeal}
          isLogged={loggedIndices.has(idx)}
          isPending={pendingIndex === idx}
          onLog={(meal) => void logFood(idx, food, meal)}
        />
      ))}

      <Button variant="secondary" size="md" fullWidth onClick={reset}>
        Take another photo
      </Button>
    </div>
  )
}

function FoodReviewRow({
  food, fallbackMeal, isLogged, isPending, onLog,
}: {
  index: number
  food: IdentifiedFood
  fallbackMeal: MealType
  isLogged: boolean
  isPending: boolean
  onLog: (meal: MealType) => void
}) {
  const initialMeal: MealType = isMealType(food.mealType) ? food.mealType : fallbackMeal
  const [meal, setMeal] = useState<MealType>(initialMeal)
  const calories = food.nutrients?.calories ?? food.estimatedCalories
  const usdaNote = food.usdaMatch
    ? `Matched to: ${food.usdaMatch}`
    : 'No USDA match. Use search to log this one.'

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            {food.name}
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ~{Math.round(food.estimatedGrams)} g {'\u00b7'} {Math.round(calories)} cal
          </span>
          <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
            {usdaNote}
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="Meal type"
          style={{ display: 'flex', gap: 'var(--v2-space-1)', flexWrap: 'wrap' }}
        >
          {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((m) => {
            const active = meal === m
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMeal(m)}
                style={{
                  minHeight: 'var(--v2-touch-target-min)',
                  padding: '0 var(--v2-space-3)',
                  borderRadius: 'var(--v2-radius-full)',
                  border: `1px solid ${active ? 'var(--v2-accent-primary)' : 'var(--v2-border)'}`,
                  background: active ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-card)',
                  color: active ? 'var(--v2-accent-primary)' : 'var(--v2-text-secondary)',
                  fontSize: 'var(--v2-text-sm)',
                  fontWeight: active ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-medium)',
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                {MEAL_LABELS[m]}
              </button>
            )
          })}
        </div>

        <Button
          variant={isLogged ? 'secondary' : 'primary'}
          size="md"
          fullWidth
          disabled={isLogged || isPending || !food.fdcId}
          onClick={() => onLog(meal)}
        >
          {isLogged
            ? 'Logged'
            : isPending
              ? `Logging\u2026`
              : food.fdcId
                ? `Log to ${MEAL_LABELS[meal]}`
                : 'No USDA match'}
        </Button>
      </div>
    </Card>
  )
}
