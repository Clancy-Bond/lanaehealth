import Link from 'next/link'
import { loadNutritionGoals } from '@/lib/calories/goals'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Banner, Card } from '@/v2/components/primitives'
import PlanForm from './_components/PlanForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Plan - LanaeHealth' }

/*
 * Plan route
 *
 * Lets the user edit calorie target, macro split, weight goal, and
 * activity level. The same nutrition_goals row that the dashboard
 * (Task 3) reads for ring + macro tiles. Submission flows through
 * /api/calories/plan; on success we re-render here with ?saved=1
 * and surface a success Banner.
 *
 * This page is intentionally lean : load goals, hand them to the
 * client form, render chrome. All state lives inside PlanForm.
 */

export default async function V2CaloriesPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const params = await searchParams
  const showSaved = params.saved === '1'

  const goals = await loadNutritionGoals()

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
              {'\u2039'}
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
            Targets are a guide, not a contract. Adjust them anytime.
          </p>
        </Card>

        <PlanForm initial={goals} />
      </div>
    </MobileShell>
  )
}
