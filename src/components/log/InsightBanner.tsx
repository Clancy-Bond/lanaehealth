'use client'

import type { CheckInPrefill } from '@/lib/log/prefill'
import type { CyclePhase } from '@/lib/types'
import { pickPhaseInsight } from '@/lib/cycle/phase-insights'

interface InsightBannerProps {
  insight: CheckInPrefill['insight']
  currentPhase?: CyclePhase | null
  dateISO?: string
}

const CONFIDENCE_ICON: Record<'strong' | 'moderate' | 'suggestive' | 'weak', string> = {
  strong: '\u2726',
  moderate: '\u25C6',
  suggestive: '\u25C7',
  weak: '\u00B7',
}

const EVIDENCE_LABEL: Record<'clinical' | 'educational' | 'self-care', string> = {
  clinical: 'Clinical',
  educational: 'Educational',
  'self-care': 'Self care',
}

export default function InsightBanner({
  insight,
  currentPhase,
  dateISO,
}: InsightBannerProps) {
  // Resolve an optional phase-matched insight. The component can render a
  // phase insight alone, a pattern insight alone, both stacked, or nothing.
  const effectiveDate = dateISO ?? new Date().toISOString().slice(0, 10)
  const phaseInsight =
    currentPhase !== undefined ? pickPhaseInsight(currentPhase ?? null, effectiveDate) : null

  const hasPattern = !!(insight && insight.text)
  if (!hasPattern && !phaseInsight) return null

  return (
    <div className="flex flex-col gap-3">
      {hasPattern ? <PatternCard insight={insight!} /> : null}
      {phaseInsight ? (
        <div
          className="rounded-2xl p-4 text-sm"
          style={{
            background: 'linear-gradient(135deg, #F6F8F3 0%, #ECE4DA 100%)',
            border: '1px solid rgba(107, 144, 128, 0.2)',
          }}
          role="note"
          aria-label="Cycle phase insight"
        >
          <div className="flex items-start gap-3">
            <span
              className="shrink-0 text-lg leading-6"
              style={{ color: '#6B9080' }}
              aria-hidden
            >
              {'\u25CF'}
            </span>
            <div className="flex-1">
              <div
                className="text-xs font-semibold mb-1"
                style={{ color: '#6B9080', letterSpacing: '0.01em' }}
              >
                {currentPhase
                  ? `${capitalize(currentPhase)} phase`
                  : 'Cycle insight'}
                <span
                  className="ml-1 font-normal"
                  style={{ color: '#8a9f93' }}
                >
                  {`(${EVIDENCE_LABEL[phaseInsight.evidence_tag]})`}
                </span>
              </div>
              <div
                className="font-medium mb-0.5"
                style={{ color: '#3a3a3a' }}
              >
                {phaseInsight.title}
              </div>
              <div style={{ color: '#5a5a5a' }}>{phaseInsight.body}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PatternCard({ insight }: { insight: NonNullable<CheckInPrefill['insight']> }) {
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
          <div
            className="text-xs font-semibold mb-1"
            style={{ color: '#6B9080', letterSpacing: '0.01em' }}
          >
            Pattern
            {insight.confidence ? (
              <span
                className="ml-1 font-normal"
                style={{ color: '#8a9f93' }}
              >
                {`(${insight.confidence})`}
              </span>
            ) : null}
          </div>
          <div style={{ color: '#3a3a3a' }}>{insight.text}</div>
        </div>
      </div>
    </div>
  )
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
}
