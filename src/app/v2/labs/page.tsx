/*
 * /v2/labs (server component)
 *
 * Lab results under the v2 dark chrome. Mirrors the data contract of
 * legacy /labs so row counts, abnormal-first counts, and per-test
 * latest values match byte-for-byte on the same dataset.
 *
 * Fetch happens once, server-side, via createServiceClient() (same
 * RLS-safe pattern /v2/records uses). The grouping loop is inlined
 * here so the client bundle gets ready LabGroup[] and does not pay
 * the hashing cost on hydration.
 *
 * The "Abnormal / All" toggle lives in LabsClient. Voice on empty
 * states follows NC : short, kind, explanatory.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import type { LabResult } from '@/lib/types'
import { EmptyState } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import LabsClient from './_components/LabsClient'
import type { LabGroup } from './_components/LabTestGroup'

export const dynamic = 'force-dynamic'

export default async function V2LabsPage() {
  const sb = createServiceClient()

  // Oldest-first so each group's last entry is the "latest" one. This
  // matches the legacy /labs grouping loop (src/app/labs/page.tsx:29-43).
  const { data, error } = await sb
    .from('lab_results')
    .select('*')
    .order('date', { ascending: true })

  if (error) {
    throw new Error(`Labs fetch failed: ${error.message}`)
  }

  const all = (data ?? []) as LabResult[]

  // Group rows by test_name. Keep the latest non-null unit so downstream
  // code can decide whether to trust unit consistency for a sparkline.
  // "Latest" here = most recent in encounter order, which mirrors how a
  // clinician would read the chart.
  const groupMap = new Map<string, LabGroup>()
  for (const r of all) {
    const key = (r.test_name ?? '').trim()
    if (!key) continue
    const existing = groupMap.get(key) ?? { name: key, unit: null, entries: [] }
    existing.entries.push(r)
    if (r.unit) existing.unit = r.unit
    groupMap.set(key, existing)
  }

  // Sort groups by each group's most recent entry date, descending :
  // the user's freshest tests show at the top. entries were fetched
  // ascending, so the last one is the newest.
  const groups: LabGroup[] = [...groupMap.values()].sort((a, b) => {
    const aLast = a.entries[a.entries.length - 1]?.date ?? ''
    const bLast = b.entries[b.entries.length - 1]?.date ?? ''
    return bLast.localeCompare(aLast)
  })

  // Abnormal = flag != null and not 'normal', newest-first, capped at
  // 30 : matches the legacy page exactly so data-parity is testable
  // with a simple count comparison.
  const abnormal = all
    .filter((r) => r.flag && r.flag !== 'normal')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)

  const hasAny = all.length > 0

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Labs"
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
                minWidth: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
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
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-10)',
        }}
      >
        {!hasAny ? (
          <EmptyState
            headline="No labs to show yet."
            subtext="Import via MyAH, upload a photo, or add a result by hand to see trends here."
          />
        ) : (
          <Suspense fallback={null}>
            <LabsClient abnormal={abnormal} groups={groups} />
          </Suspense>
        )}
      </div>
    </MobileShell>
  )
}
