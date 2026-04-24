'use client'

/**
 * LabValueExplainer
 *
 * Tap-to-explain modal for a single lab result row. Opens when the
 * user taps the value or flag pill in a LabRow. Mirrors the Sleep
 * and Cycle explainer pattern but framed for lab numbers: what a
 * reference range really means, when a single out-of-range value is
 * worth alarm, and when to bring it to a doctor.
 *
 * Voice follows NC: short, kind, explanatory. Never alarming, but
 * honest about what "Critical" means when it shows up.
 */
import { format, parseISO } from 'date-fns'
import ExplainerSheet from '../../_components/ExplainerSheet'
import type { LabResult } from '@/lib/types'

export interface LabValueExplainerProps {
  open: boolean
  onClose: () => void
  row: LabResult | null
}

function formatLabDate(iso: string): string {
  return format(parseISO(iso + 'T00:00:00'), 'MMMM d, yyyy')
}

function flagWord(flag: LabResult['flag']): string {
  switch (flag) {
    case 'low':
      return 'flagged Low'
    case 'high':
      return 'flagged High'
    case 'critical':
      return 'flagged Critical, which usually means it sat well outside the reference band'
    default:
      return 'inside the reference band'
  }
}

export default function LabValueExplainer({ open, onClose, row }: LabValueExplainerProps) {
  if (!row) return null

  const hasRange = row.reference_range_low !== null || row.reference_range_high !== null
  const rangeText = (() => {
    if (!hasRange) return null
    const low = row.reference_range_low
    const high = row.reference_range_high
    const unit = row.unit ?? ''
    if (low !== null && high !== null) return `${low} to ${high} ${unit}`.trim()
    if (low !== null) return `at least ${low} ${unit}`.trim()
    if (high !== null) return `up to ${high} ${unit}`.trim()
    return null
  })()

  const dateText = formatLabDate(row.date)
  const valueText =
    row.value !== null
      ? `${row.value}${row.unit ? ` ${row.unit}` : ''}`
      : 'no recorded value'

  const isCritical = row.flag === 'critical'
  const isAbnormal = row.flag != null && row.flag !== 'normal'

  // Plain-English source line. Avoid em-dashes per CLAUDE.md.
  const sourceParts: string[] = []
  sourceParts.push(`On ${dateText}, ${row.test_name} read ${valueText}.`)
  if (rangeText) sourceParts.push(`Reference range: ${rangeText}.`)
  if (isAbnormal) sourceParts.push(`That value was ${flagWord(row.flag)}.`)

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title={row.test_name}
      source={sourceParts.join(' ')}
    >
      <p style={{ margin: 0 }}>
        A reference range is the band of values most healthy people fall into for
        this test. It is not a pass or fail line. Bodies, labs, and assays differ,
        so a single value just outside the band is rarely a reason to worry.
      </p>
      {isCritical ? (
        <p style={{ margin: 0 }}>
          A <strong>Critical</strong> flag is the lab&apos;s way of saying this
          one stands out enough to be worth a closer look. Bring it up at your
          next appointment, or call sooner if you also feel off.
        </p>
      ) : isAbnormal ? (
        <p style={{ margin: 0 }}>
          A single <strong>{row.flag === 'low' ? 'Low' : 'High'}</strong> result
          rarely tells the full story. Two or three in a row, or one paired with
          symptoms, is the pattern worth raising with your doctor.
        </p>
      ) : (
        <p style={{ margin: 0 }}>
          You are inside the reference band for this test, which is the easy
          read. If a trend is drifting toward an edge, the chart in the All view
          will show it.
        </p>
      )}
      <p style={{ margin: 0 }}>
        <strong>When to bring it up:</strong> if a flag repeats across visits,
        if several related tests trend the same direction, or if it shows up
        alongside how you feel. The Records timeline groups everything by date
        so a clinician can see them together.
      </p>
    </ExplainerSheet>
  )
}
