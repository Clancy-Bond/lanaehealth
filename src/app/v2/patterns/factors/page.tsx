/**
 * /v2/patterns/factors - Bearable-pattern factor explorer.
 *
 * Pattern source: bearable.app - factor explorer / "what's affecting"
 * card. The user picks an outcome (Pain, Sleep quality, Mood, Energy)
 * and sees the factors that move it most. Bearable's contribution is
 * the framing: a single outcome focus, ranked factors with confidence
 * and sample size on every row, and a calm empty state when there
 * are not enough days yet.
 *
 * Data source is unchanged: the existing `correlation_results` table.
 * No new compute, no duplicate stats. We only re-shape and re-frame
 * what we already produce.
 *
 * The chip set + list interactivity lives in FactorExplorer (client).
 * The DB read stays here so the page stays SSR-friendly.
 */
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import SectionHeader from '../../_components/SectionHeader'
import SectionLoadError from '../_components/SectionLoadError'
import FactorExplorer from './_components/FactorExplorer'
import type { FactorRow } from '@/lib/v2/triggers'

export const dynamic = 'force-dynamic'

interface CorrelationsResult {
  data: FactorRow[]
  error: boolean
}

async function safeCorrelations(): Promise<CorrelationsResult> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('correlation_results')
      .select(
        'id, factor_a, factor_b, correlation_type, coefficient, effect_size, confidence_level, sample_size, computed_at',
      )
      .order('computed_at', { ascending: false })
      .limit(200)
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[v2/patterns/factors] supabase error', error)
      }
      return { data: [], error: true }
    }
    return { data: (data ?? []) as FactorRow[], error: false }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[v2/patterns/factors] threw', err)
    }
    return { data: [], error: true }
  }
}

export default async function V2FactorsPage() {
  const result = await safeCorrelations()

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Factors"
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
        {result.error ? (
          <SectionLoadError what="the factor explorer" retryHref="/v2/patterns/factors" />
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
              Pick an outcome below and see which factors track with it.
              Patterns are associations, not causes. Use them as questions
              to bring to your doctor, not as instructions.
            </p>
          </Card>
        )}

        <section>
          <SectionHeader eyebrow="Outcome" />
          <div style={{ marginTop: 'var(--v2-space-3)' }}>
            <FactorExplorer rows={result.data} />
          </div>
        </section>

        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          Pattern adapted from{' '}
          <a
            href="https://bearable.app"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--v2-text-muted)' }}
          >
            Bearable
          </a>
          &apos;s factor explorer. Numbers come from your own data.
        </p>
      </div>
    </MobileShell>
  )
}
