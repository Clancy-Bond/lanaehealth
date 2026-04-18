'use client'

/**
 * ConditionTagSelector
 *
 * Multi-select chip UI that lets the user tag a symptom with zero or more
 * of Lanae's active conditions from the `active_problems` table. Ships
 * collapsed by default as a single "Tag conditions" button; expanding
 * reveals one chip per available condition.
 *
 * Controlled component. The parent owns the selected IDs and persists
 * them via `onChange`; this keeps state co-located with the broader
 * symptom-logging state in SymptomPills.
 *
 * Voice rule (non-shaming):
 *   "Tag conditions" + "Optional" subtext only. No nagging copy about
 *   untagged symptoms. An empty selection is fully valid and treated as
 *   "visible to all specialists" by the doctor views.
 */

import { useState, useCallback } from 'react'

export interface ConditionOption {
  /** active_problems.id - uuid, stable across renders */
  id: string
  /** active_problems.problem - short human label, e.g. "POTS" */
  label: string
}

interface ConditionTagSelectorProps {
  /** Full catalog of condition options to present as chips */
  conditions: ConditionOption[]
  /** Currently selected condition ids (controlled) */
  selectedIds: string[]
  /** Fired with the next full selection on every toggle */
  onChange: (nextIds: string[]) => void
  /** Optional compact layout. Defaults to false. */
  compact?: boolean
}

export default function ConditionTagSelector({
  conditions,
  selectedIds,
  onChange,
  compact = false,
}: ConditionTagSelectorProps) {
  const [expanded, setExpanded] = useState(selectedIds.length > 0)

  const isSelected = useCallback(
    (id: string) => selectedIds.includes(id),
    [selectedIds]
  )

  const toggle = useCallback(
    (id: string) => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
      onChange(next)
    },
    [selectedIds, onChange]
  )

  // Empty catalog - render nothing. No scolding, no placeholder.
  if (conditions.length === 0) return null

  // Collapsed state: single button with a gentle hint.
  if (!expanded) {
    const label =
      selectedIds.length > 0
        ? `${selectedIds.length} tagged`
        : 'Tag conditions'
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
        style={{
          background: 'var(--bg-elevated)',
          color: 'var(--text-muted)',
          border: '1px dashed var(--border)',
          minHeight: 28,
        }}
        aria-label="Tag this symptom with a condition"
      >
        <span aria-hidden="true">+</span>
        <span>{label}</span>
      </button>
    )
  }

  const chipGap = compact ? 'gap-1' : 'gap-1.5'
  const chipPad = compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'

  return (
    <div className={`flex flex-wrap items-center ${chipGap}`}>
      <span
        className="mr-1 text-[10px] uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
      >
        Tag
      </span>
      {conditions.map((cond) => {
        const active = isSelected(cond.id)
        return (
          <button
            key={cond.id}
            type="button"
            onClick={() => toggle(cond.id)}
            className={`rounded-full font-medium transition-colors ${chipPad}`}
            style={{
              background: active
                ? 'var(--accent-sage-muted)'
                : 'var(--bg-elevated)',
              color: active ? 'var(--accent-sage)' : 'var(--text-secondary)',
              border: active
                ? '1px solid var(--accent-sage)'
                : '1px solid var(--border)',
              minHeight: compact ? 24 : 28,
            }}
            aria-pressed={active}
          >
            {cond.label}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="ml-1 rounded-full px-2 py-0.5 text-[11px]"
        style={{ color: 'var(--text-muted)' }}
        aria-label="Hide condition tags"
      >
        Hide
      </button>
    </div>
  )
}
