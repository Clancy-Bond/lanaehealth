'use client'

/*
 * LabsClient (v2 labs)
 *
 * Owns the "Abnormal / All" view toggle and the LabValueExplainer
 * modal that opens when a row's value is tapped. Receives:
 *   - abnormal : LabResult[] : top-30 abnormal rows (newest-first)
 *   - groups   : LabGroup[]  : one entry per unique test_name, already
 *                              sorted by latest-entry date descending
 *
 * No filtering, no search : the lab dataset is small enough that the
 * abnormal/all split is the only interaction that makes sense on a
 * weekly-tail surface. The list just re-renders when the segment flips.
 *
 * Tap-to-explain (post polish pass): we pass the same onExplain
 * handler down both list paths so the user can learn what a flag means
 * for any test, not just abnormal ones.
 */
import { useState } from 'react'
import { EmptyState, SegmentedControl } from '@/v2/components/primitives'
import type { LabResult } from '@/lib/types'
import LabAbnormalList from './LabAbnormalList'
import LabTestGroup, { type LabGroup } from './LabTestGroup'
import LabValueExplainer from './LabValueExplainer'

type View = 'abnormal' | 'all'

export interface LabsClientProps {
  abnormal: LabResult[]
  groups: LabGroup[]
}

export default function LabsClient({ abnormal, groups }: LabsClientProps) {
  const [view, setView] = useState<View>('abnormal')
  const [explainRow, setExplainRow] = useState<LabResult | null>(null)

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
          <LabAbnormalList rows={abnormal} onExplain={setExplainRow} />
        ))}

      {view === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
          {groups.map((g) => (
            <LabTestGroup key={g.name} group={g} onExplain={setExplainRow} />
          ))}
        </div>
      )}

      <LabValueExplainer
        open={explainRow !== null}
        onClose={() => setExplainRow(null)}
        row={explainRow}
      />
    </div>
  )
}
