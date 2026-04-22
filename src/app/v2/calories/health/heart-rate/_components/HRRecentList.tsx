/*
 * HRRecentList
 *
 * Full history of HR spot-checks, newest first, grouped by month.
 * Each month gets a small eyebrow label with a thin hairline so the
 * list still scans cleanly when a year's worth of readings stack up.
 * Month grouping mirrors the visual pattern already proven on
 * /v2/records (TimelineGroup).
 *
 * Label is the bpm value, subtext is date + context (+ notes on a
 * second line); no trailing pill because bpm is already the primary
 * number. No pagination : native scroll handles reasonable history
 * sizes; we revisit with virtualization only if lists get huge.
 */
import { format, parseISO } from 'date-fns'
import { Card, ListRow } from '@/v2/components/primitives'
import {
  hrContextLabel,
  type HeartRateEntry,
} from '@/lib/calories/heart-rate'

export interface HRRecentListProps {
  entries: HeartRateEntry[]
}

interface MonthGroup {
  key: string
  label: string
  entries: HeartRateEntry[]
}

function groupByMonth(entries: HeartRateEntry[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  let current: MonthGroup | null = null
  for (const e of entries) {
    const d = parseISO(e.date + 'T00:00:00')
    const key = format(d, 'yyyy-MM')
    if (!current || current.key !== key) {
      current = { key, label: format(d, 'MMMM yyyy'), entries: [] }
      groups.push(current)
    }
    current.entries.push(e)
  }
  return groups
}

export default function HRRecentList({ entries }: HRRecentListProps) {
  if (entries.length === 0) return null

  // loadHeartRateLog already sorts DESC (date then loggedAt), so we
  // trust the incoming order. Month grouping walks once linearly.
  const groups = groupByMonth(entries)

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-4)',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          color: 'var(--v2-text-muted)',
          fontWeight: 'var(--v2-weight-semibold)',
        }}
      >
        History
      </h2>
      {groups.map((group) => (
        <section
          key={group.key}
          aria-label={group.label}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--v2-space-2)',
              paddingLeft: 'var(--v2-space-1)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {group.label}
            </span>
            <span
              aria-hidden="true"
              style={{
                flex: 1,
                height: 1,
                background: 'var(--v2-border-subtle)',
              }}
            />
          </div>
          <Card padding="none">
            <div style={{ padding: '0 var(--v2-space-4)' }}>
              {group.entries.map((e, i) => {
                const dateLabel = format(
                  parseISO(e.date + 'T00:00:00'),
                  'MMM d',
                )
                const datePart = e.time ? `${dateLabel} · ${e.time}` : dateLabel
                const subtextMain = `${datePart} · ${hrContextLabel(e.context)}`
                return (
                  <ListRow
                    key={e.id}
                    label={
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {e.bpm}
                        <span
                          style={{
                            fontSize: 'var(--v2-text-sm)',
                            color: 'var(--v2-text-muted)',
                            marginLeft: 4,
                            fontWeight: 'var(--v2-weight-regular)',
                          }}
                        >
                          bpm
                        </span>
                      </span>
                    }
                    subtext={
                      <span>
                        {subtextMain}
                        {e.notes ? (
                          <span
                            style={{
                              display: 'block',
                              marginTop: 2,
                              color: 'var(--v2-text-muted)',
                            }}
                          >
                            {e.notes}
                          </span>
                        ) : null}
                      </span>
                    }
                    divider={i < group.entries.length - 1}
                  />
                )
              })}
            </div>
          </Card>
        </section>
      ))}
    </section>
  )
}
