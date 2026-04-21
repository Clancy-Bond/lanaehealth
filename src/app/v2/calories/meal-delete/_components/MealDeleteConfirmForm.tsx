/*
 * MealDeleteConfirmForm
 *
 * Server-action form that wraps the Remove + Cancel row for the
 * meal-delete confirmation page. Handles two shapes:
 *
 *   bulk    : entry absent. Removes every food_entries row for
 *             (date, meal).
 *   single  : entry present. Removes exactly that food_entries
 *             row by id.
 *
 * Both paths use the same server action so returnTo is honored
 * uniformly. The existing POST /api/calories/meal/delete route
 * only supports the bulk shape, so single-entry goes through
 * a direct food_entries delete by id. No client JS: the form
 * submits, Next runs the action, and we redirect to returnTo.
 *
 * The voice on the button label is NC-register: "Remove", not
 * "Delete". The copy on the page itself explains that adding
 * the item back is fine.
 */
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { Button } from '@/v2/components/primitives'

export interface MealDeleteConfirmFormProps {
  date: string
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  entryId: string | null
  returnTo: string
  itemCount: number
}

/** Re-sanitize returnTo at the server-action trust boundary. The page
 * sanitizer only runs at render; a direct POST can bypass it. */
function sanitizeReturnToServer(raw: string): string {
  const fallback = '/v2/calories/food'
  if (!raw || raw.length > 500) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  if (raw.includes('\\')) return fallback
  try {
    const resolved = new URL(raw, 'https://lanaehealth.internal')
    if (resolved.origin !== 'https://lanaehealth.internal') return fallback
    if (!resolved.pathname.startsWith('/')) return fallback
  } catch {
    return fallback
  }
  return raw
}

async function runMealDelete(formData: FormData): Promise<void> {
  'use server'

  const date = String(formData.get('date') ?? '')
  const meal = String(formData.get('meal') ?? '').toLowerCase()
  const entry = String(formData.get('entry') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  const returnTo = sanitizeReturnToServer(String(formData.get('returnTo') ?? ''))

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
  if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(meal)) return
  // Enforce the confirm token the form always posts; blocks direct
  // action invocations that skip the confirmation page.
  if (confirm !== 'yes') return

  const sb = createServiceClient()

  if (entry) {
    // Single-entry delete. Verify the entry's (date, meal) context
    // matches what the user confirmed on the preview page before we
    // touch the row. CLAUDE.md zero-data-loss rule.
    const { data: row } = await sb
      .from('food_entries')
      .select('id, meal_type, log_id, daily_logs!inner(date)')
      .eq('id', entry)
      .maybeSingle()
    const safe = row as
      | { id: string; meal_type: string | null; log_id: string; daily_logs: { date: string } | null }
      | null
    if (!safe) return
    if (safe.meal_type !== meal) return
    if (safe.daily_logs?.date !== date) return
    await sb.from('food_entries').delete().eq('id', entry)
  } else {
    // Bulk delete: every food_entries row for (date, meal).
    const { data: log } = await sb
      .from('daily_logs')
      .select('id')
      .eq('date', date)
      .maybeSingle()
    const logId = (log as { id: string } | null)?.id ?? null
    if (logId) {
      await sb
        .from('food_entries')
        .delete()
        .eq('log_id', logId)
        .eq('meal_type', meal)
    }
  }

  redirect(returnTo)
}

export default function MealDeleteConfirmForm({
  date,
  meal,
  entryId,
  returnTo,
  itemCount,
}: MealDeleteConfirmFormProps) {
  const disabled = itemCount === 0
  return (
    <form
      action={runMealDelete}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
      }}
    >
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="meal" value={meal} />
      {entryId && <input type="hidden" name="entry" value={entryId} />}
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="confirm" value="yes" />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        <Button type="submit" variant="destructive" size="lg" fullWidth disabled={disabled}>
          Remove
        </Button>
        <a
          href={returnTo}
          aria-label="Cancel and go back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 52,
            padding: '0 var(--v2-space-6)',
            borderRadius: 'var(--v2-radius-full)',
            background: 'transparent',
            color: 'var(--v2-text-primary)',
            border: '1px solid var(--v2-border-strong)',
            fontSize: 'var(--v2-text-lg)',
            fontWeight: 'var(--v2-weight-semibold)',
            textDecoration: 'none',
            width: '100%',
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </a>
      </div>
    </form>
  )
}
