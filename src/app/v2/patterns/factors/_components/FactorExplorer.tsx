'use client'

/**
 * FactorExplorer - Bearable-pattern outcome picker + ranked list.
 *
 * Source pattern: bearable.app's factor explorer. The user picks one
 * outcome, the page recomputes the ranked factor list. Pure client
 * component; the rows are pre-fetched server-side and shaped here.
 *
 * Behavior:
 *   - Outcome chips render as a radiogroup (single-select). The
 *     active chip carries a sage tint; the rest are neutral.
 *   - When no rows match, render a calm empty state with a link to
 *     /v2/log so the user can start logging.
 *   - Each ranked factor row renders impact phrase, confidence chip,
 *     and "based on N days" sample-size line.
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'
import {
  filterByOutcome,
  rankAndShape,
  OUTCOME_CHIPS,
  type FactorRow,
  type OutcomeKey,
  type RankedFactor,
} from '@/lib/v2/triggers'

const CONFIDENCE_COLORS: Record<RankedFactor['confidence'], string> = {
  strong: 'var(--v2-accent-primary)',
  moderate: 'var(--v2-surface-explanatory-accent)',
  suggestive: 'var(--v2-text-muted)',
}

interface FactorExplorerProps {
  rows: FactorRow[]
}

export default function FactorExplorer({ rows }: FactorExplorerProps) {
  const [outcome, setOutcome] = useState<OutcomeKey>('pain')

  const ranked = useMemo<RankedFactor[]>(
    () => rankAndShape(filterByOutcome(rows, outcome)).slice(0, 8),
    [rows, outcome],
  )

  const currentChip = OUTCOME_CHIPS.find((c) => c.key === outcome)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
      <div
        role="radiogroup"
        aria-label="Pick an outcome to explore"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--v2-space-2)',
        }}
      >
        {OUTCOME_CHIPS.map((chip) => {
          const isOn = chip.key === outcome
          return (
            <button
              key={chip.key}
              type="button"
              role="radio"
              aria-checked={isOn}
              onClick={() => setOutcome(chip.key as OutcomeKey)}
              style={{
                padding: 'var(--v2-space-2) var(--v2-space-4)',
                borderRadius: 'var(--v2-radius-pill)',
                border: `1px solid ${isOn ? 'var(--v2-accent-primary)' : 'var(--v2-border)'}`,
                background: isOn ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-base)',
                color: 'var(--v2-text-primary)',
                fontSize: 'var(--v2-text-sm)',
                fontWeight: 'var(--v2-weight-medium)',
                cursor: 'pointer',
                minHeight: 'var(--v2-touch-target-min)',
              }}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        Top factors that track with{' '}
        <strong style={{ color: 'var(--v2-text-primary)' }}>
          {currentChip?.label.toLowerCase() ?? outcome}
        </strong>
        .
      </p>

      {ranked.length === 0 ? (
        <Card padding="md">
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Not enough confident signal yet for{' '}
            {currentChip?.label.toLowerCase() ?? outcome}. Keep logging
            for a couple of weeks and the strongest factors will show
            up here.{' '}
            <Link
              href="/v2/log"
              style={{ color: 'var(--v2-text-primary)', textDecoration: 'underline' }}
            >
              Open the log
            </Link>
            .
          </p>
        </Card>
      ) : (
        <ol
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-3)',
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}
        >
          {ranked.map((row) => (
            <li key={row.id}>
              <Card padding="md">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
                  <div
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
                      {row.factor}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--v2-text-xs)',
                        color: CONFIDENCE_COLORS[row.confidence],
                        textTransform: 'uppercase',
                        letterSpacing: 'var(--v2-tracking-wide)',
                        fontWeight: 'var(--v2-weight-semibold)',
                      }}
                    >
                      {row.confidence}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--v2-text-sm)',
                      color: 'var(--v2-text-secondary)',
                      lineHeight: 'var(--v2-leading-relaxed)',
                    }}
                  >
                    {row.impact}
                  </p>
                  {row.sampleSize > 0 ? (
                    <span
                      style={{
                        fontSize: 'var(--v2-text-xs)',
                        color: 'var(--v2-text-muted)',
                      }}
                    >
                      Based on {row.sampleSize} day{row.sampleSize === 1 ? '' : 's'} of data
                    </span>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
