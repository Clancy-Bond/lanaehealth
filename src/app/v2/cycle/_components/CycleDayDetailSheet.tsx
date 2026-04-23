'use client'

/*
 * CycleDayDetailSheet
 *
 * Bottom sheet that surfaces every logged signal for a single date
 * on /v2/cycle/history. Matches Natural Cycles' tap-a-day behavior:
 * the day opens a detail card inline rather than navigating to the
 * log form. An "Edit entry" button at the bottom still routes to
 * /v2/cycle/log?date=... for actual edits.
 *
 * Pure presentation: all data arrives via props. Lookup + phase
 * derivation happen upstream in CycleHistoryClient.
 *
 * Voice: short, kind, explanatory. No "you should" / "you must".
 * No em-dashes.
 */
import Link from 'next/link'
import { Sheet, Button } from '@/v2/components/primitives'
import type { CyclePhase, CycleEntry } from '@/lib/types'

export interface CycleDayDetail {
  date: string
  flow_level: CycleEntry['flow_level']
  menstruation: boolean
  ovulation_signs: string | null
  lh_test_result: string | null
  cervical_mucus_consistency: string | null
  cervical_mucus_quantity: string | null
  symptoms: string[] | null
  temp_f: number | null
  temp_c: number | null
  notes: string | null
  cycleDay: number | null
  phase: CyclePhase | null
}

export interface CycleDayDetailSheetProps {
  open: boolean
  onClose: () => void
  detail: CycleDayDetail | null
}

function fmtFullDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function prettyFlow(flow: CycleEntry['flow_level']): string | null {
  if (!flow) return null
  if (flow === 'none') return 'None'
  return titleCase(flow)
}

function prettyList(items: string[] | null): string | null {
  if (!items || items.length === 0) return null
  return items.map((s) => s.replace(/_/g, ' ')).join(', ')
}

interface FieldRowProps {
  label: string
  value: React.ReactNode
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--v2-space-3)',
        padding: 'var(--v2-space-3) 0',
        borderBottom: '1px solid var(--v2-border-subtle)',
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-muted)',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-primary)',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export default function CycleDayDetailSheet({ open, onClose, detail }: CycleDayDetailSheetProps) {
  // Sheet returns null when !open. If open but detail is briefly missing
  // (race between tap and state), render an empty sheet rather than crash.
  if (!detail) {
    return (
      <Sheet open={open} onClose={onClose} title="">
        <div />
      </Sheet>
    )
  }

  const title = fmtFullDate(detail.date)
  const rows: FieldRowProps[] = []

  if (detail.cycleDay != null) {
    const phaseLabel = detail.phase ? ` \u00b7 ${titleCase(detail.phase)}` : ''
    rows.push({ label: 'Cycle day', value: `Day ${detail.cycleDay}${phaseLabel}` })
  }

  const flow = prettyFlow(detail.flow_level)
  if (detail.menstruation || flow) {
    rows.push({
      label: 'Flow',
      value: flow ?? 'Period day',
    })
  }

  if (detail.ovulation_signs) {
    rows.push({ label: 'Ovulation signs', value: detail.ovulation_signs.replace(/_/g, ' ') })
  }

  if (detail.lh_test_result) {
    rows.push({ label: 'LH test', value: titleCase(detail.lh_test_result) })
  }

  const mucus = [detail.cervical_mucus_consistency, detail.cervical_mucus_quantity]
    .filter(Boolean)
    .join(', ')
  if (mucus) {
    rows.push({ label: 'Cervical mucus', value: mucus })
  }

  const symptomsText = prettyList(detail.symptoms)
  if (symptomsText) {
    rows.push({ label: 'Symptoms', value: symptomsText })
  }

  if (detail.temp_f != null) {
    rows.push({
      label: 'Basal temp',
      value: `${detail.temp_f.toFixed(2)}\u00b0F`,
    })
  }

  const hasRows = rows.length > 0

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        {hasRows ? (
          <div>
            {rows.map((r, i) => (
              <div
                key={r.label}
                style={{
                  borderBottom:
                    i === rows.length - 1 ? 'none' : '1px solid var(--v2-border-subtle)',
                }}
              >
                <FieldRow label={r.label} value={r.value} />
              </div>
            ))}
          </div>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Nothing logged for this day yet. Tap Edit to add what you remember.
          </p>
        )}

        {detail.notes && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-1)',
              paddingTop: 'var(--v2-space-2)',
              borderTop: hasRows ? 'none' : '1px solid var(--v2-border-subtle)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
              }}
            >
              Notes
            </span>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-primary)',
                lineHeight: 'var(--v2-leading-relaxed)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {detail.notes}
            </p>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
            paddingTop: 'var(--v2-space-2)',
          }}
        >
          <Link
            href={`/v2/cycle/log?date=${detail.date}`}
            aria-label="Edit entry"
            style={{ textDecoration: 'none' }}
          >
            <Button variant="primary" size="lg" fullWidth>
              Edit entry
            </Button>
          </Link>
          <Button variant="tertiary" size="md" fullWidth onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
