'use client'

/*
 * Toggle
 *
 * iOS-style switch. 52×32 hit target, 28×28 thumb, 200ms thumb
 * transition. Matches the existing MedicationReminders toggle
 * styling so v1 and v2 visually agree during rollout.
 */
import { useState } from 'react'

export interface ToggleProps {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  label?: string
  /**
   * Accessible name when no visible label is rendered (e.g. the Toggle
   * sits beside a separate piece of explanatory copy). Without this
   * the screen reader reads "switch, on" with no context.
   */
  ariaLabel?: string
  disabled?: boolean
}

export default function Toggle({ checked, defaultChecked, onChange, label, ariaLabel, disabled }: ToggleProps) {
  const [internal, setInternal] = useState(defaultChecked ?? false)
  const isOn = checked ?? internal

  const toggle = () => {
    if (disabled) return
    const next = !isOn
    if (checked === undefined) setInternal(next)
    onChange?.(next)
  }

  // Resolve the accessible name. Prefer the explicit ariaLabel, then
  // the visible label (which the wrapping <label> would also provide,
  // but being explicit silences screen-reader edge cases), then a
  // sensible default so the button is never anonymous.
  const name = ariaLabel ?? label ?? 'Toggle'

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--v2-space-3)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      {label && <span style={{ fontSize: 'var(--v2-text-base)', color: 'var(--v2-text-primary)' }}>{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={name}
        disabled={disabled}
        onClick={toggle}
        style={{
          width: 52,
          height: 32,
          borderRadius: 'var(--v2-radius-full)',
          border: 'none',
          background: isOn ? 'var(--v2-accent-primary)' : 'var(--v2-border-strong)',
          padding: 2,
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background var(--v2-duration-medium) var(--v2-ease-standard)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: isOn ? 22 : 2,
            width: 28,
            height: 28,
            borderRadius: 'var(--v2-radius-full)',
            background: 'var(--v2-text-primary)',
            boxShadow: 'var(--v2-shadow-sm)',
            transition: 'left var(--v2-duration-medium) var(--v2-ease-emphasized)',
          }}
        />
      </button>
    </label>
  )
}
