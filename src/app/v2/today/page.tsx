/**
 * /v2/today: Today snapshot
 *
 * The "at-a-glance day" view. Complementary to Home: where Home
 * answers "what do I need to know about today", Today answers
 * "what is complete and what is still open".
 *
 * Source of truth: the same loadHomeContext as Home, so the numbers
 * always agree between the two screens.
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { getCurrentUser } from '@/lib/auth/get-user'
import { loadHomeContext } from '@/lib/v2/load-home-context'
import TodayHero from './_components/TodayHero'
import TodayProgressRings from './_components/TodayProgressRings'
import TodayRemainingTasks from './_components/TodayRemainingTasks'
import TodayCyclePhase from './_components/TodayCyclePhase'
import PainCheckInCard from './_components/PainCheckInCard'
import SectionHeader from '../_components/SectionHeader'
import { detectConditionFlags } from '../log/pain/_components/condition-detection'
import healthProfile from '@/lib/health-profile.json'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function V2TodayPage() {
  const today = todayISO()
  const user = await getCurrentUser()
  const ctx = await loadHomeContext(today, user?.id ?? null)
  const hour = new Date().getHours()

  const checkInsTotal = 4
  const checkInsLogged = countCheckIns(ctx)

  const latest = ctx.ouraTrend[ctx.ouraTrend.length - 1] ?? null
  const vitalsTotal = 3
  const vitalsLogged = countVitals(latest, today)

  const missing = buildMissingList(ctx, checkInsLogged, checkInsTotal)

  // Surface a chronic-pain check-in card only for users whose
  // diagnoses include migraine or POTS-like conditions. The bundled
  // profile is the floor; in production we'd also union active_problems.
  const profile = healthProfile as { diagnoses?: { confirmed?: string[]; suspected?: string[] } }
  const diagnosisCorpus = [
    ...(profile.diagnoses?.confirmed ?? []),
    ...(profile.diagnoses?.suspected ?? []),
  ]
  const flags = detectConditionFlags(diagnosisCorpus)
  const isChronicPainPatient = flags.hasMigraine || flags.hasOrthostatic
  const showPainCard = ctx.dailyLog?.overall_pain == null

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Today"
          leading={
            <Link
              href="/v2"
              aria-label="Back to home"
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
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          }
        />
      }
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
        <TodayHero iso={today} hour={hour} loggedCount={checkInsLogged} totalCount={checkInsTotal} />

        <section>
          <SectionHeader eyebrow="Progress" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <TodayProgressRings
              checkInsLogged={checkInsLogged}
              checkInsTotal={checkInsTotal}
              vitalsLogged={vitalsLogged}
              vitalsTotal={vitalsTotal}
              symptomsLogged={ctx.symptomsToday}
            />
          </div>
        </section>

        <PainCheckInCard showCard={showPainCard} isChronicPainPatient={isChronicPainPatient} />

        <section>
          <SectionHeader eyebrow="Cycle" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <TodayCyclePhase cycle={ctx.cycle} />
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="Check-ins" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <TodayRemainingTasks missing={missing} />
          </div>
        </section>
      </div>
    </MobileShell>
  )
}

function countCheckIns(ctx: Awaited<ReturnType<typeof loadHomeContext>>): number {
  let n = 0
  if (ctx.dailyLog?.overall_pain != null) n += 1
  if (ctx.dailyLog?.sleep_quality != null) n += 1
  if (ctx.dailyLog?.fatigue != null) n += 1
  if (ctx.dailyLog?.stress != null) n += 1
  return n
}

function countVitals(
  latest: Awaited<ReturnType<typeof loadHomeContext>>['ouraTrend'][number] | null,
  today: string,
): number {
  if (!latest || latest.date !== today) return 0
  let n = 0
  if (latest.sleep_score != null) n += 1
  if (latest.hrv_avg != null) n += 1
  if (latest.resting_hr != null) n += 1
  return n
}

function buildMissingList(
  ctx: Awaited<ReturnType<typeof loadHomeContext>>,
  logged: number,
  total: number,
): Array<{ key: string; label: string; subtext: string; href: string }> {
  if (logged >= total) return []
  const items: Array<{ key: string; label: string; subtext: string; href: string }> = []
  if (ctx.dailyLog?.overall_pain == null) {
    items.push({ key: 'pain', label: 'Log pain', subtext: 'A 0 to 10 reading of how today feels', href: '/v2/log/pain' })
  }
  if (ctx.dailyLog?.sleep_quality == null) {
    items.push({
      key: 'sleep',
      label: 'Log sleep quality',
      subtext: 'How last night felt, beyond the Oura score',
      href: '/v2/log',
    })
  }
  if (ctx.dailyLog?.fatigue == null) {
    items.push({
      key: 'fatigue',
      label: 'Log fatigue',
      subtext: 'Helps separate tired from flare-level exhausted',
      href: '/v2/log',
    })
  }
  if (ctx.dailyLog?.stress == null) {
    items.push({ key: 'stress', label: 'Log stress', subtext: 'A quick pulse check, optional', href: '/v2/log' })
  }
  return items
}
