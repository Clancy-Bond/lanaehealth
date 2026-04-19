'use client'

/**
 * Single-screen period log form.
 *
 * FAB destination. Deliberately terse: one scroll, big targets, one save
 * button at the bottom. Flow level doubles as 0 = no period so the user
 * can "log a no-period day" too, matching the way Natural Cycles treats
 * every day as a log opportunity.
 *
 * Symptoms are a carousel of chips (multi-select). We don't collect pain
 * intensity here; that's /log's job. This form is cycle-specific.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { FlowLevel } from '@/lib/types'
import { Droplet, CheckCircle2 } from 'lucide-react'

export interface PeriodLogFormProps {
  date: string
  initialFlow: FlowLevel | null
  initialMenstruation: boolean
  initialOvulationSigns: string[]
  initialLh: string
  initialMucusConsistency: string | null
  initialMucusQuantity: string | null
  initialNotes: string
  /** Whether endo-mode columns exist for this user. */
  endoMode: boolean
}

const FLOW_OPTIONS: Array<{ value: FlowLevel; label: string; description: string; score: number }> = [
  { value: 'none', label: 'None', description: 'No bleeding', score: 0 },
  { value: 'spotting', label: 'Spotting', description: 'Few drops', score: 1 },
  { value: 'light', label: 'Light', description: 'Below typical', score: 2 },
  { value: 'medium', label: 'Medium', description: 'Typical flow', score: 3 },
  { value: 'heavy', label: 'Heavy', description: 'Above typical', score: 4 },
]

const OVULATION_SIGNS = [
  'mittelschmerz',
  'mid_cycle_pain',
  'energy_high',
  'libido_up',
  'breast_tender',
  'bloating',
]

const SIGN_LABELS: Record<string, string> = {
  mittelschmerz: 'Ovulation pain',
  mid_cycle_pain: 'Mid-cycle ache',
  energy_high: 'Energy up',
  libido_up: 'Libido up',
  breast_tender: 'Breast tender',
  bloating: 'Bloating',
}

const MUCUS_CONSISTENCY = ['none', 'sticky', 'creamy', 'watery', 'egg_white']
const MUCUS_QUANTITY = ['none', 'light', 'moderate', 'heavy']

export function PeriodLogForm({
  date,
  initialFlow,
  initialMenstruation,
  initialOvulationSigns,
  initialLh,
  initialMucusConsistency,
  initialMucusQuantity,
  initialNotes,
  endoMode,
}: PeriodLogFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [flow, setFlow] = useState<FlowLevel>(
    initialFlow ?? (initialMenstruation ? 'medium' : 'none'),
  )
  const [signs, setSigns] = useState<Set<string>>(new Set(initialOvulationSigns))
  const [lh, setLh] = useState<string>(initialLh || 'not_taken')
  const [mucusConsistency, setMucusConsistency] = useState<string>(initialMucusConsistency ?? 'none')
  const [mucusQuantity, setMucusQuantity] = useState<string>(initialMucusQuantity ?? 'none')
  const [notes, setNotes] = useState(initialNotes)

  const toggleSign = (sign: string) => {
    setSigns((prev) => {
      const next = new Set(prev)
      if (next.has(sign)) next.delete(sign)
      else next.add(sign)
      return next
    })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const body = {
      date,
      flow_level: flow,
      menstruation: flow !== 'none' && flow !== 'spotting',
      ovulation_signs: Array.from(signs).join(','),
      lh_test_result: lh,
      cervical_mucus_consistency: mucusConsistency === 'none' ? null : mucusConsistency,
      cervical_mucus_quantity: mucusQuantity === 'none' ? null : mucusQuantity,
      endo_notes: endoMode && notes.trim() ? notes.trim() : null,
    }
    startTransition(async () => {
      const res = await fetch('/api/cycle/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Save failed.' }))
        setError(j?.error ?? 'Save failed.')
        return
      }
      setSaved(true)
      router.refresh()
      setTimeout(() => router.push('/cycle?saved=1'), 400)
    })
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Section title="Flow">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          {FLOW_OPTIONS.map((o) => {
            const active = flow === o.value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setFlow(o.value)}
                className="press-feedback"
                aria-pressed={active}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: active ? 'var(--phase-menstrual)' : 'var(--bg-elevated)',
                  color: active ? 'var(--text-inverse)' : 'var(--text-primary)',
                  border: '1px solid',
                  borderColor: active ? 'var(--phase-menstrual)' : 'var(--border-light)',
                  cursor: 'pointer',
                  minHeight: 60,
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Droplet size={14} style={{ opacity: active ? 1 : 0.6 }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{o.label}</span>
                  <span
                    className="tabular"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      opacity: 0.7,
                      marginLeft: 'auto',
                    }}
                  >
                    {o.score}
                  </span>
                </div>
                <span style={{ fontSize: 11, opacity: active ? 0.9 : 0.7 }}>{o.description}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Ovulation signs" caption="Multi-select. Track anything you notice today.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {OVULATION_SIGNS.map((s) => {
            const active = signs.has(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSign(s)}
                className="press-feedback"
                aria-pressed={active}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: active ? 'var(--accent-sage)' : 'var(--bg-elevated)',
                  color: active ? 'var(--text-inverse)' : 'var(--text-primary)',
                  border: '1px solid',
                  borderColor: active ? 'var(--accent-sage)' : 'var(--border-light)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  minHeight: 38,
                }}
              >
                {SIGN_LABELS[s]}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="LH test">
        <SegmentedControl
          value={lh}
          onChange={setLh}
          options={[
            { value: 'not_taken', label: 'Not tested' },
            { value: 'negative', label: 'Negative' },
            { value: 'positive', label: 'Positive' },
          ]}
          accents={{ positive: 'var(--phase-ovulatory)', negative: 'var(--accent-sage)' }}
        />
      </Section>

      <Section title="Cervical mucus" caption="Optional but a strong fertility signal.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SegmentedControl
            value={mucusConsistency}
            onChange={setMucusConsistency}
            label="Consistency"
            options={MUCUS_CONSISTENCY.map((v) => ({ value: v, label: mucusLabel(v) }))}
          />
          <SegmentedControl
            value={mucusQuantity}
            onChange={setMucusQuantity}
            label="Quantity"
            options={MUCUS_QUANTITY.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))}
          />
        </div>
      </Section>

      {endoMode && (
        <Section title="Notes" caption="Optional. Extra details for your doctor.">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything a doctor might find useful..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--border-light)',
              background: 'var(--bg-input)',
              fontSize: 14,
              lineHeight: 1.4,
              resize: 'vertical',
              minHeight: 80,
            }}
          />
        </Section>
      )}

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          paddingTop: 12,
          marginTop: 4,
          background: 'linear-gradient(180deg, rgba(250,250,247,0) 0%, var(--bg-primary) 40%)',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <button
          type="submit"
          disabled={pending}
          className="press-feedback"
          style={{
            flex: '1 1 160px',
            minHeight: 48,
            padding: '12px 18px',
            borderRadius: 12,
            background: saved ? 'var(--accent-sage)' : 'var(--phase-menstrual)',
            color: 'var(--text-inverse)',
            border: 'none',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.02em',
            cursor: pending ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: pending ? 0.7 : 1,
            textTransform: 'uppercase',
          }}
        >
          {saved ? (
            <>
              <CheckCircle2 size={16} /> Saved
            </>
          ) : pending ? (
            'Saving...'
          ) : (
            'Save entry'
          )}
        </button>
        <Link
          href="/cycle"
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            color: 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Cancel
        </Link>
      </div>

      {error && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--phase-menstrual)' }}>
          {error}
        </div>
      )}
    </form>
  )
}

function Section({
  title,
  caption,
  children,
}: {
  title: string
  caption?: string
  children: React.ReactNode
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {title}
        </div>
        {caption && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>
            {caption}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

function SegmentedControl({
  value,
  onChange,
  options,
  label,
  accents = {},
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  label?: string
  accents?: Record<string, string>
}) {
  return (
    <div>
      {label && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 4,
          }}
        >
          {label}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((o) => {
          const active = value === o.value
          const accent = accents[o.value] ?? 'var(--accent-sage)'
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={active}
              className="press-feedback"
              style={{
                flex: '1 1 90px',
                padding: '10px 12px',
                borderRadius: 10,
                background: active ? accent : 'var(--bg-elevated)',
                color: active ? 'var(--text-inverse)' : 'var(--text-primary)',
                border: '1px solid',
                borderColor: active ? accent : 'var(--border-light)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                minHeight: 40,
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function mucusLabel(v: string): string {
  return v === 'egg_white' ? 'Egg white' : v.charAt(0).toUpperCase() + v.slice(1)
}
