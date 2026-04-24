/*
 * /v2/topics/cycle/hormones (server component)
 *
 * 9-hormone panel grid under v2 dark chrome. One card per hormone in
 * HORMONE_META's canonical order (estrogen, progesterone,
 * testosterone, LH, FSH, TSH, prolactin, DHEA-S, cortisol) so the
 * full panel is visible at a glance, even for hormones with zero
 * readings. Every card shows latest value, typical range, sparkline
 * (when >= 2 entries with matching units), and recent entries.
 *
 * Data flows server-only: loadHormoneLog() is a resilient loader that
 * returns { entries: [] } on any failure so we never render a broken
 * page. New entries go through /api/cycle/hormones POST (same path
 * the legacy page uses); on success the sheet calls router.refresh()
 * and this loader re-runs to pick up the new row.
 *
 * Locked engine: @/lib/cycle/hormones (loadHormoneLog,
 * entriesByHormone, HORMONE_META, HormoneId).
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import {
  loadHormoneLog,
  entriesByHormone,
  HORMONE_META,
  type HormoneId,
} from '@/lib/cycle/hormones'
import HormonePanelCard from './_components/HormonePanelCard'
import HormoneIndexClient from './_components/HormoneIndexClient'

export const dynamic = 'force-dynamic'

// Canonical order for the card grid. HORMONE_META is declared in
// panel order so Object.keys() already gives the right sequence, but
// we pin it explicitly here so any reordering of HORMONE_META does
// not silently reshuffle the grid for Lanae.
const HORMONE_ORDER: HormoneId[] = [
  'estrogen',
  'progesterone',
  'testosterone',
  'lh',
  'fsh',
  'tsh',
  'prolactin',
  'dhea_s',
  'cortisol',
]

export default async function V2CycleHormonesPage() {
  const log = await loadHormoneLog()
  const byHormone = entriesByHormone(log)

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Hormones"
          leading={
            <Link
              href="/v2/topics/cycle"
              aria-label="Back to cycle"
              style={{
                color: 'var(--v2-text-secondary)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                minWidth: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          }
        />
      }
      fab={<HormoneIndexClient />}
    >
      <div
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
          A log of hormone values. Tap + to add a reading from a lab or self-test.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--v2-space-3)',
          }}
        >
          {HORMONE_ORDER.map((id) => (
            <HormonePanelCard
              key={id}
              meta={HORMONE_META[id]}
              entries={byHormone[id]}
            />
          ))}
        </div>
      </div>
    </MobileShell>
  )
}
