'use client'

import { useMemo } from 'react'
import { generateHypotheses } from '@/lib/doctor/hypotheses'
import type { DoctorPageData } from '@/app/doctor/page'
import type { SpecialistView } from '@/lib/doctor/specialist-config'

export interface HypothesisCoverage {
  hypothesisName: string
  evaluatingAppointments: Array<{
    specialty: string
    date: string
    daysAway: number
    isCurrentView: boolean
  }>
}

function specialtyToView(s: string | null): SpecialistView | null {
  if (!s) return null
  if (/ob.?gyn|gyn|gyno|reproductive/i.test(s)) return 'obgyn'
  if (/cardio|heart|electrophys/i.test(s)) return 'cardiology'
  if (/primary|internal|family|pcp/i.test(s)) return 'pcp'
  return null
}

function daysBetween(targetDate: string, from: Date): number {
  const target = new Date(targetDate + 'T00:00:00')
  const ms = target.getTime() - from.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

/*
 * useCrossAppointmentCoverage
 *
 * For each active hypothesis, which of the upcoming appointments is
 * positioned to evaluate it? Surfaces coordination gaps: "your POTS
 * workup is on the cardiology calendar, but your OB/GYN on the 30th
 * is also relevant for the MCAS angle."
 */
export function useCrossAppointmentCoverage(
  data: DoctorPageData,
  currentView: SpecialistView,
): HypothesisCoverage[] {
  return useMemo(() => {
    const hypotheses = generateHypotheses(data)
    const now = new Date()
    const upcoming = (data.upcomingAppointments ?? []).slice(0, 6)
    return hypotheses
      .map<HypothesisCoverage>((h) => {
        const evaluating: HypothesisCoverage['evaluatingAppointments'] = []
        for (const appt of upcoming) {
          const view = specialtyToView(appt.specialty)
          if (view && h.relevantTo.includes(view)) {
            evaluating.push({
              specialty: appt.specialty ?? 'Unknown',
              date: appt.date,
              daysAway: daysBetween(appt.date, now),
              isCurrentView: view === currentView,
            })
          }
        }
        return { hypothesisName: h.name, evaluatingAppointments: evaluating }
      })
      .filter((c) => c.evaluatingAppointments.length > 0)
  }, [data, currentView])
}
