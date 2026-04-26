/*
 * SymptomRadarCard (Feature D, NC wave 3)
 *
 * Displays patterns detected by the symptom-radar module. Each
 * pattern card shows:
 *   - The symptom + the phase where it clusters (NC voice).
 *   - A confidence chip (from the algorithm: instances + ratio).
 *   - A "Log this symptom" CTA pointing at /v2/cycle/log so the
 *     user can capture today's instance with one tap.
 *
 * Server component. Patterns are precomputed by the page; this is
 * pure presentation. When no patterns surface, we render a kind
 * empty state explaining what unlocks the radar (more cycles or
 * more consistent logging) rather than hiding the card entirely.
 */
import Link from 'next/link'
import type { SymptomPattern } from '@/lib/cycle/symptom-radar'
import type { CyclePhase } from '@/lib/types'

export interface SymptomRadarCardProps {
  patterns: ReadonlyArray<SymptomPattern>
}

const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'menstrual phase',
  follicular: 'follicular phase',
  ovulatory: 'ovulation window',
  luteal: 'luteal phase',
}

const PHASE_TONE: Record<CyclePhase, string> = {
  menstrual: 'rgba(232, 69, 112, 0.16)',
  follicular: 'rgba(106, 207, 137, 0.14)',
  ovulatory: 'rgba(229, 201, 82, 0.18)',
  luteal: 'rgba(155, 127, 224, 0.16)',
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

export default function SymptomRadarCard({ patterns }: SymptomRadarCardProps) {
  return (
    <div
      data-testid="symptom-radar-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-md)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          Symptom radar
        </h3>
        <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
          Patterns we have noticed across your last few cycles. The radar
          looks for symptoms that cluster in the same phase, not for
          anything that needs a doctor.
        </p>
      </header>

      {patterns.length === 0 ? (
        <div
          data-testid="symptom-radar-empty"
          style={{
            padding: 'var(--v2-space-3)',
            borderRadius: 'var(--v2-radius-md)',
            border: '1px dashed var(--v2-border-subtle)',
            background: 'var(--v2-bg-card)',
          }}
        >
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
            No clear patterns yet. The radar surfaces symptoms once the same
            one shows up at least three times across your cycles. Logging a
            few more days makes the picture sharper.
          </p>
        </div>
      ) : (
        <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          {patterns.map((p) => (
            <article
              key={`${p.symptom}-${p.observed_in_phase}`}
              role="listitem"
              data-testid={`radar-pattern-${p.symptom.replace(/\s+/g, '-')}`}
              style={{
                padding: 'var(--v2-space-3)',
                borderRadius: 'var(--v2-radius-md)',
                background: 'var(--v2-bg-card)',
                border: '1px solid var(--v2-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--v2-space-2)',
              }}
            >
              <header
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--v2-space-2)',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--v2-text-base)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-text-primary)',
                  }}
                >
                  {titleCase(p.symptom)}
                </span>
                <span
                  aria-label={`Pattern confidence ${(p.confidence * 100).toFixed(0)} percent`}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--v2-radius-full)',
                    background: PHASE_TONE[p.observed_in_phase],
                    color: 'var(--v2-text-secondary)',
                    fontSize: 'var(--v2-text-xs)',
                    fontWeight: 'var(--v2-weight-medium)',
                  }}
                >
                  {PHASE_LABEL[p.observed_in_phase]} · {Math.round(p.confidence * 100)}%
                </span>
              </header>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                }}
              >
                {p.suggestion}
              </p>
              <Link
                href="/v2/cycle/log"
                style={{
                  alignSelf: 'flex-start',
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-accent-primary)',
                  textDecoration: 'none',
                  fontWeight: 'var(--v2-weight-medium)',
                  padding: 'var(--v2-space-1) var(--v2-space-2)',
                  borderRadius: 'var(--v2-radius-sm)',
                  background: 'rgba(77, 184, 168, 0.08)',
                }}
              >
                Log this symptom
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
