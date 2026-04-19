/**
 * Cycle history list.
 *
 * Table-like view of completed cycles: start date, length in days, period
 * length, and a flag when the cycle falls outside ACOG 21-35d normal
 * range. We show the most-recent completed cycles first.
 */
import { format, parseISO } from 'date-fns'
import type { Cycle, CycleStats, Regularity } from '@/lib/cycle/cycle-stats'

export interface CycleHistoryListProps {
  stats: CycleStats
}

const REGULARITY_COPY: Record<Regularity, string> = {
  regular: 'Cycles cluster tightly around your mean. Predictions are narrow.',
  somewhat: 'Cycles vary a bit. Predictions include a small uncertainty buffer.',
  irregular: 'Cycles vary widely. Predictions widen to match your real range. This is honest, not alarming.',
  insufficient: 'Not enough completed cycles yet to compute regularity.',
}

export function CycleHistoryList({ stats }: CycleHistoryListProps) {
  const cycles = [...stats.completedCycles].reverse()

  if (cycles.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: '20px 18px',
          color: 'var(--text-muted)',
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        No completed cycles yet. A cycle closes when a new period starts after
        the current one, so the list fills in as data accumulates.
      </div>
    )
  }

  return (
    <section className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Past cycles</div>
        <div className="tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {stats.sampleSize} complete
        </div>
      </div>

      <StatRow stats={stats} />

      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
        {REGULARITY_COPY[stats.regularity]}
      </p>

      <div
        role="table"
        aria-label="Past cycle lengths"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(100px, 1fr) auto auto auto',
          gap: '4px 12px',
          fontSize: 12,
          marginTop: 4,
        }}
      >
        <Cell role="columnheader" strong>Start</Cell>
        <Cell role="columnheader" strong align="end">Length</Cell>
        <Cell role="columnheader" strong align="end">Period</Cell>
        <Cell role="columnheader" strong align="end">Note</Cell>

        {cycles.map((c) => (
          <CycleRow key={c.startDate} cycle={c} />
        ))}
      </div>
    </section>
  )
}

function StatRow({ stats }: { stats: CycleStats }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 8,
      }}
    >
      <Stat label="Mean cycle" value={formatDays(stats.meanCycleLength)} sub={stats.sdCycleLength != null ? `\u00b1 ${stats.sdCycleLength}d` : null} />
      <Stat label="Shortest" value={formatDays(stats.shortestCycle)} />
      <Stat label="Longest" value={formatDays(stats.longestCycle)} />
      <Stat label="Mean period" value={formatDays(stats.meanPeriodLength)} sub={stats.sdPeriodLength != null ? `\u00b1 ${stats.sdPeriodLength}d` : null} />
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        background: 'var(--bg-elevated)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>
      <div className="tabular" style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
      {sub && (
        <div className="tabular" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sub}</div>
      )}
    </div>
  )
}

function CycleRow({ cycle }: { cycle: Cycle }) {
  const len = cycle.lengthDays
  const outOfRange = len != null && (len < 21 || len > 35)
  return (
    <>
      <Cell>
        {format(parseISO(cycle.startDate), 'MMM d, yyyy')}
      </Cell>
      <Cell align="end" mono>{len != null ? `${len}d` : '--'}</Cell>
      <Cell align="end" mono>{cycle.periodDays}d</Cell>
      <Cell align="end">
        {outOfRange ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--phase-luteal)',
              background: 'rgba(232, 168, 73, 0.14)',
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            outside 21-35d
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>--</span>
        )}
      </Cell>
    </>
  )
}

function Cell({
  children,
  role,
  strong,
  align,
  mono,
}: {
  children: React.ReactNode
  role?: string
  strong?: boolean
  align?: 'start' | 'end'
  mono?: boolean
}) {
  return (
    <div
      role={role}
      className={mono ? 'tabular' : undefined}
      style={{
        padding: '6px 0',
        borderBottom: '1px solid var(--border-light)',
        textAlign: align === 'end' ? 'end' : 'start',
        fontWeight: strong ? 800 : 500,
        fontSize: strong ? 10 : 12,
        color: strong ? 'var(--text-muted)' : 'var(--text-primary)',
        textTransform: strong ? 'uppercase' : 'none',
        letterSpacing: strong ? '0.06em' : 'normal',
      }}
    >
      {children}
    </div>
  )
}

function formatDays(n: number | null): string {
  return n == null ? '--' : `${n}d`
}
