'use client'

/**
 * HypothesesExplainer
 *
 * Tap-to-learn for the "Working hypotheses" panel. Clinicians will
 * read this to understand what our confidence tiers mean and how our
 * directional arrows map to probability trajectory. Lanae reads it
 * to understand why one hypothesis sits above another.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'
import { Button } from '@/v2/components/primitives'

export interface HypothesesExplainerProps {
  open: boolean
  onClose: () => void
}

export default function HypothesesExplainer({ open, onClose }: HypothesesExplainerProps) {
  return (
    <ExplainerSheet open={open} onClose={onClose} title="Working hypotheses">
      <p style={{ margin: 0 }}>
        A differential list built from the same long-running clinical
        inference engine that chat uses. These are not diagnoses; they
        are ranked explanations for the current pattern of findings,
        each with its own confidence and evidence trail.
      </p>
      <p style={{ margin: 0 }}>
        <strong>Confidence tiers.</strong> We use two overlapping
        scales because some hypotheses come from the structured
        knowledge-base tracker (CIE) and others from the fallback
        heuristic generator when the KB hasn&apos;t rebuilt yet.
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
          <strong>Low (under 40 percent).</strong> Weak signal. A few
          supporting data points, but alternatives explain the pattern
          just as well. Treat as speculative.
        </li>
        <li>
          <strong>Moderate (40 to 70 percent).</strong> Real signal
          with meaningful support. More likely than not, but not
          enough to act on without confirmatory workup.
        </li>
        <li>
          <strong>High (over 70 percent).</strong> Strong convergent
          evidence across multiple data types. Usually worth anchoring
          management around while ruling out mimics.
        </li>
      </ul>
      <p style={{ margin: 0 }}>
        KB-tracked hypotheses also carry one of five category labels:
        ESTABLISHED, PROBABLE, POSSIBLE, SPECULATIVE, or INSUFFICIENT.
        These map roughly onto the same bands with ESTABLISHED and
        PROBABLE in the high range.
      </p>
      <p style={{ margin: 0 }}>
        <strong>Directional arrows.</strong> The arrow next to the
        confidence label shows how probability is moving across the
        last few weeks of new data, not the absolute level:
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
          <strong>Rising.</strong> Recent findings strengthen the
          hypothesis. Worth focusing workup here first.
        </li>
        <li>
          <strong>Falling.</strong> Recent findings weaken it.
          Consider de-prioritizing unless a confirmatory test would
          still change management.
        </li>
        <li>
          <strong>Flat.</strong> No meaningful signal shift since the
          last snapshot. Steady-state.
        </li>
      </ul>
      <p style={{ margin: 0 }}>
        Each block also lists supporting findings, contradicting
        findings, alternatives to consider, and the single most
        uncertainty-reducing next test. That last field is the one
        the engine recommends ordering if you only order one thing.
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          fontStyle: 'italic',
        }}
      >
        Source: KB tracker (CIE) with heuristic fallback. Never a
        substitute for clinical judgment; rebuilt after every new
        structured data point.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--v2-space-2)' }}>
        <Button variant="primary" size="md" onClick={onClose}>
          Got it
        </Button>
      </div>
    </ExplainerSheet>
  )
}
