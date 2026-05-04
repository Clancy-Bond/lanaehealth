/*
 * /v2/cycle/messages
 *
 * Smart-logging Messages inbox. NC sends phase-aware reminders to
 * a per-user inbox (NOT push notifications) so the user can scan
 * them at their own pace. Cards include morning temperature
 * reminders, fertile-window approaching, period-might-start, and
 * cycle-insight-ready.
 *
 * Generation runs server-side on every visit so the inbox is fresh
 * without a daily cron. Persistence is idempotent on
 * (user_id, dedupe_key).
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/get-user'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { generateCycleMessages } from '@/lib/cycle/messages'
import {
  listMessages,
  persistMessages,
  lastInsightSampleSize,
} from '@/lib/cycle/messages-store'
import { createServiceClient } from '@/lib/supabase'
import { runScopedQuery } from '@/lib/auth/scope-query'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { EmptyState } from '@/v2/components/primitives'
import RouteFade from '../../_components/RouteFade'
import CycleSurface from '../_components/CycleSurface'
import MessagesList from './_components/MessagesList'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function CycleMessagesPage() {
  const today = todayISO()
  const user = await getCurrentUser()

  if (user?.id) {
    try {
      const ctx = await loadCycleContext(today, user.id)
      const todayBbt = ctx.bbtReadings.some((r) => r.date === today)
      const sb = createServiceClient()
      const { data: cycleRow } = await runScopedQuery({
        table: 'cycle_entries',
        userId: user.id,
        withFilter: () =>
          sb
            .from('cycle_entries')
            .select('menstruation')
            .eq('date', today)
            .eq('user_id', user.id)
            .maybeSingle(),
        withoutFilter: () =>
          sb
            .from('cycle_entries')
            .select('menstruation')
            .eq('date', today)
            .maybeSingle(),
      })
      const periodLoggedToday =
        (cycleRow as { menstruation: boolean | null } | null)?.menstruation === true
      const lastSize = await lastInsightSampleSize(user.id)
      const candidates = generateCycleMessages({
        ctx,
        today,
        bbtLoggedToday: todayBbt,
        periodLoggedToday,
        lastInsightSampleSize: lastSize,
      })
      await persistMessages(user.id, candidates)
    } catch {
      // Non-fatal: render whatever the store has even when the
      // generator fails. The user still sees their inbox.
    }
  }

  const messages = user?.id ? await listMessages(user.id, { limit: 50 }) : []

  return (
    <CycleSurface>
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          transparent
          /* NC plum brand title to match the rest of the cycle section. */
          title={
            <span
              style={{
                fontSize: 'var(--v2-text-xl)',
                fontWeight: 'var(--v2-weight-bold)',
                color: 'var(--v2-surface-explanatory-cta, #5B2852)',
                letterSpacing: 'var(--v2-tracking-tight)',
              }}
            >
              Messages
            </span>
          }
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
          className="v2-surface-explanatory"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-4)',
            padding: 'var(--v2-space-4)',
            paddingBottom: 'var(--v2-space-8)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Phase-aware reminders and insights, delivered here. No push notifications, no nag, you decide when to read them.
          </p>

          {messages.length === 0 ? (
            <EmptyState
              headline="Inbox is empty"
              subtext="Cards land here when there is something worth your attention, like a morning temperature reminder or a new cycle insight."
            />
          ) : (
            <MessagesList initialMessages={messages} />
          )}
        </div>
      </RouteFade>
    </MobileShell>
    </CycleSurface>
  )
}
