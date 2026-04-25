'use client'

import { useCallback, useState } from 'react'
import type { SpecialistView } from '@/lib/doctor/specialist-config'

function isSpecialistView(v: string | null | undefined): v is SpecialistView {
  return v === 'pcp' || v === 'obgyn' || v === 'cardiology'
}

/*
 * useSpecialistView
 *
 * Keeps the specialist toggle (PCP / OB-GYN / Cardiology) synced with the
 * `?v=` URL search param. The legacy /doctor route writes the same param
 * via window.history.replaceState so both surfaces can share a link.
 *
 * Read the initial value from the server-rendered search param, then
 * mirror every change back to the URL without a navigation event.
 */
export function useSpecialistView(initial: SpecialistView = 'pcp') {
  const [view, setView] = useState<SpecialistView>(initial)

  const changeView = useCallback((next: SpecialistView) => {
    setView(next)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('v', next)
    window.history.replaceState(null, '', url.toString())
  }, [])

  return { view, setView: changeView }
}

export { isSpecialistView }
