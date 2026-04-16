'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  CONDITION_PRESETS,
  ONBOARDING_GOALS,
  type ConditionPreset,
} from '@/lib/onboarding/condition-presets'
import { createTrackable } from '@/lib/api/custom-trackables'

// ── Types ────────────────────────────────────────────────────────────

type Step = 'welcome' | 'conditions' | 'goals' | 'preview' | 'tutorial' | 'complete'

const STEPS: Step[] = ['welcome', 'conditions', 'goals', 'preview', 'tutorial', 'complete']

// ── Component ────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('welcome')
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [otherCondition, setOtherCondition] = useState('')
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [activeSections, setActiveSections] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const stepIndex = STEPS.indexOf(currentStep)

  // Collect all recommended sections + custom trackables from selected conditions
  const { mergedSections, mergedTrackables } = useMemo(() => {
    const sections = new Set<string>()
    const trackables: ConditionPreset['custom_trackables'] = []
    const seen = new Set<string>()

    for (const cid of selectedConditions) {
      const preset = CONDITION_PRESETS.find((p) => p.id === cid)
      if (!preset) continue
      for (const s of preset.recommended_sections) {
        sections.add(s)
      }
      for (const t of preset.custom_trackables) {
        if (!seen.has(t.name)) {
          seen.add(t.name)
          trackables.push(t)
        }
      }
    }

    return { mergedSections: Array.from(sections), mergedTrackables: trackables }
  }, [selectedConditions])

  // Initialize activeSections when entering preview step
  const goToStep = useCallback(
    (step: Step) => {
      if (step === 'preview') {
        setActiveSections(mergedSections)
      }
      setCurrentStep(step)
    },
    [mergedSections]
  )

  const goNext = useCallback(() => {
    const next = STEPS[stepIndex + 1]
    if (next) goToStep(next)
  }, [stepIndex, goToStep])

  const goBack = useCallback(() => {
    const prev = STEPS[stepIndex - 1]
    if (prev) goToStep(prev)
  }, [stepIndex, goToStep])

  // Toggle a condition selection
  const toggleCondition = useCallback((id: string) => {
    setSelectedConditions((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }, [])

  // Toggle a goal selection
  const toggleGoal = useCallback((id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    )
  }, [])

  // Toggle a section on the preview step
  const toggleSection = useCallback((section: string) => {
    setActiveSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    )
  }, [])

  // Complete onboarding: save to API and create trackables
  const handleComplete = useCallback(async () => {
    setSaving(true)
    try {
      // Create custom trackables
      const createdNames: string[] = []
      for (const t of mergedTrackables) {
        try {
          await createTrackable({
            name: t.name,
            category: t.category,
            input_type: t.input_type,
            icon: t.icon,
          })
          createdNames.push(t.name)
        } catch {
          // Skip if trackable already exists or fails
        }
      }

      // Save onboarding record
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditions: selectedConditions,
          goals: selectedGoals,
          active_sections: activeSections,
          custom_trackables_created: createdNames,
          other_condition: otherCondition || undefined,
        }),
      })

      router.push('/log')
    } catch {
      // Allow user to retry
      setSaving(false)
    }
  }, [
    selectedConditions,
    selectedGoals,
    activeSections,
    otherCondition,
    mergedTrackables,
    router,
  ])

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-card, #FAFAF7)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header: back arrow + step dots */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px 8px',
        }}
      >
        {/* Back button */}
        <div style={{ width: 44 }}>
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 12,
                border: 'none',
                background: 'var(--bg-elevated, #F0F0EC)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: 20,
              }}
            >
              &#8592;
            </button>
          )}
        </div>

        {/* Step dots */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                width: i === stepIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background:
                  i <= stepIndex
                    ? 'var(--accent-sage, #6B9080)'
                    : 'var(--border-light, #E0E0DC)',
                transition: 'all 200ms ease',
              }}
            />
          ))}
        </div>

        {/* Spacer to balance the back button */}
        <div style={{ width: 44 }} />
      </div>

      {/* Step content */}
      <div
        style={{
          flex: 1,
          padding: '16px 20px 32px',
          overflowY: 'auto',
        }}
      >
        {currentStep === 'welcome' && (
          <WelcomeStep onContinue={goNext} />
        )}
        {currentStep === 'conditions' && (
          <ConditionsStep
            selected={selectedConditions}
            onToggle={toggleCondition}
            otherText={otherCondition}
            onOtherChange={setOtherCondition}
            onContinue={goNext}
          />
        )}
        {currentStep === 'goals' && (
          <GoalsStep
            selected={selectedGoals}
            onToggle={toggleGoal}
            onContinue={goNext}
          />
        )}
        {currentStep === 'preview' && (
          <PreviewStep
            sections={activeSections}
            trackables={mergedTrackables}
            onToggleSection={toggleSection}
            onContinue={goNext}
          />
        )}
        {currentStep === 'tutorial' && (
          <TutorialStep onContinue={goNext} />
        )}
        {currentStep === 'complete' && (
          <CompleteStep onFinish={handleComplete} saving={saving} />
        )}
      </div>
    </div>
  )
}

// ── Step Components ──────────────────────────────────────────────────

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: '60vh',
        gap: 24,
      }}
    >
      <div style={{ fontSize: 56 }}>{'\u{1F33F}'}</div>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
        }}
      >
        Welcome to LanaeHealth
      </h1>
      <p
        style={{
          fontSize: 16,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: 320,
        }}
      >
        Let&apos;s personalize your tracker so it captures what matters most for your health journey.
      </p>
      <button
        type="button"
        onClick={onContinue}
        style={{
          marginTop: 16,
          padding: '14px 40px',
          borderRadius: 12,
          border: 'none',
          background: 'var(--accent-sage, #6B9080)',
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          minHeight: 48,
        }}
      >
        Get Started
      </button>
    </div>
  )
}

function ConditionsStep({
  selected,
  onToggle,
  otherText,
  onOtherChange,
  onContinue,
}: {
  selected: string[]
  onToggle: (id: string) => void
  otherText: string
  onOtherChange: (text: string) => void
  onContinue: () => void
}) {
  const hasOther = selected.includes('other')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 6,
          }}
        >
          What are you tracking?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Select all that apply. We will customize your log sections based on your choices.
        </p>
      </div>

      {/* Condition cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}
      >
        {CONDITION_PRESETS.map((preset) => {
          const isSelected = selected.includes(preset.id)
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onToggle(preset.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
                padding: 14,
                borderRadius: 12,
                border: isSelected
                  ? '2px solid var(--accent-sage, #6B9080)'
                  : '1px solid var(--border-light, #E0E0DC)',
                background: isSelected
                  ? 'var(--accent-sage-muted, rgba(107, 144, 128, 0.08))'
                  : 'var(--bg-elevated, #FFFFFF)',
                cursor: 'pointer',
                textAlign: 'left',
                minHeight: 44,
                transition: 'all 150ms ease',
              }}
            >
              <span style={{ fontSize: 24 }}>{preset.icon}</span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {preset.name}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  lineHeight: 1.4,
                }}
              >
                {preset.description}
              </span>
            </button>
          )
        })}

        {/* "Other" option */}
        <button
          type="button"
          onClick={() => onToggle('other')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 6,
            padding: 14,
            borderRadius: 12,
            border: hasOther
              ? '2px solid var(--accent-sage, #6B9080)'
              : '1px solid var(--border-light, #E0E0DC)',
            background: hasOther
              ? 'var(--accent-sage-muted, rgba(107, 144, 128, 0.08))'
              : 'var(--bg-elevated, #FFFFFF)',
            cursor: 'pointer',
            textAlign: 'left',
            minHeight: 44,
            transition: 'all 150ms ease',
          }}
        >
          <span style={{ fontSize: 24 }}>{'\u{2795}'}</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Other
          </span>
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 1.4,
            }}
          >
            Something not listed here
          </span>
        </button>
      </div>

      {/* Other text input */}
      {hasOther && (
        <input
          type="text"
          value={otherText}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="Describe your condition..."
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid var(--border-light, #E0E0DC)',
            background: 'var(--bg-input, #FFFFFF)',
            color: 'var(--text-primary)',
            fontSize: 14,
            outline: 'none',
            minHeight: 44,
          }}
        />
      )}

      {/* Continue button */}
      <button
        type="button"
        onClick={onContinue}
        disabled={selected.length === 0}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 12,
          border: 'none',
          background:
            selected.length > 0
              ? 'var(--accent-sage, #6B9080)'
              : 'var(--border-light, #E0E0DC)',
          color: selected.length > 0 ? '#FFFFFF' : 'var(--text-muted)',
          fontSize: 16,
          fontWeight: 600,
          cursor: selected.length > 0 ? 'pointer' : 'default',
          minHeight: 48,
          transition: 'all 150ms ease',
        }}
      >
        Continue
      </button>
    </div>
  )
}

function GoalsStep({
  selected,
  onToggle,
  onContinue,
}: {
  selected: string[]
  onToggle: (id: string) => void
  onContinue: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 6,
          }}
        >
          What matters most?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Choose the goals that are most important to you right now.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ONBOARDING_GOALS.map((goal) => {
          const isSelected = selected.includes(goal.id)
          return (
            <button
              key={goal.id}
              type="button"
              onClick={() => onToggle(goal.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                borderRadius: 12,
                border: isSelected
                  ? '2px solid var(--accent-sage, #6B9080)'
                  : '1px solid var(--border-light, #E0E0DC)',
                background: isSelected
                  ? 'var(--accent-sage-muted, rgba(107, 144, 128, 0.08))'
                  : 'var(--bg-elevated, #FFFFFF)',
                cursor: 'pointer',
                textAlign: 'left',
                minHeight: 52,
                transition: 'all 150ms ease',
                width: '100%',
              }}
            >
              {/* Checkbox circle */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: isSelected
                    ? '2px solid var(--accent-sage, #6B9080)'
                    : '2px solid var(--border, #C4C4C0)',
                  background: isSelected
                    ? 'var(--accent-sage, #6B9080)'
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 150ms ease',
                }}
              >
                {isSelected && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    style={{ display: 'block' }}
                  >
                    <path
                      d="M3 7L6 10L11 4"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              <span style={{ fontSize: 20, flexShrink: 0 }}>{goal.icon}</span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                }}
              >
                {goal.label}
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={selected.length === 0}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 12,
          border: 'none',
          background:
            selected.length > 0
              ? 'var(--accent-sage, #6B9080)'
              : 'var(--border-light, #E0E0DC)',
          color: selected.length > 0 ? '#FFFFFF' : 'var(--text-muted)',
          fontSize: 16,
          fontWeight: 600,
          cursor: selected.length > 0 ? 'pointer' : 'default',
          minHeight: 48,
          transition: 'all 150ms ease',
        }}
      >
        Continue
      </button>
    </div>
  )
}

// Map section IDs to readable labels
const SECTION_LABELS: Record<string, { label: string; icon: string }> = {
  pain: { label: 'Pain Tracking', icon: '\u{1F3AF}' },
  bloating: { label: 'Bloating', icon: '\u{1F388}' },
  cycle: { label: 'Cycle', icon: '\u{1F319}' },
  bowel: { label: 'Bowel Log', icon: '\u{1F4CB}' },
  food: { label: 'Food & Triggers', icon: '\u{1F34E}' },
  fatigue: { label: 'Fatigue & Energy', icon: '\u{26A1}' },
  mood: { label: 'Mood', icon: '\u{1F60A}' },
  sleep: { label: 'Sleep Details', icon: '\u{1F634}' },
  stress: { label: 'Stress Level', icon: '\u{1F4CA}' },
  gratitude: { label: 'Gratitude', icon: '\u{1F49A}' },
}

function PreviewStep({
  sections,
  trackables,
  onToggleSection,
  onContinue,
}: {
  sections: string[]
  trackables: ConditionPreset['custom_trackables']
  onToggleSection: (section: string) => void
  onContinue: () => void
}) {
  // All possible sections for toggling
  const allSectionIds = Object.keys(SECTION_LABELS)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 6,
          }}
        >
          Here&apos;s what we&apos;ve set up
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Toggle sections on or off to customize your daily log.
        </p>
      </div>

      {/* Active sections */}
      <div>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Log Sections
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {allSectionIds.map((sid) => {
            const info = SECTION_LABELS[sid]
            const isActive = sections.includes(sid)
            return (
              <button
                key={sid}
                type="button"
                onClick={() => onToggleSection(sid)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border-light, #E0E0DC)',
                  background: 'var(--bg-elevated, #FFFFFF)',
                  cursor: 'pointer',
                  minHeight: 48,
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{info.icon}</span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {info.label}
                  </span>
                </div>

                {/* Toggle switch */}
                <div
                  style={{
                    width: 44,
                    height: 26,
                    borderRadius: 13,
                    background: isActive
                      ? 'var(--accent-sage, #6B9080)'
                      : 'var(--border, #C4C4C0)',
                    position: 'relative',
                    transition: 'background 200ms ease',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      position: 'absolute',
                      top: 2,
                      left: isActive ? 20 : 2,
                      transition: 'left 200ms ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom trackables */}
      {trackables.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Custom Trackables (auto-created)
          </h3>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {trackables.map((t) => (
              <div
                key={t.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 20,
                  background: 'var(--accent-sage-muted, rgba(107, 144, 128, 0.08))',
                  border: '1px solid var(--accent-sage, #6B9080)',
                }}
              >
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--accent-sage, #6B9080)',
                  }}
                >
                  {t.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 12,
          border: 'none',
          background: 'var(--accent-sage, #6B9080)',
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          minHeight: 48,
        }}
      >
        Looks Good
      </button>
    </div>
  )
}

function TutorialStep({ onContinue }: { onContinue: () => void }) {
  const tips = [
    {
      icon: '\u{1F4F1}',
      title: 'Swipe through cards',
      description:
        'Your daily log is a carousel of cards. Swipe left and right to move between sections like mood, pain, food, and more.',
    },
    {
      icon: '\u{1F44B}',
      title: 'Tap to log',
      description:
        'Most entries are a single tap. Select your mood, tap a pain level, toggle a symptom. Designed for quick logging.',
    },
    {
      icon: '\u{2705}',
      title: 'Auto-save',
      description:
        'Everything saves automatically as you go. No need to hit a save button. Just log and move on with your day.',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 6,
          }}
        >
          How it works
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          A few tips to get you started.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tips.map((tip, i) => (
          <div
            key={i}
            style={{
              padding: 18,
              borderRadius: 14,
              border: '1px solid var(--border-light, #E0E0DC)',
              background: 'var(--bg-elevated, #FFFFFF)',
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
            }}
          >
            <span
              style={{
                fontSize: 28,
                flexShrink: 0,
                lineHeight: 1,
              }}
            >
              {tip.icon}
            </span>
            <div>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                }}
              >
                {tip.title}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {tip.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onContinue}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 12,
          border: 'none',
          background: 'var(--accent-sage, #6B9080)',
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          minHeight: 48,
        }}
      >
        Got It
      </button>
    </div>
  )
}

function CompleteStep({
  onFinish,
  saving,
}: {
  onFinish: () => void
  saving: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: '60vh',
        gap: 24,
      }}
    >
      <div style={{ fontSize: 56 }}>{'\u{1F33F}'}</div>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
        }}
      >
        You&apos;re all set!
      </h1>
      <p
        style={{
          fontSize: 16,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: 320,
        }}
      >
        Your tracker is personalized and ready. Start your first daily log whenever you are ready.
      </p>
      <button
        type="button"
        onClick={onFinish}
        disabled={saving}
        style={{
          marginTop: 16,
          padding: '14px 40px',
          borderRadius: 12,
          border: 'none',
          background: 'var(--accent-sage, #6B9080)',
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: 600,
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.7 : 1,
          transition: 'opacity 150ms ease',
          minHeight: 48,
        }}
      >
        {saving ? 'Setting up...' : 'Start Logging'}
      </button>
    </div>
  )
}
