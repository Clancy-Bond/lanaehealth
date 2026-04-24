'use client'

/**
 * OutstandingTestsExplainer
 *
 * Tap-to-learn for the "Tests worth ordering" panel. Defines the
 * difference between an outstanding test, an ordered test, and a
 * scheduled test, and walks through the urgency tiers a doctor will
 * see in the trailing slot.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'
import { Button } from '@/v2/components/primitives'

export interface OutstandingTestsExplainerProps {
  open: boolean
  onClose: () => void
}

export default function OutstandingTestsExplainer({ open, onClose }: OutstandingTestsExplainerProps) {
  return (
    <ExplainerSheet open={open} onClose={onClose} title="Tests worth ordering">
      <p style={{ margin: 0 }}>
        Tests we&apos;d expect to have on file given the active suspected
        conditions and standard workup pathways, but which aren&apos;t in
        the labs or imaging history yet. The point of this panel is to
        catch gaps that would otherwise run for months unnoticed.
      </p>
      <p style={{ margin: 0 }}>
        <strong>Outstanding vs ordered vs scheduled.</strong> These are
        not the same thing, and the panel only surfaces the first:
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
          <strong>Outstanding.</strong> Indicated by the active
          differential, but no record of the test being ordered,
          scheduled, or resulted. This is what shows up here.
        </li>
        <li>
          <strong>Ordered.</strong> The clinician has placed the order
          in the EMR but the appointment isn&apos;t booked. Lives on
          the appointments view, not here.
        </li>
        <li>
          <strong>Scheduled.</strong> An appointment exists in the
          calendar. Lives on Upcoming appointments.
        </li>
      </ul>
      <p style={{ margin: 0 }}>
        Once a result comes back into lab_results or imaging_studies,
        the entry drops off this panel automatically.
      </p>
      <p style={{ margin: 0 }}>
        <strong>Urgency tiers.</strong> Each row carries a trailing
        chip that maps to the engine&apos;s recommended timing:
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
          <strong>Order today.</strong> High urgency. The test would
          likely change today&apos;s management plan or rule out a
          time-sensitive cause.
        </li>
        <li>
          <strong>Within weeks.</strong> Medium urgency. Indicated for
          the workup but not blocking immediate care decisions.
        </li>
        <li>
          <strong>When convenient.</strong> Low urgency. Useful for
          completeness or longitudinal tracking; bundle with the next
          routine draw.
        </li>
      </ul>
      <p style={{ margin: 0 }}>
        Each row also shows what the test would clarify and a brief
        rationale for why the engine flagged it. We surface at most
        six entries to keep the panel scannable.
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          fontStyle: 'italic',
        }}
      >
        Source: findOutstanding cross-references active hypotheses
        against lab_results and imaging_studies. Sorted by urgency.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--v2-space-2)' }}>
        <Button variant="primary" size="md" onClick={onClose}>
          Got it
        </Button>
      </div>
    </ExplainerSheet>
  )
}
