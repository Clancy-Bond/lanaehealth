/**
 * /v2/patterns/cycle: Cycle patterns
 *
 * The differentiator here is combining three signals on one scroll:
 * prediction (engine), history (stats), and phase-specific
 * correlations (narrator). No competitor puts prediction + pattern
 * + education in one place.
 *
 * Heavy lifting lives in the existing cycle context loader and
 * insight-narrator. This page just composes them into a coherent
 * story for the reader.
 */
import Link from 'next/link'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { createServiceClient } from '@/lib/supabase'
import { narrateTopInsights } from '@/lib/intelligence/insight-narrator'
import type { CorrelationResult } from '@/components/patterns/PatternsClient'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import CycleHistoryStrip from './_components/CycleHistoryStrip'
import CyclePredictionCardV2 from './_components/CyclePredictionCardV2'
import InsightCardList from '../_components/InsightCardList'
import SectionHeader from '../../_components/SectionHeader'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function isCyclePhaseRelated(row: CorrelationResult): boolean {
  if (row.cycle_phase) return true
  const a = row.factor_a?.toLowerCase() ?? ''
  const b = row.factor_b?.toLowerCase() ?? ''
  return a.includes('cycle') || b.includes('cycle') || a.includes('period') || b.includes('period') || a.includes('menstrual') || b.includes('menstrual')
}

export default async function V2CyclePatternsPage() {
  const today = todayISO()

  const [ctx, correlations] = await Promise.all([
    safeLoadCycle(today),
    safeCorrelations(),
  ])

  const cycleRows = correlations.filter(isCyclePhaseRelated)
  const narrated = narrateTopInsights(cycleRows, 4).map((r) => ({
    id: r.id,
    narration: r.narration,
    computed_at: r.computed_at,
  }))

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Cycle patterns"
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
        {ctx ? (
          <>
            <section>
              <SectionHeader eyebrow="Cycle history" />
              <div style={{ marginTop: 'var(--v2-space-3)' }}>
                <CycleHistoryStrip
                  cycles={ctx.stats.completedCycles}
                  meanLength={ctx.stats.meanCycleLength}
                />
              </div>
            </section>

            <section>
              <SectionHeader eyebrow="Predictions" />
              <div style={{ marginTop: 'var(--v2-space-3)' }}>
                <CyclePredictionCardV2
                  period={ctx.periodPrediction}
                  fertile={ctx.fertilePrediction}
                  meanCycleLength={ctx.stats.meanCycleLength}
                  sdCycleLength={ctx.stats.sdCycleLength}
                  completedCycles={ctx.stats.completedCycles.length}
                />
              </div>
            </section>
          </>
        ) : (
          <Card padding="md">
            <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
              We could not load cycle context right now. Try again in a moment.
            </p>
          </Card>
        )}

        <section>
          <SectionHeader eyebrow="Phase-linked patterns" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <InsightCardList rows={narrated} />
          </div>
        </section>

        <Card variant="explanatory" padding="md">
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', lineHeight: 'var(--v2-leading-relaxed)', color: 'var(--v2-surface-explanatory-text)' }}>
            Your cycle is a source of pattern, not a script. Numbers here help you notice, not predict with certainty. When the range is wide, that is the honest answer, not a bug.
          </p>
        </Card>
      </div>
    </MobileShell>
  )
}

async function safeLoadCycle(today: string) {
  try {
    return await loadCycleContext(today)
  } catch {
    return null
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
