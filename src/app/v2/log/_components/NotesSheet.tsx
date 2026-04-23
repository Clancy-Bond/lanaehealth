'use client'

/**
 * NotesSheet
 *
 * Free-text reflection for today. Persists to daily_logs.notes. Kept
 * separate from the sliders so the reader opens a dedicated space
 * for writing and is not distracted by numeric inputs.
 */
import { useEffect, useState, useTransition } from 'react'
import { updateDailyLog } from '@/lib/api/logs'
import type { DailyLog } from '@/lib/types'
import { Sheet, Button } from '@/v2/components/primitives'

export interface NotesSheetProps {
  open: boolean
  onClose: () => void
  logId: string
  initial: string | null
  onSaved: (log: DailyLog) => void
}

export default function NotesSheet({ open, onClose, logId, initial, onSaved }: NotesSheetProps) {
  const [text, setText] = useState<string>(initial ?? '')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Resync on reopen so the textarea always reflects the saved value.
  useEffect(() => {
    if (open) {
      setText(initial ?? '')
      setError(null)
    }
  }, [open, initial])

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      try {
        const trimmed = text.trim()
        const updated = await updateDailyLog(logId, { notes: trimmed || null })
        onSaved(updated)
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save. Try again in a moment.')
      }
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Today's notes">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
          Anything worth remembering about today. Context, reactions, small wins.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="How did today go?"
          aria-label="Today's notes"
          style={{
            width: '100%',
            minHeight: 140,
            padding: 'var(--v2-space-3)',
            background: 'var(--v2-bg-card)',
            color: 'var(--v2-text-primary)',
            border: '1px solid var(--v2-border)',
            borderRadius: 'var(--v2-radius-md)',
            fontSize: 'var(--v2-text-base)',
            fontFamily: 'inherit',
            lineHeight: 'var(--v2-leading-normal)',
            resize: 'vertical',
          }}
        />
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-accent-danger)' }}>
            {error}
          </p>
        )}
        <Button variant="primary" onClick={handleSave} disabled={isPending} fullWidth>
          {isPending ? 'Saving...' : 'Save notes'}
        </Button>
      </div>
    </Sheet>
  )
}
