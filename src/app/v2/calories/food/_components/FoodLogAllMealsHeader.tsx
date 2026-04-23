'use client'

/*
 * FoodLogAllMealsHeader
 *
 * Client wrapper around SegmentedControl that routes meal-filter
 * changes through the URL. The server component reads `?meal=` and
 * decides which MealSectionCard(s) to render, so the filter is
 * shareable, back-button friendly, and survives hard reloads.
 *
 * Segments: All / Breakfast / Lunch / Dinner / Snacks.
 * "Snacks" is plural per NC voice conventions; the underlying
 * meal_type value stays singular `snack` for DB parity.
 */
import { useRouter } from 'next/navigation'
import { SegmentedControl } from '@/v2/components/primitives'

export type MealFilter = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface FoodLogAllMealsHeaderProps {
  date: string
  initialMeal: MealFilter
}

const SEGMENTS: { value: MealFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
]

export default function FoodLogAllMealsHeader({
  date,
  initialMeal,
}: FoodLogAllMealsHeaderProps) {
  const router = useRouter()

  const onChange = (next: MealFilter) => {
    const params = new URLSearchParams({ date, meal: next })
    router.push(`/v2/calories/food?${params.toString()}`)
  }

  return (
    <SegmentedControl<MealFilter>
      fullWidth
      segments={SEGMENTS}
      value={initialMeal}
      onChange={onChange}
    />
  )
}
