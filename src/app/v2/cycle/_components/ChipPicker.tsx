'use client'

/*
 * ChipPicker
 *
 * Reusable pill/chip selector used across the expanded cycle log form.
 * Two modes:
 *
 *   mode="multi"   - multi-select: options is a set, toggle adds/removes.
 *   mode="single"  - single-select: selecting a chip replaces the value.
 *                    Tapping the active chip clears the value (nullable).
 *
 * Both modes share the same visual treatment as the existing ovulation
 * sign picker in PeriodLogFormV2 so the form reads as one piece. 44pt
 * tap target minimum on every chip.
 *
 * Extracted here because the expanded log renders the pattern in seven
 * places (symptoms, cervical mucus consistency, cervical mucus quantity,
 * bowel, bladder, sex activity, skin state) and inlining the same
 * 30-line block seven times was costing more than the helper weighs.
 */

interface ChipOption {
  value: string
  label: string
}

type ChipPickerProps =
  | {
      mode: 'multi'
      options: ChipOption[]
      values: Set<string>
      onToggle: (value: string) => void
      ariaLabel?: string
    }
  | {
      mode: 'single'
      options: ChipOption[]
      value: string | null
      onSelect: (value: string | null) => void
      ariaLabel?: string
    }

export default function ChipPicker(props: ChipPickerProps) {
  return (
    <div
      role="group"
      aria-label={props.ariaLabel}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--v2-space-2)' }}
    >
      {props.options.map((o) => {
        const active =
          props.mode === 'multi' ? props.values.has(o.value) : props.value === o.value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (props.mode === 'multi') {
                props.onToggle(o.value)
              } else {
                props.onSelect(active ? null : o.value)
              }
            }}
            style={chipStyle(active)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    minHeight: 'var(--v2-touch-target-min)',
    padding: '0 var(--v2-space-4)',
    borderRadius: 'var(--v2-radius-full)',
    background: active ? 'var(--v2-accent-primary-soft)' : 'transparent',
    color: active ? 'var(--v2-accent-primary)' : 'var(--v2-text-secondary)',
    border: `1px solid ${active ? 'var(--v2-accent-primary)' : 'var(--v2-border-strong)'}`,
    fontSize: 'var(--v2-text-sm)',
    fontWeight: 'var(--v2-weight-medium)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}
