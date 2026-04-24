'use client'

/*
 * ImagingClient (v2 imaging)
 *
 * Owns three pieces of state:
 *   1. view tab ("reports" default, or "viewer" for the DICOM iframe)
 *   2. modality filter (null = All, or one of CT/XR/MRI/US/EKG)
 *   3. currently open study for the report sheet (or null)
 *
 * Receives the full ImagingStudy[] from the server page already
 * sorted newest-first. Counts for the filter chips come from the
 * unfiltered list so the user sees totals regardless of selection.
 *
 * The Viewer tab embeds /pacs.html (the legacy DICOM viewer) via
 * iframe. It renders edge-to-edge under the top chrome; the reports
 * chrome (modality chips, study cards) is hidden while the viewer
 * is active so the iframe gets the full available height.
 *
 * Voice on the empty state follows NC: short, kind, explanatory.
 * When the modality filter yields zero rows we nudge the user back
 * to the broader view instead of dead-ending them.
 */
import { useMemo, useState } from 'react'
import { Banner, EmptyState, SegmentedControl } from '@/v2/components/primitives'
import type { ImagingModality, ImagingStudy } from '@/lib/types'
import ImagingModalityFilter from './ImagingModalityFilter'
import ImagingReportSheet from './ImagingReportSheet'
import ImagingStudyCard from './ImagingStudyCard'

type ModalityCounts = Record<ImagingModality, number>

type ImagingView = 'reports' | 'viewer'

function zeroCounts(): ModalityCounts {
  return { CT: 0, XR: 0, MRI: 0, US: 0, EKG: 0 }
}

// Stable display order for the chip row : anatomy-then-function. CT,
// XR, MRI are the most common anatomy studies; US and EKG trail.
const MODALITY_ORDER: ImagingModality[] = ['CT', 'XR', 'MRI', 'US', 'EKG']

const VIEW_SEGMENTS: Array<{ value: ImagingView; label: string }> = [
  { value: 'reports', label: 'Reports' },
  { value: 'viewer', label: 'Viewer' },
]

export interface ImagingClientProps {
  studies: ImagingStudy[]
}

export default function ImagingClient({ studies }: ImagingClientProps) {
  const [view, setView] = useState<ImagingView>('reports')
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
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding:
            'var(--v2-space-4) var(--v2-space-4) var(--v2-space-3) var(--v2-space-4)',
        }}
      >
        <SegmentedControl<ImagingView>
          segments={VIEW_SEGMENTS}
          value={view}
          onChange={setView}
          fullWidth
        />
      </div>

      {view === 'viewer' ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* NC-voice nudge: the legacy PACS shell was designed for desktop
              window-leveling and pinch-zoom is awkward on mobile. We tell the
              user that honestly so they can decide whether to grab a laptop
              or just read the report instead. */}
          <div style={{ padding: '0 var(--v2-space-4) var(--v2-space-3)' }}>
            <Banner
              intent="info"
              title="Best on a bigger screen"
              body="The image viewer needs pinch and drag for measurement. On a phone, tapping a study card opens the radiologist's report, which is usually the part your doctor cares about."
            />
          </div>
          <iframe
            src="/pacs.html"
            title="DICOM viewer"
            style={{
              border: 0,
              width: '100%',
              // Banner ~ 80px, segmented control ~ 56px, plus 32px breathing room.
              // Keep a 420px floor for very short viewports.
              height:
                'calc(100vh - var(--v2-topbar-height-large) - var(--v2-tabbar-height) - var(--v2-safe-top) - var(--v2-safe-bottom) - 168px)',
              minHeight: 420,
              background: '#000',
              display: 'block',
            }}
          />
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-4)',
            padding: '0 var(--v2-space-4) var(--v2-space-8) var(--v2-space-4)',
          }}
        >
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
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--v2-space-3)',
              }}
            >
              {filtered.map((s) => (
                <ImagingStudyCard key={s.id} study={s} onOpenReport={setOpenStudy} />
              ))}
            </div>
          )}
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
