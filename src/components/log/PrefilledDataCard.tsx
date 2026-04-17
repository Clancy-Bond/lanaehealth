'use client'

import { useState } from 'react'

type Verdict = 'matches' | 'worse' | 'better'

interface PrefilledDataCardProps {
  title: string
  subtitle?: string
  stats: Array<{ label: string; value: string; accent?: boolean }>
  onVerdict?: (v: Verdict) => void
  initialVerdict?: Verdict | null
}

const chipStyles: Record<Verdict, { bg: string; text: string; label: string }> = {
  matches: { bg: '#6B9080', text: '#fff', label: 'Matches' },
  worse:   { bg: '#D4A0A0', text: '#fff', label: 'Felt worse' },
  better:  { bg: '#E8D5B7', text: '#3a2e1f', label: 'Felt better' },
}

export default function PrefilledDataCard({
  title,
  subtitle,
  stats,
  onVerdict,
  initialVerdict = null,
}: PrefilledDataCardProps) {
  const [verdict, setVerdict] = useState<Verdict | null>(initialVerdict)

  const pick = (v: Verdict) => {
    setVerdict(v)
    onVerdict?.(v)
  }

  return (
    <div
      className="rounded-2xl p-5 shadow-sm"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold" style={{ color: '#3a3a3a' }}>{title}</h3>
        {subtitle ? (
          <span className="text-xs" style={{ color: '#8a8a8a' }}>{subtitle}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {stats.map(s => (
          <div key={s.label} className="flex flex-col">
            <span className="text-xs" style={{ color: '#8a8a8a', letterSpacing: '0.01em' }}>
              {s.label}
            </span>
            <span
              className="tabular text-xl font-semibold mt-1"
              style={{ color: s.accent ? '#6B9080' : '#3a3a3a' }}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {onVerdict ? (
        <div className="flex gap-2">
          {(['matches', 'worse', 'better'] as Verdict[]).map(v => {
            const s = chipStyles[v]
            const active = verdict === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => pick(v)}
                className="press-feedback flex-1 py-2 rounded-full text-sm font-medium"
                style={{
                  background: active ? s.bg : 'transparent',
                  color: active ? s.text : '#6a6a6a',
                  border: `1px solid ${active ? s.bg : 'rgba(107, 144, 128, 0.25)'}`,
                  transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)`,
                }}
                aria-pressed={active}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
