'use client'

import type { CheckInPrefill } from '@/lib/log/prefill'

interface CyclePhaseTipProps {
  phase: CheckInPrefill['cycle']['phase']
  cycleDay: number | null
}

const TIPS: Record<string, { label: string; tip: string; accent: string }> = {
  menstrual: {
    label: 'Period support',
    tip: 'Iron-rich foods + magnesium help with cramp intensity. Hydration extra important.',
    accent: '#D4A0A0',
  },
  follicular: {
    label: 'Energy climbing',
    tip: 'Best window for intensity. Strength work and cognitive tasks tolerate well.',
    accent: '#6B9080',
  },
  ovulatory: {
    label: 'Peak performance window',
    tip: 'Estrogen peak may improve mood + resilience. Watch cervical mucus signs.',
    accent: '#CCB167',
  },
  luteal: {
    label: 'Pre-period wind-down',
    tip: 'PMS symptoms likely. Prioritize magnesium, calcium, sleep. Reduce caffeine after noon.',
    accent: '#A67BA6',
  },
}

export default function CyclePhaseTip({ phase, cycleDay }: CyclePhaseTipProps) {
  if (!phase) return null
  const meta = TIPS[phase]
  if (!meta) return null

  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{ background: '#FFFDF9', border: `1px solid ${meta.accent}33` }}
    >
      <span
        className="shrink-0 w-1 self-stretch rounded-full"
        style={{ background: meta.accent }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold" style={{ color: meta.accent, letterSpacing: '0.01em' }}>
          {meta.label}{cycleDay ? <> &middot; day <span className="tabular">{cycleDay}</span></> : ''}
        </div>
        <p className="text-sm mt-1" style={{ color: '#3a3a3a' }}>
          {meta.tip}
        </p>
      </div>
    </div>
  )
}
