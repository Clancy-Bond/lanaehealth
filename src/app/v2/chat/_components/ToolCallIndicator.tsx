'use client'

/*
 * ToolCallIndicator
 *
 * Live status pill rendered while the assistant is working. Now
 * driven by the SSE stream from /api/chat:
 *
 *   phase = 'connecting' -> "Reaching out..."
 *   phase = 'context'    -> "Reviewing your records..." (assembler done)
 *   phase = 'tool'       -> "Pulling Cycle..." (per tool name)
 *   phase = 'streaming'  -> "Putting it together..." (tokens flowing)
 *
 * If `phase` is not provided we fall back to the prior canned-cycle
 * behavior so legacy JSON-mode callers still see something animated.
 */
import { useEffect, useState } from 'react'

const TOOL_LABELS: Record<string, string> = {
  search_daily_logs: 'daily logs',
  search_symptoms: 'symptoms',
  get_lab_results: 'labs',
  get_oura_biometrics: 'Oura',
  get_cycle_data: 'cycle data',
  search_food_entries: 'food log',
  search_pubmed: 'PubMed',
  get_food_nutrients: 'nutrient database',
  check_drug_interactions: 'drug interactions',
  get_health_profile: 'health profile',
  get_analysis_findings: 'analysis findings',
  get_hypothesis_status: 'hypothesis tracker',
  get_next_best_actions: 'next best actions',
  get_research_context: 'research context',
}

export type ChatPhase = 'connecting' | 'context' | 'tool' | 'streaming'

interface ToolCallIndicatorProps {
  /** Current phase from the SSE stream. Optional for legacy callers. */
  phase?: ChatPhase
  /** Most recent tool name when phase === 'tool'. */
  currentTool?: string | null
  /** Approximate tokens of context loaded; shown to add transparency. */
  contextTokenEstimate?: number | null
}

const FALLBACK_STATUSES = [
  'Pulling your records',
  'Checking recent symptoms',
  'Reading cycle and sleep data',
  'Looking at relevant labs',
  'Putting the picture together',
]

function statusFor(
  phase: ChatPhase | undefined,
  currentTool: string | null | undefined,
  contextTokenEstimate: number | null | undefined,
  fallback: string,
): string {
  switch (phase) {
    case 'connecting':
      return 'Reaching out'
    case 'context': {
      if (typeof contextTokenEstimate === 'number' && contextTokenEstimate > 0) {
        const k = Math.round(contextTokenEstimate / 1000)
        return `Reviewing your records (${k}k tokens loaded)`
      }
      return 'Reviewing your records'
    }
    case 'tool': {
      if (currentTool) {
        const label = TOOL_LABELS[currentTool] ?? currentTool.replace(/_/g, ' ')
        return `Pulling ${label}`
      }
      return 'Pulling your records'
    }
    case 'streaming':
      return 'Putting it together'
    default:
      return fallback
  }
}

export default function ToolCallIndicator({
  phase,
  currentTool,
  contextTokenEstimate,
}: ToolCallIndicatorProps = {}) {
  const [idx, setIdx] = useState(0)

  // Only run the canned-cycle fallback when we have no live phase data.
  useEffect(() => {
    if (phase) return
    const id = window.setInterval(() => {
      setIdx((n) => (n + 1) % FALLBACK_STATUSES.length)
    }, 2200)
    return () => window.clearInterval(id)
  }, [phase])

  const status = statusFor(phase, currentTool, contextTokenEstimate, FALLBACK_STATUSES[idx])

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '16px 16px 16px 4px',
          background: 'var(--v2-bg-card)',
          border: '1px solid var(--v2-border-subtle)',
          boxShadow: 'var(--v2-shadow-sm)',
          minWidth: 96,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--v2-accent-primary)',
              animation: `v2ChatDot 1.2s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          paddingLeft: 4,
          fontWeight: 'var(--v2-weight-medium)',
        }}
      >
        {status}
      </span>
      <style>{`
        @keyframes v2ChatDot {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.85); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
