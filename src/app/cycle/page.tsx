// ARCHIVED: This legacy route is now redirected to /v2/cycle via next.config.ts.
// Kept in source for fast revert. To revive: remove the redirect in next.config.ts.
// Cutover landed: 2026-04-25 (legacy → v2 unified merge).

/**
 * /cycle - Cycle tab landing.
 *
 * Reference app: Natural Cycles. Primary UI elements:
 *   - Hero ring (cycle day + phase)
 *   - Daily "period today?" one-tap prompt
 *   - Fertility signal card (window + ovulation state)
 *   - Next-period countdown with honest uncertainty
 *   - BBT quick log (preserved from Phase 0 shell)
 *   - Phase insight (rotates daily)
 *
 * Voice rules per docs/plans/2026-04-16-non-shaming-voice-rule.md:
 *   - "Cycle unknown" when no data, never "No data".
 *   - Overdue cycles surface with blush stripe, no alarm.
 *   - No contraceptive efficacy claims.
 */
import { createServiceClient } from '@/lib/supabase'
import { format } from 'date-fns'
import Link from 'next/link'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { pickPhaseInsight } from '@/lib/cycle/phase-insights'
import { CycleTodayRing } from '@/components/cycle/CycleTodayRing'
import { DailyPeriodPrompt } from '@/components/cycle/DailyPeriodPrompt'
import { FertilitySignalCard } from '@/components/cycle/FertilitySignalCard'
import { NextPeriodCountdown } from '@/components/cycle/NextPeriodCountdown'
import { CycleQuickActions } from '@/components/cycle/CycleQuickActions'
import { BbtQuickLog } from '@/components/cycle/BbtQuickLog'

export const dynamic = 'force-dynamic'

export default async function CyclePage({
  searchParams,
}: {
  searchParams: Promise<{ bbt?: string; saved?: string }>
}) {
  const sp = await searchParams
  const todayISO = format(new Date(), 'yyyy-MM-dd')
  const ctx = await loadCycleContext(todayISO)
  const sb = createServiceClient()

  const { data: todayEntry } = await sb
    .from('cycle_entries')
    .select('menstruation')
    .eq('date', todayISO)
    .maybeSingle()

  const phaseInsight = pickPhaseInsight(ctx.current.phase, todayISO)
  const latestBbt = ctx.bbtLog.entries[ctx.bbtLog.entries.length - 1] ?? null

  const toastMessage = sp.bbt === '1'
    ? 'Temperature logged. Ovulation detector refreshed.'
    : sp.saved === '1'
      ? 'Cycle entry saved.'
      : null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: 16,
        maxWidth: 820,
        margin: '0 auto',
        paddingBottom: 96,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Cycle
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, lineHeight: 1.15 }}>
          Today
        </h1>
      </div>

      {toastMessage && (
        <div
          role="status"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: 'var(--accent-sage-muted)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 600,
            border: '1px solid var(--accent-sage)',
          }}
        >
          {toastMessage}
        </div>
      )}

      <section
        className="card"
        style={{
          padding: '22px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <CycleTodayRing
          day={ctx.current.day}
          phase={ctx.current.phase}
          isUnusuallyLong={ctx.current.isUnusuallyLong}
          size="hero"
        />

        {ctx.current.lastPeriodStart && (
          <div
            className="tabular"
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              paddingTop: 8,
              borderTop: '1px solid var(--border-light)',
            }}
          >
            Last period start: {format(new Date(ctx.current.lastPeriodStart + 'T00:00:00'), 'MMM d')}
            {ctx.stats.meanCycleLength != null && (
              <>
                {' '}&middot; Average cycle {ctx.stats.meanCycleLength}
                {ctx.stats.sdCycleLength != null ? ` \u00b1 ${ctx.stats.sdCycleLength}` : ''} days
              </>
            )}
          </div>
        )}
      </section>

      <DailyPeriodPrompt
        date={todayISO}
        initialMenstruation={todayEntry?.menstruation === true}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
        }}
      >
        <NextPeriodCountdown prediction={ctx.periodPrediction} />
        <FertilitySignalCard
          prediction={ctx.fertilePrediction}
          confirmedOvulation={ctx.confirmedOvulation}
        />
      </div>

      <BbtQuickLog latestBbt={latestBbt} confirmedOvulation={ctx.confirmedOvulation} todayISO={todayISO} />

      {phaseInsight && (
        <section
          className="card"
          style={{
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: 'var(--bg-elevated)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Phase note &middot; {phaseInsight.evidence_tag}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{phaseInsight.title}</div>
          <p
            style={{
              fontSize: 13,
              margin: 0,
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
            }}
          >
            {phaseInsight.body}
          </p>
        </section>
      )}

      <CycleQuickActions />

      <div
        style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: 'var(--bg-primary)',
          border: '1px dashed var(--border-light)',
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        LanaeHealth is not a contraceptive. Fertile window is shown for cycle
        awareness. For contraception, use an FDA-cleared method or consult a
        clinician.
      </div>

      <Link
        href="/"
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          textDecoration: 'none',
          alignSelf: 'flex-start',
        }}
      >
        &lsaquo; Back to home
      </Link>
    </div>
  )
}
