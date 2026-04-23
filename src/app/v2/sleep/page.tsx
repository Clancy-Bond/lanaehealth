/**
 * /v2/sleep: Sleep detail
 *
 * Mirrors Oura's sleep day-detail pattern: hero ring with band label
 * and reason, contributor rows with educational modals, bar-chart
 * trend with a range toggle, and a historical night list.
 *
 * We read a single 90-day window at server render time. The trend
 * sub-component filters locally so the range toggle is instant.
 */
import Link from 'next/link'
import { MobileShell, TopAppBar, StandardTabBar } from '@/v2/components/shell'
import { getOuraData } from '@/lib/api/oura'
import { median } from '@/lib/v2/home-signals'
import SleepHero from './_components/SleepHero'
import SleepTrend from './_components/SleepTrend'
import SleepContributors from './_components/SleepContributors'
import SleepNightList from './_components/SleepNightList'
import SectionHeader from '../_components/SectionHeader'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function ninetyDaysAgoISO(today: string): string {
  const t = new Date(today + 'T00:00:00Z').getTime()
  return new Date(t - 90 * 86_400_000).toISOString().slice(0, 10)
}

export default async function V2SleepPage() {
  const today = todayISO()
  const start = ninetyDaysAgoISO(today)

  let ouraData: Awaited<ReturnType<typeof getOuraData>> = []
  try {
    ouraData = await getOuraData(start, today)
  } catch {
    ouraData = []
  }

  const sorted = [...ouraData].sort((a, b) => a.date.localeCompare(b.date))
  const lastNight = sorted[sorted.length - 1] ?? null
  const last14 = sorted.slice(-14)
  const last30 = sorted.slice(-30)
  const medianScore = median(last30.map((d) => d.sleep_score))

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Sleep"
          leading={
            <Link
              href="/v2"
              aria-label="Back to home"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-lg)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              ←
            </Link>
          }
        />
      }
      bottom={<StandardTabBar />}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-5)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-10)',
        }}
      >
        <SleepHero lastNight={lastNight} medianScore={medianScore} />

        <SleepTrend ninetyDays={sorted} />

        <section>
          <SectionHeader eyebrow="Last night, in detail" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <SleepContributors lastNight={lastNight} />
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="History" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <SleepNightList nights={last14} />
          </div>
        </section>
      </div>
    </MobileShell>
  )
}
