'use client'

/**
 * EnergyModeSheet
 *
 * Three-way toggle: minimal / gentle / full. Matches the legacy
 * EnergyMode enum. Writes to daily_logs.energy_mode.
 *
 * Why this deserves its own sheet: the mode shapes downstream UX
 * (evening check-in, task suggestions), so it warrants a paused
 * decision rather than a drive-by tap.
 */
import { useEffect, useState, useTransition } from 'react'
import { updateDailyLog } from '@/lib/api/logs'
import type { DailyLog, EnergyMode } from '@/lib/types'
import { Sheet, Button, Card } from '@/v2/components/primitives'

export interface EnergyModeSheetProps {
  open: boolean
  onClose: () => void
  logId: string
  initial: EnergyMode | null
  onSaved: (log: DailyLog) => void
}

interface ModeOption {
  value: EnergyMode
  label: string
  description: string
}

const MODES: ModeOption[] = [
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Resting day. Log only what takes no effort.',
  },
  {
    value: 'gentle',
    label: 'Gentle',
    description: 'A middle pace. Short check-ins are enough.',
  },
  {
    value: 'full',
    label: 'Full',
    description: 'Capacity feels available. Log as much as is useful.',
  },
]

export default function EnergyModeSheet({ open, onClose, logId, initial, onSaved }: EnergyModeSheetProps) {
  const [selected, setSelected] = useState<EnergyMode | null>(initial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Resync on reopen so the radio reflects the saved value, not the draft.
  useEffect(() => {
    if (open) {
      setSelected(initial)
      setError(null)
    }
  }, [open, initial])

  const handleSave = () => {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      try {
        const updated = await updateDailyLog(logId, { energy_mode: selected })
        onSaved(updated)
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save. Try again in a moment.')
      }
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Today's mode">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
          Picking a mode scales the rest of the app to match what feels realistic today.
        </p>
        <div role="radiogroup" aria-label="Today's mode" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        {MODES.map((mode) => {
          const isSelected = selected === mode.value
          return (
            <Card
              key={mode.value}
              padding="md"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(mode.value)}
              style={{
                cursor: 'pointer',
                borderColor: isSelected ? 'var(--v2-accent-primary)' : 'var(--v2-border-subtle)',
                borderWidth: isSelected ? 2 : 1,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
                <span
                  style={{
                    fontSize: 'var(--v2-text-base)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: isSelected ? 'var(--v2-accent-primary)' : 'var(--v2-text-primary)',
                  }}
                >
                  {mode.label}
                </span>
                <span
                  style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)', lineHeight: 'var(--v2-leading-normal)' }}
                >
                  {mode.description}
                </span>
              </div>
            </Card>
          )
        })}
        </div>
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-accent-danger)' }}>
            {error}
          </p>
        )}
        <Button variant="primary" onClick={handleSave} disabled={isPending || !selected} fullWidth>
          {isPending ? 'Saving...' : 'Set today\u2019s mode'}
        </Button>
      </div>
    </Sheet>
  )
}
