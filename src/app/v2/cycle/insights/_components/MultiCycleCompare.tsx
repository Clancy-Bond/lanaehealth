/*
 * MultiCycleCompare (Feature B, NC wave 3)
 *
 * NC's pattern (frame_0060 / frame_0125): show the last 3-6 cycles
 * side-by-side so the user can directly compare cycle length, period
 * length, ovulation day, and any anomalies (long cycle, late ovulation,
 * anovulatory). Average and range are shown alongside.
 *
 * This is a server component because the inputs (CycleStats +
 * detectAnovulatoryCycle outputs) are computed in load-cycle-context
 * and we render statically. Per-cycle anomaly tags are derived in-place
 * from the cycle's own length + ovulation day relative to the user's
 * mean and SD so the same cycle is flagged identically across surfaces.
 *
 * Anomaly definitions used here (NC-aligned; documented in
 * docs/research/nc-pattern-recognition-audit.md section 4.9):
 *   - long: cycle length > 35 days OR > mean + 2 * SD
 *   - short: cycle length < 21 days OR < mean - 2 * SD
 *   - lateOvulation: ovulation day > 21 (uncommon for normal cycles)
 *   - anovulatory: passed in from detectAnovulatoryCycle
 */
import type { Cycle } from '@/lib/cycle/cycle-stats'

export interface CycleCompareEntry {
  cycle: Cycle
  /** 1-indexed cycle number (most recent = 1). */
  cycleNumber: number
  /** Computed ovulation day inside the cycle, when known. */
  ovulationDay: number | null
  /** True when detectAnovulatoryCycle flagged this cycle. */
  anovulatory: boolean
}

export interface MultiCycleCompareProps {
  /** Last N cycles (most-recent first). Component clamps display to 6. */
  entries: CycleCompareEntry[]
  /** Mean cycle length across all completed cycles, used for deviation chip. */
  meanCycleLength: number | null
  /** Sample SD of cycle length, used for outlier flagging. */
  sdCycleLength: number | null
  /** Mean period length, surfaced in the average row. */
  meanPeriodLength: number | null
}

const MAX_CYCLES_DISPLAYED = 6

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface AnomalyTag {
  label: string
  tone: 'warn' | 'info'
}

function classifyAnomalies(
  cycle: Cycle,
  ovulationDay: number | null,
  anovulatory: boolean,
  meanCycleLength: number | null,
  sdCycleLength: number | null,
): AnomalyTag[] {
  const tags: AnomalyTag[] = []
  if (anovulatory) tags.push({ label: 'Anovulatory', tone: 'warn' })
  if (cycle.lengthDays != null) {
    const len = cycle.lengthDays
    const longBound = meanCycleLength != null && sdCycleLength != null
      ? Math.max(35, meanCycleLength + 2 * sdCycleLength)
      : 35
    const shortBound = meanCycleLength != null && sdCycleLength != null
      ? Math.min(21, meanCycleLength - 2 * sdCycleLength)
      : 21
    if (len > longBound) tags.push({ label: 'Long cycle', tone: 'warn' })
    else if (len < shortBound) tags.push({ label: 'Short cycle', tone: 'warn' })
  }
  if (ovulationDay != null && ovulationDay > 21) {
    tags.push({ label: 'Late ovulation', tone: 'info' })
  }
  return tags
}

export default function MultiCycleCompare({
  entries,
  meanCycleLength,
  sdCycleLength,
  meanPeriodLength,
}: MultiCycleCompareProps) {
  const displayed = entries.slice(0, MAX_CYCLES_DISPLAYED)

  if (displayed.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--v2-space-4)',
          background: 'var(--v2-bg-card)',
          border: '1px dashed var(--v2-border-subtle)',
          borderRadius: 'var(--v2-radius-lg)',
          textAlign: 'center',
        }}
        data-testid="multi-cycle-compare-empty"
      >
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
          You need at least one completed cycle for the side-by-side view.
          Complete a few more and the patterns become clearer.
        </p>
      </div>
    )
  }

  const lengths = displayed
    .map((e) => e.cycle.lengthDays)
    .filter((n): n is number => n != null && Number.isFinite(n))
  const minLen = lengths.length > 0 ? Math.min(...lengths) : null
  const maxLen = lengths.length > 0 ? Math.max(...lengths) : null

  return (
    <div
      data-testid="multi-cycle-compare"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}
    >
      <div
        role="grid"
        aria-label="Side-by-side cycle comparison"
        style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 56px 56px 56px',
          alignItems: 'center',
          gap: 'var(--v2-space-2)',
          padding: 'var(--v2-space-2) 0',
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          borderBottom: '1px solid var(--v2-border-subtle)',
        }}
      >
        <span role="columnheader">#</span>
        <span role="columnheader">Window</span>
        <span role="columnheader" style={{ textAlign: 'right' }}>Length</span>
        <span role="columnheader" style={{ textAlign: 'right' }}>Period</span>
        <span role="columnheader" style={{ textAlign: 'right' }}>Ov day</span>
      </div>

      {displayed.map((e) => {
        const tags = classifyAnomalies(
          e.cycle,
          e.ovulationDay,
          e.anovulatory,
          meanCycleLength,
          sdCycleLength,
        )
        return (
          <div
            key={`${e.cycle.startDate}-${e.cycleNumber}`}
            role="row"
            data-testid={`multi-cycle-row-${e.cycleNumber}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 56px 56px 56px',
              alignItems: 'center',
              gap: 'var(--v2-space-2)',
              padding: 'var(--v2-space-3) 0',
              borderBottom: '1px solid var(--v2-border-subtle)',
            }}
          >
            <span
              role="cell"
              aria-label={`Cycle number ${e.cycleNumber}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--v2-surface-explanatory-accent)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--v2-text-xs)',
                fontWeight: 'var(--v2-weight-semibold)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {e.cycleNumber}
            </span>
            <div role="cell" style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-primary)' }}>
                {fmtDate(e.cycle.startDate)} to {fmtDate(e.cycle.periodEndDate)}
              </span>
              {tags.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--v2-space-1)', flexWrap: 'wrap' }}>
                  {tags.map((t) => (
                    <span
                      key={t.label}
                      style={{
                        fontSize: 'var(--v2-text-xs)',
                        padding: '2px 8px',
                        borderRadius: 'var(--v2-radius-full)',
                        border: '1px solid var(--v2-border-subtle)',
                        background:
                          t.tone === 'warn'
                            ? 'rgba(217, 119, 92, 0.18)'
                            : 'rgba(229, 201, 82, 0.16)',
                        color: 'var(--v2-text-secondary)',
                      }}
                    >
                      {t.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span
              role="cell"
              style={{
                textAlign: 'right',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {e.cycle.lengthDays != null ? `${e.cycle.lengthDays}d` : '-'}
            </span>
            <span
              role="cell"
              style={{
                textAlign: 'right',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {e.cycle.periodDays > 0 ? `${e.cycle.periodDays}d` : '-'}
            </span>
            <span
              role="cell"
              style={{
                textAlign: 'right',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {e.ovulationDay != null ? `CD ${e.ovulationDay}` : '-'}
            </span>
          </div>
        )
      })}

      <div
        role="row"
        data-testid="multi-cycle-summary"
        style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 56px 56px 56px',
          alignItems: 'center',
          gap: 'var(--v2-space-2)',
          padding: 'var(--v2-space-3) 0',
          marginTop: 'var(--v2-space-2)',
          borderTop: '1px solid var(--v2-border-subtle)',
          background: 'var(--v2-bg-card)',
          borderRadius: 'var(--v2-radius-md)',
        }}
      >
        <span role="cell" />
        <span role="cell" style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
          Average
          {minLen != null && maxLen != null && minLen !== maxLen && (
            <span style={{ marginLeft: 'var(--v2-space-2)', fontSize: 'var(--v2-text-xs)' }}>
              range {minLen}d to {maxLen}d
            </span>
          )}
        </span>
        <span
          role="cell"
          style={{
            textAlign: 'right',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {meanCycleLength != null ? `${meanCycleLength.toFixed(1)}d` : '-'}
        </span>
        <span
          role="cell"
          style={{
            textAlign: 'right',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {meanPeriodLength != null ? `${meanPeriodLength.toFixed(1)}d` : '-'}
        </span>
        <span role="cell" />
      </div>
    </div>
  )
}
