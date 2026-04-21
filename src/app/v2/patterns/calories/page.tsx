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

  const [days, correlations] = await Promise.all([
    safeRange(start, today),
    safeCorrelations(),
  ])

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
            <CalorieTrendChart days={days} />
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="Macros" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <MacroSummaryCard days={days} />
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="Food-linked patterns" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <InsightCardList rows={narrated} />
          </div>
        </section>
      </div>
    </MobileShell>
  )
}

async function safeRange(start: string, end: string) {
  try {
    return await getDailyTotalsRange(start, end)
  } catch {
    return []
  }
}

async function safeCorrelations(): Promise<CorrelationResult[]> {
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from('correlation_results')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(200)
    return (data ?? []) as CorrelationResult[]
  } catch {
    return []
  }
}
