'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  getScaleQuestions,
  getMaxScore,
  scoreScale,
  getSeverityColor,
  getSeverityLabel,
  RESPONSE_LABELS,
} from '@/lib/clinical-scales'
import type { ClinicalScaleResponse, ClinicalScaleType } from '@/lib/types'

interface ClinicalScaleCardProps {
  logId: string
  scaleType: ClinicalScaleType
  initialResponse: ClinicalScaleResponse | null
}

export default function ClinicalScaleCard({
  logId,
  scaleType,
  initialResponse,
}: ClinicalScaleCardProps) {
  const questions = getScaleQuestions(scaleType)
  const maxScore = getMaxScore(scaleType)

  const [responses, setResponses] = useState<(number | null)[]>(() => {
    if (initialResponse?.responses) {
      return initialResponse.responses
    }
    return new Array(questions.length).fill(null)
  })

  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // Compute running total from non-null responses
  const answeredResponses = responses.filter((r): r is number => r !== null)
  const allAnswered = answeredResponses.length === questions.length
  const runningTotal = answeredResponses.reduce((sum, val) => sum + val, 0)
  const currentResult = allAnswered ? scoreScale(scaleType, responses as number[]) : null

  const handleSave = useCallback(
    async (finalResponses: number[]) => {
      const result = scoreScale(scaleType, finalResponses)
      const today = new Date().toISOString().split('T')[0]

      try {
        const res = await fetch('/api/clinical-scales/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            log_id: logId,
            scale_type: scaleType,
            date: today,
            responses: finalResponses,
            total_score: result.total_score,
            severity: result.severity,
          }),
        })

        if (res.ok) {
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        }
      } catch {
        // Silently fail, user can retry
      }
    },
    [logId, scaleType]
  )

  const setResponse = useCallback(
    (questionIndex: number, value: number) => {
      setResponses((prev) => {
        const next = [...prev]
        next[questionIndex] = value

        // Auto-save when all questions are answered
        const allDone = next.every((r) => r !== null)
        if (allDone) {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(() => {
            handleSave(next as number[])
          }, 300)
        }

        return next
      })
    },
    [handleSave]
  )

  // Scale display name
  const scaleName = scaleType === 'PHQ-9' ? 'Depression (PHQ-9)' : 'Anxiety (GAD-7)'

  // Summary line for collapsed state
  const summaryText = currentResult
    ? `Score: ${currentResult.total_score}/${maxScore} - ${getSeverityLabel(currentResult.severity)}`
    : answeredResponses.length > 0
      ? `${answeredResponses.length}/${questions.length} answered`
      : 'Tap to begin'

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '1rem',
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
      }}
    >
      {/* Header - always visible, tap to expand */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--accent-sage-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {scaleType === 'PHQ-9' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 15h8" />
                <circle cx="9" cy="9" r="1" fill="currentColor" />
                <circle cx="15" cy="9" r="1" fill="currentColor" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                <path d="M12 8v4l3 3" />
              </svg>
            )}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {scaleName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: currentResult
                  ? getSeverityColor(currentResult.severity)
                  : 'var(--text-muted)',
                marginTop: 1,
              }}
            >
              {summaryText}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saved && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--accent-sage)',
                fontWeight: 500,
              }}
            >
              Saved
            </span>
          )}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{
              color: 'var(--text-muted)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms ease',
            }}
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Instruction */}
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 1.4,
              marginBottom: 14,
              padding: '8px 12px',
              background: 'var(--bg-elevated)',
              borderRadius: 10,
            }}
          >
            Over the last 2 weeks, how often have you been bothered by the following problems?
          </p>

          {/* Response labels row (sticky reference) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 44px)',
                gap: 4,
                textAlign: 'center',
              }}
            >
              {RESPONSE_LABELS.map((label) => (
                <span
                  key={label}
                  style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    lineHeight: 1.2,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Questions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {questions.map((q) => (
              <div
                key={q.index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: q.index < questions.length - 1
                    ? '1px solid var(--border-light)'
                    : 'none',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    lineHeight: 1.35,
                  }}
                >
                  {q.index + 1}. {q.text}
                </span>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 44px)',
                    gap: 4,
                  }}
                >
                  {[0, 1, 2, 3].map((value) => {
                    const isSelected = responses[q.index] === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setResponse(q.index, value)}
                        style={{
                          width: 44,
                          height: 36,
                          borderRadius: 8,
                          border: isSelected
                            ? '2px solid var(--accent-sage)'
                            : '1px solid var(--border)',
                          background: isSelected
                            ? 'var(--accent-sage-muted)'
                            : 'var(--bg-elevated)',
                          color: isSelected
                            ? 'var(--accent-sage)'
                            : 'var(--text-secondary)',
                          fontSize: 14,
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Running total / result */}
          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              background: 'var(--bg-elevated)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                }}
              >
                Score
              </span>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  lineHeight: 1.1,
                }}
              >
                {runningTotal}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: 'var(--text-muted)',
                  }}
                >
                  /{maxScore}
                </span>
              </div>
            </div>

            {currentResult && (
              <div
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fff',
                  background: getSeverityColor(currentResult.severity),
                }}
              >
                {getSeverityLabel(currentResult.severity)}
              </div>
            )}

            {!allAnswered && answeredResponses.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}
              >
                {questions.length - answeredResponses.length} remaining
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
