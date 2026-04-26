'use client'

/*
 * LogDatePicker
 *
 * Tappable date header that opens a native date input so the user can
 * backdate a cycle entry without editing the URL. The header still
 * looks like a passive title; the underlying input is invisible but
 * full-bleed across the heading so a tap anywhere on the date string
 * surfaces the OS date picker.
 *
 * Backdating is a real user need: people forget to log on the day a
 * period starts and want to fix it the next morning. Without this
 * affordance the whole prediction engine drifts because day 1 was
 * recorded on day 2.
 *
 * Forward-dating is intentionally allowed too. Some users plan ahead
 * (e.g. expected ovulation window) and the form happily accepts a
 * future date. The page server reads `?date=` and re-fetches.
 */
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'

export interface LogDatePickerProps {
  /** Currently selected date (yyyy-mm-dd). */
  date: string
  /** Optional cycle-day caption rendered under the date. */
  cycleDayText?: string | null
}

export default function LogDatePicker({ date, cycleDayText }: LogDatePickerProps) {
  const router = useRouter()
  const headerDate = format(parseISO(date), 'EEE, MMM d')
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span>{headerDate}</span>
        <span aria-hidden style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
          ▾
        </span>
      </span>
      {cycleDayText && (
        <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', fontWeight: 'var(--v2-weight-regular)' }}>
          {cycleDayText}
        </span>
      )}
      <input
        type="date"
        aria-label="Change log date"
        value={date}
        onChange={(e) => {
          const next = e.target.value
          if (!next) return
          // Push to the same route with a different ?date so the page
          // re-fetches the entry for that day. Keep history clean by
          // using replace, not push, so back goes to /v2/cycle.
          router.replace(`/v2/cycle/log?date=${next}`)
        }}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          cursor: 'pointer',
          // Native iOS picker fires on tap of the input area; full
          // overlay means the user taps the visible date text.
          minHeight: 'var(--v2-touch-target-min)',
        }}
      />
    </span>
  )
}
