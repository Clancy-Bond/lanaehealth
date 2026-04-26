'use client'

/**
 * MigraineStageChips
 *
 * Bearable's migraine tracker teaches users the four ICHD-recognized
 * migraine stages and lets them log which stage they are in. We
 * surface the same chip set when the user has migraine on file and
 * has selected a head region or a head-like quality.
 *
 * Pattern source:
 *   https://bearable.app/migraine-tracker-app
 *   "Track Prodrome / Aura / Attack / Postdrome symptoms"
 *
 * Clinical anchor: ICHD-3 (Headache Classification Committee, 2018).
 * The four phases are widely taught for migraine self-tracking;
 * tracking which phase you are in helps doctors recognize patterns
 * across visits ("she said she was in postdrome four days running
 * after each menstrual cycle").
 *
 * UX rules:
 *   - Single-select chips. The user is in one phase at a time.
 *   - Each chip carries a one-line example so the user does not
 *     have to remember what "prodrome" means.
 *   - The selection is appended into the trigger_guess free-text
 *     field on save so it lands in pain_points.context_json without
 *     needing a new column or migration. (The trigger_guess field
 *     is intentionally free-form for exactly this kind of optional
 *     enrichment.)
 *
 * Voice rule: kind, never causal. Examples are the symptoms commonly
 * reported, not predictions.
 */
import type { MigraineStage } from './migraine-stages'
import { MIGRAINE_STAGES } from './migraine-stages'

export interface MigraineStageChipsProps {
  show: boolean
  value: MigraineStage | undefined
  onChange: (next: MigraineStage | undefined) => void
}

export default function MigraineStageChips({ show, value, onChange }: MigraineStageChipsProps) {
  if (!show) return null
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
          }}
        >
          Migraine stage
        </span>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          Where are you in the cycle right now?
        </h3>
      </header>
      <div
        role="radiogroup"
        aria-label="Migraine stage"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}
      >
        {MIGRAINE_STAGES.map((stage) => {
          const isOn = value === stage.key
          return (
            <button
              key={stage.key}
              type="button"
              role="radio"
              aria-checked={isOn}
              onClick={() => onChange(isOn ? undefined : stage.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 'var(--v2-space-3) var(--v2-space-4)',
                borderRadius: 'var(--v2-radius-md)',
                border: `1px solid ${isOn ? 'var(--v2-accent-primary)' : 'var(--v2-border)'}`,
                background: isOn ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-base)',
                color: 'var(--v2-text-primary)',
                cursor: 'pointer',
                minHeight: 'var(--v2-touch-target-min)',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 'var(--v2-text-sm)', fontWeight: 'var(--v2-weight-semibold)' }}>
                {stage.label}
              </span>
              <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', lineHeight: 1.4 }}>
                {stage.examples}
              </span>
            </button>
          )
        })}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        Stages adapted from ICHD-3 and{' '}
        <a
          href="https://bearable.app/migraine-tracker-app"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--v2-text-muted)' }}
        >
          Bearable&apos;s migraine tracker
        </a>
        .
      </p>
    </section>
  )
}
