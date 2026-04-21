'use client'

/*
 * ImagingClient (v2 imaging)
 *
 * Owns two pieces of state:
 *   1. modality filter (null = All, or one of CT/XR/MRI/US/EKG)
 *   2. currently open study for the report sheet (or null)
 *
 * Receives the full ImagingStudy[] from the server page already
 * sorted newest-first. Counts for the filter chips come from the
 * unfiltered list so the user sees totals regardless of selection.
 *
 * Voice on the empty state follows NC: short, kind, explanatory.
 * When the modality filter yields zero rows we nudge the user back
 * to the broader view instead of dead-ending them.
 */
import { useMemo, useState } from 'react'
import { EmptyState } from '@/v2/components/primitives'
import type { ImagingModality, ImagingStudy } from '@/lib/types'
import ImagingModalityFilter from './ImagingModalityFilter'
import ImagingReportSheet from './ImagingReportSheet'
import ImagingStudyCard from './ImagingStudyCard'

type ModalityCounts = Record<ImagingModality, number>

function zeroCounts(): ModalityCounts {
  return { CT: 0, XR: 0, MRI: 0, US: 0, EKG: 0 }
}

// Stable display order for the chip row : anatomy-then-function. CT,
// XR, MRI are the most common anatomy studies; US and EKG trail.
const MODALITY_ORDER: ImagingModality[] = ['CT', 'XR', 'MRI', 'US', 'EKG']

export interface ImagingClientProps {
  studies: ImagingStudy[]
}

export default function ImagingClient({ studies }: ImagingClientProps) {
  const [modality, setModality] = useState<ImagingModality | null>(null)
  const [openStudy, setOpenStudy] = useState<ImagingStudy | null>(null)

  const counts = useMemo<ModalityCounts>(() => {
    const c = zeroCounts()
    for (const s of studies) c[s.modality] += 1
    return c
  }, [studies])

  const availableModalities = useMemo<ImagingModality[]>(
    () => MODALITY_ORDER.filter((m) => counts[m] > 0),
    [counts],
  )

  const filtered = useMemo<ImagingStudy[]>(() => {
    if (modality === null) return studies
    return studies.filter((s) => s.modality === modality)
  }, [studies, modality])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
      <ImagingModalityFilter
        modality={modality}
        counts={counts}
        availableModalities={availableModalities}
        totalCount={studies.length}
        onChange={setModality}
      />

      {filtered.length === 0 ? (
        <EmptyState
          headline={`No ${modality ?? ''} studies yet.`}
          subtext="Switch filters to see others."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
          {filtered.map((s) => (
            <ImagingStudyCard key={s.id} study={s} onOpenReport={setOpenStudy} />
          ))}
        </div>
      )}

      <ImagingReportSheet
        study={openStudy}
        open={openStudy !== null}
        onClose={() => setOpenStudy(null)}
      />
    </div>
  )
}
