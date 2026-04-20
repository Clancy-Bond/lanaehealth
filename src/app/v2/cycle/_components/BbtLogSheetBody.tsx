'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, SegmentedControl } from '@/v2/components/primitives'

export interface BbtLogSheetBodyProps {
  date: string
  onDone: () => void
}

type Unit = 'F' | 'C'

export default function BbtLogSheetBody({ date, onDone }: BbtLogSheetBodyProps) {
  const [unit, setUnit] = useState<Unit>('F')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const submit = () => {
    const n = Number(value)
    if (!Number.isFinite(n)) {
      setError('Enter a number')
      return
    }
    setError(null)
    startTransition(async () => {
      const body: Record<string, unknown> = { date, source: 'manual' }
      if (unit === 'F') body.temp_f = n
      else body.temp_c = n
      try {
        const res = await fetch('/api/cycle/bbt', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const msg = (await res.json().catch(() => null))?.error ?? 'Could not save'
          setError(msg)
          return
        }
        onDone()
        router.refresh()
      } catch {
        setError('Network error')
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
      <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', lineHeight: 'var(--v2-leading-relaxed)' }}>
        Measure within 30 minutes of waking, before sitting up if you can. Consistency matters more than perfection.
      </p>
      <SegmentedControl
        segments={[
          { value: 'F', label: '°F' },
          { value: 'C', label: '°C' },
        ]}
        value={unit}
        onChange={(v) => setUnit(v as Unit)}
      />
      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
          Temperature
        </span>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder={unit === 'F' ? '97.80' : '36.55'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            fontSize: 'var(--v2-text-xl)',
            fontVariantNumeric: 'tabular-nums',
            padding: 'var(--v2-space-3) var(--v2-space-4)',
            borderRadius: 'var(--v2-radius-md)',
            background: 'var(--v2-bg-card)',
            color: 'var(--v2-text-primary)',
            border: '1px solid var(--v2-border-strong)',
            fontFamily: 'inherit',
            minHeight: 52,
          }}
        />
      </label>
      {error && (
        <p style={{ margin: 0, color: 'var(--v2-accent-warning)', fontSize: 'var(--v2-text-sm)' }}>{error}</p>
      )}
      <Button variant="primary" size="lg" fullWidth onClick={submit} disabled={pending || value === ''}>
        {pending ? 'Saving…' : 'Log temperature'}
      </Button>
    </div>
  )
}
