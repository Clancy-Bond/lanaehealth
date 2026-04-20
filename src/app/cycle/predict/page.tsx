/**
 * /cycle/predict - next period + fertile window with honest uncertainty.
 *
 * This page is the "what's coming" view. It never hides the range, never
 * promises a point estimate, and links back to history when the user
 * wants to see what the predictions are based on. Follows NC patterns 2,
 * 3, and 15 while staying honest per our voice rules.
 */
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { NextPeriodCountdown } from '@/components/cycle/NextPeriodCountdown'
import { FertilitySignalCard } from '@/components/cycle/FertilitySignalCard'

export const dynamic = 'force-dynamic'

export default async function CyclePredictPage() {
  const todayISO = format(new Date(), 'yyyy-MM-dd')
  const ctx = await loadCycleContext(todayISO)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: 16,
        maxWidth: 820,
        margin: '0 auto',
        paddingBottom: 96,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Cycle / Predict
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.15 }}>
          What&rsquo;s coming
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
          Ranges, not points. When the uncertainty is wide, we show a wide
          window. That&rsquo;s the honest answer.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <NextPeriodCountdown prediction={ctx.periodPrediction} />
        <FertilitySignalCard
          prediction={ctx.fertilePrediction}
          confirmedOvulation={ctx.confirmedOvulation}
        />
      </div>

      <section
        className="card"
        style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>How these predictions are built</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          <li>
            Mean cycle length:{' '}
            <strong className="tabular">
              {ctx.stats.meanCycleLength != null ? `${ctx.stats.meanCycleLength}d` : 'unknown'}
              {ctx.stats.sdCycleLength != null ? ` \u00b1 ${ctx.stats.sdCycleLength}d` : ''}
            </strong>{' '}
            across {ctx.stats.sampleSize} completed cycle{ctx.stats.sampleSize === 1 ? '' : 's'}.
          </li>
          <li>
            Fertile window assumes a textbook 14-day luteal phase. Your real
            luteal length may vary; BBT and LH tests refine it.
          </li>
          <li>
            Ovulation confirmation:{' '}
            {ctx.confirmedOvulation
              ? 'BBT shift detected in the last 14 days.'
              : 'No sustained BBT shift yet. Log temperatures to confirm.'}
          </li>
          <li>
            Predictions widen when cycle variability is higher. We do not
            pretend to know a single date when we don&rsquo;t.
          </li>
        </ul>
      </section>

      {ctx.periodPrediction.status === 'overdue' && (
        <section
          className="card"
          style={{
            padding: '16px 18px',
            background: 'var(--accent-blush-muted)',
            borderLeft: '3px solid var(--accent-blush)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: 'var(--accent-blush)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 4,
            }}
          >
            Cycle is late
          </div>
          <p style={{ fontSize: 13, margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Late cycles happen. Stress, travel, illness, weight shifts, and
            thyroid changes can all push the timing. When a period does start,{' '}
            <Link href="/cycle/log" style={{ color: 'var(--accent-sage)' }}>log it</Link>{' '}
            and the prediction refreshes.
          </p>
        </section>
      )}

      {ctx.current.lastPeriodStart && (
        <div
          className="tabular"
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          Last period start: {format(parseISO(ctx.current.lastPeriodStart), 'MMM d, yyyy')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link
          href="/cycle/history"
          className="press-feedback"
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          See past cycles
        </Link>
        <Link
          href="/cycle/log"
          className="press-feedback"
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            background: 'var(--accent-sage)',
            color: 'var(--text-inverse)',
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          Log a period
        </Link>
      </div>

      <Link
        href="/cycle"
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          textDecoration: 'none',
          alignSelf: 'flex-start',
        }}
      >
        &lsaquo; Back to Cycle
      </Link>
    </div>
  )
}
