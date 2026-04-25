/*
 * /v2/cycle/insights
 *
 * NC's Cycle Insights with population comparison stats. Each metric
 * (cycle length, luteal, follicular, period duration, fertile
 * window) is rendered as a row showing the user's mean +/- SD next
 * to the published population mean +/- SD, plus a NC-voice
 * interpretation tuned to the comparison + sample size.
 *
 * Sources cited: Bull et al. 2019 NPJ Digital Medicine and Lenton
 * et al. 1984 BJOG. Full reference table at
 * docs/research/cycle-population-references.md.
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { computeCycleInsightsFromStats } from '@/lib/cycle/cycle-insights'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import RouteFade from '../../_components/RouteFade'
import InsightRow from './_components/InsightRow'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function CycleInsightsPage() {
  const today = todayISO()
  const ctx = await loadCycleContext(today)
  // Per-cycle luteal/follicular lengths require ovulation per cycle,
  // which signal-fusion only emits for the current cycle in this
  // wave. We pass an empty array; the comparison row degrades to
  // "Need a confirmed ovulation date" copy, which is honest.
  const insights = computeCycleInsightsFromStats(ctx.stats, {
    lutealLengths: [],
    follicularLengths: [],
  })

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Cycle insights"
          leading={
            <Link
              href="/v2/cycle"
              aria-label="Back to cycle"
              style={{
                color: 'var(--v2-text-secondary)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2)',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ChevronLeft size={20} />
              Cycle
            </Link>
          }
        />
      }
    >
      <RouteFade>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-4)',
            padding: 'var(--v2-space-4)',
            paddingBottom: 'var(--v2-space-8)',
          }}
        >
          <Card padding="md">
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              How your numbers compare to large population studies. Numbers
              here are for orientation, not judgment, the goal is
              understanding your rhythm.
            </p>
            <p
              style={{
                margin: 'var(--v2-space-2) 0 0',
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
              }}
            >
              {ctx.stats.sampleSize > 0
                ? `${ctx.stats.sampleSize} completed ${ctx.stats.sampleSize === 1 ? 'cycle' : 'cycles'} on file.`
                : 'No completed cycles yet, comparisons fill in as your history grows.'}
            </p>
          </Card>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-3)',
            }}
          >
            {insights.map((insight) => (
              <InsightRow key={insight.metric} insight={insight} />
            ))}
          </div>

          <Card padding="md" variant="explanatory">
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-md)',
                fontWeight: 'var(--v2-weight-semibold)',
              }}
            >
              Sources
            </h3>
            <ul
              style={{
                margin: 'var(--v2-space-2) 0 0',
                paddingLeft: 'var(--v2-space-4)',
                fontSize: 'var(--v2-text-sm)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              <li>
                Bull JR et al., NPJ Digital Medicine, 2019. n = 124,648 women,
                612,613 cycles.
              </li>
              <li>Lenton EA et al., BJOG, 1984. Luteal n = 60, follicular n = 65.</li>
              <li>
                Wilcox AJ et al., NEJM, 1995. Fertile window definition, n = 221.
              </li>
            </ul>
            <p
              style={{
                margin: 'var(--v2-space-2) 0 0',
                fontSize: 'var(--v2-text-xs)',
                opacity: 0.75,
              }}
            >
              Full reference detail in
              docs/research/cycle-population-references.md.
            </p>
          </Card>
        </div>
      </RouteFade>
    </MobileShell>
  )
}
