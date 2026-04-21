/*
 * /v2/topics/nutrition (server component)
 *
 * Condition-focused editorial reading page. NOT a clone of the legacy
 * /topics/nutrition redirect : that route forwards to /calories, which
 * is the MyNetDiary-style dashboard. This page is deliberately
 * different: a reading surface about how food intersects with the
 * three conditions Lanae tracks (POTS, endometriosis, migraine).
 *
 * Data sources:
 *   - buildNutritionCoachContext() for the "this week" strip (recent
 *     meal count, nutrient target count, current cycle phase)
 *   - active_problems table (separate query) to decide which
 *     condition cards to render. The coach-context builder does load
 *     active problems, but only exposes the count on its return
 *     object; the names are baked into its text block. Querying
 *     directly keeps this surface honest about what it knows.
 *
 * Voice follows Natural Cycles: short, kind, informational. No
 * optimization language, no "you should" anywhere. The closing card
 * reiterates that food is one input among many.
 *
 * Failure mode: if the coach-context call throws or the shape is
 * empty, render a single EmptyState inviting the user to log meals
 * and tag problems. The page never 500s on data absence.
 */
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import {
  buildNutritionCoachContext,
  type NutritionCoachContext,
} from '@/lib/intelligence/nutrition-coach-context'
import { EmptyState } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import NutritionIntroCard from './_components/NutritionIntroCard'
import NutritionWeekCard from './_components/NutritionWeekCard'
import ConditionFoodCard from './_components/ConditionFoodCard'
import NutritionClosingCard from './_components/NutritionClosingCard'

export const dynamic = 'force-dynamic'

// Canonical condition keys rendered on this page. Order defines the
// rendering order below when more than one matches the user's active
// problems and also when none do.
type ConditionKey = 'POTS' | 'endometriosis' | 'migraine'

interface ConditionConfig {
  key: ConditionKey
  label: string
  matchTerms: string[]
  mechanism: string
  helps: string[]
  watch: string[]
}

// Placeholder copy. Reviewed to be safe, conservative, and
// non-prescriptive. Lanae will refine per her clinicians' guidance.
const CONDITIONS: ConditionConfig[] = [
  {
    key: 'POTS',
    label: 'POTS',
    matchTerms: ['pots', 'postural orthostatic', 'orthostatic tachycardia'],
    mechanism:
      'POTS is often eased by more fluid and salt; dehydration triggers symptoms.',
    helps: [
      'Hydration throughout the day',
      'Salty snacks',
      'Electrolyte drinks',
    ],
    watch: [
      'Long gaps without fluid',
      'Large caffeine doses on empty stomach',
    ],
  },
  {
    key: 'endometriosis',
    label: 'Endometriosis',
    matchTerms: ['endometriosis', 'endo'],
    mechanism:
      'Endometriosis research links some diet patterns to pain frequency, but individual response varies.',
    helps: ['Omega-3 rich fish', 'Leafy greens', 'Regular fiber'],
    watch: ['Alcohol in luteal phase', 'Ultra-processed foods daily'],
  },
  {
    key: 'migraine',
    label: 'Migraine',
    matchTerms: ['migraine'],
    mechanism:
      'Migraine triggers are highly individual; identifying personal ones is more useful than a generic list.',
    helps: [
      'Regular meals',
      'Consistent sleep before food',
      'Magnesium-rich foods',
    ],
    watch: ['Aged cheeses', 'Processed meats', 'Skipped meals'],
  },
]

interface ActiveProblemRow {
  problem: string | null
}

async function loadActiveProblemNames(): Promise<string[]> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('active_problems')
      .select('problem, status')
      .neq('status', 'resolved')
    if (error) return []
    return ((data ?? []) as ActiveProblemRow[])
      .map((r) => (r.problem ?? '').trim())
      .filter((s) => s.length > 0)
  } catch {
    return []
  }
}

function matchConditions(problemNames: string[]): ConditionKey[] {
  const lowered = problemNames.map((p) => p.toLowerCase())
  const matched: ConditionKey[] = []
  for (const cfg of CONDITIONS) {
    if (
      cfg.matchTerms.some((term) =>
        lowered.some((problem) => problem.includes(term)),
      )
    ) {
      matched.push(cfg.key)
    }
  }
  return matched
}

function isEmptyContext(ctx: NutritionCoachContext | null): boolean {
  if (!ctx) return true
  const s = ctx.sections
  return (
    s.recentMealCount === 0 &&
    s.nutrientTargetCount === 0 &&
    s.activeProblemCount === 0 &&
    (s.cyclePhase === null ||
      (s.cyclePhase.day === null && s.cyclePhase.phase === null))
  )
}

export default async function V2NutritionTopicPage() {
  let ctx: NutritionCoachContext | null = null
  try {
    ctx = await buildNutritionCoachContext()
  } catch {
    ctx = null
  }

  const problemNames = await loadActiveProblemNames()
  const matchedKeys = matchConditions(problemNames)

  const renderedKeys: ConditionKey[] =
    matchedKeys.length > 0
      ? matchedKeys
      : CONDITIONS.map((c) => c.key)
  const noMatches = matchedKeys.length === 0
  const conditionConfigs = renderedKeys
    .map((k) => CONDITIONS.find((c) => c.key === k))
    .filter((c): c is ConditionConfig => !!c)

  const emptyState = isEmptyContext(ctx)

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Food & your conditions"
          leading={
            <Link
              href="/v2/"
              aria-label="Back to home"
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
              &lsaquo; Home
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
        {emptyState || !ctx ? (
          <EmptyState
            headline="Nothing to show yet."
            subtext="Log meals and tag any active problems to see nutrition notes personalized to you."
          />
        ) : (
          <>
            <NutritionIntroCard />
            <NutritionWeekCard ctx={ctx} />
            {noMatches && (
              <p
                style={{
                  margin: 0,
                  padding: 'var(--v2-space-3) var(--v2-space-4)',
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-muted)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                  borderRadius: 'var(--v2-radius-md)',
                  background: 'var(--v2-bg-card)',
                  border: '1px solid var(--v2-border-subtle)',
                }}
              >
                You don&rsquo;t have any of these conditions tagged. The notes
                below still apply to general understanding of each
                condition&rsquo;s patterns.
              </p>
            )}
            {conditionConfigs.map((cfg) => (
              <ConditionFoodCard
                key={cfg.key}
                condition={cfg.label}
                mechanism={cfg.mechanism}
                helps={cfg.helps}
                watch={cfg.watch}
              />
            ))}
            <NutritionClosingCard />
          </>
        )}
      </div>
    </MobileShell>
  )
}
