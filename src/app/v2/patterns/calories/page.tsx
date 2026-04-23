/**
 * /v2/patterns/calories: Calorie patterns
 *
 * 30-day daily calorie trend, macro averages, and food-related
 * correlations. Food triggers surface naturally through the
 * narrator whenever factor_a or factor_b starts with "food_".
 */
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { getDailyTotalsRange } from '@/lib/calories/home-data'
import { narrateTopInsights } from '@/lib/intelligence/insight-narrator'
import type { CorrelationResult } from '@/components/patterns/PatternsClient'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import CalorieTrendChart from './_components/CalorieTrendChart'
import MacroSummaryCard from './_components/MacroSummaryCard'
import InsightCardList from '../_components/InsightCardList'
import SectionLoadError from '../_components/SectionLoadError'
import SectionHeader from '../../_components/SectionHeader'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function thirtyDaysAgoISO(today: string): string {
  const t = new Date(today + 'T00:00:00Z').getTime()
  return new Date(t - 29 * 86_400_000).toISOString().slice(0, 10)
}

function isFoodRelated(row: CorrelationResult): boolean {
  const a = row.factor_a?.toLowerCase() ?? ''
  const b = row.factor_b?.toLowerCase() ?? ''
  return (
    a.startsWith('food') ||
    b.startsWith('food') ||
    a.includes('meal') ||
    b.includes('meal') ||
    a.includes('calorie') ||
    b.includes('calorie') ||
    a.includes('protein') ||
    b.includes('protein') ||
    a.includes('carb') ||
    b.includes('carb') ||
    a.includes('sugar') ||
    b.includes('sugar')
  )
}

export default async function V2CaloriePatternsPage() {
  const today = todayISO()
  const start = thirtyDaysAgoISO(today)

  const [daysResult, correlationsResult] = await Promise.all([
    safeRange(start, today),
    safeCorrelations(),
  ])

  const correlations = correlationsResult.data ?? []
  const foodRows = correlations.filter(isFoodRelated)
  const narrated = narrateTopInsights(foodRows, 3).map((r) => ({
    id: r.id,
    narration: r.narration,
    computed_at: r.computed_at,
  }))

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Food patterns"
          leading={
            <Link
              href="/v2/patterns"
              aria-label="Back to patterns"
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-5)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-10)',
        }}
      >
        <section>
          <SectionHeader eyebrow="30-day energy" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            {daysResult.error ? (
              <SectionLoadError what="the 30-day energy chart" retryHref="/v2/patterns/calories" />
            ) : (
              <CalorieTrendChart days={daysResult.data} />
            )}
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="Macros" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            {daysResult.error ? (
              <SectionLoadError what="macro averages" retryHref="/v2/patterns/calories" />
            ) : (
              <MacroSummaryCard days={daysResult.data} />
            )}
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="Food-linked patterns" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            {correlationsResult.error ? (
              <SectionLoadError what="food-linked patterns" retryHref="/v2/patterns/calories" />
            ) : (
              <InsightCardList rows={narrated} />
            )}
          </div>
        </section>
      </div>
    </MobileShell>
  )
}

interface RangeResult {
  data: Awaited<ReturnType<typeof getDailyTotalsRange>>
  error: boolean
}

async function safeRange(start: string, end: string): Promise<RangeResult> {
  try {
    const data = await getDailyTotalsRange(start, end)
    return { data, error: false }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2/patterns/calories] safeRange failed', err)
    }
    return { data: [], error: true }
  }
}

interface CorrelationsResult {
  data: CorrelationResult[]
  error: boolean
}

async function safeCorrelations(): Promise<CorrelationsResult> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('correlation_results')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(200)
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[v2/patterns/calories] safeCorrelations supabase error', error)
      }
      return { data: [], error: true }
    }
    return { data: (data ?? []) as CorrelationResult[], error: false }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2/patterns/calories] safeCorrelations threw', err)
    }
    return { data: [], error: true }
  }
}
