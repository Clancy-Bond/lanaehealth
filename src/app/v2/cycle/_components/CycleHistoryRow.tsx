/*
 * CycleHistoryRow
 *
 * NC-fidelity push (frame_0080): each completed cycle reads as a
 * numbered red circle on the left (cycle index), connected to the next
 * cycle by a thin pink vertical line so the history feels like a
 * continuous timeline rather than a list of disconnected rows. The
 * circle picks up an Anovulatory chip when BBT never sustained a rise.
 */
import type { Cycle } from '@/lib/cycle/cycle-stats'

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export interface CycleHistoryRowProps {
  cycle: Cycle
  meanCycleLength: number | null
  /**
   * True when BBT never sustained a rise above the cover line for this
   * entire cycle, per detectAnovulatoryCycle. Renders an "Anovulatory"
   * badge so the reader can spot patterns over time.
   */
  anovulatory?: boolean
  /**
   * 1-indexed cycle number (most recent = 1). Optional; when present we
   * render NC's signature numbered circle on the left.
   */
  cycleNumber?: number
  /**
   * When true, render a vertical pink connector line below the circle so
   * adjacent rows visually link. Pass false on the last row.
   */
  connectorBelow?: boolean
}

export default function CycleHistoryRow({
  cycle,
  meanCycleLength,
  anovulatory = false,
  cycleNumber,
  connectorBelow = true,
}: CycleHistoryRowProps) {
  const length = cycle.lengthDays
  const deviation =
    length != null && meanCycleLength != null ? Math.round(length - meanCycleLength) : null
  const outOfRange = length != null && (length < 21 || length > 35)

  // No em or en dashes (CLAUDE.md). Use "to" for ranges.
  const rangeText = `${fmtDate(cycle.startDate)} to ${fmtDate(cycle.periodEndDate)}`

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        gap: 'var(--v2-space-3)',
        padding: 'var(--v2-space-3) 0',
        alignItems: 'flex-start',
      }}
    >
      {/* Left rail: numbered circle + vertical connector to next row. */}
      <div
        style={{
          position: 'relative',
          width: 36,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--v2-surface-explanatory-accent)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            fontVariantNumeric: 'tabular-nums',
            zIndex: 1,
          }}
        >
          {cycleNumber ?? ''}
        </span>
        {connectorBelow && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 32,
              bottom: -8,
              width: 3,
              background: 'rgba(232, 69, 112, 0.55)',
              borderRadius: 2,
            }}
          />
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--v2-space-2)', flexWrap: 'wrap' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 'var(--v2-text-base)', fontWeight: 'var(--v2-weight-semibold)', color: 'var(--v2-text-primary)' }}>
            {length != null ? `${length} days` : 'In progress'}
          </span>
          {anovulatory && (
            <span
              aria-label="No ovulation detected this cycle"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: 'var(--v2-radius-full)',
                border: '1px solid var(--v2-border-subtle)',
                background: 'rgba(229, 201, 82, 0.08)',
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-secondary)',
                fontWeight: 'var(--v2-weight-medium)',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
              }}
            >
              Anovulatory
            </span>
          )}
        </div>
        <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
          {rangeText}
          {cycle.periodDays > 0 && ` · ${cycle.periodDays}d period`}
        </div>
      </div>

      {/* Trailing: deviation chip */}
      {deviation != null && (
        <div
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontSize: 'var(--v2-text-sm)',
            color: outOfRange ? 'var(--v2-accent-warning)' : 'var(--v2-text-muted)',
            paddingTop: 4,
          }}
        >
          {deviation > 0 ? `+${deviation}` : deviation}d
        </div>
      )}
    </div>
  )
}
