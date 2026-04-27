'use client'

/*
 * FoodDetailHero
 *
 * Hosts the FoodDetailContext used by sibling components
 * (PortionInputRow, PortionChipStrip, NutritionFactsCardV2,
 * AddToMealForm) to read the scaled nutrients without prop-drilling
 * through page.tsx.
 *
 * The visual hero (centered 64pt CALORIES headline with serving
 * label) was REMOVED 2026-04-27 in favor of MFN-parity components:
 * FoodDetailHeader (photo banner + name overlay) at the page top
 * and PortionInputRow (`2 ___ fl oz | 33 cals`) immediately below.
 * The previous design lived at this file but did not match
 * `docs/reference/mynetdiary/frames/full-tour/frame_0045.png`.
 *
 * State flow:
 *   PortionChipStrip writes portionIndex to the context on tap, then
 *   PortionInputRow + NutritionFactsCardV2 + AddToMealForm re-render
 *   from the derived scaled nutrients. No fetch. One React commit
 *   under the 100ms target on a mid-range device.
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
      nutrients,
      portions,
      selectedIndex: safeIndex,
      setSelectedIndex,
      selectedPortion,
      gramsEaten,
      scaled,
    }
  }, [nutrients, portions, safeIndex, selectedPortion])

  return <FoodDetailContext.Provider value={value}>{children}</FoodDetailContext.Provider>
}

/**
 * @deprecated The visual hero moved to FoodDetailHeader +
 * PortionInputRow on 2026-04-27 for MFN parity. This default export
 * remains as a no-op so any stale imports do not break the build.
 * Remove once page.tsx is the only caller and has been updated.
 */
export default function FoodDetailHero(): null {
  return null
}
