import Link from 'next/link'
import { loadNutritionGoals } from '@/lib/calories/goals'
import { loadWeightPlan } from '@/lib/calories/weight-plan-store'
import { createServiceClient } from '@/lib/supabase'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Banner, Card } from '@/v2/components/primitives'
import WeightLossCalculator from './_components/WeightLossCalculator'
import PlanForm from './_components/PlanForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Plan - LanaeHealth' }

/*
 * Plan route
 *
 * Top of page is the weight-loss calculator (Mifflin-St Jeor BMR ->
 * activity-tiered TDEE -> safe-deficit-clamped target -> macro split,
 * with NC-voice warnings and condition-aware adjustments). Methodology
 * cited at docs/research/weight-loss-calculation-methodology.md.
 *
 * Below the calculator the existing per-field editor (PlanForm) is
 * preserved as an "Advanced" override for users who want to hand-tune
 * macros or sodium past the auto-derived plan.
 */

interface ActiveProblemRow {
  problem: string
}

const POTS_RE = /POTS|orthostatic|dysautonomia|syncope|presyncope|near-syncope/i
const MIGRAINE_RE = /migraine|headache/i
const CYCLE_RE = /endometri|menstrual|heavy period|menorrhag|cycle/i

async function detectConditions(): Promise<{ POTS: boolean; migraine: boolean; cycle: boolean }> {
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from('active_problems')
      .select('problem')
      .neq('status', 'resolved')
    const rows = (data ?? []) as ActiveProblemRow[]
    const blob = rows.map((r) => r.problem).join(' | ')
    return {
      POTS: POTS_RE.test(blob),
      migraine: MIGRAINE_RE.test(blob),
      cycle: CYCLE_RE.test(blob),
    }
  } catch {
    return { POTS: false, migraine: false, cycle: false }
  }
}

export default async function V2CaloriesPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const params = await searchParams
  const showSaved = params.saved === '1'

  const [goals, savedPlan, detected] = await Promise.all([
    loadNutritionGoals(),
    loadWeightPlan(),
    detectConditions(),
  ])

  // Seed the calculator from the saved plan first, then fall back to
  // nutrition_goals (which carries weight + activity from prior edits).
  const seed = savedPlan?.inputs ?? {
    currentWeightKg: goals.weight.currentKg ?? 67.3,
    heightCm: 170,
    ageYears: 24,
    sex: 'female' as const,
    activityLevel: goals.activityLevel,
    goalWeightKg: goals.weight.targetKg ?? Math.max(45, (goals.weight.currentKg ?? 67.3) - 5),
    weeklyRateKg: 0.5,
  }

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="standard"
          title="Plan"
          leading={
            <Link
              href="/v2/calories"
              aria-label="Back to calories"
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
              {'‹'}
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
          paddingBottom: 'var(--v2-space-12)',
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {showSaved && (
          <Banner
            intent="success"
            title="Saved"
            body="Your targets will apply to today and going forward."
          />
        )}

        <Card variant="explanatory" padding="md">
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            This calculator uses Mifflin-St Jeor for resting metabolism and a safe deficit (1 to 2 lb per week, capped at 1 percent of body weight) to estimate your daily calorie target. Numbers are a starting point, not a verdict.
          </p>
        </Card>

        <WeightLossCalculator
          initial={seed}
          detectedConditions={detected}
        />

        <details>
          <summary
            style={{
              cursor: 'pointer',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-secondary)',
              padding: 'var(--v2-space-2)',
            }}
          >
            Advanced: hand-tune calorie + macro targets
          </summary>
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <PlanForm initial={goals} />
          </div>
        </details>
      </div>
    </MobileShell>
  )
}
