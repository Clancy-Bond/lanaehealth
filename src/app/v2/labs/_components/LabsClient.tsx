'use client'

/*
 * LabsClient (v2 labs)
 *
 * Owns the "Abnormal / All" view toggle. Receives:
 *   - abnormal : LabResult[] : top-30 abnormal rows (newest-first)
 *   - groups   : LabGroup[]  : one entry per unique test_name, already
 *                              sorted by latest-entry date descending
 *
 * No filtering, no search : the lab dataset is small enough that the
 * abnormal/all split is the only interaction that makes sense on a
 * weekly-tail surface. The list just re-renders when the segment flips.
 */
import { useState } from 'react'
import { EmptyState, SegmentedControl } from '@/v2/components/primitives'
import type { LabResult } from '@/lib/types'
import LabAbnormalList from './LabAbnormalList'
import LabTestGroup, { type LabGroup } from './LabTestGroup'

type View = 'abnormal' | 'all'

export interface LabsClientProps {
  abnormal: LabResult[]
  groups: LabGroup[]
}

export default function LabsClient({ abnormal, groups }: LabsClientProps) {
  const [view, setView] = useState<View>('abnormal')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
      <SegmentedControl<View>
        segments={[
          { value: 'abnormal', label: 'Abnormal' },
          { value: 'all', label: 'All' },
        ]}
        value={view}
        onChange={setView}
        fullWidth
      />

      {view === 'abnormal' &&
        (abnormal.length === 0 ? (
          <EmptyState
            headline="No abnormal results in your history."
            subtext="Your trends are in All."
          />
        ) : (
          <LabAbnormalList rows={abnormal} />
        ))}

      {view === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
          {groups.map((g) => (
            <LabTestGroup key={g.name} group={g} />
          ))}
        </div>
      )}
    </div>
  )
}
