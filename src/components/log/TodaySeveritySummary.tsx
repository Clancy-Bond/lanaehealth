'use client'

import type { CheckInPrefill } from '@/lib/log/prefill'

interface TodaySeveritySummaryProps {
  severity: CheckInPrefill['todaySeverity']
}

const TONE: Record<'severe' | 'moderate' | 'mild', { bg: string; fg: string; label: string }> = {
  severe:   { bg: '#A66B6B', fg: '#fff',    label: 'Severe day' },
  moderate: { bg: '#D4A0A0', fg: '#fff',    label: 'Moderate day' },
  mild:     { bg: '#E8D5B7', fg: '#3a2e1f', label: 'Mild day' },
}

export default function TodaySeveritySummary({ severity }: TodaySeveritySummaryProps) {
  if (severity.count === 0) return null
  const tone = severity.highest ? TONE[severity.highest] : TONE.moderate
  const preview = severity.names.slice(0, 4).join(', ')
  const overflow = severity.names.length > 4 ? `, +${severity.names.length - 4}` : ''

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <div
        className="shrink-0 px-3 py-2 rounded-full text-xs font-semibold"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {tone.label}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: '#3a3a3a' }}>
          {severity.count} symptom{severity.count === 1 ? '' : 's'} logged today
        </div>
        <div className="text-xs truncate" style={{ color: '#8a8a8a' }}>
          {preview}{overflow}
        </div>
      </div>
      {severity.severe > 0 || severity.moderate > 0 || severity.mild > 0 ? (
        <div className="flex gap-1 text-[10px] shrink-0">
          {severity.severe > 0 ? <span className="px-1.5 py-0.5 rounded" style={{ background: '#A66B6B', color: '#fff' }}>{severity.severe}</span> : null}
          {severity.moderate > 0 ? <span className="px-1.5 py-0.5 rounded" style={{ background: '#D4A0A0', color: '#fff' }}>{severity.moderate}</span> : null}
          {severity.mild > 0 ? <span className="px-1.5 py-0.5 rounded" style={{ background: '#E8D5B7', color: '#3a2e1f' }}>{severity.mild}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
