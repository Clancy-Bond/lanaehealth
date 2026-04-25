'use client'

/*
 * ReplayTourCard
 *
 * Replays the /v2/cycle 7-step coachmark tour. POSTs
 * { lastStep: 0, dismissed: false, completed: false } to
 * /api/v2/cycle/tutorial, then sends the user to /v2/cycle so the
 * tour auto-starts on the next render.
 */
import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Card } from '@/v2/components/primitives'

export default function ReplayTourCard() {
  const [busy, setBusy] = useState(false)

  const replay = async () => {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/v2/cycle/tutorial', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lastStep: 0, dismissed: false, completed: false }),
      })
    } catch {
      // Non-fatal. Replay still works once they navigate.
    }
    window.location.href = '/v2/cycle'
  }

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-md)',
            fontWeight: 'var(--v2-weight-semibold)',
          }}
        >
          Replay cycle tour
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          Walk through the 7-step coachmark tour again. Useful after a UI update or for refreshing your memory.
        </p>
        <button
          type="button"
          onClick={replay}
          disabled={busy}
          style={{
            alignSelf: 'flex-start',
            background: 'transparent',
            color: 'var(--v2-text-primary)',
            border: '1px solid var(--v2-border-subtle)',
            borderRadius: 'var(--v2-radius-full)',
            padding: 'var(--v2-space-2) var(--v2-space-3)',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-medium)',
            cursor: busy ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 'var(--v2-touch-target-min)',
          }}
        >
          <RotateCcw size={14} />
          {busy ? 'Starting...' : 'Replay tour'}
        </button>
      </div>
    </Card>
  )
}
