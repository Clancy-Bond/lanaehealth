'use client'

/*
 * AnalysisSubTabs
 *
 * Three-way switch between Summary & foods, Meal analysis, and
 * Cals from nutrients. SegmentedControl is the right chassis since
 * the plan reserves TabStrip for 4+ tabs; 3 segments fits here.
 *
 * Tab state lives in the URL (?tab=summary|meal|nutrients) so deep
 * links restore the view and the back/forward buttons cycle sub-tabs
 * naturally. Any other search params on the URL are preserved when
 * switching.
 */
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { SegmentedControl } from '@/v2/components/primitives'

export type AnalysisTab = 'summary' | 'meal' | 'nutrients'

const SEGMENTS: Array<{ value: AnalysisTab; label: string }> = [
  { value: 'summary', label: 'Summary & foods' },
  { value: 'meal', label: 'Meal analysis' },
  { value: 'nutrients', label: 'Cals from nutrients' },
]

export interface AnalysisSubTabsProps {
  active: AnalysisTab
}

export default function AnalysisSubTabs({ active }: AnalysisSubTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = (tab: AnalysisTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'summary') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <SegmentedControl<AnalysisTab>
        segments={SEGMENTS}
        value={active}
        onChange={onChange}
        fullWidth
      />
    </div>
  )
}
