/*
 * StatisticsRollup (Feature C, NC wave 3)
 *
 * NC's Cycle Insights statistics panel (frame_0040 / frame_0263). Shows
 * each metric in a "your stat vs population stat" pair with a published
 * reference range citation, mirroring NC's:
 *   "My luteal phase: 15 +/- 2 days. All NC users: 12 +/- 2 days."
 *
 * Reference values cited at the top so the source audit lives next to
 * the numbers it explains. Values match POPULATION_REFERENCES in
 * src/lib/cycle/cycle-insights.ts so the comparison Rows downstream
 * never drift from the rollup the user sees first.
 *
 * Sources cited:
 *   - Cycle length: 28 +/- 4 days
 *     Bull JR, Rowland SP, Scherwitzl EB, et al. Real-world menstrual
 *     cycle characteristics of more than 600,000 menstrual cycles. NPJ
 *     Digital Medicine, 2019. n = 124,648 women, 612,613 cycles.
 *     This is NC's own published reference dataset.
 *   - Follicular length: 16 +/- 3 days
 *     Lenton EA, Landgren BM, Sexton L, Harper R. Normal variation in
 *     the length of the follicular phase of the menstrual cycle. BJOG,
 *     1984. n = 65 women.
 *   - Luteal length: 12 +/- 2 days
 *     Lenton EA, Landgren BM, Sexton L. Normal variation in the length
 *     of the luteal phase of the menstrual cycle. BJOG, 1984. n = 60.
 *   - BBT shift magnitude: ~0.45 F (variable)
 *     Bauman JE. Basal body temperature: unreliable method of ovulation
 *     detection. Fertility & Sterility, 1981. NC published guidance
 *     describes a typical post-ovulatory rise of 0.4-0.6 F sustained
 *     across the luteal phase.
 *   - Period length: 5 +/- 2 days
 *     Bull et al. 2019, NPJ Digital Medicine, same dataset as cycle
 *     length above.
 */
import type { CycleStats } from '@/lib/cycle/cycle-stats'

interface PopulationReference {
  /** Pretty label, e.g. "Cycle length". */
  label: string
  /** Population mean (days, except BBT shift in degrees F). */
  popMean: number
  popSd: number
  /** Citation surfaced inline so the user can audit the source. */
  source: string
  /** Unit suffix for display ("d" or "F"). */
  unit: 'd' | 'F'
}

const POP_REFS = {
  cycleLength: {
    label: 'Cycle length',
    popMean: 28,
    popSd: 4,
    source: 'Bull et al. 2019, NPJ Digital Medicine, n=124,648',
    unit: 'd',
  },
  follicularLength: {
    label: 'Follicular phase',
    popMean: 16,
    popSd: 3,
    source: 'Lenton et al. 1984, BJOG, n=65',
    unit: 'd',
  },
  lutealLength: {
    label: 'Luteal phase',
    popMean: 12,
    popSd: 2,
    source: 'Lenton et al. 1984, BJOG, n=60',
    unit: 'd',
  },
  bbtShift: {
    label: 'BBT shift magnitude',
    popMean: 0.45,
    popSd: 0,
    source: 'Bauman 1981 / NC published guidance, 0.4-0.6 F typical',
    unit: 'F',
  },
  periodLength: {
    label: 'Period length',
    popMean: 5,
    popSd: 2,
    source: 'Bull et al. 2019, NPJ Digital Medicine, n=124,648',
    unit: 'd',
  },
} as const satisfies Record<string, PopulationReference>

export interface StatisticsRollupProps {
  stats: CycleStats
  /** Per-cycle luteal lengths, when known. May be empty. */
  lutealLengths?: ReadonlyArray<number>
  /** Per-cycle follicular lengths, when known. May be empty. */
  follicularLengths?: ReadonlyArray<number>
  /** Observed BBT shift magnitude in degrees F, when measurable. */
  bbtShiftMagnitude?: number | null
}

interface RowSpec {
  label: string
  userMean: number | null
  userSd: number | null
  pop: PopulationReference
  /** True when user value sits outside +/- 1 population SD. */
  flagged: boolean
}

function mean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function sampleSd(xs: readonly number[]): number | null {
  if (xs.length < 2) return null
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  const sumSq = xs.reduce((acc, x) => acc + (x - m) ** 2, 0)
  return Math.sqrt(sumSq / (xs.length - 1))
}

function round1(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null
  return Math.round(n * 10) / 10
}

function flagOutsideBand(userMean: number | null, pop: PopulationReference): boolean {
  if (userMean == null) return false
  const band = pop.popSd > 0 ? pop.popSd : 1
  return Math.abs(userMean - pop.popMean) > band
}

function fmtRange(m: number | null, sd: number | null, unit: string): string {
  if (m == null) return 'Not enough data'
  const mTxt = unit === 'F' ? m.toFixed(2) : m.toFixed(1)
  if (sd == null || sd <= 0) return `${mTxt} ${unit}`
  const sdTxt = unit === 'F' ? sd.toFixed(2) : sd.toFixed(1)
  return `${mTxt} +/- ${sdTxt} ${unit}`
}

function fmtPop(p: PopulationReference): string {
  if (p.popSd <= 0) return `${p.popMean.toFixed(p.unit === 'F' ? 2 : 0)} ${p.unit}`
  return `${p.popMean} +/- ${p.popSd} ${p.unit}`
}

export default function StatisticsRollup({
  stats,
  lutealLengths = [],
  follicularLengths = [],
  bbtShiftMagnitude = null,
}: StatisticsRollupProps) {
  const userLuteal = round1(mean(lutealLengths))
  const userLutealSd = round1(sampleSd(lutealLengths))
  const userFoll = round1(mean(follicularLengths))
  const userFollSd = round1(sampleSd(follicularLengths))

  const rows: RowSpec[] = [
    {
      label: POP_REFS.cycleLength.label,
      userMean: stats.meanCycleLength,
      userSd: stats.sdCycleLength,
      pop: POP_REFS.cycleLength,
      flagged: flagOutsideBand(stats.meanCycleLength, POP_REFS.cycleLength),
    },
    {
      label: POP_REFS.follicularLength.label,
      userMean: userFoll,
      userSd: userFollSd,
      pop: POP_REFS.follicularLength,
      flagged: flagOutsideBand(userFoll, POP_REFS.follicularLength),
    },
    {
      label: POP_REFS.lutealLength.label,
      userMean: userLuteal,
      userSd: userLutealSd,
      pop: POP_REFS.lutealLength,
      flagged: flagOutsideBand(userLuteal, POP_REFS.lutealLength),
    },
    {
      label: POP_REFS.bbtShift.label,
      userMean: bbtShiftMagnitude,
      userSd: null,
      pop: POP_REFS.bbtShift,
      flagged: false,
    },
    {
      label: POP_REFS.periodLength.label,
      userMean: stats.meanPeriodLength,
      userSd: stats.sdPeriodLength,
      pop: POP_REFS.periodLength,
      flagged: flagOutsideBand(stats.meanPeriodLength, POP_REFS.periodLength),
    },
  ]

  return (
    <div
      data-testid="statistics-rollup"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-md)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          Statistics rollup
        </h3>
        <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
          {stats.sampleSize} completed cycle{stats.sampleSize === 1 ? '' : 's'} on file
        </p>
      </header>

      <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        {rows.map((row) => (
          <div
            key={row.label}
            role="listitem"
            data-testid={`stat-row-${row.label.toLowerCase().replace(/\s+/g, '-')}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--v2-space-2)',
              padding: 'var(--v2-space-3)',
              borderRadius: 'var(--v2-radius-md)',
              border: '1px solid var(--v2-border-subtle)',
              background: row.flagged ? 'rgba(217, 119, 92, 0.08)' : 'var(--v2-bg-card)',
            }}
          >
            <div style={{ gridColumn: '1 / span 2' }}>
              <span
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                }}
              >
                {row.label}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--v2-tracking-wide)',
                  color: 'var(--v2-text-muted)',
                }}
              >
                You
              </span>
              <span
                style={{
                  fontSize: 'var(--v2-text-md)',
                  color: 'var(--v2-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtRange(row.userMean, row.userSd, row.pop.unit)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--v2-tracking-wide)',
                  color: 'var(--v2-text-muted)',
                }}
              >
                Population
              </span>
              <span
                style={{
                  fontSize: 'var(--v2-text-md)',
                  color: 'var(--v2-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtPop(row.pop)}
              </span>
            </div>
            <div style={{ gridColumn: '1 / span 2' }}>
              <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
                Source: {row.pop.source}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
