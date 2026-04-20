'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, SegmentedControl, Toggle, Card } from '@/v2/components/primitives'
import type { FlowLevel } from '@/lib/types'

const FLOW_OPTIONS: { value: FlowLevel; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'spotting', label: 'Spot' },
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Med' },
  { value: 'heavy', label: 'Heavy' },
]

const LH_OPTIONS = [
  { value: 'not_taken', label: 'Not tested' },
  { value: 'negative', label: 'Negative' },
  { value: 'positive', label: 'Positive' },
]

const OVULATION_SIGN_OPTIONS = [
  { value: 'cramping', label: 'Cramping' },
  { value: 'mittelschmerz', label: 'One-sided pain' },
  { value: 'libido', label: 'Libido shift' },
  { value: 'mood', label: 'Mood lift' },
]

export interface PeriodLogFormV2Props {
  date: string
  initialFlow: FlowLevel | null
  initialMenstruation: boolean
  initialOvulationSigns: string[]
  initialLh: string
  initialNotes: string
}

export default function PeriodLogFormV2({
  date,
  initialFlow,
  initialMenstruation,
  initialOvulationSigns,
  initialLh,
  initialNotes,
}: PeriodLogFormV2Props) {
  const [flow, setFlow] = useState<FlowLevel | null>(initialFlow)
  const [menstruation, setMenstruation] = useState(initialMenstruation)
  const [signs, setSigns] = useState<Set<string>>(new Set(initialOvulationSigns))
  const [lh, setLh] = useState(initialLh)
  const [notes, setNotes] = useState(initialNotes)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  const toggleSign = (v: string) => {
    const next = new Set(signs)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    setSigns(next)
  }

  const submit = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        const res = await fetch('/api/cycle/log', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            date,
            flow_level: flow,
            menstruation,
            ovulation_signs: Array.from(signs),
            lh_test_result: lh,
            endo_notes: notes,
          }),
        })
        if (!res.ok) {
          const msg = (await res.json().catch(() => null))?.error ?? 'Could not save'
          setError(msg)
          return
        }
        setSaved(true)
        router.refresh()
      } catch {
        setError('Network error')
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-5)' }}>
      <Card variant="explanatory" padding="md">
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', lineHeight: 'var(--v2-leading-relaxed)' }}>
          Honest flow is better than best-guess flow. If you aren&apos;t sure, leave it blank —
          an empty entry is a signal too.
        </p>
      </Card>

      <Field label="Flow">
        <SegmentedControl
          fullWidth
          segments={FLOW_OPTIONS}
          value={flow ?? ''}
          onChange={(v) => setFlow(v === '' ? null : (v as FlowLevel))}
        />
      </Field>

      <Field label="Menstruation today">
        <Toggle checked={menstruation} onChange={setMenstruation} />
      </Field>

      <Field label="Ovulation signs you noticed">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--v2-space-2)' }}>
          {OVULATION_SIGN_OPTIONS.map((o) => {
            const active = signs.has(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleSign(o.value)}
                aria-pressed={active}
                style={{
                  minHeight: 'var(--v2-touch-target-min)',
                  padding: '0 var(--v2-space-4)',
                  borderRadius: 'var(--v2-radius-full)',
                  background: active ? 'var(--v2-accent-primary-soft)' : 'transparent',
                  color: active ? 'var(--v2-accent-primary)' : 'var(--v2-text-secondary)',
                  border: `1px solid ${active ? 'var(--v2-accent-primary)' : 'var(--v2-border-strong)'}`,
                  fontSize: 'var(--v2-text-sm)',
                  fontWeight: 'var(--v2-weight-medium)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="LH test">
        <SegmentedControl fullWidth segments={LH_OPTIONS} value={lh} onChange={setLh} />
      </Field>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything else worth remembering about today?"
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
            minHeight: 88,
            lineHeight: 'var(--v2-leading-normal)',
          }}
        />
      </Field>

      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--v2-accent-warning)', fontSize: 'var(--v2-text-sm)' }}>
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" style={{ margin: 0, color: 'var(--v2-accent-success)', fontSize: 'var(--v2-text-sm)' }}>
          Saved.
        </p>
      )}

      <Button variant="primary" size="lg" fullWidth onClick={submit} disabled={pending}>
        {pending ? 'Saving…' : 'Save entry'}
      </Button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}
