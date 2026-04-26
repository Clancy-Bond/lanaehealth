'use client'

/**
 * PainLogClient
 *
 * Whole /v2/log/pain page state. Quick log = NRS / FACES + Save.
 * "Add detail" expands the drill-down (location, quality chips, PEG,
 * trigger guess) and surfaces condition-aware prompts (HIT-6,
 * COMPASS) when the user's diagnoses warrant.
 *
 * The save action POSTs to /api/log/pain. The canonical intensity
 * always writes to daily_logs.overall_pain so the rest of the app
 * (home tiles, doctor reports, exports) keeps working.
 *
 * Design rationale: the quick path stays under 5 seconds. NC voice
 * throughout: "Pain is hard to put in numbers. Take your best guess;
 * you can always come back and adjust."
 */
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Banner, SegmentedControl } from '@/v2/components/primitives'
import { success, warning as warningHaptic } from '@/v2/lib/haptics'
import NRSSlider from './NRSSlider'
import FacesScale from './FacesScale'
import PainQualityChips from './PainQualityChips'
import FunctionalImpactQuestions, { type PegValues } from './FunctionalImpactQuestions'
import BodyMap, { type BodyRegion, parseBodyRegion } from './BodyMap'
import ConditionPrompts from './ConditionPrompts'
import MigraineStageChips from './MigraineStageChips'
import { migraineStageLabel, type MigraineStage } from './migraine-stages'
import {
  shouldShowMigrainePrompt,
  shouldShowOrthostaticPrompt,
  type ConditionFlags,
} from './condition-detection'
import type {
  Hit6SeverityFrequency,
  CompassOrthostatic,
  PainScaleUsed,
  PainQuality,
} from '@/lib/types'

export interface PainLogClientProps {
  today: string
  initialIntensity: number | null
  initialBodyRegion: string | null
  conditionFlags: ConditionFlags
}

export default function PainLogClient({
  today,
  initialIntensity,
  initialBodyRegion,
  conditionFlags,
}: PainLogClientProps) {
  const router = useRouter()
  const [scale, setScale] = useState<PainScaleUsed>('nrs')
  const [intensity, setIntensity] = useState<number>(initialIntensity ?? 3)
  const [showDetail, setShowDetail] = useState<boolean>(false)
  const [bodyRegion, setBodyRegion] = useState<BodyRegion | null>(parseBodyRegion(initialBodyRegion))
  const [qualities, setQualities] = useState<PainQuality[]>([])
  const [peg, setPeg] = useState<PegValues>({ enjoyment: 0, activity: 0 })
  const [hit6, setHit6] = useState<Hit6SeverityFrequency | undefined>(undefined)
  const [compass, setCompass] = useState<CompassOrthostatic | undefined>(undefined)
  const [migraineStage, setMigraineStage] = useState<MigraineStage | undefined>(undefined)
  const [trigger, setTrigger] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const showMigrainePrompt = useMemo(
    () => shouldShowMigrainePrompt(conditionFlags, bodyRegion, qualities),
    [conditionFlags, bodyRegion, qualities],
  )
  const showOrthostaticPrompt = useMemo(
    () => shouldShowOrthostaticPrompt(conditionFlags, bodyRegion, qualities),
    [conditionFlags, bodyRegion, qualities],
  )

  const toggleQuality = (q: PainQuality) => {
    setQualities((prev) => (prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]))
  }

  const handleSave = () => {
    setError(null)
    setWarning(null)
    startTransition(async () => {
      try {
        const payload = {
          date: today,
          intensity,
          scale_used: scale,
          ...(showDetail
            ? {
                qualities,
                body_region: bodyRegion,
                peg: peg.enjoyment > 0 || peg.activity > 0 ? peg : undefined,
                hit6_severity: showMigrainePrompt ? hit6 : undefined,
                compass_orthostatic: showOrthostaticPrompt ? compass : undefined,
                trigger_guess: buildTriggerGuess(trigger, showMigrainePrompt ? migraineStage : undefined) || undefined,
              }
            : {}),
        }
        const res = await fetch('/api/log/pain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data: { ok: boolean; warning?: string; error?: string; log_id?: string; intensity?: number } = await res.json()
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Could not save. Try again.')
        }
        if (data.warning) {
          warningHaptic()
          setWarning(data.warning)
        } else {
          success()
          router.push('/v2/log')
          router.refresh()
        }
      } catch (e) {
        warningHaptic()
        setError(e instanceof Error ? e.message : 'Could not save. Try again.')
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-5)' }}>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        Pain is hard to put in numbers. Take your best guess; you can always come back and adjust.
      </p>

      <Card padding="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
          <SegmentedControl<PainScaleUsed>
            value={scale}
            onChange={(next) => {
              setScale(next)
              // FACES uses even values only. Snap when switching.
              if (next === 'faces' && intensity % 2 !== 0) {
                setIntensity(intensity - 1)
              }
            }}
            segments={[
              { value: 'nrs', label: 'Numbers' },
              { value: 'faces', label: 'Faces' },
            ]}
            fullWidth
          />

          {scale === 'nrs' ? (
            <NRSSlider value={intensity} onChange={setIntensity} />
          ) : (
            <FacesScale value={Math.max(0, Math.min(10, Math.round(intensity / 2) * 2))} onChange={setIntensity} />
          )}
        </div>
      </Card>

      <Button
        variant={showDetail ? 'tertiary' : 'secondary'}
        onClick={() => setShowDetail((v) => !v)}
        fullWidth
      >
        {showDetail ? 'Hide detail' : 'Add detail (location, quality, impact)'}
      </Button>

      {showDetail && (
        <Card padding="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-5)' }}>
            <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 'var(--v2-text-base)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                }}
              >
                Where is the pain?
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
                Pick the closest match. You can leave it blank.
              </p>
              <BodyMap selected={bodyRegion} onChange={setBodyRegion} />
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 'var(--v2-text-base)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                }}
              >
                What does it feel like?
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
                Pick any words that fit. Doctors quote these in notes.
              </p>
              <PainQualityChips selected={qualities} onToggle={toggleQuality} />
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 'var(--v2-text-base)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                }}
              >
                How is it affecting today?
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
                The PEG question set: how much pain has gotten in the way.
              </p>
              <FunctionalImpactQuestions values={peg} onChange={setPeg} />
            </section>

            <ConditionPrompts
              showMigrainePrompt={showMigrainePrompt}
              showOrthostaticPrompt={showOrthostaticPrompt}
              hit6Severity={hit6}
              onHit6SeverityChange={setHit6}
              compassOrthostatic={compass}
              onCompassOrthostaticChange={setCompass}
            />

            <MigraineStageChips
              show={showMigrainePrompt}
              value={migraineStage}
              onChange={setMigraineStage}
            />

            <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 'var(--v2-text-base)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                }}
              >
                Anything you think set it off?
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
                Optional. A quick guess is more useful than perfect recall.
              </p>
              <textarea
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                placeholder="e.g. heavy period day, slept badly, busy morning"
                rows={3}
                maxLength={280}
                style={{
                  width: '100%',
                  minHeight: 'var(--v2-touch-target-min)',
                  padding: 'var(--v2-space-3)',
                  borderRadius: 'var(--v2-radius-md)',
                  border: '1px solid var(--v2-border)',
                  background: 'var(--v2-bg-base)',
                  color: 'var(--v2-text-primary)',
                  fontSize: 'var(--v2-text-sm)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </section>
          </div>
        </Card>
      )}

      {error && <Banner intent="danger" title="Could not save" body={error} />}
      {warning && <Banner intent="warning" title="Saved with a hiccup" body={warning} />}

      <Button variant="primary" onClick={handleSave} disabled={isPending} fullWidth>
        {isPending ? 'Saving...' : 'Save pain log'}
      </Button>
    </div>
  )
}

/**
 * Compose the trigger_guess value sent to /api/log/pain. When the
 * migraine staging chip is set we prepend "[Migraine: <stage>]" so
 * the four-stage signal lands in pain_points.context_json without
 * needing a new column. Existing free-text from the user is kept
 * verbatim, separated by a single space.
 *
 * Pattern source for the four-stage model:
 * https://bearable.app/migraine-tracker-app
 */
function buildTriggerGuess(freeText: string, stage: MigraineStage | undefined): string {
  const trimmed = freeText.trim()
  if (!stage) return trimmed
  const tag = `[Migraine: ${migraineStageLabel(stage).toLowerCase()}]`
  return trimmed ? `${tag} ${trimmed}` : tag
}
