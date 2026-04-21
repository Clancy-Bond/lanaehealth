'use client'

import { Banner } from '@/v2/components/primitives'
import type { RedFlag } from '@/lib/doctor/red-flags'

interface RedFlagsSectionProps {
  flags: RedFlag[]
}

/*
 * RedFlagsSection
 *
 * Always at the very top of the brief. Distinct red treatment is
 * non-negotiable per spec: a doctor scanning the page should
 * register "something urgent here" before reading anything else.
 *
 * Safety-critical empty state: when there are no red flags, we
 * render a subtle success banner ("No red flags today") instead
 * of collapsing silently. A doctor needs to know we checked and
 * found nothing, not just that the check never ran.
 */
export default function RedFlagsSection({ flags }: RedFlagsSectionProps) {
  if (flags.length === 0) {
    return (
      <Banner
        intent="success"
        title="No red flags today"
        body="No urgent issues detected in the last 30-day window across vitals, labs, or timeline events."
      />
    )
  }

  const headline =
    flags.length === 1 ? 'Red flag: contact a doctor' : `${flags.length} red flags: contact a doctor`

  return (
    <Banner
      intent="danger"
      title={headline}
      body={
        <ul
          aria-label="Red flag details"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 'var(--v2-space-2) 0 0 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          {flags.map((f) => (
            <li
              key={f.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: 'var(--v2-space-2) var(--v2-space-3)',
                borderRadius: 'var(--v2-radius-sm)',
                background: 'rgba(239, 93, 93, 0.08)',
                border: '1px solid rgba(239, 93, 93, 0.35)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--v2-space-2)' }}>
                <span
                  style={{
                    fontSize: 'var(--v2-text-sm)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-text-primary)',
                  }}
                >
                  {f.headline}
                </span>
                <span
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    color: 'var(--v2-accent-danger)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.severity === 'call-today' ? 'Call today' : 'Call this week'}
                </span>
              </div>
              <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>{f.detail}</span>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-accent-danger)',
                  fontWeight: 'var(--v2-weight-semibold)',
                }}
              >
                Action: {f.action}
              </span>
              <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {f.dataRef}
              </span>
            </li>
          ))}
        </ul>
      }
    />
  )
}
