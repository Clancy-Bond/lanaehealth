/*
 * WeighInForm
 *
 * Plain server-rendered form backed by a Next.js server action. No
 * client JS: submit reloads the page with ?saved=1 on success so
 * the banner catches it. Input is lb (the only unit Lanae ever
 * thinks in) and we convert to kg before calling addWeightEntry,
 * which stores canonical kg. Invalid submissions surface as
 * ?error=<code> so the form can reflect them on reload.
 *
 * The input id weigh-in-lb is stable so the empty-state CTA
 * anchors there (href="#weigh-in-lb"); this is a deliberate
 * no-JS focus handoff.
 */
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { Button, Card } from '@/v2/components/primitives'
import { addWeightEntry, lbToKg } from '@/lib/calories/weight'

export interface WeighInFormProps {
  /** Error code reflected back from a previous submission, if any. */
  error?: string | null
}

async function runWeighIn(formData: FormData): Promise<void> {
  'use server'

  const lbRaw = String(formData.get('lb') ?? '').trim()
  const notesRaw = String(formData.get('notes') ?? '').trim()
  const lb = Number(lbRaw)
  if (!Number.isFinite(lb) || lb <= 0) {
    redirect('/v2/calories/health/weight?error=invalid')
  }
  const kg = lbToKg(lb)
  const date = format(new Date(), 'yyyy-MM-dd')
  const result = await addWeightEntry({
    date,
    kg,
    notes: notesRaw === '' ? null : notesRaw,
  })
  if (!result.ok) {
    redirect('/v2/calories/health/weight?error=save')
  }
  redirect('/v2/calories/health/weight?saved=1')
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid: 'That reading did not look right. Enter a number like 201.4.',
  save: 'We could not save that one. Try again in a moment.',
}

export default function WeighInForm({ error }: WeighInFormProps) {
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? null) : null

  return (
    <Card padding="md">
      <form
        action={runWeighIn}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <label
            htmlFor="weigh-in-lb"
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            Today&apos;s weight
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--v2-space-2)',
            }}
          >
            <input
              id="weigh-in-lb"
              name="lb"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="20"
              max="800"
              required
              placeholder="201.4"
              style={{
                flex: 1,
                fontSize: 'var(--v2-text-base)',
                padding: 'var(--v2-space-3) var(--v2-space-4)',
                borderRadius: 'var(--v2-radius-md)',
                background: 'var(--v2-bg-card)',
                color: 'var(--v2-text-primary)',
                border: '1px solid var(--v2-border-strong)',
                fontFamily: 'inherit',
                fontVariantNumeric: 'tabular-nums',
                width: '100%',
                minWidth: 0,
              }}
            />
            <span
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                fontWeight: 'var(--v2-weight-medium)',
              }}
            >
              lb
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <label
            htmlFor="weigh-in-notes"
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            Anything to remember?
          </label>
          <textarea
            id="weigh-in-notes"
            name="notes"
            rows={2}
            placeholder="Optional: time of day, clothing, context."
            style={{
              fontSize: 'var(--v2-text-base)',
              padding: 'var(--v2-space-3) var(--v2-space-4)',
              borderRadius: 'var(--v2-radius-md)',
              background: 'var(--v2-bg-card)',
              color: 'var(--v2-text-primary)',
              border: '1px solid var(--v2-border-strong)',
              fontFamily: 'inherit',
              resize: 'vertical',
              width: '100%',
              minHeight: 60,
              lineHeight: 'var(--v2-leading-normal)',
            }}
          />
        </div>

        {errorMessage && (
          <p
            role="alert"
            style={{
              margin: 0,
              color: 'var(--v2-accent-warning)',
              fontSize: 'var(--v2-text-sm)',
            }}
          >
            {errorMessage}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" fullWidth>
          Add today&apos;s weigh-in
        </Button>
      </form>
    </Card>
  )
}
