/**
 * /v2/patterns: Patterns hub
 *
 * Three things stacked: a short headline that attributes the data
 * source, the top 3 narrated insights, a 2x2 grid into the focused
 * pattern views. Everything here is derived from the existing
 * correlation_results table through the insight-narrator library.
 *
 * When we do not have enough confident rows, we render an empty
 * state rather than noisy suggestive-only cards.
 */
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import {
  narrateTopInsights,
  hasEnoughConfidentInsights,
} from '@/lib/intelligence/insight-narrator'
import type { CorrelationResult } from '@/components/patterns/PatternsClient'
import { MobileShell, TopAppBar, StandardTabBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import InsightCardList from './_components/InsightCardList'
import PatternEntryGrid from './_components/PatternEntryGrid'
import SectionLoadError from './_components/SectionLoadError'
import SectionHeader from '../_components/SectionHeader'

export const dynamic = 'force-dynamic'

export default async function V2PatternsPage() {
  const correlationsResult = await safeCorrelations()
  const correlations = correlationsResult.data

  const enoughConfident = hasEnoughConfidentInsights(correlations)
  const topInsights = enoughConfident
    ? narrateTopInsights(correlations, 3).map((r) => ({
        id: r.id,
        narration: r.narration,
        computed_at: r.computed_at,
      }))
    : []

  const maxSample = correlations.reduce((m, r) => Math.max(m, r.sample_size ?? 0), 0)

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Patterns"
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
        {correlationsResult.error ? (
          <SectionLoadError what="the patterns summary" retryHref="/v2/patterns" />
        ) : (
          <Card variant="explanatory" padding="md">
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                lineHeight: 'var(--v2-leading-relaxed)',
                color: 'var(--v2-surface-explanatory-text)',
              }}
            >
              {correlations.length === 0
                ? 'No patterns computed yet. Log steadily for a couple of weeks and the first correlations will surface here.'
                : `${correlations.length} patterns tracked across your data${maxSample > 0 ? `, drawing on up to ${maxSample} days of records` : ''}. Patterns are associations, not causes.`}
            </p>
          </Card>
        )}

        <section>
          <SectionHeader eyebrow="Top insights" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            {correlationsResult.error ? (
              <SectionLoadError what="top insights" retryHref="/v2/patterns" />
            ) : (
              <InsightCardList rows={topInsights} />
            )}
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="Drill in" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <PatternEntryGrid />
          </div>
        </section>
      </div>
    </MobileShell>
  )
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
      .limit(120)
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[v2/patterns] safeCorrelations supabase error', error)
      }
      return { data: [], error: true }
    }
    return { data: (data ?? []) as CorrelationResult[], error: false }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2/patterns] safeCorrelations threw', err)
    }
    return { data: [], error: true }
  }
}
