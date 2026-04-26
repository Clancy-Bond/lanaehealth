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
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { getOuraData } from '@/lib/api/oura'
import { median } from '@/lib/v2/home-signals'
import SleepHero from './_components/SleepHero'
import SleepTrend from './_components/SleepTrend'
import SleepContributors from './_components/SleepContributors'
import SleepNightList from './_components/SleepNightList'
import SleepStagesStrip from './_components/SleepStagesStrip'
import BedtimeRegularityChart from './_components/BedtimeRegularityChart'
import BodyTempChart from './_components/BodyTempChart'
import HrvBalanceCard from './_components/HrvBalanceCard'
import SectionHeader from '../_components/SectionHeader'
import RouteFade from '../_components/RouteFade'
import RefreshRouter from '../_components/RefreshRouter'
import CorrectionsPanel from '@/v2/components/CorrectionsPanel'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function ninetyDaysAgoISO(today: string): string {
  const t = new Date(today + 'T00:00:00Z').getTime()
  return new Date(t - 90 * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Pull the Oura sleep_regularity contributor (0-100) from raw_json.
 * Wave 1 (audit): the value lives at
 * raw_json.oura.readiness.contributors.sleep_regularity but was missing
 * from the OuraContributors interface, so the SleepRegularityExplainer
 * always rendered the empty state. Now wired through so the modal
 * actually shows last night's score.
 */
function extractRegularityScore(
  night: { raw_json?: Record<string, unknown> | null } | null,
): number | null {
  if (!night) return null
  const oura = (night.raw_json as { oura?: { readiness?: { contributors?: { sleep_regularity?: unknown } } } } | null | undefined)?.oura
  const value = oura?.readiness?.contributors?.sleep_regularity
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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
    >
      <RefreshRouter>
        <RouteFade>
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
            <SleepContributors
              lastNight={lastNight}
              sleepLatencyMin={lastNight?.sleep_latency_min ?? null}
              regularityScore={extractRegularityScore(lastNight)}
            />
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="HRV balance" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <HrvBalanceCard nights={sorted} />
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="Sleep stages, last 7 nights" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <SleepStagesStrip nights={sorted} />
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="Bedtime regularity, last 14 nights" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <BedtimeRegularityChart nights={sorted} />
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="Body temperature, last 30 nights" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <BodyTempChart nights={sorted} />
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="History" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <SleepNightList nights={last14} />
          </div>
        </section>

        {/* Data correction affordance. Lets the user override Oura
            values that look wrong (e.g. ring off the finger, missed
            night). Saves into medical_narrative and the AI will see
            the correction in every future conversation. */}
        {lastNight && (
          <CorrectionsPanel
            tableName="oura_daily"
            rowId={lastNight.id}
            source="v2_sleep"
            heading="Does last night look wrong?"
            subtext="If Oura missed the night or the score does not match how you felt, fix it here."
            fields={[
              {
                label: 'Sleep score',
                value: lastNight.sleep_score,
                fieldName: 'sleep_score',
                inputType: 'number',
                displayValue: lastNight.sleep_score == null ? 'No reading' : `${lastNight.sleep_score}`,
              },
              {
                // Stored in seconds. We surface seconds as the editable
                // value so the saved correction matches the column type;
                // the displayValue shows it in readable form.
                label: 'Sleep duration (seconds, displayed in minutes)',
                value: lastNight.sleep_duration,
                fieldName: 'sleep_duration',
                inputType: 'number',
                displayValue: (() => {
                  const v = lastNight.sleep_duration
                  if (v == null) return 'No reading'
                  const n = typeof v === 'number' ? v : Number(v)
                  if (!Number.isFinite(n)) return String(v)
                  return `${Math.round(n / 60)} min (${n}s)`
                })(),
              },
              {
                label: 'Resting heart rate',
                value: lastNight.resting_hr,
                fieldName: 'resting_hr',
                inputType: 'number',
                displayValue: lastNight.resting_hr == null ? 'No reading' : `${lastNight.resting_hr} bpm`,
              },
            ]}
          />
        )}
          </div>
        </RouteFade>
      </RefreshRouter>
    </MobileShell>
  )
}
