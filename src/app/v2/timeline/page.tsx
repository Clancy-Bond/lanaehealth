/**
 * /v2/timeline: Medical timeline
 *
 * Historical events from medical_timeline, grouped by year,
 * descending. Each card opens a detail sheet with the full
 * description and any linked_data captured at ingest time.
 *
 * Read-only in v1. Add / edit paths live in legacy /timeline and
 * are not scoped to this session.
 */
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import type { MedicalTimelineEvent } from '@/lib/types'
import { MobileShell, TopAppBar, StandardTabBar } from '@/v2/components/shell'
import { EmptyState } from '@/v2/components/primitives'
import TimelineEventList from './_components/TimelineEventList'

export const dynamic = 'force-dynamic'

export default async function V2TimelinePage() {
  let events: MedicalTimelineEvent[] = []
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from('medical_timeline')
      .select('*')
      .order('event_date', { ascending: false })
    events = (data ?? []) as MedicalTimelineEvent[]
  } catch {
    events = []
  }

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Timeline"
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
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          Your health story in order. Tap any event for details.
        </p>

        {events.length === 0 ? (
          <EmptyState
            headline="Your timeline is empty"
            subtext="Import from Adventist Health or add events from the legacy timeline view to populate this screen."
          />
        ) : (
          <TimelineEventList events={events} />
        )}
      </div>
    </MobileShell>
  )
}
