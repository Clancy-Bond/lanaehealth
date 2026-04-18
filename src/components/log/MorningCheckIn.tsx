'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import PrefilledDataCard from './PrefilledDataCard'
import VoiceNote from './VoiceNote'
import InsightBanner from './InsightBanner'
import MedStatusCard from './MedStatusCard'
import NextAppointmentCard from './NextAppointmentCard'
import FoodQuickRow from './FoodQuickRow'
import SymptomPillRow from './SymptomPillRow'
import PainRegionRow from './PainRegionRow'
import CycleFlowRow from './CycleFlowRow'
import CheckInDoneButton from './CheckInDoneButton'
import GratitudeQuickInput from './GratitudeQuickInput'
import HydrationRow from './HydrationRow'
import AskAICta from './AskAICta'
import BreathingExercise from './BreathingExercise'
import OrthostaticRow from './OrthostaticRow'
import QuickImportButton from './QuickImportButton'
import CyclePhaseTip from './CyclePhaseTip'
import OuraSyncIndicator from './OuraSyncIndicator'
import FlareToggle from './FlareToggle'
import BBTRow from './BBTRow'
import { updateDailyLog } from '@/lib/api/logs'
import { refreshTodayNarrative } from '@/lib/log/narrative-refresh'
import type { CheckInPrefill } from '@/lib/log/prefill'
import type { DailyLog, Symptom, PainPoint, GratitudeEntry, MoodEntry } from '@/lib/types'
import type { ActiveProblemOption } from '@/app/log/page'

interface RecentMealLite {
  meal_type: string | null
  food_items: string
  flagged_triggers: string[]
  logged_at: string
}

interface MorningCheckInProps {
  log: DailyLog
  prefill: CheckInPrefill
  recentMeals: RecentMealLite[]
  initialSymptoms: Symptom[]
  initialPainPoints: PainPoint[]
  initialGratitudes: GratitudeEntry[]
  initialMood: MoodEntry | null
  onOpenDetails: () => void
  /** Wave 2d D5: condition tag options forwarded to SymptomPillRow. */
  activeProblems?: ActiveProblemOption[]
}

function formatSleepHours(seconds: number | null): string {
  if (!seconds) return '--'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function formatMin(min: number | null): string {
  if (min === null) return '--'
  return `${Math.round(min)}m`
}

function formatNum(n: number | null, unit = ''): string {
  if (n === null) return '--'
  return `${Math.round(n)}${unit}`
}

const phaseLabel: Record<string, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
}

export default function MorningCheckIn({ log, prefill, recentMeals, initialSymptoms, initialPainPoints, initialGratitudes, initialMood, onOpenDetails, activeProblems }: MorningCheckInProps) {
  const [pain, setPain] = useState<number>(log.overall_pain ?? prefill.yesterday.overall_pain ?? 0)
  const [stress, setStress] = useState<number>(log.stress ?? 0)
  const [sleepQuality, setSleepQuality] = useState<number | null>(log.sleep_quality)
  const [notes, setNotes] = useState<string>(log.notes ?? '')
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')

  const save = useCallback(
    async (fields: Partial<DailyLog>) => {
      setSaving('saving')
      try {
        await updateDailyLog(log.id, fields)
        setSaving('saved')
        setTimeout(() => setSaving('idle'), 1500)
      } catch (e) {
        setSaving('idle')
      }
    },
    [log.id]
  )

  const onVerdictSleep = (v: 'matches' | 'worse' | 'better') => {
    const ouraScore = prefill.oura?.sleep_score ?? null
    let quality: number
    if (ouraScore !== null) {
      quality = v === 'matches' ? Math.round(ouraScore / 10) : v === 'worse' ? Math.max(1, Math.round(ouraScore / 10) - 3) : Math.min(10, Math.round(ouraScore / 10) + 2)
    } else {
      quality = v === 'matches' ? 5 : v === 'worse' ? 3 : 7
    }
    setSleepQuality(quality)
    save({ sleep_quality: quality })
  }

  const onPainChange = (n: number) => {
    setPain(n)
    save({ overall_pain: n })
  }

  const onNotesBlur = () => {
    if (notes !== (log.notes ?? '')) {
      save({ notes })
      refreshTodayNarrative()
    }
  }

  const greeting = `Good morning`
  const dateLabel = format(new Date(prefill.date), 'EEEE, MMMM d')

  const sleepStats = [
    { label: 'Total sleep', value: formatSleepHours(prefill.oura?.sleep_duration ?? null), accent: true },
    { label: 'Sleep score', value: formatNum(prefill.oura?.sleep_score ?? null), accent: true },
    { label: 'Deep sleep', value: formatMin(prefill.oura?.deep_sleep_min ?? null) },
    { label: 'REM sleep', value: formatMin(prefill.oura?.rem_sleep_min ?? null) },
    { label: 'HRV avg', value: formatNum(prefill.oura?.hrv_avg ?? null, ' ms') },
    { label: 'Resting HR', value: formatNum(prefill.oura?.resting_hr ?? null, ' bpm') },
  ]

  const showCycle = prefill.cycle.phase || prefill.cycle.day
  const cycleStats = [
    { label: 'Cycle day', value: prefill.cycle.day ? `${prefill.cycle.day}` : '--', accent: true },
    { label: 'Phase', value: prefill.cycle.phase ? phaseLabel[prefill.cycle.phase] : '--' },
    { label: 'Flow', value: prefill.cycle.flow ?? 'None' },
  ]

  return (
    <div className="mx-auto max-w-2xl route-desktop-wide px-4 pt-6 pb-28 space-y-5" style={{ background: '#FAFAF7' }}>
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: '#3a3a3a' }}>
          {greeting}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8a8a8a' }}>
          {dateLabel} &middot; Here&apos;s your night
        </p>
        {(log.sleep_quality !== null || log.overall_pain !== null) ? (
          <div
            className="mt-3 inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full"
            style={{ background: '#E8EDE6', color: '#4A6B52' }}
          >
            <span aria-hidden>&#10003;</span> Already logged today. Edit anything below
          </div>
        ) : null}
      </header>

      <InsightBanner insight={prefill.insight} currentPhase={prefill.cycle.phase} dateISO={prefill.date} />

      <FlareToggle log={log} />

      <NextAppointmentCard appointment={prefill.nextAppointment} />

      {prefill.oura ? (
        <PrefilledDataCard
          title="Last night"
          subtitle="From Oura"
          stats={sleepStats}
          onVerdict={onVerdictSleep}
          initialVerdict={sleepQuality === null ? null : sleepQuality >= 7 ? 'better' : sleepQuality <= 3 ? 'worse' : 'matches'}
        />
      ) : (
        <div className="space-y-2">
          <OuraSyncIndicator ouraLastSync={prefill.ouraLastSync} />
          <div
            className="rounded-2xl p-5 text-sm"
            style={{ background: '#FFFDF9', border: '1px dashed rgba(107, 144, 128, 0.3)', color: '#8a8a8a' }}
          >
            No wearable data for last night yet. <button onClick={onOpenDetails} className="underline" style={{ color: '#6B9080' }}>Log sleep manually</button>
          </div>
        </div>
      )}

      {showCycle ? (
        <PrefilledDataCard title="Cycle" stats={cycleStats} />
      ) : null}

      <CycleFlowRow
        date={prefill.date}
        initialFlow={prefill.cycle.flow}
        cycleDay={prefill.cycle.day}
        phase={prefill.cycle.phase}
      />

      <CyclePhaseTip phase={prefill.cycle.phase} cycleDay={prefill.cycle.day} />

      <BBTRow date={prefill.date} />

      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
      >
        <label className="block text-sm font-medium mb-3" style={{ color: '#3a3a3a' }}>
          Sleep quality
          <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>
            {prefill.oura?.sleep_score ? `Oura: ${prefill.oura.sleep_score}/100` : '0-10 scale'}
          </span>
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={10}
            value={sleepQuality ?? 0}
            onChange={e => { const v = Number(e.target.value); setSleepQuality(v); save({ sleep_quality: v }) }}
            className="flex-1"
            style={{ accentColor: '#6B9080' }}
            aria-label="Sleep quality, 0 to 10"
          />
          <span
            className="tabular text-2xl font-semibold w-10 text-center"
            style={{ color: (sleepQuality ?? 0) >= 7 ? '#6B9080' : (sleepQuality ?? 0) <= 3 ? '#D4A0A0' : '#CCB167' }}
          >
            {sleepQuality ?? 0}
          </span>
        </div>
      </div>

      <MedStatusCard log={log} availableMeds={prefill.availableMeds} onOpenDetails={onOpenDetails} />

      <FoodQuickRow logId={log.id} recentMeals={recentMeals} onOpenDetails={onOpenDetails} />

      <SymptomPillRow
        logId={log.id}
        initialSymptoms={initialSymptoms}
        topPills={prefill.topPills}
        label="Any symptoms on waking?"
        activeProblems={activeProblems}
      />

      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
      >
        <label className="block text-sm font-medium mb-3" style={{ color: '#3a3a3a' }}>
          Pain on waking
          {prefill.yesterday.overall_pain !== null ? (
            <span className="ml-2 text-xs" style={{ color: '#8a8a8a' }}>
              Yesterday evening was <span className="tabular">{prefill.yesterday.overall_pain}</span>/10
            </span>
          ) : (
            <span className="ml-2 text-xs" style={{ color: '#8a8a8a' }}>
              No pain logged last night
            </span>
          )}
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={10}
            value={pain}
            onChange={e => onPainChange(Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: '#D4A0A0' }}
            aria-label="Pain on waking, 0 to 10"
          />
          <span
            className="tabular text-2xl font-semibold w-10 text-center"
            style={{ color: pain >= 6 ? '#D4A0A0' : '#6B9080' }}
          >
            {pain}
          </span>
        </div>
      </div>

      <PainRegionRow
        logId={log.id}
        initialPainPoints={initialPainPoints}
        intensity={pain}
        onAutoBumpIntensity={(n) => { setPain(n); save({ overall_pain: n }) }}
      />

      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
      >
        <label className="block text-sm font-medium mb-3" style={{ color: '#3a3a3a' }}>
          Stress entering the day
          <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>0 calm to 10 overwhelming</span>
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={10}
            value={stress}
            onChange={e => { const v = Number(e.target.value); setStress(v); save({ stress: v }) }}
            className="flex-1"
            style={{ accentColor: '#CCB167' }}
            aria-label="Stress level entering the day, 0 to 10"
          />
          <span
            className="tabular text-2xl font-semibold w-10 text-center"
            style={{ color: stress >= 7 ? '#D4A0A0' : stress >= 4 ? '#CCB167' : '#6B9080' }}
          >
            {stress}
          </span>
        </div>
      </div>

      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium" style={{ color: '#3a3a3a' }}>
            Anything notable about the night?
          </label>
          <VoiceNote
            onTranscript={t => {
              const merged = notes ? `${notes} ${t}` : t
              setNotes(merged)
              save({ notes: merged })
            }}
          />
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={onNotesBlur}
          rows={3}
          placeholder="Dreams, wake-ups, how you feel as you get up, or tap Voice"
          className="w-full rounded-xl p-3 text-sm resize-none focus:outline-none"
          style={{ background: '#FAFAF7', border: '1px solid rgba(107, 144, 128, 0.15)', color: '#3a3a3a' }}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onOpenDetails}
          className="press-feedback text-sm underline"
          style={{ color: '#6B9080' }}
        >
          Log more detail
        </button>
        <span className="text-xs" style={{ color: '#8a8a8a' }}>
          {saving === 'saving' ? 'Saving' : saving === 'saved' ? 'Saved' : 'We save as you type'}
        </span>
      </div>

      <HydrationRow date={prefill.date} />

      <OrthostaticRow date={prefill.date} />

      <BreathingExercise />

      <GratitudeQuickInput logId={log.id} initialEntries={initialGratitudes} />

      <QuickImportButton />

      <AskAICta context="morning" />

      <CheckInDoneButton
        label="Done with morning"
        sectionsLogged={[
          sleepQuality !== null,
          initialMood !== null,
          pain > 0,
          notes.trim().length > 0,
          initialPainPoints.length > 0,
        ].filter(Boolean).length}
        totalSections={5}
      />
    </div>
  )
}
