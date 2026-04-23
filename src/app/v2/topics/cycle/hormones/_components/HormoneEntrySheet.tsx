'use client'

/*
 * HormoneEntrySheet
 *
 * Bottom sheet that lets the user add a single hormone reading. The
 * form mirrors /api/cycle/hormones POST: hormone id, value, unit
 * (defaults to the hormone's canonical unit if blank), date, source.
 *
 * Submission path: POST /api/cycle/hormones. The API already exists
 * and is the path the legacy page uses, so we keep the client light
 * and avoid adding a new server action just for this surface. On
 * success the sheet calls onSaved() which triggers a server refresh
 * in the parent client component.
 *
 * Validation follows the "explicit, short, not-shaming" voice rule:
 *   - Hormone is always picked (defaults to estrogen)
 *   - Value must be a positive, finite number
 *   - Unit is optional (API falls back to the hormone's default)
 *   - Date must be present; defaults to today
 */
import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Sheet,
  Button,
  Banner,
  SegmentedControl,
} from '@/v2/components/primitives'
import {
  fieldInputStyle,
  fieldSelectStyle,
  fieldLabelStyle,
} from '@/app/v2/_tail-shared/formField'
import {
  HORMONE_META,
  type HormoneId,
} from '@/lib/cycle/hormones'

type Source = 'lab' | 'self' | 'wearable'

const HORMONE_IDS = Object.keys(HORMONE_META) as HormoneId[]

const SOURCE_SEGMENTS: { label: string; value: Source }[] = [
  { label: 'Lab', value: 'lab' },
  { label: 'Self', value: 'self' },
  { label: 'Wearable', value: 'wearable' },
]

export interface HormoneEntrySheetProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export default function HormoneEntrySheet({
  open,
  onClose,
  onSaved,
}: HormoneEntrySheetProps) {
  const [hormone, setHormone] = useState<HormoneId>('estrogen')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [date, setDate] = useState<string>(todayISO())
  const [source, setSource] = useState<Source>('lab')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  // Reset form every time the sheet opens so stale values from a
  // previous session never surface. Keeps the sheet feeling fresh.
  useEffect(() => {
    if (open) {
      setHormone('estrogen')
      setValue('')
      setUnit('')
      setDate(todayISO())
      setSource('lab')
      setSubmitting(false)
      setError(null)
      setFieldError(null)
    }
  }, [open])

  // The placeholder updates when the hormone selection changes so the
  // user sees the canonical unit for the hormone they just picked.
  const unitPlaceholder = useMemo(
    () => HORMONE_META[hormone].defaultUnit,
    [hormone],
  )

  const validate = (): string | null => {
    if (!hormone || !(hormone in HORMONE_META)) return 'Pick a hormone.'
    const n = Number(value)
    if (!Number.isFinite(n)) return 'Enter a number for value.'
    if (n <= 0) return 'Value must be greater than zero.'
    if (!date) return 'Pick a date.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    const v = validate()
    if (v) {
      setFieldError(v)
      return
    }
    setFieldError(null)
    setSubmitting(true)
    try {
      const payload = {
        hormone,
        value: Number(value),
        date,
        source,
        ...(unit.trim().length > 0 ? { unit: unit.trim() } : {}),
      }
      const res = await fetch('/api/cycle/hormones', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        onSaved()
        onClose()
        return
      }
      let message = `Could not save entry (${res.status}).`
      try {
        const body = (await res.json()) as { error?: string }
        if (body && typeof body.error === 'string' && body.error.length > 0) {
          message = body.error
        }
      } catch {
        /* non-JSON body, keep the fallback */
      }
      setError(message)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log hormone entry">
      <form
        onSubmit={handleSubmit}
        noValidate
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
        }}
      >
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          <span style={fieldLabelStyle}>Hormone</span>
          <select
            value={hormone}
            onChange={(e) => setHormone(e.target.value as HormoneId)}
            style={fieldSelectStyle}
          >
            {HORMONE_IDS.map((id) => (
              <option key={id} value={id}>
                {HORMONE_META[id].label}
              </option>
            ))}
          </select>
        </label>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          <span style={fieldLabelStyle}>Value</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            style={fieldInputStyle}
          />
        </label>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          <span style={fieldLabelStyle}>Unit (optional)</span>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={unitPlaceholder}
            style={fieldInputStyle}
          />
        </label>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          <span style={fieldLabelStyle}>Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            style={fieldInputStyle}
          />
        </label>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          <span style={fieldLabelStyle}>Source</span>
          <SegmentedControl<Source>
            segments={SOURCE_SEGMENTS}
            value={source}
            onChange={setSource}
            fullWidth
          />
        </div>

        {fieldError && (
          <Banner intent="warning" title="Check the form" body={fieldError} />
        )}
        {error && <Banner intent="danger" title="Could not save" body={error} />}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Save entry'}
          </Button>
          <Button
            type="button"
            variant="tertiary"
            size="md"
            fullWidth
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
