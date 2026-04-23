/*
 * DiagnosticProgressCard
 *
 * Tracks Lanae's own testing against the usual POTS documentation
 * threshold: 3 positive tests, each at least 14 days apart. The ring
 * is informational, not a goal. No nudges, no "you should" phrasing.
 *
 * Uses the v2 MetricRing primitive (foundation-locked) so the visual
 * matches frame_0001 proportions. The ring turns teal only when all
 * three qualifying positives are on file; otherwise it stays on the
 * highlight hue so the card does not read as "done yet".
 */
import { format, parseISO } from 'date-fns'
import { Card, MetricRing } from '@/v2/components/primitives'
import {
  THRESHOLDS,
  type DiagnosticProgress,
} from '@/lib/intelligence/orthostatic'

export interface DiagnosticProgressCardProps {
  diagnosticProgress: DiagnosticProgress
}

function formatDate(iso: string): string {
  return format(parseISO(iso + 'T00:00:00'), 'MMM d')
}

export default function DiagnosticProgressCard({
  diagnosticProgress,
}: DiagnosticProgressCardProps) {
  const {
    qualifyingPositives,
    qualifyingDates,
    earliestNextQualifyingDate,
    remainingNeeded,
  } = diagnosticProgress

  const required = THRESHOLDS.REQUIRED_POSITIVES
  const atThreshold = qualifyingPositives >= required
  const rawPct = (qualifyingPositives / required) * 100
  const ringValue = Math.min(100, rawPct)
  const ringColor = atThreshold
    ? 'var(--v2-accent-primary)'
    : 'var(--v2-accent-highlight)'

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            POTS documentation
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            A POTS diagnosis is typically built from {required} positive tests at
            least {THRESHOLDS.MIN_DAYS_BETWEEN_QUALIFYING_TESTS} days apart.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--v2-space-4)',
          }}
        >
          <MetricRing
            value={ringValue}
            displayValue={`${qualifyingPositives}/${required}`}
            color={ringColor}
            size="md"
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-1)',
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: 'var(--v2-text-base)',
                color: 'var(--v2-text-primary)',
                fontWeight: 'var(--v2-weight-medium)',
              }}
            >
              {qualifyingPositives} of {required} positives
            </span>
            {atThreshold ? (
              <span
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                }}
              >
                POTS criteria met for documentation.
              </span>
            ) : (
              <span
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                }}
              >
                {remainingNeeded === 1
                  ? '1 more qualifying positive completes the set.'
                  : `${remainingNeeded} more qualifying positives complete the set.`}
              </span>
            )}
          </div>
        </div>

        {qualifyingDates.length > 0 && (
          <div
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Tests counted: {qualifyingDates.map(formatDate).join(', ')}
          </div>
        )}

        {remainingNeeded > 0 && earliestNextQualifyingDate && (
          <div
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Next qualifying test: on or after{' '}
            {format(parseISO(earliestNextQualifyingDate + 'T00:00:00'), 'MMM d, yyyy')}.
          </div>
        )}
      </div>
    </Card>
  )
}
