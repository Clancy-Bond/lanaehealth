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
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import type { FoodNutrients } from '@/lib/api/usda-food'
import { scaleNutrientsToGrams, type FoodPortion } from '@/lib/api/usda-portions'
import { unitAmountToGrams, type UnitOption } from '@/lib/api/unit-options'

interface FoodDetailContextValue {
  nutrients: FoodNutrients
  portions: FoodPortion[]
  selectedIndex: number
  setSelectedIndex: (i: number) => void
  selectedPortion: FoodPortion
  /**
   * Multi-unit picker state. When non-null, the user has tapped a
   * universal unit chip (g / mg / kg / oz / lb / ml / L / fl oz /
   * cup / tbsp / tsp) and `unitAmount` is the typed amount in that
   * unit. gramsEaten = unitAmount * selectedUnit.gramsPerUnit.
   *
   * When null, we are in USDA-portion mode and gramsEaten comes from
   * selectedPortion.gramWeight as before. The two modes are mutually
   * exclusive: tapping a USDA chip clears selectedUnit; tapping a
   * unit chip sets it.
   */
  selectedUnit: UnitOption | null
  setSelectedUnit: (u: UnitOption | null) => void
  unitAmount: number
  setUnitAmount: (n: number) => void
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
  const [selectedIndex, setSelectedIndexRaw] = useState(0)
  // Tracking unit-mode state alongside USDA-portion mode. selectedUnit
  // null = portion mode, !null = unit mode.
  const [selectedUnit, setSelectedUnitRaw] = useState<UnitOption | null>(null)
  const [unitAmount, setUnitAmount] = useState<number>(1)
  const safeIndex = Math.max(0, Math.min(selectedIndex, portions.length - 1))
  const selectedPortion = portions[safeIndex] ?? HUNDRED_G_FALLBACK

  // Mutually-exclusive setters. Tapping a USDA portion chip clears
  // unit-mode; tapping a universal unit chip clears portion-index
  // tracking semantics (the chip strip will visually highlight the
  // unit chip instead of any USDA chip).
  const setSelectedIndex = useCallback((i: number) => {
    setSelectedIndexRaw(i)
    setSelectedUnitRaw(null)
  }, [])
  const setSelectedUnit = useCallback((u: UnitOption | null) => {
    setSelectedUnitRaw(u)
    if (u) setUnitAmount(1)
  }, [])

  const value = useMemo<FoodDetailContextValue>(() => {
    const baseServingG = nutrients.servingSize ?? 100
    // gramsEaten depends on which mode we're in. Unit mode wins when
    // selectedUnit is set; otherwise we fall back to the USDA portion
    // gramWeight. This is what makes the calorie total + nutrient
    // table re-scale live whether the user picked "1 medium banana"
    // (118g via portion) or typed "2" then tapped "oz" (56.7g via
    // unit conversion).
    const gramsEaten = selectedUnit
      ? unitAmountToGrams(unitAmount, selectedUnit)
      : selectedPortion.gramWeight
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
      selectedUnit,
      setSelectedUnit,
      unitAmount,
      setUnitAmount,
      gramsEaten,
      scaled,
    }
  }, [nutrients, portions, safeIndex, selectedPortion, selectedUnit, unitAmount, setSelectedIndex, setSelectedUnit])

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
