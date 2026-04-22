/*
 * BPRecentList
 *
 * Full history of blood-pressure readings, newest first, grouped by
 * month. Each month gets a small eyebrow label with a thin hairline
 * divider so scrolling a year of readings still reads as months
 * rather than one endless list. Month grouping mirrors the visual
 * pattern already proven on /v2/records (TimelineGroup).
 *
 * Label per row is the headline value ("120/80"), subtext is date
 * + position (+ notes on a second line), trailing is the
 * classification pill so the "pay attention" signal lines up
 * visually across rows. No pagination : native scroll handles
 * reasonable history sizes; if list length ever hits 1000+ we
 * revisit with virtualization.
 */
import { format, parseISO } from 'date-fns'
import { Card, ListRow } from '@/v2/components/primitives'
import {
  classifyBP,
  type BloodPressureEntry,
} from '@/lib/calories/blood-pressure'

export interface BPRecentListProps {
  entries: BloodPressureEntry[]
}

interface MonthGroup {
  key: string
  label: string
  entries: BloodPressureEntry[]
}

function groupByMonth(entries: BloodPressureEntry[]): MonthGroup[] {
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

export default function BPRecentList({ entries }: BPRecentListProps) {
  if (entries.length === 0) return null

  // loadBloodPressureLog already sorts DESC (date then loggedAt), so
  // we trust the incoming order. Month grouping walks once linearly.
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
                const cls = classifyBP(e.systolic, e.diastolic)
                const dateLabel = format(
                  parseISO(e.date + 'T00:00:00'),
                  'MMM d',
                )
                const positionLabel =
                  e.position !== 'unknown' ? e.position : null
                const subtextMain = [
                  e.time ? `${dateLabel} · ${e.time}` : dateLabel,
                  positionLabel,
                  e.pulse !== null ? `pulse ${e.pulse}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <ListRow
                    key={e.id}
                    label={
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {e.systolic}/{e.diastolic}
                        <span
                          style={{
                            fontSize: 'var(--v2-text-sm)',
                            color: 'var(--v2-text-muted)',
                            marginLeft: 4,
                            fontWeight: 'var(--v2-weight-regular)',
                          }}
                        >
                          mmHg
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
                    trailing={
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--v2-radius-full)',
                          background: cls.color,
                          color: '#FFFFFF',
                          fontSize: 11,
                          fontWeight: 'var(--v2-weight-semibold)',
                          textTransform: 'uppercase',
                          letterSpacing: 'var(--v2-tracking-wide)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cls.label}
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
