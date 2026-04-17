'use client'

import { useState } from 'react'
import type { DailyLog, Symptom } from '@/lib/types'
import type { CheckInPrefill } from '@/lib/log/prefill'

interface ShareDailySummaryProps {
  log: DailyLog
  prefill: CheckInPrefill
  symptoms: Symptom[]
}

function buildSummary(log: DailyLog, prefill: CheckInPrefill, symptoms: Symptom[]): string {
  const lines: string[] = []
  lines.push(`LanaeHealth Daily Summary \u2014 ${prefill.date}`)
  lines.push('')

  if (log.overall_pain !== null) lines.push(`Pain: ${log.overall_pain}/10`)
  if (log.fatigue !== null) lines.push(`Fatigue: ${log.fatigue}/10`)
  if (log.stress !== null) lines.push(`Stress: ${log.stress}/10`)
  if (log.sleep_quality !== null) lines.push(`Sleep quality: ${log.sleep_quality}/10`)

  if (prefill.oura) {
    lines.push('')
    lines.push('Oura last night:')
    if (prefill.oura.sleep_score !== null) lines.push(`  Sleep score: ${prefill.oura.sleep_score}/100`)
    if (prefill.oura.hrv_avg !== null) lines.push(`  HRV avg: ${prefill.oura.hrv_avg} ms`)
    if (prefill.oura.resting_hr !== null) lines.push(`  Resting HR: ${prefill.oura.resting_hr} bpm`)
  }

  if (prefill.cycle.phase || prefill.cycle.day) {
    lines.push('')
    lines.push(`Cycle: day ${prefill.cycle.day ?? '?'} (${prefill.cycle.phase ?? 'unknown phase'})`)
    if (prefill.cycle.flow) lines.push(`  Flow: ${prefill.cycle.flow}`)
  }

  if (symptoms.length > 0) {
    lines.push('')
    lines.push('Symptoms today:')
    for (const s of symptoms) {
      const sev = s.severity ? ` (${s.severity})` : ''
      lines.push(`  - ${s.symptom}${sev}`)
    }
  }

  if ((log.triggers ?? '').includes('[FLARE]')) {
    lines.push('')
    lines.push('\u26A0\uFE0F FLARE DAY \u2014 flagged for doctor review')
  }

  if (log.notes) {
    lines.push('')
    lines.push(`Notes: ${log.notes}`)
  }

  if (prefill.insight) {
    lines.push('')
    lines.push(`Pattern: ${prefill.insight.text}`)
  }

  return lines.join('\n')
}

export default function ShareDailySummary({ log, prefill, symptoms }: ShareDailySummaryProps) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    const text = buildSummary(log, prefill, symptoms)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback: select textarea + execCommand
    }
  }

  const onShare = async () => {
    const text = buildSummary(log, prefill, symptoms)
    if (navigator.share) {
      try {
        await navigator.share({ title: `Daily summary ${prefill.date}`, text })
      } catch {
        onCopy()
      }
    } else {
      onCopy()
    }
  }

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <span
        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-base"
        style={{ background: 'rgba(107, 144, 128, 0.1)', color: '#6B9080' }}
        aria-hidden
      >
        &#x1F4CB;
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: '#3a3a3a' }}>
          Share today&apos;s summary
        </div>
        <div className="text-xs mt-0.5" style={{ color: '#8a8a8a' }}>
          Text for your doctor or family &mdash; one tap
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: copied ? '#6B9080' : 'transparent', color: copied ? '#fff' : '#6B9080', border: '1px solid #6B9080' }}
        >
          {copied ? '\u2713 Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: '#6B9080', color: '#fff' }}
        >
          Share
        </button>
      </div>
    </div>
  )
}
