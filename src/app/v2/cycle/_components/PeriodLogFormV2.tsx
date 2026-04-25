'use client'

/*
 * PeriodLogFormV2
 *
 * Granular daily cycle log, modeled on Natural Cycles' full daily surface.
 * Writes to cycle_entries via POST /api/cycle/log. The API whitelist (see
 * src/app/api/cycle/log/route.ts) is pre-migration safe : if migrations
 * 011 (endo-mode) or 028 (granular logging) are absent, the route strips
 * extended fields and retries, so every field here is safe to send.
 *
 * Sections (progressive disclosure):
 *
 *   1. Period      (always open) menstruation toggle, flow chips
 *   2. Signs       (always open) ovulation signs, LH, cervical mucus
 *   3. Symptoms    (collapsed)   symptoms chip grid
 *   4. Mood & skin (collapsed)   mood emoji + skin state
 *   5. Sex         (collapsed)   sex activity type
 *   6. Endo mode   (collapsed)   bowel, bladder, dyspareunia, clots, notes
 *
 * Endo mode is only rendered when `endoMode` is true (determined server-
 * side in log/page.tsx from active_problems + health_profile + any
 * existing endo values on this date's entry).
 *
 * Because the form is long, we attach a beforeunload guard that only
 * fires when isDirty is true. The flag flips on first edit and clears
 * after a successful save so the router.push navigation is clean.
 *
 * Voice rules (repeated here so copy edits stay consistent):
 *   - Short, kind, explanatory.
 *   - Never "you should" / "you must" / "you need to".
 *   - No em-dashes anywhere.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Banner, Button, Card, SegmentedControl, Stepper, Toggle } from '@/v2/components/primitives'
import { success, warning } from '@/v2/lib/haptics'
import { fieldTextareaStyle } from '@/app/v2/_tail-shared/formField'
import type { ClotSize, FlowLevel } from '@/lib/types'
import ChipPicker from './ChipPicker'

const FLOW_OPTIONS: { value: FlowLevel; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'spotting', label: 'Spot' },
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Med' },
  { value: 'heavy', label: 'Heavy' },
]

const LH_OPTIONS = [
  { value: 'not_taken', label: 'Not tested' },
  { value: 'negative', label: 'Negative' },
  { value: 'positive', label: 'Positive' },
]

const OVULATION_SIGN_OPTIONS = [
  { value: 'cramping', label: 'Cramping' },
  { value: 'mittelschmerz', label: 'One-sided pain' },
  { value: 'libido', label: 'Libido shift' },
  { value: 'mood', label: 'Mood lift' },
]

const MUCUS_CONSISTENCY_OPTIONS = [
  { value: 'dry', label: 'Dry' },
  { value: 'sticky', label: 'Sticky' },
  { value: 'creamy', label: 'Creamy' },
  { value: 'watery', label: 'Watery' },
  { value: 'egg_white', label: 'Egg white' },
  { value: 'none', label: 'None' },
]

const MUCUS_QUANTITY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'little', label: 'A little' },
  { value: 'medium', label: 'Medium' },
  { value: 'lots', label: 'Lots' },
]

const SYMPTOM_OPTIONS = [
  { value: 'cramping', label: 'Cramping' },
  { value: 'backache', label: 'Backache' },
  { value: 'sore_breasts', label: 'Sore breasts' },
  { value: 'tender_breasts', label: 'Tender breasts' },
  { value: 'bloating', label: 'Bloating' },
  { value: 'headache', label: 'Headache' },
  { value: 'migraine', label: 'Migraine' },
  { value: 'fatigue', label: 'Fatigue' },
  { value: 'low_energy', label: 'Low energy' },
  { value: 'nausea', label: 'Nausea' },
  { value: 'cravings', label: 'Cravings' },
  { value: 'insomnia', label: 'Insomnia' },
  { value: 'anxious', label: 'Anxious' },
  { value: 'irritable', label: 'Irritable' },
  { value: 'pelvic_pain', label: 'Pelvic pain' },
]

const MOOD_EMOJI_OPTIONS = [
  '😊', '🙂', '😐', '😔', '😢',
  '😠', '😰', '😤', '🥱', '🧠',
  '💪', '🔥', '💔', '🤕', '😶',
]

const SKIN_STATE_OPTIONS = [
  { value: 'dry', label: 'Dry' },
  { value: 'oily', label: 'Oily' },
  { value: 'puffy', label: 'Puffy' },
  { value: 'acne', label: 'Breaking out' },
  { value: 'glowing', label: 'Glowing' },
  { value: 'normal', label: 'Normal' },
]

const SEX_ACTIVITY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'vaginal_protected', label: 'Vaginal, protected' },
  { value: 'vaginal_unprotected', label: 'Vaginal, unprotected' },
  { value: 'other', label: 'Other' },
]

const BOWEL_SYMPTOM_OPTIONS = [
  { value: 'loose', label: 'Loose' },
  { value: 'normal', label: 'Normal' },
  { value: 'constipated', label: 'Constipated' },
  { value: 'painful', label: 'Painful' },
]

const BLADDER_SYMPTOM_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'frequent', label: 'Frequent' },
  { value: 'painful', label: 'Painful' },
]

const CLOT_SIZE_OPTIONS: { value: ClotSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'very_large', label: 'Very large' },
]

export interface PeriodLogFormV2Props {
  date: string
  endoMode: boolean
  initialFlow: FlowLevel | null
  initialMenstruation: boolean
  initialOvulationSigns: string[]
  initialLh: string
  initialCervicalMucusConsistency: string | null
  initialCervicalMucusQuantity: string | null
  initialSymptoms: string[]
  initialMoodEmoji: string | null
  initialSkinState: string | null
  initialSexActivityType: string | null
  initialBowelSymptoms: string[]
  initialBladderSymptoms: string[]
  initialDyspareunia: boolean
  initialDyspareuniaIntensity: number
  initialClotsPresent: boolean
  initialClotSize: ClotSize | null
  initialClotCount: number
  initialEndoNotes: string
}

export default function PeriodLogFormV2({
  date,
  endoMode,
  initialFlow,
  initialMenstruation,
  initialOvulationSigns,
  initialLh,
  initialCervicalMucusConsistency,
  initialCervicalMucusQuantity,
  initialSymptoms,
  initialMoodEmoji,
  initialSkinState,
  initialSexActivityType,
  initialBowelSymptoms,
  initialBladderSymptoms,
  initialDyspareunia,
  initialDyspareuniaIntensity,
  initialClotsPresent,
  initialClotSize,
  initialClotCount,
  initialEndoNotes,
}: PeriodLogFormV2Props) {
  const [flow, setFlow] = useState<FlowLevel | null>(initialFlow)
  const [menstruation, setMenstruation] = useState(initialMenstruation)
  const [signs, setSigns] = useState<Set<string>>(new Set(initialOvulationSigns))
  const [lh, setLh] = useState(initialLh)
  const [mucusConsistency, setMucusConsistency] = useState<string | null>(
    initialCervicalMucusConsistency,
  )
  const [mucusQuantity, setMucusQuantity] = useState<string | null>(initialCervicalMucusQuantity)
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set(initialSymptoms))
  const [moodEmoji, setMoodEmoji] = useState<string | null>(initialMoodEmoji)
  const [skinState, setSkinState] = useState<string | null>(initialSkinState)
  const [sexActivity, setSexActivity] = useState<string | null>(initialSexActivityType)
  const [bowel, setBowel] = useState<Set<string>>(new Set(initialBowelSymptoms))
  const [bladder, setBladder] = useState<Set<string>>(new Set(initialBladderSymptoms))
  const [dyspareunia, setDyspareunia] = useState(initialDyspareunia)
  const [dyspareuniaIntensity, setDyspareuniaIntensity] = useState(initialDyspareuniaIntensity)
  const [clotsPresent, setClotsPresent] = useState(initialClotsPresent)
  const [clotSize, setClotSize] = useState<ClotSize | null>(initialClotSize)
  const [clotCount, setClotCount] = useState(initialClotCount)
  const [endoNotes, setEndoNotes] = useState(initialEndoNotes)

  const [isDirty, setIsDirty] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  /*
   * beforeunload guard. Only attached while the form has unsaved edits
   * so the common "open and close without changes" path does not prompt.
   * returnValue = '' is required for Chrome/Safari even though the text
   * itself isn't shown.
   */
  useEffect(() => {
    if (!isDirty) return
    function beforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  const markDirty = () => {
    if (!isDirty) setIsDirty(true)
  }

  const toggleInSet = (set: Set<string>, setter: (next: Set<string>) => void, v: string) => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    setter(next)
    markDirty()
  }

  const submit = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        const res = await fetch('/api/cycle/log', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            date,
            flow_level: flow,
            menstruation,
            ovulation_signs: Array.from(signs),
            lh_test_result: lh,
            cervical_mucus_consistency: mucusConsistency,
            cervical_mucus_quantity: mucusQuantity,
            symptoms: Array.from(symptoms),
            mood_emoji: moodEmoji,
            skin_state: skinState,
            sex_activity_type: sexActivity,
            // Endo-mode fields only sent when the user has endo mode enabled.
            // The API whitelist accepts them regardless, but omitting them
            // when the section is hidden keeps request bodies lean.
            ...(endoMode
              ? {
                  bowel_symptoms: Array.from(bowel),
                  bladder_symptoms: Array.from(bladder),
                  dyspareunia,
                  dyspareunia_intensity: dyspareunia ? dyspareuniaIntensity : null,
                  clots_present: clotsPresent,
                  clot_size: clotsPresent ? clotSize : null,
                  clot_count: clotsPresent ? clotCount : null,
                  endo_notes: endoNotes,
                }
              : {}),
          }),
        })
        if (!res.ok) {
          const msg = (await res.json().catch(() => null))?.error ?? 'Could not save'
          warning()
          setError(msg)
          return
        }
        success()
        setSaved(true)
        setIsDirty(false)
        router.push('/v2/cycle')
      } catch {
        warning()
        setError('Network error. Check your connection and try again.')
      }
    })
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-5)',
        paddingBottom: 'var(--v2-space-10)',
      }}
    >
      <Card variant="explanatory" padding="md">
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', lineHeight: 'var(--v2-leading-relaxed)' }}>
          Honest logs are better than perfect logs. Any section can stay closed.
          Patterns show up over weeks, not days.
        </p>
      </Card>

      {/* 1. Period - always visible */}
      <Section title="Period" explainer="What's happening with flow today.">
        <Field label="Menstruation today">
          <Toggle
            checked={menstruation}
            onChange={(v) => {
              setMenstruation(v)
              markDirty()
            }}
          />
        </Field>
        <Field label="Flow">
          <SegmentedControl
            fullWidth
            segments={FLOW_OPTIONS}
            value={flow ?? ''}
            onChange={(v) => {
              setFlow(v === '' ? null : (v as FlowLevel))
              markDirty()
            }}
          />
        </Field>
      </Section>

      {/* 2. Signs - always visible */}
      <Section title="Signs" explainer="Ovulation clues and fluid quality.">
        <Field label="Ovulation signs you noticed">
          <ChipPicker
            mode="multi"
            ariaLabel="Ovulation signs"
            options={OVULATION_SIGN_OPTIONS}
            values={signs}
            onToggle={(v) => toggleInSet(signs, setSigns, v)}
          />
        </Field>
        <Field label="LH test">
          <SegmentedControl
            fullWidth
            segments={LH_OPTIONS}
            value={lh}
            onChange={(v) => {
              setLh(v)
              markDirty()
            }}
          />
        </Field>
        <Field label="Cervical mucus consistency">
          <ChipPicker
            mode="single"
            ariaLabel="Cervical mucus consistency"
            options={MUCUS_CONSISTENCY_OPTIONS}
            value={mucusConsistency}
            onSelect={(v) => {
              setMucusConsistency(v)
              markDirty()
            }}
          />
        </Field>
        <Field label="Cervical mucus quantity">
          <ChipPicker
            mode="single"
            ariaLabel="Cervical mucus quantity"
            options={MUCUS_QUANTITY_OPTIONS}
            value={mucusQuantity}
            onSelect={(v) => {
              setMucusQuantity(v)
              markDirty()
            }}
          />
        </Field>
      </Section>

      {/* 3. Symptoms - collapsed by default */}
      <CollapsibleSection
        title="Symptoms"
        explainer="Tap anything you're feeling today."
        count={symptoms.size}
        defaultOpen={symptoms.size > 0}
      >
        <ChipPicker
          mode="multi"
          ariaLabel="Symptoms"
          options={SYMPTOM_OPTIONS}
          values={symptoms}
          onToggle={(v) => toggleInSet(symptoms, setSymptoms, v)}
        />
      </CollapsibleSection>

      {/* 4. Mood & skin - collapsed by default */}
      <CollapsibleSection
        title="Mood and skin"
        explainer="Optional markers. Patterns show over weeks."
        count={(moodEmoji ? 1 : 0) + (skinState ? 1 : 0)}
        defaultOpen={Boolean(moodEmoji || skinState)}
      >
        <Field label="Mood">
          <EmojiGrid
            selected={moodEmoji}
            onSelect={(e) => {
              setMoodEmoji(moodEmoji === e ? null : e)
              markDirty()
            }}
          />
        </Field>
        <Field label="Skin">
          <ChipPicker
            mode="single"
            ariaLabel="Skin state"
            options={SKIN_STATE_OPTIONS}
            value={skinState}
            onSelect={(v) => {
              setSkinState(v)
              markDirty()
            }}
          />
        </Field>
      </CollapsibleSection>

      {/* 5. Sex activity - collapsed by default */}
      <CollapsibleSection
        title="Sex activity"
        explainer="Protection is for your own records."
        count={sexActivity ? 1 : 0}
        defaultOpen={Boolean(sexActivity)}
      >
        <ChipPicker
          mode="single"
          ariaLabel="Sex activity"
          options={SEX_ACTIVITY_OPTIONS}
          value={sexActivity}
          onSelect={(v) => {
            setSexActivity(v)
            markDirty()
          }}
        />
      </CollapsibleSection>

      {/* 6. Endo mode - only when endoMode flag is on */}
      {endoMode && (
        <CollapsibleSection
          title="Endo mode"
          explainer="Extra tracking for endometriosis patterns and doctor reports."
          count={
            bowel.size +
            bladder.size +
            (dyspareunia ? 1 : 0) +
            (clotsPresent ? 1 : 0) +
            (endoNotes.trim().length > 0 ? 1 : 0)
          }
          defaultOpen={
            bowel.size > 0 ||
            bladder.size > 0 ||
            dyspareunia ||
            clotsPresent ||
            endoNotes.trim().length > 0
          }
        >
          <Field label="Bowel">
            <ChipPicker
              mode="multi"
              ariaLabel="Bowel symptoms"
              options={BOWEL_SYMPTOM_OPTIONS}
              values={bowel}
              onToggle={(v) => toggleInSet(bowel, setBowel, v)}
            />
          </Field>
          <Field label="Bladder">
            <ChipPicker
              mode="multi"
              ariaLabel="Bladder symptoms"
              options={BLADDER_SYMPTOM_OPTIONS}
              values={bladder}
              onToggle={(v) => toggleInSet(bladder, setBladder, v)}
            />
          </Field>
          <Field label="Painful sex (dyspareunia)">
            <Toggle
              checked={dyspareunia}
              onChange={(v) => {
                setDyspareunia(v)
                markDirty()
              }}
            />
          </Field>
          {dyspareunia && (
            <Field label="Pain level (0 to 10)">
              <Stepper
                value={dyspareuniaIntensity}
                min={0}
                max={10}
                onChange={(v) => {
                  setDyspareuniaIntensity(v)
                  markDirty()
                }}
              />
            </Field>
          )}
          <Field label="Clots today">
            <Toggle
              checked={clotsPresent}
              onChange={(v) => {
                setClotsPresent(v)
                markDirty()
              }}
            />
          </Field>
          {clotsPresent && (
            <>
              <Field label="Largest clot size">
                <ChipPicker
                  mode="single"
                  ariaLabel="Clot size"
                  options={CLOT_SIZE_OPTIONS}
                  value={clotSize}
                  onSelect={(v) => {
                    setClotSize(v as ClotSize | null)
                    markDirty()
                  }}
                />
              </Field>
              <Field label="Approximate count">
                <Stepper
                  value={clotCount}
                  min={0}
                  max={99}
                  onChange={(v) => {
                    setClotCount(v)
                    markDirty()
                  }}
                />
              </Field>
            </>
          )}
          <Field label="Notes">
            <textarea
              value={endoNotes}
              onChange={(e) => {
                setEndoNotes(e.target.value)
                markDirty()
              }}
              rows={3}
              placeholder="Triggers, procedures, anything worth remembering."
              style={fieldTextareaStyle}
            />
          </Field>
        </CollapsibleSection>
      )}

      {error && <Banner intent="danger" title="Could not save" body={error} />}
      {saved && !error && (
        <p
          role="status"
          style={{ margin: 0, color: 'var(--v2-accent-success)', fontSize: 'var(--v2-text-sm)' }}
        >
          Saved.
        </p>
      )}

      <Button variant="primary" size="lg" fullWidth onClick={submit} disabled={pending}>
        {pending ? 'Saving...' : 'Save entry'}
      </Button>
    </div>
  )
}

/*
 * Always-visible section: simple heading + explainer line + children.
 */
function Section({
  title,
  explainer,
  children,
}: {
  title: string
  explainer: string
  children: React.ReactNode
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
      <SectionHeading title={title} explainer={explainer} />
      {children}
    </section>
  )
}

/*
 * Collapsible section: uses a real <details>/<summary> for built-in
 * accessibility (keyboard, screen reader, browser search). The summary
 * has a 44pt minimum tap target. When the section has entries already
 * populated it defaults to open so edits are visible without a tap.
 */
function CollapsibleSection({
  title,
  explainer,
  count,
  defaultOpen,
  children,
}: {
  title: string
  explainer: string
  count: number
  defaultOpen: boolean
  children: React.ReactNode
}) {
  return (
    <details
      open={defaultOpen}
      style={{
        background: 'var(--v2-bg-card)',
        border: '1px solid var(--v2-border-subtle)',
        borderRadius: 'var(--v2-radius-lg)',
        padding: 'var(--v2-space-2) var(--v2-space-4)',
      }}
    >
      <summary
        style={{
          minHeight: 'var(--v2-touch-target-min)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          listStyle: 'none',
          gap: 'var(--v2-space-3)',
          padding: 'var(--v2-space-2) 0',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-primary)',
              fontWeight: 'var(--v2-weight-semibold)',
            }}
          >
            {title}
            {count > 0 && (
              <span
                style={{
                  marginLeft: 'var(--v2-space-2)',
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-accent-primary)',
                  fontWeight: 'var(--v2-weight-medium)',
                }}
              >
                {count}
              </span>
            )}
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-normal)',
            }}
          >
            {explainer}
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            color: 'var(--v2-text-muted)',
            fontSize: 'var(--v2-text-sm)',
            flexShrink: 0,
          }}
        >
          ›
        </span>
      </summary>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          paddingTop: 'var(--v2-space-3)',
          paddingBottom: 'var(--v2-space-2)',
        }}
      >
        {children}
      </div>
    </details>
  )
}

function SectionHeading({ title, explainer }: { title: string; explainer: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-base)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-primary)',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          lineHeight: 'var(--v2-leading-normal)',
        }}
      >
        {explainer}
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

/*
 * EmojiGrid
 *
 * 3-column grid of single-character emoji options. Selected state lifts
 * the background + accent border, same visual language as the chip
 * picker for consistency. Every cell is 44pt minimum.
 */
function EmojiGrid({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (emoji: string) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Mood"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--v2-space-2)',
      }}
    >
      {MOOD_EMOJI_OPTIONS.map((e) => {
        const active = selected === e
        return (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Mood ${e}`}
            onClick={() => onSelect(e)}
            style={{
              minHeight: 'var(--v2-touch-target-min)',
              borderRadius: 'var(--v2-radius-md)',
              background: active ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-card)',
              border: `1px solid ${active ? 'var(--v2-accent-primary)' : 'var(--v2-border-subtle)'}`,
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 'var(--v2-space-2)',
            }}
          >
            {e}
          </button>
        )
      })}
    </div>
  )
}
