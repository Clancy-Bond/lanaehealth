'use client'

/**
 * RedFlagsExplainer
 *
 * Tap-to-learn for the red-flags banner at the top of the brief.
 * Defines what severity tiers map to and what action each tier
 * recommends. Doctors will tap this to confirm our triage logic
 * matches their own clinical thresholds.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'
import { Button } from '@/v2/components/primitives'

export interface RedFlagsExplainerProps {
  open: boolean
  onClose: () => void
}

export default function RedFlagsExplainer({ open, onClose }: RedFlagsExplainerProps) {
  return (
    <ExplainerSheet open={open} onClose={onClose} title="Red flags">
      <p style={{ margin: 0 }}>
        Always at the very top of the brief because a clinician
        scanning the page should register "something urgent here"
        before reading anything else. The empty state is intentional
        too: a green banner means we checked the last 30 days across
        vitals, labs, and timeline events and found nothing urgent.
      </p>
      <p style={{ margin: 0 }}>
        <strong>Severity tiers.</strong> Each flag carries one of two
        severity labels in the trailing slot:
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
          <strong>Call today.</strong> Time-sensitive. Either a
          critical lab value, a vital-sign pattern that suggests acute
          decompensation, or a new symptom that crosses an emergency
          threshold (chest pain at rest, suspected stroke, severe
          allergic reaction, suicidal ideation). Default action is to
          contact the relevant clinician same day or use urgent care
          if no clinician is reachable.
        </li>
        <li>
          <strong>Call this week.</strong> Important but not acute.
          New abnormal labs trending in a worrying direction, a new
          imaging finding flagged for follow-up, or a symptom cluster
          that warrants a workup conversation. Default action is to
          schedule a visit within 5 to 7 days.
        </li>
      </ul>
      <p style={{ margin: 0 }}>
        Each flag row shows a short headline, a one-line clinical
        detail, the recommended action, and a data reference so a
        clinician can trace back to the source value, lab report, or
        timeline event in seconds.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How a flag is generated.</strong> The engine watches
        for several patterns: critical-flagged labs from the source
        report, vital-sign changes outside expected variation
        (orthostatic deltas, resting HR jumps, BP excursions),
        imaging findings the radiologist flagged for follow-up, and
        symptom log entries above pre-set severity thresholds.
      </p>
      <p style={{ margin: 0 }}>
        <strong>What this panel is not.</strong> Not a substitute for
        clinical assessment, not a diagnosis, and not a triage call.
        If something feels wrong and isn&apos;t flagged, trust the
        feeling and call. We&apos;d rather miss a flag than have you
        wait on one.
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          fontStyle: 'italic',
        }}
      >
        Source: red-flags engine watching the last 30-day window
        across lab_results, oura_daily, imaging_studies, and the
        symptom log. Refreshed on every page load.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--v2-space-2)' }}>
        <Button variant="primary" size="md" onClick={onClose}>
          Got it
        </Button>
      </div>
    </ExplainerSheet>
  )
}
