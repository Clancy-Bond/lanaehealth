import Link from 'next/link'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card, Banner } from '@/v2/components/primitives'
import PeriodCountdownCard from '../_components/PeriodCountdownCard'
import FertilityAwarenessCard from '../_components/FertilityAwarenessCard'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function V2CyclePredictPage() {
  const ctx = await loadCycleContext(todayISO())
  const mean = ctx.stats.meanCycleLength
  const sd = ctx.stats.sdCycleLength
  const sample = ctx.stats.sampleSize

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="What's coming"
          leading={
            <Link
              href="/v2/cycle"
              aria-label="Back to cycle"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-base)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              ‹
            </Link>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
        }}
      >
        {/* Voice anchor */}
        <Card variant="explanatory" padding="md">
          <h2 style={{ margin: 0, fontSize: 'var(--v2-text-lg)', fontWeight: 'var(--v2-weight-semibold)' }}>
            Ranges, not points.
          </h2>
          <p
            style={{
              margin: 0,
              marginTop: 'var(--v2-space-2)',
              fontSize: 'var(--v2-text-sm)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            When the range is wide, our data is thin. That&apos;s the honest answer, not a bug.
            A few more logged cycles will tighten it.
          </p>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--v2-space-3)' }}>
          <PeriodCountdownCard prediction={ctx.periodPrediction} />
          <FertilityAwarenessCard
            prediction={ctx.fertilePrediction}
            cycleDay={ctx.current.day}
            phase={ctx.current.phase}
            isUnusuallyLong={ctx.current.isUnusuallyLong}
            confirmedOvulation={ctx.confirmedOvulation}
            ncFertilityColor={ctx.ncFertilityColorToday}
            ovulation={ctx.ovulation}
          />
        </div>

        {/* Methodology */}
        <Card padding="md">
          <h3
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            How we build these
          </h3>
          <ul
            style={{
              margin: 'var(--v2-space-2) 0 0',
              paddingLeft: 'var(--v2-space-5)',
              color: 'var(--v2-text-secondary)',
              fontSize: 'var(--v2-text-sm)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            <li>
              <strong style={{ color: 'var(--v2-text-primary)' }}>Mean cycle length:</strong>{' '}
              {mean != null ? `${mean} days` : 'not enough history yet'}
            </li>
            <li>
              <strong style={{ color: 'var(--v2-text-primary)' }}>Variability (SD):</strong>{' '}
              {sd != null ? `±${sd} days` : 'needs 2+ completed cycles'}
            </li>
            <li>
              <strong style={{ color: 'var(--v2-text-primary)' }}>Sample:</strong>{' '}
              {sample} logged menstrual {sample === 1 ? 'day' : 'days'}
            </li>
            <li>
              <strong style={{ color: 'var(--v2-text-primary)' }}>Fertile window:</strong>{' '}
              six days ending on predicted ovulation (sperm survival plus ovum viability).
            </li>
            <li>
              <strong style={{ color: 'var(--v2-text-primary)' }}>Luteal assumption:</strong>{' '}
              ~14 days. Your own luteal length will refine this as BBT data lands.
            </li>
          </ul>
        </Card>

        <Banner
          intent="info"
          title="Awareness, not contraception"
          body="These ranges support cycle awareness. Do not use them to plan or prevent pregnancy on their own."
        />
      </div>
    </MobileShell>
  )
}
