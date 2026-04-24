'use client'

/*
 * ToolCallIndicator
 *
 * Inline status pill rendered while the assistant is working. The
 * /api/chat backend resolves before returning, so we cannot show
 * tool-by-tool progress in real time. Instead, we cycle through a
 * short list of friendly status messages so the user knows the
 * model is pulling data, not stuck.
 *
 * Once the backend gains true streaming with intermediate tool-use
 * events, this component will swap to a per-tool list driven by
 * the SSE stream. The component shape is intentionally simple so
 * that swap stays small.
 */
import { useEffect, useState } from 'react'

const STATUSES = [
  'Pulling your records',
  'Checking recent symptoms',
  'Reading cycle and sleep data',
  'Looking at relevant labs',
  'Putting the picture together',
]

export default function ToolCallIndicator() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((n) => (n + 1) % STATUSES.length)
    }, 2200)
    return () => window.clearInterval(id)
  }, [])

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
        {STATUSES[idx]}
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
