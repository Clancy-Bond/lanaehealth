'use client'

import { useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import PrefilledDataCard from './PrefilledDataCard'
import VoiceNote from './VoiceNote'
import InsightBanner from './InsightBanner'
import MedStatusCard from './MedStatusCard'
import FoodQuickRow from './FoodQuickRow'
import NextAppointmentCard from './NextAppointmentCard'
import PainRegionRow from './PainRegionRow'
import CheckInDoneButton from './CheckInDoneButton'
import HydrationRow from './HydrationRow'
import AskAICta from './AskAICta'
import QuickImportButton from './QuickImportButton'
import FlareToggle from './FlareToggle'
import ShareDailySummary from './ShareDailySummary'
import { updateDailyLog } from '@/lib/api/logs'
import { addSymptom, deleteSymptom, updateSymptomSeverity } from '@/lib/api/symptoms'
import { refreshTodayNarrative } from '@/lib/log/narrative-refresh'
import type { CheckInPrefill } from '@/lib/log/prefill'
import type { DailyLog, Symptom, SymptomCategory, Severity, PainPoint, MoodEntry } from '@/lib/types'

interface RecentMealLite {
  meal_type: string | null
  food_items: string
  flagged_triggers: string[]
  logged_at: string
}

interface EveningCheckInProps {
  log: DailyLog
  prefill: CheckInPrefill
  initialSymptoms: Symptom[]
  initialPainPoints: PainPoint[]
  initialMood: MoodEntry | null
  recentMeals: RecentMealLite[]
  onOpenDetails: () => void
}

// Pills come from prefill.topPills (user-personalized, most-used last 90 days)

const FEELING_OPTIONS: Array<{ value: number; emoji: string; label: string }> = [
  { value: 1, emoji: '😣', label: 'Rough' },
  { value: 2, emoji: '😔', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Great' },
]


function formatNum(n: number | null | undefined, unit = ''): string {
  if (n === null || n === undefined) return '--'
  return `${Math.round(n)}${unit}`
}

function feelingToPain(f: number): number {
  return Math.max(0, Math.min(10, (6 - f) * 2))
}

function painToFeeling(p: number | null): number | null {
  if (p === null) return null
  return Math.max(1, Math.min(5, 6 - Math.round(p / 2)))
}

export default function EveningCheckIn({
  log,
  prefill,
  initialSymptoms,
  initialPainPoints,
  initialMood,
  recentMeals,
  onOpenDetails,
}: EveningCheckInProps) {
  const pillNames = useMemo(() => prefill.topPills.map(p => p.symptom), [prefill.topPills])
  const pillCategories = useMemo(() => {
    const m = new Map<string, SymptomCategory>()
    for (const p of prefill.topPills) m.set(p.symptom, p.category)
    return m
  }, [prefill.topPills])

  const initialMap = useMemo(() => {
    const map = new Map<string, { id: string; severity: Severity }>()
    const list = Array.isArray(initialSymptoms) ? initialSymptoms : []
    for (const s of list) {
      if (pillNames.includes(s.symptom)) {
        map.set(s.symptom, { id: s.id, severity: (s.severity as Severity) ?? 'moderate' })
      }
    }
    return map
  }, [initialSymptoms, pillNames])

  const [feeling, setFeeling] = useState<number | null>(painToFeeling(log.overall_pain))
  const [symptomIds, setSymptomIds] = useState<Map<string, { id: string; severity: Severity }>>(initialMap)
  const [pain, setPain] = useState<number>(log.overall_pain ?? prefill.yesterday.overall_pain ?? 0)
  const [stress, setStress] = useState<number>(log.stress ?? 0)
  const [notes, setNotes] = useState<string>(log.notes ?? '')
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')

  const save = useCallback(
    async (fields: Partial<DailyLog>) => {
      setSaving('saving')
      try {
        await updateDailyLog(log.id, fields)
        setSaving('saved')
        setTimeout(() => setSaving('idle'), 1500)
      } catch {
        setSaving('idle')
      }
    },
    [log.id]
  )

  const onFeeling = (v: number) => {
    setFeeling(v)
    const p = feelingToPain(v)
    setPain(p)
    save({ overall_pain: p, fatigue: p })
  }

  const toggleSymptom = async (s: string) => {
    const existing = symptomIds.get(s)
    setSaving('saving')
    try {
      if (!existing) {
        // null -> moderate: add
        const cat = pillCategories.get(s)
        if (!cat) throw new Error(`no category for ${s}`)
        const created = await addSymptom({
          log_id: log.id,
          category: cat,
          symptom: s,
          severity: 'moderate',
        })
        setSymptomIds(prev => {
          const next = new Map(prev)
          next.set(s, { id: created.id, severity: 'moderate' })
          return next
        })
      } else if (existing.severity === 'moderate') {
        // moderate -> severe: update
        await updateSymptomSeverity(existing.id, 'severe')
        setSymptomIds(prev => {
          const next = new Map(prev)
          next.set(s, { id: existing.id, severity: 'severe' })
          return next
        })
      } else {
        // severe (or mild) -> remove
        await deleteSymptom(existing.id)
        setSymptomIds(prev => {
          const next = new Map(prev)
          next.delete(s)
          return next
        })
      }
      setSaving('saved')
      refreshTodayNarrative()
      setTimeout(() => setSaving('idle'), 1500)
    } catch {
      setSaving('idle')
    }
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

  const dateLabel = format(new Date(prefill.date), 'EEEE, MMMM d')

  const activityStats = [
    { label: 'Steps', value: formatNum(prefill.oura?.raw_json?.steps as number | null | undefined), accent: true },
    { label: 'Active kcal', value: formatNum(prefill.oura?.raw_json?.active_calories as number | null | undefined) },
    { label: 'Readiness', value: formatNum(prefill.oura?.readiness_score ?? null, '/100'), accent: true },
    { label: 'Resting HR', value: formatNum(prefill.oura?.resting_hr ?? null, ' bpm') },
  ]

  const weather = prefill.weather
  const weatherHasAny =
    weather !== null &&
    (weather.temperature_c !== null ||
      weather.barometric_pressure_hpa !== null ||
      weather.humidity_pct !== null)
  const weatherStats = weather && weatherHasAny
    ? [
        { label: 'Temp', value: formatNum(weather.temperature_c, '°C') },
        { label: 'Pressure', value: formatNum(weather.barometric_pressure_hpa, ' hPa') },
        { label: 'Humidity', value: formatNum(weather.humidity_pct, '%') },
      ]
    : null

  return (
    <div className="mx-auto max-w-2xl route-desktop-wide px-4 pt-6 pb-28 space-y-5" style={{ background: '#FAFAF7' }}>
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: '#3a3a3a' }}>
          How was today?
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8a8a8a' }}>
          {dateLabel} &middot; Here&apos;s your day
        </p>
        {(log.overall_pain !== null || initialMap.size > 0 || (log.notes && log.notes.length > 0)) ? (
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
        <PrefilledDataCard title="Your day" subtitle="From Oura" stats={activityStats} />
      ) : null}

      {weatherStats ? (
        <PrefilledDataCard title="Weather" stats={weatherStats} />
      ) : null}

      <MedStatusCard log={log} availableMeds={prefill.availableMeds} onOpenDetails={onOpenDetails} />

      <FoodQuickRow logId={log.id} recentMeals={recentMeals} onOpenDetails={onOpenDetails} />

      <HydrationRow date={prefill.date} />

      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
      >
        <label className="block text-sm font-medium mb-3" style={{ color: '#3a3a3a' }}>
          How did your body feel?
          <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>Sets today&apos;s pain and fatigue</span>
        </label>
        <div className="flex justify-between gap-2">
          {FEELING_OPTIONS.map(opt => {
            const active = feeling === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onFeeling(opt.value)}
                className="press-feedback flex-1 flex flex-col items-center gap-1 py-3 rounded-xl"
                style={{
                  background: active ? 'rgba(212, 160, 160, 0.18)' : 'transparent',
                  border: `1px solid ${active ? '#D4A0A0' : 'rgba(107, 144, 128, 0.25)'}`,
                  color: active ? '#7A3A3A' : '#3a3a3a',
                  transition: `background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)`,
                }}
                aria-pressed={active}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span className="text-xs">{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
      >
        <label className="block text-sm font-medium mb-3" style={{ color: '#3a3a3a' }}>
          Anything bothering you?
          <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>Tap what applies</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {pillNames.map(s => {
            const state = symptomIds.get(s)
            const active = !!state
            const severe = state?.severity === 'severe'
            const bg = severe ? '#A66B6B' : active ? '#D4A0A0' : 'transparent'
            const color = active ? '#fff' : '#6a6a6a'
            const border = severe ? '#A66B6B' : active ? '#D4A0A0' : 'rgba(107, 144, 128, 0.25)'
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSymptom(s)}
                className="press-feedback inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm"
                style={{
                  background: bg,
                  color,
                  border: `1px solid ${border}`,
                  transition: `background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)`,
                }}
                aria-pressed={active}
                aria-label={active ? `${s}, ${state?.severity}. Tap to cycle severity.` : s}
                title={active ? `Severity: ${state?.severity}` : 'Tap to mark'}
              >
                {s}
                {severe ? <span aria-hidden style={{ fontWeight: 700 }}>!</span> : null}
              </button>
            )
          })}
          <p className="basis-full text-xs mt-1" style={{ color: '#8a8a8a' }}>
            Tap once for moderate, again for severe, again to clear.
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
      >
        <label className="block text-sm font-medium mb-3" style={{ color: '#3a3a3a' }}>
          Pain level now
          {prefill.yesterday.overall_pain !== null ? (
            <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>
              Yesterday was <span className="tabular">{prefill.yesterday.overall_pain}</span>/10
            </span>
          ) : (
            <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>
              No pain logged yesterday
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
            aria-label="Pain level, 0 to 10"
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
        label="Where did it hurt most today?"
      />

      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
      >
        <label className="block text-sm font-medium mb-3" style={{ color: '#3a3a3a' }}>
          Stress level today
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
            aria-label="Stress level, 0 to 10"
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
            Anything notable?
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
          placeholder="What stood out about today, or tap Voice"
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

      <ShareDailySummary log={log} prefill={prefill} symptoms={initialSymptoms} />

      <QuickImportButton />

      <AskAICta context="evening" />

      <CheckInDoneButton
        label="Done with evening"
        sectionsLogged={[
          feeling !== null,
          initialMood !== null,
          pain > 0,
          symptomIds.size > 0,
          notes.trim().length > 0,
        ].filter(Boolean).length}
        totalSections={5}
      />
    </div>
  )
}
