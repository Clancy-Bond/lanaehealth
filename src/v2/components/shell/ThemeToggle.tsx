'use client'

/*
 * ThemeToggle
 *
 * Three-state segmented control: Dark / Light / System. Mirrors the
 * shape of SegmentedControl but renders an icon above each label so
 * the choice scans at a glance, the way iOS Settings shows it.
 *
 * Backed by useV2Theme: writes localStorage and flips data-theme
 * on the .v2 root through the hook so the change is instant.
 *
 * This is a foundation primitive (touches v2 chrome). User
 * authorized this edit as part of the critical UX fix that landed
 * the whole light theme.
 */
import { Moon, Sun, Monitor } from 'lucide-react'
import { useV2Theme, type V2Theme } from '@/app/v2/_lib/useV2Theme'

interface SegmentDef {
  value: V2Theme
  label: string
  Icon: typeof Sun
}

const SEGMENTS: SegmentDef[] = [
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
]

export default function ThemeToggle() {
  const { theme, setTheme } = useV2Theme()

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 4,
        padding: 4,
        background: 'var(--v2-bg-card)',
        borderRadius: 'var(--v2-radius-md)',
        border: '1px solid var(--v2-border-subtle)',
      }}
    >
      {SEGMENTS.map(({ value, label, Icon }) => {
        const isActive = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(value)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              minHeight: 56,
              padding: 'var(--v2-space-2) var(--v2-space-2)',
              border: 0,
              borderRadius: 'var(--v2-radius-sm)',
              background: isActive ? 'var(--v2-bg-elevated)' : 'transparent',
              color: isActive ? 'var(--v2-text-primary)' : 'var(--v2-text-secondary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition:
                'background var(--v2-duration-fast) var(--v2-ease-standard), color var(--v2-duration-fast) var(--v2-ease-standard)',
              boxShadow: isActive ? 'var(--v2-shadow-sm)' : 'none',
            }}
          >
            <Icon size={18} aria-hidden />
            <span
              style={{
                fontSize: 'var(--v2-text-sm)',
                fontWeight: isActive
                  ? 'var(--v2-weight-semibold)'
                  : 'var(--v2-weight-medium)',
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
