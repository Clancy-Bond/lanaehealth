/**
 * Symptom-by-phase heatmap.
 *
 * 4x5 grid: four cycle phases x five metrics (pain, fatigue, bloating,
 * stress, sleep). Each cell shows the mean value colored on a warm
 * sage -> blush scale. Empty cells (no data) use neutral elevated
 * background to stay non-shaming (not "missing", just "no data").
 */
import { METRIC_LABELS, type Metric, type PhaseCounts } from '@/lib/cycle/phase-symptoms'
import { PHASES } from '@/lib/cycle/phase-symptoms'
import type { CyclePhase } from '@/lib/types'

export interface PhaseSymptomHeatmapProps {
  counts: PhaseCounts
}

const METRICS: Metric[] = ['overall_pain', 'fatigue', 'bloating', 'stress', 'sleep_quality']
const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
}

function metricColor(metric: Metric, value: number): string {
  // sleep_quality: higher is better. Flip the scale.
  const norm = metric === 'sleep_quality' ? 1 - Math.min(1, value / 10) : Math.min(1, value / 10)
  const g = 144 - Math.round(norm * 60)
  const r = 107 + Math.round(norm * 100)
  const b = 128 - Math.round(norm * 40)
  return `rgb(${r} ${g} ${b} / ${0.35 + norm * 0.35})`
}

export function PhaseSymptomHeatmap({ counts }: PhaseSymptomHeatmapProps) {
  return (
    <section
      className="card"
      style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Symptoms by phase</div>
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            margin: '2px 0 0',
            lineHeight: 1.45,
          }}
        >
          Averages across logged days. Darker = higher (for sleep quality, darker = lower). Gray cells mean no data for that phase yet.
        </p>
      </div>
      <div
        style={{ overflowX: 'auto', margin: '0 -4px' }}
        className="hide-scrollbar"
      >
        <div
          role="table"
          aria-label="Symptoms by cycle phase"
          style={{
            display: 'grid',
            gridTemplateColumns: `minmax(96px, 1.1fr) repeat(${PHASES.length}, minmax(64px, 1fr))`,
            gap: 6,
            fontSize: 12,
            padding: '0 4px',
            minWidth: 360,
          }}
        >
          <HeaderCell>Metric</HeaderCell>
          {PHASES.map((p) => (
            <HeaderCell key={p} align="center">
              {PHASE_LABELS[p]}
            </HeaderCell>
          ))}

          {METRICS.map((metric) => (
            <Row key={metric} metric={metric} counts={counts} />
          ))}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        {PHASES.map((p) => (
          <span key={p}>
            {PHASE_LABELS[p]}: {counts.daysLoggedByPhase[p]} / {counts.daysByPhase[p]}d logged
          </span>
        ))}
      </div>
    </section>
  )
}

function Row({ metric, counts }: { metric: Metric; counts: PhaseCounts }) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-primary)',
          paddingRight: 4,
        }}
      >
        {METRIC_LABELS[metric]}
      </div>
      {PHASES.map((phase) => {
        const v = counts.averages[phase][metric]
        const hasData = v != null
        return (
          <div
            key={phase}
            role="cell"
            aria-label={`${metric} in ${phase}: ${hasData ? v : 'no data'}`}
            style={{
              padding: '10px 6px',
              borderRadius: 8,
              background: hasData ? metricColor(metric, v as number) : 'var(--bg-elevated)',
              color: hasData ? 'var(--text-primary)' : 'var(--text-muted)',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 700,
              fontFeatureSettings: '"tnum"',
            }}
          >
            {hasData ? (v as number).toFixed(1) : '--'}
          </div>
        )
      })}
    </>
  )
}

function HeaderCell({
  children,
  align,
}: {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <div
      role="columnheader"
      style={{
        fontSize: 10,
        fontWeight: 800,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        textAlign: align ?? 'start',
        paddingBottom: 4,
      }}
    >
      {children}
    </div>
  )
}
