'use client'

import type { CheckInPrefill } from '@/lib/log/prefill'

interface InsightBannerProps {
  insight: CheckInPrefill['insight']
}

const CONFIDENCE_ICON: Record<'strong' | 'moderate' | 'suggestive' | 'weak', string> = {
  strong: '\u2726',
  moderate: '\u25C6',
  suggestive: '\u25C7',
  weak: '\u00B7',
}

export default function InsightBanner({ insight }: InsightBannerProps) {
  if (!insight || !insight.text) return null
  const icon = insight.confidence ? CONFIDENCE_ICON[insight.confidence] : '\u2726'
  return (
    <div
      className="rounded-2xl p-4 text-sm"
      style={{
        background: 'linear-gradient(135deg, #FFFDF9 0%, #F5EEE6 100%)',
        border: '1px solid rgba(107, 144, 128, 0.2)',
      }}
      role="note"
      aria-label="Pattern insight"
    >
      <div className="flex items-start gap-3">
        <span
          className="shrink-0 text-lg leading-6"
          style={{ color: '#6B9080' }}
          aria-hidden
        >
          {icon}
        </span>
        <div className="flex-1">
          <div className="text-xs font-semibold mb-1" style={{ color: '#6B9080', letterSpacing: '0.01em' }}>
            Pattern{insight.confidence ? <span className="ml-1 font-normal" style={{ color: '#8a9f93' }}>{`(${insight.confidence})`}</span> : null}
          </div>
          <div style={{ color: '#3a3a3a' }}>{insight.text}</div>
        </div>
      </div>
    </div>
  )
}
