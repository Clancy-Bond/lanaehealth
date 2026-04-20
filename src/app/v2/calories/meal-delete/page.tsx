/*
 * v2 Calories » Meal delete confirmation
 *
 * Routes landed here from either the MealSectionCard overflow
 * (bulk, no entry param) or the per-row kebab (single, with
 * entry param). Shows what will be removed, then a confirm
 * button that runs a server action. No deletion happens from
 * navigation alone, only from the explicit submit, per the
 * CLAUDE.md zero-data-loss rule.
 *
 * URL params:
 *   date      YYYY-MM-DD (required)
 *   meal      breakfast|lunch|dinner|snack (required)
 *   entry     food_entries.id (optional; triggers single-row flow)
 *   returnTo  where to land after submit or cancel. Falls back
 *             to /v2/calories/food?date=...#meal.
 */
import Link from 'next/link'
import { format } from 'date-fns'
import { createServiceClient } from '@/lib/supabase'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import MealDeleteConfirmForm from './_components/MealDeleteConfirmForm'
import MealDeletePreview, { type EntryPreview } from './_components/MealDeletePreview'

export const dynamic = 'force-dynamic'

const VALID_MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const MEAL_LABELS: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

function safeReturnTo(raw: string | undefined, fallback: string): string {
  // Only allow internal absolute paths so an attacker cannot
  // send a user to an off-site URL via this redirect.
  if (!raw) return fallback
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  return fallback
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso + 'T00:00:00'), 'EEE, MMM d')
  } catch {
    return iso
  }
}

function backArrow(href: string) {
  return (
    <Link
      href={href}
      aria-label="Cancel and go back"
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
  )
}

export default async function V2MealDeleteConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string
    meal?: string
    entry?: string
    returnTo?: string
  }>
}) {
  const params = await searchParams
  const date = params.date ?? ''
  const meal = (params.meal ?? '').toLowerCase()
  const entryId = params.entry?.trim() || null
  const fallbackReturn = `/v2/calories/food?date=${date}#${meal}`
  const returnTo = safeReturnTo(params.returnTo, fallbackReturn)

  if (!DATE_RE.test(date) || !VALID_MEALS.has(meal)) {
    return (
      <MobileShell
        top={<TopAppBar title="Confirm removal" leading={backArrow('/v2/calories')} />}
      >
        <div style={{ padding: 'var(--v2-space-4)' }}>
          <Card variant="explanatory" padding="md">
            <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', lineHeight: 'var(--v2-leading-relaxed)' }}>
              That link was missing a date or meal. Head back to Calories and try again.
            </p>
          </Card>
        </div>
      </MobileShell>
    )
  }

  const mealKey = meal as 'breakfast' | 'lunch' | 'dinner' | 'snack'
  const sb = createServiceClient()

  // Resolve daily_logs row so we can fetch the meal's entries
  // (bulk view) or a single entry preview.
  const { data: log } = await sb
    .from('daily_logs')
    .select('id')
    .eq('date', date)
    .maybeSingle()
  const logId = (log as { id: string } | null)?.id ?? null

  let entries: EntryPreview[] = []
  let singleEntry: EntryPreview | null = null

  if (entryId) {
    const { data } = await sb
      .from('food_entries')
      .select('id, food_items, calories')
      .eq('id', entryId)
      .maybeSingle()
    singleEntry = (data as EntryPreview | null) ?? null
  } else if (logId) {
    const { data } = await sb
      .from('food_entries')
      .select('id, food_items, calories')
      .eq('log_id', logId)
      .eq('meal_type', mealKey)
      .order('logged_at', { ascending: true })
    entries = (data ?? []) as EntryPreview[]
  }

  const label = MEAL_LABELS[mealKey]
  const prettyDate = formatDate(date)
  const isSingle = entryId !== null
  const itemCount = isSingle ? (singleEntry ? 1 : 0) : entries.length

  return (
    <MobileShell top={<TopAppBar title="Confirm removal" leading={backArrow(returnTo)} />}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Card variant="explanatory" padding="md">
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
            }}
          >
            {isSingle
              ? `Remove this item from ${label.toLowerCase()}?`
              : `Remove all of ${label.toLowerCase()} on ${prettyDate}?`}
          </h2>
          <p
            style={{
              margin: 0,
              marginTop: 'var(--v2-space-2)',
              fontSize: 'var(--v2-text-sm)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            You can always add it back. We just won&apos;t count it for now.
          </p>
        </Card>

        <MealDeletePreview
          mode={isSingle ? 'single' : 'bulk'}
          single={singleEntry}
          entries={entries}
          mealLabel={label}
        />

        <MealDeleteConfirmForm
          date={date}
          meal={mealKey}
          entryId={entryId}
          returnTo={returnTo}
          itemCount={itemCount}
        />
      </div>
    </MobileShell>
  )
}
