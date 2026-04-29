'use client'

/**
 * MedsCardClient
 *
 * The interactive home meds card. Renders three sections:
 *   - Morning batch (collapsed → summary line after a time-of-day cutoff)
 *   - Tonight batch (same)
 *   - PRN ("If you need it") — collapsed by default
 *
 * Tap a row → optimistic check, POST /api/meds/dose, ✓ stays on success,
 * reverts + brief toast on failure.
 *
 * Long-press a row OR tap the clock icon → reveals an inline time chip
 * strip (Now / 5m / 30m / 1h / When I woke up / Custom). Picking a chip
 * sends the dose with the chosen taken_at.
 *
 * Tap a checked row → DELETE /api/meds/dose/[id], shows undo toast.
 */
import { useState, useTransition, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/v2/components/primitives'
import type { MedSlot } from '@/lib/meds/types'
import type {
  MedsTodayState,
  ScheduledRowState,
  PrnRowState,
} from '@/lib/meds/today-state'

interface Props {
  state: MedsTodayState
  todayLocal: string
}

interface PendingError {
  rowId: string
  message: string
}

export default function MedsCardClient({ state, todayLocal }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busyRows, setBusyRows] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<PendingError[]>([])
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null)
  const [prnExpanded, setPrnExpanded] = useState(false)

  const hour = useMemo(() => new Date().getHours(), [])
  // Time-of-day collapse: morning section auto-collapses after 6pm if all
  // morning rows are checked; tonight section auto-collapses before noon
  // if no tonight rows are checked yet.
  const morningAllDone =
    state.morning.length > 0 && state.morning.every((r) => r.takenDose)
  const showMorningSummary = hour >= 18 && morningAllDone
  const showNightSummary = hour < 12

  function setBusy(rowId: string, busy: boolean) {
    setBusyRows((prev) => {
      const next = new Set(prev)
      if (busy) next.add(rowId)
      else next.delete(rowId)
      return next
    })
  }

  function recordError(rowId: string, message: string) {
    setErrors((prev) => [...prev.filter((e) => e.rowId !== rowId), { rowId, message }])
    window.setTimeout(() => {
      setErrors((prev) => prev.filter((e) => e.rowId !== rowId))
    }, 4000)
  }

  async function logDose(
    row: ScheduledRowState | PrnRowState,
    opts: {
      kind: 'scheduled' | 'prn'
      slot?: MedSlot | null
      takenAt?: Date
      doseText?: string | null
    },
  ) {
    const rowId =
      'rowId' in row ? row.rowId : `${row.slug}::prn::${Date.now()}`
    const med_slug = 'med' in row ? row.med.slug : row.slug
    const med_name = 'med' in row ? row.med.name : row.name
    setBusy(rowId, true)
    setPickerOpenFor(null)
    try {
      const resp = await fetch('/api/meds/dose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          med_slug,
          med_name,
          kind: opts.kind,
          slot: opts.slot ?? null,
          taken_at: (opts.takenAt ?? new Date()).toISOString(),
          dose_text: opts.doseText ?? null,
          source: 'tap',
        }),
      })
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string }
        recordError(rowId, body.error ?? 'Save failed')
        return
      }
      // Re-fetch the page so the server-rendered state matches.
      startTransition(() => router.refresh())
    } catch {
      recordError(rowId, 'Network hiccup. Try again.')
    } finally {
      setBusy(rowId, false)
    }
  }

  async function undoDose(doseId: string, rowId: string) {
    setBusy(rowId, true)
    try {
      const resp = await fetch(`/api/meds/dose/${doseId}`, { method: 'DELETE' })
      if (!resp.ok) {
        recordError(rowId, 'Undo failed')
        return
      }
      startTransition(() => router.refresh())
    } catch {
      recordError(rowId, 'Network hiccup. Try again.')
    } finally {
      setBusy(rowId, false)
    }
  }

  return (
    <Card padding="md" aria-label="Today's meds">
      <Header
        taken={state.scheduledTakenCount}
        total={state.scheduledTotalCount}
      />

      {state.morning.length > 0 && (
        <Batch
          label="Morning"
          rows={state.morning}
          summarized={showMorningSummary}
          busyRows={busyRows}
          errors={errors}
          pickerOpenFor={pickerOpenFor}
          onTap={(row) =>
            logDose(row, { kind: 'scheduled', slot: 'morning' })
          }
          onPick={(row, takenAt) =>
            logDose(row, { kind: 'scheduled', slot: 'morning', takenAt })
          }
          onUndo={(doseId, rowId) => undoDose(doseId, rowId)}
          onTogglePicker={(rowId) =>
            setPickerOpenFor((cur) => (cur === rowId ? null : rowId))
          }
        />
      )}

      {state.night.length > 0 && (
        <Batch
          label="Tonight"
          rows={state.night}
          summarized={showNightSummary}
          busyRows={busyRows}
          errors={errors}
          pickerOpenFor={pickerOpenFor}
          onTap={(row) => logDose(row, { kind: 'scheduled', slot: 'night' })}
          onPick={(row, takenAt) =>
            logDose(row, { kind: 'scheduled', slot: 'night', takenAt })
          }
          onUndo={(doseId, rowId) => undoDose(doseId, rowId)}
          onTogglePicker={(rowId) =>
            setPickerOpenFor((cur) => (cur === rowId ? null : rowId))
          }
        />
      )}

      {state.prn.length > 0 && (
        <PrnSection
          expanded={prnExpanded}
          onToggle={() => setPrnExpanded((v) => !v)}
          rows={state.prn}
          busyRows={busyRows}
          errors={errors}
          onLog={(row) =>
            logDose(row, {
              kind: 'prn',
              slot: null,
              doseText: row.default_dose_text ?? null,
            })
          }
          onUndo={(doseId, rowId) => undoDose(doseId, rowId)}
        />
      )}
    </Card>
  )
}

// ── Header (counter) ───────────────────────────────────────────────

function Header({ taken, total }: { taken: number; total: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 'var(--v2-space-3)',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-lg)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-primary)',
        }}
      >
        Meds
      </h2>
      <span
        style={{
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {total === 0 ? '' : `${taken} of ${total} today`}
      </span>
    </div>
  )
}

// ── Scheduled batch (morning / tonight) ────────────────────────────

interface BatchProps {
  label: string
  rows: ScheduledRowState[]
  summarized: boolean
  busyRows: Set<string>
  errors: PendingError[]
  pickerOpenFor: string | null
  onTap: (row: ScheduledRowState) => void
  onPick: (row: ScheduledRowState, takenAt: Date) => void
  onUndo: (doseId: string, rowId: string) => void
  onTogglePicker: (rowId: string) => void
}

function Batch({
  label,
  rows,
  summarized,
  busyRows,
  errors,
  pickerOpenFor,
  onTap,
  onPick,
  onUndo,
  onTogglePicker,
}: BatchProps) {
  const [expanded, setExpanded] = useState(!summarized)
  const allDone = rows.every((r) => r.takenDose)
  const summary = `${rows.filter((r) => r.takenDose).length} of ${rows.length} done`

  return (
    <section
      style={{
        marginTop: 'var(--v2-space-3)',
        borderTop: '1px solid var(--v2-border-subtle)',
        paddingTop: 'var(--v2-space-3)',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          appearance: 'none',
          background: 'transparent',
          border: 'none',
          padding: 0,
          width: '100%',
          textAlign: 'left',
          color: 'var(--v2-text-muted)',
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        aria-expanded={expanded}
      >
        <span>
          {label} {allDone && '✓'}
        </span>
        <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
          {!expanded ? `${summary} ▸` : ' '}
        </span>
      </button>

      {expanded && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 'var(--v2-space-2) 0 0 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-1)',
          }}
        >
          {rows.map((row) => (
            <ScheduledRow
              key={row.rowId}
              row={row}
              busy={busyRows.has(row.rowId)}
              error={errors.find((e) => e.rowId === row.rowId)?.message ?? null}
              pickerOpen={pickerOpenFor === row.rowId}
              onTap={() => onTap(row)}
              onPick={(takenAt) => onPick(row, takenAt)}
              onUndo={(doseId) => onUndo(doseId, row.rowId)}
              onTogglePicker={() => onTogglePicker(row.rowId)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

// ── A single scheduled row ─────────────────────────────────────────

interface ScheduledRowProps {
  row: ScheduledRowState
  busy: boolean
  error: string | null
  pickerOpen: boolean
  onTap: () => void
  onPick: (takenAt: Date) => void
  onUndo: (doseId: string) => void
  onTogglePicker: () => void
}

function ScheduledRow({
  row,
  busy,
  error,
  pickerOpen,
  onTap,
  onPick,
  onUndo,
  onTogglePicker,
}: ScheduledRowProps) {
  const taken = row.takenDose
  const checked = !!taken

  // Long-press handler: 500ms hold opens the time picker without firing
  // the tap handler. The browser fires `click` after `pointerup` on the
  // same element regardless of whether a long-press elapsed, so we
  // also need a `longPressFired` ref that the click handler checks and
  // consumes — otherwise a long-press would open the picker AND log
  // the dose at "now" simultaneously, defeating the picker.
  const longPressTimeout = useMemo(() => ({ current: null as number | null }), [])
  const longPressFired = useRef(false)
  function onPointerDown() {
    longPressFired.current = false
    if (longPressTimeout.current) window.clearTimeout(longPressTimeout.current)
    longPressTimeout.current = window.setTimeout(() => {
      longPressFired.current = true
      onTogglePicker()
      longPressTimeout.current = null
    }, 500)
  }
  function onPointerUp() {
    if (longPressTimeout.current) {
      window.clearTimeout(longPressTimeout.current)
      longPressTimeout.current = null
    }
  }

  return (
    <li>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--v2-space-3)',
          padding: 'var(--v2-space-2) 0',
          minHeight: 'var(--v2-touch-target-min)',
        }}
      >
        <button
          type="button"
          aria-label={
            checked ? `Undo ${row.med.name}` : `Mark ${row.med.name} as taken now`
          }
          aria-pressed={checked}
          disabled={busy}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={() => {
            if (busy) return
            // Suppress the trailing click that fires after a long-press
            // released on the same element. Without this the picker
            // opens AND the dose stamps at "now" in the same gesture.
            if (longPressFired.current) {
              longPressFired.current = false
              return
            }
            if (checked && taken) onUndo(taken.id)
            else onTap()
          }}
          style={{
            appearance: 'none',
            width: 28,
            height: 28,
            minWidth: 28,
            borderRadius: '50%',
            border: `2px solid ${checked ? 'var(--v2-accent-primary)' : 'var(--v2-border-strong)'}`,
            background: checked ? 'var(--v2-accent-primary)' : 'transparent',
            color: checked ? 'var(--v2-on-accent)' : 'transparent',
            cursor: busy ? 'progress' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            lineHeight: 1,
            transition:
              'background var(--v2-duration-fast) var(--v2-ease-standard), border-color var(--v2-duration-fast) var(--v2-ease-standard)',
          }}
        >
          {checked ? '✓' : ''}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-primary)',
              fontWeight: 'var(--v2-weight-medium)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.med.name}
          </div>
          {checked && taken && (
            <div
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Taken {formatTime(taken.taken_at)}
            </div>
          )}
          {error && (
            <div
              role="alert"
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-accent-danger)',
              }}
            >
              {error}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label={`Pick a different time for ${row.med.name}`}
          onClick={onTogglePicker}
          style={{
            appearance: 'none',
            background: 'transparent',
            border: 'none',
            color: 'var(--v2-text-muted)',
            fontSize: 18,
            cursor: 'pointer',
            padding: 'var(--v2-space-1)',
            minHeight: 'var(--v2-touch-target-min)',
            minWidth: 'var(--v2-touch-target-min)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          🕐
        </button>
      </div>

      {pickerOpen && !checked && (
        <TimePicker
          slot={row.slot}
          onPick={(d) => onPick(d)}
          onCancel={onTogglePicker}
        />
      )}
    </li>
  )
}

// ── Time picker (chip strip) ───────────────────────────────────────

function TimePicker({
  slot,
  onPick,
  onCancel,
}: {
  slot: MedSlot
  onPick: (taken: Date) => void
  onCancel: () => void
}) {
  const now = new Date()
  const chips: { label: string; date: Date }[] = [
    { label: 'Now', date: now },
    { label: '5m ago', date: minutesAgo(now, 5) },
    { label: '30m ago', date: minutesAgo(now, 30) },
    { label: '1h ago', date: minutesAgo(now, 60) },
  ]
  if (slot === 'morning' && now.getHours() >= 12) {
    chips.push({ label: 'When I woke up (~7am)', date: atHourLocal(now, 7) })
  }
  if (slot === 'night' && now.getHours() < 12) {
    chips.push({ label: 'Before bed (~10pm yesterday)', date: yesterdayAtHourLocal(now, 22) })
  }
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--v2-space-2)',
        flexWrap: 'wrap',
        padding: 'var(--v2-space-2) 0 var(--v2-space-3) calc(28px + var(--v2-space-3))',
      }}
    >
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onPick(c.date)}
          style={{
            appearance: 'none',
            border: '1px solid var(--v2-border)',
            background: 'var(--v2-bg-card)',
            color: 'var(--v2-text-primary)',
            padding: 'var(--v2-space-1) var(--v2-space-3)',
            borderRadius: 'var(--v2-radius-full)',
            fontSize: 'var(--v2-text-sm)',
            cursor: 'pointer',
            minHeight: 36,
            fontFamily: 'inherit',
          }}
        >
          {c.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onCancel}
        style={{
          appearance: 'none',
          border: 'none',
          background: 'transparent',
          color: 'var(--v2-text-muted)',
          padding: 'var(--v2-space-1) var(--v2-space-2)',
          fontSize: 'var(--v2-text-sm)',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Cancel
      </button>
    </div>
  )
}

// ── PRN section (collapsed by default) ─────────────────────────────

interface PrnSectionProps {
  expanded: boolean
  onToggle: () => void
  rows: PrnRowState[]
  busyRows: Set<string>
  errors: PendingError[]
  onLog: (row: PrnRowState) => void
  onUndo: (doseId: string, rowId: string) => void
}

function PrnSection({
  expanded,
  onToggle,
  rows,
  busyRows,
  errors,
  onLog,
  onUndo,
}: PrnSectionProps) {
  return (
    <section
      style={{
        marginTop: 'var(--v2-space-3)',
        borderTop: '1px solid var(--v2-border-subtle)',
        paddingTop: 'var(--v2-space-3)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          appearance: 'none',
          background: 'transparent',
          border: 'none',
          padding: 0,
          width: '100%',
          textAlign: 'left',
          color: 'var(--v2-text-muted)',
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        {expanded ? '▾' : '▸'} If you need it
      </button>

      {expanded && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 'var(--v2-space-2) 0 0 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          {rows.map((row) => {
            const rowId = `prn::${row.slug}`
            const busy = busyRows.has(rowId)
            const err = errors.find((e) => e.rowId === rowId)?.message ?? null
            const lastTodayDose = row.todayDoses[0] ?? null
            return (
              <li
                key={row.slug}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--v2-space-3)',
                  padding: 'var(--v2-space-2) 0',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--v2-text-base)',
                      color: 'var(--v2-text-primary)',
                      fontWeight: 'var(--v2-weight-medium)',
                    }}
                  >
                    {row.name}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--v2-text-xs)',
                      color: 'var(--v2-text-muted)',
                    }}
                  >
                    {lastTodayDose
                      ? `Taken ${formatTime(lastTodayDose.taken_at)} today`
                      : row.daysSinceLast == null
                        ? 'Never logged'
                        : row.daysSinceLast === 0
                          ? 'Last taken: earlier today'
                          : `Last taken: ${row.daysSinceLast} day${row.daysSinceLast === 1 ? '' : 's'} ago`}
                  </div>
                  {err && (
                    <div
                      role="alert"
                      style={{
                        fontSize: 'var(--v2-text-xs)',
                        color: 'var(--v2-accent-danger)',
                      }}
                    >
                      {err}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (lastTodayDose) onUndo(lastTodayDose.id, rowId)
                    else onLog(row)
                  }}
                  style={{
                    appearance: 'none',
                    border: '1px solid var(--v2-accent-primary)',
                    background: lastTodayDose
                      ? 'var(--v2-accent-primary-soft)'
                      : 'transparent',
                    color: 'var(--v2-accent-primary)',
                    padding: 'var(--v2-space-1) var(--v2-space-3)',
                    borderRadius: 'var(--v2-radius-full)',
                    fontSize: 'var(--v2-text-sm)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    cursor: busy ? 'progress' : 'pointer',
                    fontFamily: 'inherit',
                    minHeight: 'var(--v2-touch-target-min)',
                  }}
                >
                  {lastTodayDose ? 'Undo' : 'Log'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ── Helpers ────────────────────────────────────────────────────────

function minutesAgo(from: Date, mins: number): Date {
  return new Date(from.getTime() - mins * 60_000)
}

function atHourLocal(reference: Date, hour: number): Date {
  const d = new Date(reference)
  d.setHours(hour, 0, 0, 0)
  return d
}

function yesterdayAtHourLocal(reference: Date, hour: number): Date {
  const d = atHourLocal(reference, hour)
  d.setDate(d.getDate() - 1)
  return d
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    return iso
  }
}
