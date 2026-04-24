/*
 * v2 Calories » Photo meal log
 *
 * Camera capture or photo pick, sent to /api/food/identify (Claude
 * Vision + USDA enrichment). The user reviews each identified food,
 * picks meal type, and confirms. Each confirm fires the same
 * /api/food/log POST that the search and barcode flows use.
 *
 * Voice: NC explanatory. Snapshot, identify, confirm before logging.
 */
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import Link from 'next/link'
import PhotoCaptureFlow from './_components/PhotoCaptureFlow'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function parseDate(raw: string | undefined): string {
  return raw && DATE_RE.test(raw) ? raw : todayISO()
}

const VALID_MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack'])

function parseMeal(raw: string | undefined): string {
  return raw && VALID_MEALS.has(raw) ? raw : 'breakfast'
}

export default async function V2CaloriesPhotoPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; meal?: string }>
}) {
  const sp = await searchParams
  const date = parseDate(sp.date)
  const meal = parseMeal(sp.meal)

  return (
    <MobileShell
      top={
        <TopAppBar
          title="Photo meal log"
          leading={
            <Link
              href="/v2/calories"
              aria-label="Back to calories"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-base)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {'\u2039'}
            </Link>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-16)',
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
          gap: 'var(--v2-space-4)',
        }}
      >
        <PhotoCaptureFlow date={date} defaultMeal={meal} />
      </div>
    </MobileShell>
  )
}
