'use client'

/**
 * TalkingPointsExplainer
 *
 * Tap-to-learn for the "What to tell the doctor" panel. Helps Lanae
 * understand why three things float to the top of her brief, and
 * gives a doctor the same legend in clinic so the priority ordering
 * isn't a black box.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'
import { Button } from '@/v2/components/primitives'

export interface TalkingPointsExplainerProps {
  open: boolean
  onClose: () => void
}

export default function TalkingPointsExplainer({ open, onClose }: TalkingPointsExplainerProps) {
  return (
    <ExplainerSheet open={open} onClose={onClose} title="What to tell the doctor">
      <p style={{ margin: 0 }}>
        This is the single most important panel on the brief. A clinician
        who reads only this card should still know the three things that
        matter most for today&apos;s visit.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we rank.</strong> Each point gets a numeric priority
        score from 0 (most urgent) to 5 (background). We weigh four
        signals: clinical urgency of the underlying finding, how recently
        the change appeared, whether it ties to an active concern in the
        chart, and whether it&apos;s likely to change management.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we group.</strong> Points are split into three
        sections so they scan top-to-bottom in the order most visits
        flow:
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
          <strong>Lab trends.</strong> Recent flagged or trending values
          where the trajectory matters more than any single number.
        </li>
        <li>
          <strong>Active concerns.</strong> Existing problems on the
          problem list with new evidence, plus any suspected diagnoses
          under workup.
        </li>
        <li>
          <strong>Other findings.</strong> Imaging notes, referrals
          outstanding, or context the clinician will want before
          ordering anything.
        </li>
      </ul>
      <p style={{ margin: 0 }}>
        A red dot marks the top-priority points (priority 0 or 1). A
        green dot marks the rest. If you only have a few minutes with
        the doctor, start with the reds.
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          fontStyle: 'italic',
        }}
      >
        Source: ranked by useTalkingPoints from the same context engine
        that powers chat. Scores update with every new lab, symptom log,
        or imaging upload.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--v2-space-2)' }}>
        <Button variant="primary" size="md" onClick={onClose}>
          Got it
        </Button>
      </div>
    </ExplainerSheet>
  )
}
