'use client'

/**
 * HeadacheQuickLog: one-tap during-attack logging surface.
 *
 * Renders a compact card on /log with two modes:
 *   1. Idle: one big "I have a headache right now" button. Tap inserts
 *      a headache_attacks row with started_at = now() and the current
 *      cycle phase denormalized by the API layer.
 *   2. Active: shows elapsed time, pain slider 0-10, head zones,
 *      ICHD-3 aura categories, trigger/medication inputs, and an
 *      "Attack ended" button.
 *
 * Design rules:
 *   - 44px minimum touch targets per WCAG (design-decisions.md section 5)
 *   - No em dashes in any copy
 *   - Severity pain slider uses shared --pain-* tokens
 *   - Motor aura surfaces a non-blocking hemiplegic-migraine advisory
 *
 * Spec: docs/plans/2026-04-16-wave-2a-briefs.md brief A1.
 * Reference: docs/competitive/headache-diary/implementation-notes.md feature 3.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  endAttack as endAttackApi,
  getActiveAttack,
  startAttack as startAttackApi,
  updateAttack as updateAttackApi,
  type AuraCategory,
  type HeadZone,
  type HeadacheAttack,
  type HeadacheMedication,
} from '@/lib/api/headache'
import AuraCategoryPicker from './AuraCategoryPicker'
import HeadZoneMap from './HeadZoneMap'

interface HeadacheQuickLogProps {
  /**
   * Optional. When provided, the component seeds its state from this
   * attack row instead of fetching. Useful when a parent already has
   * the active attack in hand.
   */
  initialActive?: HeadacheAttack | null
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const hh = Math.floor(totalSec / 3600)
  const mm = Math.floor((totalSec % 3600) / 60)
  const ss = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`
}

function painLabel(value: number): string {
  if (value <= 2) return 'Mild'
  if (value <= 4) return 'Noticeable'
  if (value <= 6) return 'Moderate'
  if (value <= 8) return 'Severe'
  return 'Extreme'
}

function painColor(value: number): string {
  if (value <= 2) return 'var(--pain-low, #9FB8A5)'
  if (value <= 4) return 'var(--pain-mild, #C4A35A)'
  if (value <= 6) return 'var(--pain-moderate, #D4874D)'
  if (value <= 8) return 'var(--pain-severe, #C85C5C)'
  return 'var(--pain-extreme, #8B2E2E)'
}

// Trigger library mirrors common migraine triggers. Kept short so chip row
// stays one line on mobile; longer list can live in the post-attack detail
// form when that ships.
const COMMON_TRIGGERS = [
  'sleep disruption',
  'stress',
  'weather change',
  'dehydration',
  'bright light',
  'loud sound',
  'menstrual',
  'skipped meal',
  'alcohol',
  'screen time',
] as const

export default function HeadacheQuickLog({
  initialActive,
}: HeadacheQuickLogProps) {
  const [active, setActive] = useState<HeadacheAttack | null>(initialActive ?? null)
  const [loading, setLoading] = useState<boolean>(initialActive === undefined)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number>(0)

  // Draft state for fields the user edits during an active attack. These are
  // persisted via debounced updateAttack calls so the network traffic stays
  // low even when dragging the severity slider.
  const [severityDraft, setSeverityDraft] = useState<number>(0)
  const [zonesDraft, setZonesDraft] = useState<HeadZone[]>([])
  const [auraDraft, setAuraDraft] = useState<AuraCategory[]>([])
  const [triggersDraft, setTriggersDraft] = useState<string[]>([])
  const [medicationInput, setMedicationInput] = useState<string>('')

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // On mount, if we were not handed an attack, ask the API for one.
  useEffect(() => {
    if (initialActive !== undefined) return
    let cancelled = false
    ;(async () => {
      try {
        const current = await getActiveAttack()
        if (!cancelled) {
          setActive(current)
          if (current) seedDraftFromAttack(current)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Elapsed-time ticker. Only runs while an attack is active. Pauses when
  // the tab becomes hidden so we stop burning CPU in background tabs.
  useEffect(() => {
    if (!active) return

    const tick = () => {
      const startedMs = new Date(active.started_at).getTime()
      setElapsedMs(Date.now() - startedMs)
    }
    tick()

    let interval: ReturnType<typeof setInterval> | null = null
    const startTicking = () => {
      if (interval !== null) return
      interval = setInterval(tick, 1000)
    }
    const stopTicking = () => {
      if (interval === null) return
      clearInterval(interval)
      interval = null
    }

    const onVisibility = () => {
      if (document.hidden) {
        stopTicking()
      } else {
        tick()
        startTicking()
      }
    }

    startTicking()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopTicking()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active])

  const seedDraftFromAttack = useCallback((attack: HeadacheAttack) => {
    setSeverityDraft(attack.severity ?? 0)
    setZonesDraft(attack.head_zones ?? [])
    setAuraDraft(attack.aura_categories ?? [])
    setTriggersDraft(attack.triggers ?? [])
  }, [])

  const scheduleSave = useCallback(
    (attackId: string, patch: Parameters<typeof updateAttackApi>[1]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          const updated = await updateAttackApi(attackId, patch)
          setActive(updated)
        } catch (err) {
          setError((err as Error).message)
        }
      }, 400)
    },
    [],
  )

  const handleStart = useCallback(async () => {
    setStarting(true)
    setError(null)
    try {
      const attack = await startAttackApi()
      setActive(attack)
      seedDraftFromAttack(attack)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setStarting(false)
    }
  }, [seedDraftFromAttack])

  const handleEnd = useCallback(async () => {
    if (!active) return
    setEnding(true)
    setError(null)
    try {
      // Flush any pending edits first so nothing is lost.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      await updateAttackApi(active.id, {
        severity: severityDraft,
        head_zones: zonesDraft,
        aura_categories: auraDraft,
        triggers: triggersDraft,
      })
      await endAttackApi(active.id)
      setActive(null)
      setSeverityDraft(0)
      setZonesDraft([])
      setAuraDraft([])
      setTriggersDraft([])
      setMedicationInput('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnding(false)
    }
  }, [active, severityDraft, zonesDraft, auraDraft, triggersDraft])

  const handleSeverityChange = useCallback(
    (value: number) => {
      setSeverityDraft(value)
      if (active) scheduleSave(active.id, { severity: value })
    },
    [active, scheduleSave],
  )

  const handleZonesChange = useCallback(
    (zones: HeadZone[]) => {
      setZonesDraft(zones)
      if (active) scheduleSave(active.id, { head_zones: zones })
    },
    [active, scheduleSave],
  )

  const handleAuraChange = useCallback(
    (next: AuraCategory[]) => {
      setAuraDraft(next)
      if (active) scheduleSave(active.id, { aura_categories: next })
    },
    [active, scheduleSave],
  )

  const handleTriggerToggle = useCallback(
    (trigger: string) => {
      const next = triggersDraft.includes(trigger)
        ? triggersDraft.filter(t => t !== trigger)
        : [...triggersDraft, trigger]
      setTriggersDraft(next)
      if (active) scheduleSave(active.id, { triggers: next })
    },
    [active, scheduleSave, triggersDraft],
  )

  const handleMedicationAdd = useCallback(async () => {
    if (!active) return
    const trimmed = medicationInput.trim()
    if (!trimmed) return
    const entry: HeadacheMedication = {
      name: trimmed,
      time_taken: new Date().toISOString(),
    }
    const next = [...(active.medications_taken ?? []), entry]
    try {
      const updated = await updateAttackApi(active.id, { medications_taken: next })
      setActive(updated)
      setMedicationInput('')
    } catch (err) {
      setError((err as Error).message)
    }
  }, [active, medicationInput])

  if (loading) {
    return (
      <div
        style={{
          minHeight: 80,
          background: 'var(--bg-elevated, #F5F5F0)',
          borderRadius: 'var(--radius-md, 12px)',
          padding: '1rem',
        }}
        aria-busy="true"
        aria-label="Loading headache log"
      />
    )
  }

  if (!active) {
    return (
      <div
        style={{
          background: 'var(--bg-card, #FFFFFF)',
          borderRadius: 'var(--radius-md, 12px)',
          padding: '1rem',
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
        }}
      >
        <h3
          style={{
            fontSize: 'var(--text-base, 1rem)',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: 'var(--text-primary, #1A1A2E)',
          }}
        >
          Headache
        </h3>
        <p
          style={{
            fontSize: 'var(--text-sm, 0.875rem)',
            color: 'var(--text-secondary, #6B7280)',
            marginBottom: '0.75rem',
          }}
        >
          One tap starts a timed log. You can fill in zones, triggers, and
          medications as the attack unfolds.
        </p>
        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          style={{
            width: '100%',
            minHeight: 44,
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md, 12px)',
            border: 'none',
            background: 'var(--accent-sage, #6B9080)',
            color: '#FFFFFF',
            fontSize: 'var(--text-base, 1rem)',
            fontWeight: 600,
            cursor: starting ? 'wait' : 'pointer',
          }}
          aria-label="Start headache log"
        >
          {starting ? 'Starting...' : 'I have a headache right now'}
        </button>
        {error && (
          <div
            role="alert"
            style={{
              marginTop: '0.5rem',
              fontSize: 'var(--text-xs, 0.75rem)',
              color: 'var(--pain-severe, #C85C5C)',
            }}
          >
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--bg-card, #FFFFFF)',
        borderRadius: 'var(--radius-md, 12px)',
        padding: '1rem',
        boxShadow: 'var(--shadow-md, 0 2px 8px rgba(0,0,0,0.06))',
        borderLeft: `4px solid ${painColor(severityDraft)}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3
          style={{
            fontSize: 'var(--text-base, 1rem)',
            fontWeight: 600,
            color: 'var(--text-primary, #1A1A2E)',
          }}
        >
          Headache in progress
        </h3>
        <div
          style={{
            fontSize: 'var(--text-sm, 0.875rem)',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--text-secondary, #6B7280)',
          }}
          aria-live="polite"
          aria-label={`Elapsed ${formatElapsed(elapsedMs)}`}
        >
          {formatElapsed(elapsedMs)}
        </div>
      </div>

      {/* Severity slider */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 'var(--text-sm, 0.875rem)',
            color: 'var(--text-secondary, #6B7280)',
            marginBottom: '0.25rem',
          }}
        >
          <span>Pain</span>
          <span style={{ color: painColor(severityDraft), fontWeight: 600 }}>
            {severityDraft} / 10 - {painLabel(severityDraft)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={severityDraft}
          onChange={e => handleSeverityChange(Number(e.target.value))}
          aria-label="Pain severity 0 to 10"
          style={{
            width: '100%',
            accentColor: painColor(severityDraft),
          }}
        />
      </div>

      {/* Head zones */}
      <div>
        <div
          style={{
            fontSize: 'var(--text-sm, 0.875rem)',
            color: 'var(--text-secondary, #6B7280)',
            marginBottom: '0.5rem',
          }}
        >
          Where does it hurt?
        </div>
        <HeadZoneMap
          selected={zonesDraft}
          onChange={handleZonesChange}
          intensity={severityDraft}
        />
      </div>

      {/* Aura categories */}
      <div>
        <div
          style={{
            fontSize: 'var(--text-sm, 0.875rem)',
            color: 'var(--text-secondary, #6B7280)',
            marginBottom: '0.5rem',
          }}
        >
          Any aura?
        </div>
        <AuraCategoryPicker value={auraDraft} onChange={handleAuraChange} />
      </div>

      {/* Triggers */}
      <div>
        <div
          style={{
            fontSize: 'var(--text-sm, 0.875rem)',
            color: 'var(--text-secondary, #6B7280)',
            marginBottom: '0.5rem',
          }}
        >
          Possible triggers (optional)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {COMMON_TRIGGERS.map(trigger => {
            const selected = triggersDraft.includes(trigger)
            return (
              <button
                key={trigger}
                type="button"
                onClick={() => handleTriggerToggle(trigger)}
                aria-pressed={selected}
                style={{
                  minHeight: 44,
                  padding: '0.5rem 0.875rem',
                  borderRadius: 'var(--radius-full, 9999px)',
                  border: '1px solid',
                  borderColor: selected
                    ? 'var(--accent-blush, #D4A0A0)'
                    : 'var(--text-secondary, #6B7280)',
                  background: selected ? 'var(--accent-blush, #D4A0A0)' : 'transparent',
                  color: selected ? '#FFFFFF' : 'var(--text-primary, #1A1A2E)',
                  fontSize: 'var(--text-sm, 0.875rem)',
                  cursor: 'pointer',
                }}
              >
                {trigger}
              </button>
            )
          })}
        </div>
      </div>

      {/* Medication quick add */}
      <div>
        <div
          style={{
            fontSize: 'var(--text-sm, 0.875rem)',
            color: 'var(--text-secondary, #6B7280)',
            marginBottom: '0.5rem',
          }}
        >
          Medication taken (optional)
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={medicationInput}
            onChange={e => setMedicationInput(e.target.value)}
            placeholder="e.g., sumatriptan 50mg"
            aria-label="Medication name and dose"
            style={{
              flex: 1,
              minHeight: 44,
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-md, 12px)',
              border: '1px solid var(--text-secondary, #6B7280)',
              background: 'var(--bg-card, #FFFFFF)',
              fontSize: 'var(--text-sm, 0.875rem)',
              color: 'var(--text-primary, #1A1A2E)',
            }}
          />
          <button
            type="button"
            onClick={handleMedicationAdd}
            disabled={!medicationInput.trim()}
            style={{
              minHeight: 44,
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md, 12px)',
              border: 'none',
              background: 'var(--accent-sage, #6B9080)',
              color: '#FFFFFF',
              fontSize: 'var(--text-sm, 0.875rem)',
              fontWeight: 600,
              cursor: medicationInput.trim() ? 'pointer' : 'not-allowed',
              opacity: medicationInput.trim() ? 1 : 0.5,
            }}
          >
            Add
          </button>
        </div>
        {active.medications_taken && active.medications_taken.length > 0 && (
          <ul
            style={{
              marginTop: '0.5rem',
              fontSize: 'var(--text-xs, 0.75rem)',
              color: 'var(--text-secondary, #6B7280)',
              listStyle: 'none',
              padding: 0,
            }}
          >
            {active.medications_taken.map((m, idx) => (
              <li key={idx}>
                - {m.name}
                {m.time_taken ? ` at ${new Date(m.time_taken).toLocaleTimeString()}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={handleEnd}
        disabled={ending}
        style={{
          minHeight: 44,
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md, 12px)',
          border: '1px solid var(--accent-sage, #6B9080)',
          background: 'transparent',
          color: 'var(--accent-sage, #6B9080)',
          fontSize: 'var(--text-base, 1rem)',
          fontWeight: 600,
          cursor: ending ? 'wait' : 'pointer',
        }}
        aria-label="End headache log"
      >
        {ending ? 'Ending...' : 'Attack ended'}
      </button>

      {error && (
        <div
          role="alert"
          style={{
            fontSize: 'var(--text-xs, 0.75rem)',
            color: 'var(--pain-severe, #C85C5C)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
