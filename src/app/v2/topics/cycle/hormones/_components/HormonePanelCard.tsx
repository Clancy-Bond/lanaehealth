/*
 * HormonePanelCard
 *
 * One card per hormone. Always rendered (all 9 hormones show even if
 * no readings exist yet) so the user sees the full panel at a glance
 * and knows which hormones are unlogged.
 *
 * Shape:
 *   - Header: hormone label + typical-range subtext
 *   - Latest reading: big value + unit + date (or "No readings yet.")
 *   - Sparkline when entries.length >= 2 AND all share the same unit
 *   - Recent entries list: last 8 rows, date on the left, value +
 *     unit on the right
 *
 * Server component. Renders the client-only HormoneSparkline as a
 * child, which Next hydrates as an island.
 */
import { format, parseISO } from 'date-fns'
import { Card } from '@/v2/components/primitives'
import type { HormoneEntry } from '@/lib/cycle/hormones'
import HormoneSparkline from './HormoneSparkline'

export interface HormoneMeta {
  label: string
  defaultUnit: string
  typicalRange: string
}

export interface HormonePanelCardProps {
  meta: HormoneMeta
  /** All entries for this hormone. Need not be sorted : card sorts internally. */
  entries: HormoneEntry[]
}

function allShareUnit(entries: HormoneEntry[]): string | null {
  if (entries.length === 0) return null
  const first = entries[0].unit
  for (const e of entries) {
    if (e.unit !== first) return null
  }
  return first
}

export default function HormonePanelCard({ meta, entries }: HormonePanelCardProps) {
  // Ascending date order so the last element is the newest reading
  // (mirrors the LabTestGroup convention and the HormoneSparkline
  // re-sort).
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null

  const sharedUnit = allShareUnit(sorted)
  const trendable = sorted.length >= 2 && sharedUnit !== null

  // Most recent 8 readings for the compact list, newest-first so the
  // eye lands on the freshest reading first.
  const recent = [...sorted].reverse().slice(0, 8)

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-1)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            {meta.label}
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-normal)',
            }}
          >
            Typical: {meta.typicalRange}
          </span>
        </div>

        {latest ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--v2-space-2)',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 'var(--v2-text-2xl)',
                fontWeight: 'var(--v2-weight-bold)',
                color: 'var(--v2-text-primary)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 'var(--v2-tracking-tight)',
                lineHeight: 1.1,
              }}
            >
              {latest.value}
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-sm)',
                fontWeight: 'var(--v2-weight-medium)',
                color: 'var(--v2-text-muted)',
              }}
            >
              {latest.unit}
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {format(parseISO(latest.date + 'T00:00:00'), 'MMM d, yyyy')}
            </span>
          </div>
        ) : (
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-normal)',
            }}
          >
            No readings yet.
          </span>
        )}

        {trendable && <HormoneSparkline entries={sorted} unit={sharedUnit} />}

        {recent.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-1)',
            }}
          >
            {recent.map((e, i) => (
              <li
                key={`${e.date}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 'var(--v2-space-3)',
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span
                  style={{
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-text-primary)',
                  }}
                >
                  {e.value}
                  <span
                    style={{
                      fontWeight: 'var(--v2-weight-medium)',
                      color: 'var(--v2-text-muted)',
                      marginLeft: 3,
                    }}
                  >
                    {e.unit}
                  </span>
                </span>
                <span style={{ color: 'var(--v2-text-muted)' }}>
                  {format(parseISO(e.date + 'T00:00:00'), 'MMM d, yyyy')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
