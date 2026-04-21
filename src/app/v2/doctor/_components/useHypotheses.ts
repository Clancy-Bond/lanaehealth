import { useMemo } from 'react'
import { generateHypotheses, filterForSpecialist, type Hypothesis } from '@/lib/doctor/hypotheses'
import type { KBHypothesis, KBHypothesisPayload } from '@/lib/doctor/kb-hypotheses'
import type { SpecialistView } from '@/lib/doctor/specialist-config'
import type { DoctorPageData } from '@/app/doctor/page'

export type HypothesesSource = 'kb' | 'heuristic'

export interface HypothesesViewModel {
  source: HypothesesSource
  stale: boolean
  kbHypotheses?: KBHypothesis[]
  heuristicHypotheses?: Hypothesis[]
}

function specialistFilterForKB(h: KBHypothesis, view: SpecialistView): boolean {
  const name = h.name.toLowerCase()
  if (view === 'obgyn') return /endo|menstru|cycl|reproduct|dysp|ovari|uter/.test(name)
  if (view === 'cardiology') return /pots|orthostat|autonom|cardia|dys(auto|lipid)|heart|syncope/.test(name)
  return true
}

/*
 * useHypotheses
 *
 * Prefer the KB payload (full CIE output with supporting /
 * contradicting / whatWouldChange / alternatives) when present.
 * Fall back to the heuristic generator when the KB document is
 * missing or empty. Returns a view-filtered list for the current
 * specialist so OB/GYN doesn't see cardio hypotheses and vice versa.
 */
export function useHypotheses(
  data: DoctorPageData,
  payload: KBHypothesisPayload | null,
  view: SpecialistView,
): HypothesesViewModel {
  return useMemo(() => {
    if (payload && payload.hypotheses.length > 0) {
      const filtered = payload.hypotheses.filter((h) => specialistFilterForKB(h, view))
      return {
        source: 'kb',
        stale: payload.stale,
        kbHypotheses: filtered.length > 0 ? filtered : payload.hypotheses,
      }
    }
    const hs = filterForSpecialist(generateHypotheses(data), view)
    return { source: 'heuristic', stale: false, heuristicHypotheses: hs }
  }, [data, payload, view])
}
