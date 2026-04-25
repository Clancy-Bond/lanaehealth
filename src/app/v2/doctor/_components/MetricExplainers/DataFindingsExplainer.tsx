'use client'

/**
 * DataFindingsExplainer
 *
 * Tap-to-learn for the "Lab trends" panel. Defines abnormal-flag
 * thresholds and how the trend arrow is computed from the underlying
 * series. Useful for the doctor who wants to know whether "trending
 * up" means a real signal or a single-point hop.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'
import { Button } from '@/v2/components/primitives'

export interface DataFindingsExplainerProps {
  open: boolean
  onClose: () => void
}

export default function DataFindingsExplainer({ open, onClose }: DataFindingsExplainerProps) {
  return (
    <ExplainerSheet open={open} onClose={onClose} title="Lab trends">
      <p style={{ margin: 0 }}>
        Repeat-test trajectories for the labs that matter most to the
        active workup. Reference ranges show as a faint green band so
        you can eyeball "is the current value in range" without reading
        the number. Abnormal points enlarge and tint warning.
      </p>
      <p style={{ margin: 0 }}>
        <strong>Abnormal-flag thresholds.</strong> Each lab carries the
        reference range from the source report (LabCorp, Quest, hospital
        system). We classify each point against that range:
      </p>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        <li>
          <strong>Normal.</strong> Inside the source-reported reference
          range for that assay and patient demographic.
        </li>
        <li>
          <strong>High / Low.</strong> Outside the reference band but
          within roughly 1.5x the boundary. Worth noting; trajectory
          matters more than the single number.
        </li>
        <li>
          <strong>Critical.</strong> Far outside range, typically
          flagged by the lab itself with an asterisk or callout. These
          warrant explicit review at the visit.
        </li>
      </ul>
      <p style={{ margin: 0 }}>
        <strong>How trends are detected.</strong> The trend label
        ("trending up", "trending down", "stable") compares the most
        recent value to the first value in the displayed series. We
        intentionally use a simple endpoint comparison rather than a
        regression slope so the read matches what the chart shows. For
        a real statistical trend, look at the chart shape across three
        or more points.
      </p>
      <p style={{ margin: 0 }}>
        A panel border tinted warning means at least one point in the
        series tripped an abnormal flag. The summary line at the top
        of the card counts how many of the tracked tests have any
        abnormal point.
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          fontStyle: 'italic',
        }}
      >
        Source: lab_results table grouped by useLabGrouping. Reference
        ranges as reported by the lab. Bucket-gated on `labs` so it
        hides for specialist views that don&apos;t use it.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--v2-space-2)' }}>
        <Button variant="primary" size="md" onClick={onClose}>
          Got it
        </Button>
      </div>
    </ExplainerSheet>
  )
}
