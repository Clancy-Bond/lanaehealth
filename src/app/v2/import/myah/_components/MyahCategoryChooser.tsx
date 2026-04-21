'use client'

/*
 * MyahCategoryChooser
 *
 * Step 1 of the MyAH paste importer. Four category cards in a
 * vertical stack : labs, appointments, medications, notes. Each
 * is a full-width Card used as a press target that advances the
 * wizard to the paste step.
 *
 * SegmentedControl is a close design sibling but capped at three
 * segments visually; four categories want a richer explainer under
 * each label, so cards with a brief subtext win here.
 *
 * Tap targets: the whole card is the hit area (>= 44pt), the
 * chevron is decorative.
 */
import { Card } from '@/v2/components/primitives'
import type { MyahEntityType } from './MyahWizard'

interface CategoryOption {
  key: MyahEntityType
  label: string
  hint: string
}

const OPTIONS: CategoryOption[] = [
  {
    key: 'labs',
    label: 'Labs',
    hint: 'Lab results with values and reference ranges.',
  },
  {
    key: 'appointments',
    label: 'Appointments',
    hint: 'Scheduled or completed visits with specialists.',
  },
  {
    key: 'medications',
    label: 'Medications',
    hint: 'Prescriptions and dosages.',
  },
  {
    key: 'notes',
    label: 'Notes',
    hint: 'Doctor notes, after-visit summaries, letters.',
  },
]

export interface MyahCategoryChooserProps {
  onPick: (entityType: MyahEntityType) => void
}

export default function MyahCategoryChooser({ onPick }: MyahCategoryChooserProps) {
  return (
    <section
      aria-label="Choose what to import"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          color: 'var(--v2-text-muted)',
          fontWeight: 'var(--v2-weight-semibold)',
        }}
      >
        What are you pasting?
      </h2>
      <div
        role="list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        {OPTIONS.map((opt) => (
          <Card key={opt.key} padding="none">
            <button
              type="button"
              onClick={() => onPick(opt.key)}
              aria-label={`${opt.label}: ${opt.hint}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--v2-space-3)',
                width: '100%',
                minHeight: 'var(--v2-touch-target-min)',
                padding: 'var(--v2-space-4)',
                background: 'transparent',
                color: 'inherit',
                border: 0,
                borderRadius: 'var(--v2-radius-lg)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--v2-text-base)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-text-primary)',
                  }}
                >
                  {opt.label}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 'var(--v2-text-sm)',
                    color: 'var(--v2-text-muted)',
                    lineHeight: 'var(--v2-leading-relaxed)',
                  }}
                >
                  {opt.hint}
                </div>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden
                style={{
                  color: 'var(--v2-text-muted)',
                  flexShrink: 0,
                }}
              >
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </Card>
        ))}
      </div>
    </section>
  )
}
