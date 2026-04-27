/**
 * /v2/log: Daily logging surface (rebuilt 2026-04-27)
 *
 * Pivot from the prior slider list. Lanae explicitly said the only
 * thing she logs is a note, and meds get their own checklist. So
 * /v2/log is now two things stacked:
 *
 *   1. Today's meds checklist (same MedsCard as the home card; tap
 *      to log a dose). Reuses src/v2/components/meds/MedsCard.tsx so
 *      adherence behavior stays identical across surfaces.
 *
 *   2. A chronological feed of recent notes. Each card shows the
 *      note body, when it was captured, source (text or voice), and
 *      a chip with the count of stamped extractions (when present).
 *      A "+ Add a note" CTA at the top opens the same composer the
 *      FAB opens.
 *
 * Removed in this PR:
 *   - The pain/energy/stress/sleep/mode slider list
 *   - The notes-as-a-row sheet
 *   - The /v2/log/pain body map + clinical-instrument flow
 *
 * The corresponding API routes (/api/log/pain, /api/clinical-scales/*)
 * remain so the AI extraction pipeline (PR 4) can write to them when
 * a note implies pain or a scale answer.
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { getCurrentUser } from '@/lib/auth/get-user'
import { listNotes } from '@/lib/notes/save-note'
import MedsCard from '@/v2/components/meds/MedsCard'
import LogPageClient from './_components/LogPageClient'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function V2LogPage() {
  const today = todayISO()
  const user = await getCurrentUser()
  const userId = user?.id ?? null

  // Pull last 14 days of notes for the feed. The composer is the only
  // way to add new ones, so older notes can stay accessible via a
  // future "history" expand toggle without bloating the default view.
  const notes = await listNotes({ userId, limit: 50 })

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Log"
          leading={
            <Link
              href="/v2"
              aria-label="Back to home"
              style={{
                color: 'var(--v2-text-secondary)',
                padding: 'var(--v2-space-2)',
                minHeight: 'var(--v2-touch-target-min)',
                minWidth: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={20} aria-hidden="true" />
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
        <MedsCard userId={userId} todayLocal={today} />
        <LogPageClient initialNotes={notes} />
      </div>
    </MobileShell>
  )
}
