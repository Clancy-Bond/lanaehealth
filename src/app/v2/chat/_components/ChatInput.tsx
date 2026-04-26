'use client'

/*
 * ChatInput
 *
 * Composer for /v2/chat. Mirrors the legacy /chat input shape but
 * styled for v2 dark chrome. Auto-grows up to ~4 rows, submits on
 * Enter (Shift+Enter inserts a newline), and renders a teal send
 * button to keep the primary call-to-action obvious on the dark
 * surface.
 *
 * Voice button is intentionally a stub today. The legacy /chat
 * surface does not ship voice either. Including a placeholder slot
 * keeps the v2 layout stable when speech-to-text lands.
 */
import { useEffect, useRef } from 'react'
import { ArrowUp } from 'lucide-react'

interface ChatInputProps {
  value: string
  loading: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  /** Placeholder copy. Defaults to a neutral prompt. */
  placeholder?: string
}

const MAX_HEIGHT_PX = 120

export default function ChatInput({
  value,
  loading,
  onChange,
  onSubmit,
  placeholder = 'Ask about your health',
}: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the textarea, capped at MAX_HEIGHT_PX.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT_PX) + 'px'
  }, [value])

  const canSubmit = !loading && value.trim().length > 0

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSubmit) onSubmit()
    }
  }

  return (
    <div
      style={{
        flexShrink: 0,
        padding: '8px var(--v2-space-3) calc(var(--v2-space-3) + var(--v2-safe-bottom))',
        borderTop: '1px solid var(--v2-border-subtle)',
        background: 'var(--v2-bg-primary)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          background: 'var(--v2-bg-card)',
          borderRadius: 'var(--v2-radius-xl)',
          padding: '6px 6px 6px 16px',
          border: '1px solid var(--v2-border-subtle)',
        }}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={loading}
          aria-label="Ask the AI a question about your health"
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            resize: 'none',
            outline: 'none',
            fontSize: 'var(--v2-text-base)',
            lineHeight: 'var(--v2-leading-normal)',
            color: 'var(--v2-text-primary)',
            padding: '6px 0',
            maxHeight: MAX_HEIGHT_PX,
            fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          aria-label="Send message"
          style={{
            position: 'relative',
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: 'none',
            background: canSubmit ? 'var(--v2-accent-primary)' : 'var(--v2-bg-elevated)',
            color: canSubmit ? 'var(--v2-on-accent)' : 'var(--v2-text-muted)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: canSubmit ? 1 : 0.6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition:
              'background var(--v2-duration-fast) var(--v2-ease-standard), color var(--v2-duration-fast) var(--v2-ease-standard), opacity var(--v2-duration-fast) var(--v2-ease-standard)',
          }}
        >
          {/* Invisible >=44pt hit area without changing the visual button. */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 'var(--v2-touch-target-min)',
              height: 'var(--v2-touch-target-min)',
              transform: 'translate(-50%, -50%)',
            }}
          />
          <ArrowUp size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
