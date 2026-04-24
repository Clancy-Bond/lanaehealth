import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { getCombinedCycleEntries } from '@/lib/api/nc-cycle'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card, Banner } from '@/v2/components/primitives'
import PeriodCountdownCard from '../_components/PeriodCountdownCard'
import FertilityAwarenessCard from '../_components/FertilityAwarenessCard'
import BbtChartPanel from '../_components/BbtChartPanel'
import { buildBbtChartData } from '../_components/bbtChartAdapter'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function V2CyclePredictPage() {
  const today = todayISO()
  const ctx = await loadCycleContext(today)
  const mean = ctx.stats.meanCycleLength
  const sd = ctx.stats.sdCycleLength
  const sample = ctx.stats.sampleSize

  // Pull this cycle's menstrual entries so the chart's period-band
  // background lines up with logged flow days. Window is from the
  // current period's start (or 60 days back if unknown) to today.
  const cycleStart = ctx.current.lastPeriodStart ?? today
  const cycleEntries = await getCombinedCycleEntries(cycleStart, today)
  const periodDates = new Set(cycleEntries.filter((e) => e.menstruation === true).map((e) => e.date))
  const { readings, coverLine } = buildBbtChartData({
    readings: ctx.bbtReadings,
    lastPeriodStart: ctx.current.lastPeriodStart,
    periodDates,
  })

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
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                minWidth: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
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
            ncOvulationStatus={ctx.ncOvulationStatusToday}
            ovulation={ctx.ovulation}
          />
        </div>

        {/* Temperature pattern (NC's signature visual). The line color
            shifts at the user's personal cover line: green below, red
            above. No horizontal threshold is drawn. See
            CoverLineExplainer for the methodology. */}
        <BbtChartPanel
          readings={readings}
          coverLine={coverLine}
          shiftDetected={ctx.confirmedOvulation}
        />

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
