'use client'

/*
 * FoodDetailHero
 *
 * Big calorie total that scales with the selected portion. Also hosts
 * the shared FoodDetailContext used by sibling components
 * (PortionChipStrip, NutritionFactsCardV2, AddToMealForm) to read the
 * scaled nutrients without prop-drilling through page.tsx.
 *
 * State flow:
 *   PortionChipStrip writes portionIndex to the context on tap, then
 *   FoodDetailHero + NutritionFactsCardV2 + AddToMealForm re-render
 *   from the derived scaled nutrients. No fetch. One React commit is
 *   comfortably under the 100ms target on a mid-range device.
 */
import { createContext, ReactNode, useContext, useMemo, useState } from 'react'
import type { FoodNutrients } from '@/lib/api/usda-food'
import { scaleNutrientsToGrams, type FoodPortion } from '@/lib/api/usda-portions'

interface FoodDetailContextValue {
  nutrients: FoodNutrients
  portions: FoodPortion[]
  selectedIndex: number
  setSelectedIndex: (i: number) => void
  selectedPortion: FoodPortion
  gramsEaten: number
  scaled: FoodNutrients
}

const FoodDetailContext = createContext<FoodDetailContextValue | null>(null)

export function useFoodDetail(): FoodDetailContextValue {
  const ctx = useContext(FoodDetailContext)
  if (!ctx) throw new Error('useFoodDetail must be used inside FoodDetailProvider')
  return ctx
}

export interface FoodDetailProviderProps {
  nutrients: FoodNutrients
  children: ReactNode
}

const HUNDRED_G_FALLBACK: FoodPortion = { label: '100 g', amount: 100, unit: 'g', gramWeight: 100 }

export function FoodDetailProvider({ nutrients, children }: FoodDetailProviderProps) {
  const portions = useMemo<FoodPortion[]>(
    () => nutrients.portions ?? [],
    [nutrients.portions],
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const safeIndex = Math.max(0, Math.min(selectedIndex, portions.length - 1))
  const selectedPortion = portions[safeIndex] ?? HUNDRED_G_FALLBACK

  const value = useMemo<FoodDetailContextValue>(() => {
    const baseServingG = nutrients.servingSize ?? 100
    // USDA stores gramWeight as the total grams for this portion entry
    // (e.g., 118g for "1 medium banana"). The `amount` field is display
    // metadata only, not a multiplier. gramsEaten is gramWeight.
    const gramsEaten = selectedPortion.gramWeight
    // scaleNutrientsToGrams only knows about numeric fields. We scale
    // the numeric subset, then merge non-numeric fields (description,
    // portions, fdcId, servingUnit) back in so consumers can still
    // read the full FoodNutrients shape.
    const numericOnly = {
      calories: nutrients.calories,
      protein: nutrients.protein,
      fat: nutrients.fat,
      satFat: nutrients.satFat,
      transFat: nutrients.transFat,
      cholesterol: nutrients.cholesterol,
      carbs: nutrients.carbs,
      fiber: nutrients.fiber,
      sugar: nutrients.sugar,
      sodium: nutrients.sodium,
      iron: nutrients.iron,
      calcium: nutrients.calcium,
      vitaminC: nutrients.vitaminC,
      vitaminD: nutrients.vitaminD,
      vitaminB12: nutrients.vitaminB12,
      magnesium: nutrients.magnesium,
      zinc: nutrients.zinc,
      potassium: nutrients.potassium,
      omega3: nutrients.omega3,
      folate: nutrients.folate,
    }
    const scaledNumeric = scaleNutrientsToGrams(numericOnly, baseServingG, gramsEaten)
    const scaled: FoodNutrients = { ...nutrients, ...scaledNumeric }
    return {
      nutrients, portions, selectedIndex: safeIndex,
      setSelectedIndex, selectedPortion, gramsEaten, scaled,
    }
  }, [nutrients, portions, safeIndex, selectedPortion])

  return <FoodDetailContext.Provider value={value}>{children}</FoodDetailContext.Provider>
}

export interface FoodDetailHeroProps {
  brandName?: string | null
  /** Open Food Facts photo URL when available. Renders as a 16:9 hero
   *  banner above the calorie total. The aspect-ratio box is reserved
   *  whether or not the URL loads, so layout is stable. Null skips the
   *  banner entirely (we keep the calorie-only chrome). */
  photoUrl?: string | null
}

export default function FoodDetailHero({ brandName, photoUrl }: FoodDetailHeroProps) {
  const { scaled, selectedPortion, gramsEaten, nutrients } = useFoodDetail()
  const calories = scaled.calories !== null ? Math.round(scaled.calories) : null
  const unit = nutrients.servingUnit ?? 'g'
  const servingLabel = `${selectedPortion.label} · ${Math.round(gramsEaten)} ${unit}`

  return (
    <section
      aria-label="Calorie total"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 'var(--v2-space-2)', padding: photoUrl ? 0 : 'var(--v2-space-5) var(--v2-space-4)',
        borderRadius: 'var(--v2-radius-lg)', background: 'var(--v2-bg-card)',
        border: '1px solid var(--v2-border-subtle)', overflow: 'hidden',
      }}
    >
      {photoUrl && (
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            background: 'var(--v2-bg-card-muted, rgba(255,255,255,0.04))',
            overflow: 'hidden',
            display: 'block',
          }}
        >
          <img
            src={photoUrl}
            alt={nutrients.description ?? 'Food photo'}
            loading="lazy"
            decoding="async"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--v2-space-2)',
          padding: photoUrl ? 'var(--v2-space-4)' : 0,
          width: '100%',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)',
            textTransform: 'uppercase', letterSpacing: 'var(--v2-tracking-wide)',
            fontWeight: 'var(--v2-weight-semibold)',
          }}
        >
          Calories
        </span>
        <span
          aria-live="polite"
          style={{
            fontSize: 64, lineHeight: 1, fontWeight: 'var(--v2-weight-bold)',
            letterSpacing: 'var(--v2-tracking-tight)', color: 'var(--v2-text-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {calories !== null ? calories : '--'}
        </span>
        <span
          style={{
            fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)',
            textAlign: 'center', fontVariantNumeric: 'tabular-nums',
          }}
        >
          {servingLabel}
        </span>
        {brandName && (
          <span
            style={{
              fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)',
              textAlign: 'center',
            }}
          >
            {brandName}
          </span>
        )}
      </div>
    </section>
  )
}
