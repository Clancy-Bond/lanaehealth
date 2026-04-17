'use client'

/**
 * AuraCategoryPicker: multi-select of the 4 ICHD-3 aura categories with
 * subtle iconography and a non-diagnostic hemiplegic-migraine advisory
 * attached to the motor option.
 *
 * Replaces the inline aura chip block that lived in HeadacheQuickLog.
 * Pulled into its own component so the same picker can later render in:
 *   - post-attack detail form
 *   - share/export card
 *   - pre-visit doctor prep sheet
 *
 * Design rules (docs/competitive/design-decisions.md sec 5):
 *   - 44px minimum touch targets (WCAG)
 *   - Warm Modern tokens (sage/blush/cream)
 *   - No em dashes in copy
 *
 * Voice rule (docs/plans/2026-04-16-non-shaming-voice-rule.md):
 *   - Motor aura advisory is informational only; user can still save
 *   - Copy is "If first time or lasts 24h, contact your doctor" NOT
 *     "you may have hemiplegic migraine"
 *
 * Clinical reference: ICHD-3 criterion 1.2 (Migraine with aura).
 *
 * Spec: docs/plans/2026-04-17-wave-2b-briefs.md brief A2.
 */

import { useMemo, type ReactNode } from 'react'
import { AURA_CATEGORIES, type AuraCategory } from '@/lib/api/headache'
import {
  getHemiplegicAdvisory,
  type HemiplegicAdvisory,
} from '@/lib/clinical-advisories/hemiplegic-migraine'

// ── Icon components ────────────────────────────────────────────────────
// Inline SVGs so we do not pull another icon dep. Stroke-based, matched
// weight to Lucide defaults (1.5). Decorative only; aria-hidden is on
// the parent button so screen readers read the label text, not the icon.

function VisualIcon(): ReactNode {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  )
}

function SensoryIcon(): ReactNode {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 11.5V6a3 3 0 0 1 6 0v5.5" />
      <path d="M9 11.5a3 3 0 0 0-3 3V18a5 5 0 0 0 10 0v-3.5a3 3 0 0 0-3-3" />
      <path d="M12 14v4" />
    </svg>
  )
}

function SpeechIcon(): ReactNode {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h16v10H8l-4 4V6z" />
      <path d="M9 11h.01" />
      <path d="M13 11h.01" />
      <path d="M17 11h.01" />
    </svg>
  )
}

function MotorIcon(): ReactNode {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx={12} cy={5} r={2} />
      <path d="M12 7v6" />
      <path d="M8 11l4 2 4-2" />
      <path d="M9 21l3-8 3 8" />
    </svg>
  )
}

// ── Category metadata ──────────────────────────────────────────────────

interface CategoryMeta {
  category: AuraCategory
  /** Plain-language headline visible on the chip. */
  label: string
  /** One-line descriptor shown beneath the label. */
  description: string
  /** Icon component. */
  Icon: () => ReactNode
}

const CATEGORY_META: Record<AuraCategory, CategoryMeta> = {
  visual: {
    category: 'visual',
    label: 'Visual',
    description: 'Zigzags, blur, spots, loss of vision',
    Icon: VisualIcon,
  },
  sensory: {
    category: 'sensory',
    label: 'Sensory',
    description: 'Tingling, numbness, pins and needles',
    Icon: SensoryIcon,
  },
  speech: {
    category: 'speech',
    label: 'Speech',
    description: 'Word finding, slurring, language trouble',
    Icon: SpeechIcon,
  },
  motor: {
    category: 'motor',
    label: 'Motor',
    description: 'Weakness on one side of the body',
    Icon: MotorIcon,
  },
}

// ── Props ──────────────────────────────────────────────────────────────

export interface AuraCategoryPickerProps {
  /** Currently selected aura categories. */
  value: AuraCategory[]
  /** Called with the next selection. Parent owns state. */
  onChange: (next: AuraCategory[]) => void
  /**
   * Optional overrides for the hemiplegic advisory context. When the
   * parent knows the attack is first-time or already past 24 hours the
   * urgent variant is surfaced.
   */
  advisoryOptions?: { firstTime?: boolean; durationHours?: number }
  /** Disable all interaction (used during save flush). */
  disabled?: boolean
}

// ── Pure helpers (exported for tests) ──────────────────────────────────

/**
 * Toggle membership of a category within the selection array. Order is
 * preserved; the newly added category is appended.
 */
export function toggleAura(
  current: AuraCategory[],
  cat: AuraCategory,
): AuraCategory[] {
  return current.includes(cat)
    ? current.filter(c => c !== cat)
    : [...current, cat]
}

/**
 * Decide whether the hemiplegic advisory should render given a selection.
 * Pulled out so the same rule can be reused by analytics or narrative
 * generation.
 */
export function shouldShowHemiplegicAdvisory(
  selection: AuraCategory[],
): boolean {
  return selection.includes('motor')
}

// ── Component ──────────────────────────────────────────────────────────

export default function AuraCategoryPicker({
  value,
  onChange,
  advisoryOptions,
  disabled = false,
}: AuraCategoryPickerProps) {
  const advisory = useMemo<HemiplegicAdvisory>(
    () => getHemiplegicAdvisory(advisoryOptions ?? {}),
    [advisoryOptions],
  )

  const motorSelected = shouldShowHemiplegicAdvisory(value)

  const handleToggle = (cat: AuraCategory) => {
    if (disabled) return
    onChange(toggleAura(value, cat))
  }

  return (
    <div>
      <div
        role="group"
        aria-label="Aura categories"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '0.5rem',
        }}
      >
        {AURA_CATEGORIES.map(cat => {
          const meta = CATEGORY_META[cat]
          const selected = value.includes(cat)
          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleToggle(cat)}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${meta.label}. ${meta.description}`}
              data-testid={`aura-${cat}`}
              style={{
                minHeight: 44,
                padding: '0.625rem 0.875rem',
                borderRadius: 'var(--radius-md, 12px)',
                border: '1px solid',
                borderColor: selected
                  ? 'var(--accent-sage, #6B9080)'
                  : 'var(--border-subtle, #E5E5E0)',
                background: selected
                  ? 'var(--accent-sage-soft, #EAF1ED)'
                  : 'var(--bg-card, #FFFFFF)',
                color: selected
                  ? 'var(--accent-sage, #6B9080)'
                  : 'var(--text-primary, #1A1A2E)',
                fontSize: 'var(--text-sm, 0.875rem)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                textAlign: 'left',
                display: 'flex',
                gap: '0.625rem',
                alignItems: 'flex-start',
                transition: 'background 120ms ease, border-color 120ms ease',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-sm, 8px)',
                  background: selected
                    ? 'var(--accent-sage, #6B9080)'
                    : 'var(--bg-elevated, #F5F5F0)',
                  color: selected ? '#FFFFFF' : 'var(--text-secondary, #6B7280)',
                  flexShrink: 0,
                }}
              >
                <meta.Icon />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{meta.label}</span>
                <span
                  style={{
                    fontSize: 'var(--text-xs, 0.75rem)',
                    color: selected
                      ? 'var(--accent-sage, #6B9080)'
                      : 'var(--text-secondary, #6B7280)',
                    lineHeight: 1.35,
                  }}
                >
                  {meta.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {motorSelected && (
        <div
          role="note"
          aria-live="polite"
          data-testid="hemiplegic-advisory"
          style={{
            marginTop: '0.75rem',
            padding: '0.875rem',
            borderRadius: 'var(--radius-md, 12px)',
            background: advisory.urgent
              ? 'var(--pain-severe-soft, #FBE9E9)'
              : 'var(--bg-elevated, #F5F5F0)',
            borderLeft: `4px solid ${
              advisory.urgent
                ? 'var(--pain-severe, #C85C5C)'
                : 'var(--pain-moderate, #D4874D)'
            }`,
            fontSize: 'var(--text-sm, 0.875rem)',
            color: 'var(--text-primary, #1A1A2E)',
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
            {advisory.headline}
          </div>
          <p style={{ margin: 0 }}>{advisory.body}</p>
          <p
            style={{
              margin: '0.5rem 0 0 0',
              color: 'var(--text-secondary, #6B7280)',
            }}
          >
            {advisory.context}
          </p>
          <a
            href={advisory.cta.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              marginTop: '0.625rem',
              padding: '0.5rem 0.875rem',
              minHeight: 44,
              borderRadius: 'var(--radius-md, 12px)',
              background: 'var(--accent-sage, #6B9080)',
              color: '#FFFFFF',
              fontSize: 'var(--text-sm, 0.875rem)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {advisory.cta.text}
          </a>
          <p
            style={{
              margin: '0.625rem 0 0 0',
              fontSize: 'var(--text-xs, 0.75rem)',
              color: 'var(--text-secondary, #6B7280)',
            }}
          >
            This is informational and not diagnostic. You can still save this
            log.
          </p>
        </div>
      )}
    </div>
  )
}
