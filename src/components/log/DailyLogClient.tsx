'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import type {
  DailyLog,
  PainPoint,
  Symptom,
  FoodEntry,
  CycleEntry,
  NcImported,
  SymptomCategory,
  Severity,
  MealType,
} from '@/lib/types'
import type { RecentMeal } from '@/app/log/page'
import { updateDailyLog } from '@/lib/api/logs'
import { saveSymptomsBatch } from '@/lib/api/symptoms'
import { addFoodEntry, deleteFoodEntry } from '@/lib/api/food'
import { updateCycleEntry } from '@/lib/api/cycle'

import CollapsibleSection from './CollapsibleSection'
import PainSlider from './PainSlider'
import BodyPainMap from './BodyPainMap'
import EnergySlider from './EnergySlider'
import BloatingSlider from './BloatingSlider'
import StressSlider from './StressSlider'
import SymptomPills from './SymptomPills'
import QuickMealLog from './QuickMealLog'
import CycleQuickEntry from './CycleQuickEntry'
import MedicationEntry from './MedicationEntry'
import BowelEntry from './BowelEntry'
import SaveIndicator from './SaveIndicator'

interface DailyLogClientProps {
  log: DailyLog
  painPoints: PainPoint[]
  symptoms: Symptom[]
  foodEntries: FoodEntry[]
  cycleEntry: CycleEntry
  recentMeals: RecentMeal[]
  ncData: NcImported | null
  streak: number
}

interface MedicationObject {
  name: string
  time: string
}

export default function DailyLogClient({
  log,
  painPoints: initialPainPoints,
  symptoms: initialSymptoms,
  foodEntries: initialFoodEntries,
  cycleEntry: initialCycleEntry,
  recentMeals,
  ncData,
  streak,
}: DailyLogClientProps) {
  // Summary states for collapsed sections
  const [painPointCount, setPainPointCount] = useState(initialPainPoints.length)
  const [symptomCount, setSymptomCount] = useState(initialSymptoms.length)
  const [foodCount, setFoodCount] = useState(initialFoodEntries.length)
  const [cycleData, setCycleData] = useState({
    menstruation: initialCycleEntry.menstruation,
    flowLevel: initialCycleEntry.flow_level,
  })
  const [medications, setMedications] = useState<MedicationObject[]>(() => {
    // Parse JSONB medications from daily log
    const raw = (log as unknown as Record<string, unknown>).medications
    if (Array.isArray(raw)) return raw as MedicationObject[]
    return []
  })

  // Bowel state
  interface BowelData {
    type: number | null
    urgency: boolean
    pain: boolean
    blood: boolean
  }
  const [bowelData, setBowelData] = useState<BowelData>(() => {
    const raw = (log as unknown as Record<string, unknown>).bowel
    if (raw && typeof raw === 'object') return raw as BowelData
    return { type: null, urgency: false, pain: false, blood: false }
  })

  // Notes state
  const [triggers, setTriggers] = useState(log.triggers ?? '')
  const [whatHelped, setWhatHelped] = useState(log.what_helped ?? '')
  const [dailyImpact, setDailyImpact] = useState(log.daily_impact ?? '')
  const [notesSaved, setNotesSaved] = useState(false)
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const today = format(new Date(), 'EEEE, MMMM d')

  // ── Pain save handler ──
  const handlePainSave = useCallback(
    async (value: number) => {
      await updateDailyLog(log.id, { overall_pain: value })
    },
    [log.id]
  )

  // ── Energy save handler ──
  const handleEnergySave = useCallback(
    async (fatigue: number) => {
      await updateDailyLog(log.id, { fatigue })
    },
    [log.id]
  )

  // ── Bloating save handler ──
  const handleBloatingSave = useCallback(
    async (value: number) => {
      await updateDailyLog(log.id, { bloating: value })
    },
    [log.id]
  )

  // ── Stress save handler ──
  const handleStressSave = useCallback(
    async (value: number) => {
      await updateDailyLog(log.id, { stress: value })
    },
    [log.id]
  )

  // ── Symptom batch save ──
  const handleSymptomSave = useCallback(
    async (
      logId: string,
      symptoms: { category: SymptomCategory; symptom: string; severity: Severity }[]
    ) => {
      await saveSymptomsBatch(logId, symptoms)
      setSymptomCount(symptoms.length)
    },
    []
  )

  // ── Food handlers ──
  const handleFoodAdd = useCallback(
    async (input: {
      log_id: string
      meal_type: MealType
      food_items: string
      flagged_triggers: string[]
    }) => {
      const entry = await addFoodEntry(input)
      setFoodCount((prev) => prev + 1)
      return entry
    },
    []
  )

  const handleFoodDelete = useCallback(async (id: string) => {
    await deleteFoodEntry(id)
    setFoodCount((prev) => Math.max(0, prev - 1))
  }, [])

  // ── Cycle save handler ──
  const handleCycleSave = useCallback(
    async (
      date: string,
      fields: Partial<Omit<CycleEntry, 'id' | 'date' | 'created_at'>>
    ) => {
      await updateCycleEntry(date, fields)
      if ('menstruation' in fields) {
        setCycleData((prev) => ({
          ...prev,
          menstruation: fields.menstruation ?? prev.menstruation,
        }))
      }
      if ('flow_level' in fields) {
        setCycleData((prev) => ({
          ...prev,
          flowLevel: fields.flow_level ?? prev.flowLevel,
        }))
      }
    },
    []
  )

  // ── Medication save handler ──
  const handleMedicationSave = useCallback(
    async (meds: MedicationObject[]) => {
      setMedications(meds)
      // medications is a JSONB column not in the DailyLog TS type
      // Use a narrow cast to send the field through
      await updateDailyLog(
        log.id,
        { medications: meds } as unknown as Parameters<typeof updateDailyLog>[1]
      )
    },
    [log.id]
  )

  // ── Bowel save handler ──
  const handleBowelSave = useCallback(
    async (data: BowelData) => {
      setBowelData(data)
      await updateDailyLog(
        log.id,
        { bowel: data } as unknown as Parameters<typeof updateDailyLog>[1]
      )
    },
    [log.id]
  )

  // ── Notes debounced save ──
  const saveNotes = useCallback(
    (field: 'triggers' | 'what_helped' | 'daily_impact', value: string) => {
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
      notesTimerRef.current = setTimeout(async () => {
        try {
          await updateDailyLog(log.id, { [field]: value })
          setNotesSaved(true)
          setTimeout(() => setNotesSaved(false), 1600)
        } catch {
          // Silently fail
        }
      }, 800)
    },
    [log.id]
  )

  useEffect(() => {
    return () => {
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    }
  }, [])

  // ── Summary strings ──
  const painMapSummary =
    painPointCount > 0
      ? `${painPointCount} pain point${painPointCount > 1 ? 's' : ''}`
      : 'No pain points'

  const bloatingSummary =
    log.bloating != null && log.bloating > 0
      ? `${log.bloating}/10`
      : 'Not set'

  const stressSummary =
    log.stress != null && log.stress > 0
      ? `${log.stress}/10`
      : 'Not set'

  const symptomSummary =
    symptomCount > 0
      ? `${symptomCount} symptom${symptomCount > 1 ? 's' : ''} logged`
      : 'No symptoms'

  const cycleSummary = cycleData.menstruation
    ? `Period${cycleData.flowLevel ? ', ' + cycleData.flowLevel + ' flow' : ''}`
    : 'No period'

  const foodSummary =
    foodCount > 0
      ? `${foodCount} meal${foodCount > 1 ? 's' : ''} logged`
      : 'No meals'

  const medSummary =
    medications.length > 0
      ? medications
          .slice(0, 3)
          .map((m) => m.name)
          .join(', ') + (medications.length > 3 ? '...' : '')
      : 'None taken'

  const bowelSummary = bowelData.type
    ? `Type ${bowelData.type}${bowelData.urgency ? ', urgent' : ''}${bowelData.pain ? ', pain' : ''}${bowelData.blood ? ', blood' : ''}`
    : 'Not logged'

  const noteTexts = [triggers, whatHelped, dailyImpact].filter(Boolean)
  const notesSummary =
    noteTexts.length > 0
      ? noteTexts[0].slice(0, 30) + (noteTexts[0].length > 30 ? '...' : '')
      : 'No notes'

  return (
    <div className="space-y-3 px-4 pb-safe pt-4">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Daily Log
          </h1>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              background: streak > 0 ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
              color: streak > 0 ? 'var(--accent-sage)' : 'var(--text-muted)',
            }}
          >
            {streak > 0 ? (
              <>🔥 {streak} day streak</>
            ) : (
              'Start your streak!'
            )}
          </span>
        </div>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {today}
        </p>
      </div>

      {/* Pain Section */}
      <CollapsibleSection title="Pain" defaultOpen>
        <PainSlider initialValue={log.overall_pain} onSave={handlePainSave} />
      </CollapsibleSection>

      {/* Pain Map Section */}
      <CollapsibleSection title="Pain Map" subtitle={painMapSummary}>
        <BodyPainMap
          logId={log.id}
          initialPainPoints={initialPainPoints}
          onCountChange={setPainPointCount}
        />
      </CollapsibleSection>

      {/* Energy Section */}
      <CollapsibleSection title="Energy" defaultOpen>
        <EnergySlider
          initialFatigue={log.fatigue}
          onSave={handleEnergySave}
        />
      </CollapsibleSection>

      {/* Bloating Section */}
      <CollapsibleSection title="Bloating" subtitle={bloatingSummary}>
        <BloatingSlider
          initialValue={log.bloating}
          onSave={handleBloatingSave}
        />
      </CollapsibleSection>

      {/* Stress Section */}
      <CollapsibleSection title="Stress" subtitle={stressSummary}>
        <StressSlider
          initialValue={log.stress}
          onSave={handleStressSave}
        />
      </CollapsibleSection>

      {/* Symptoms Section */}
      <CollapsibleSection title="Symptoms" subtitle={symptomSummary}>
        <SymptomPills
          logId={log.id}
          initialSymptoms={initialSymptoms}
          onSaveBatch={handleSymptomSave}
        />
      </CollapsibleSection>

      {/* Cycle Section */}
      <CollapsibleSection title="Cycle" subtitle={cycleSummary}>
        <CycleQuickEntry
          initialEntry={initialCycleEntry}
          onSave={handleCycleSave}
          ncData={ncData}
        />
      </CollapsibleSection>

      {/* Bowel Section */}
      <CollapsibleSection title="Bowel" subtitle={bowelSummary}>
        <BowelEntry
          initialData={bowelData}
          onSave={handleBowelSave}
        />
      </CollapsibleSection>

      {/* Food Section */}
      <CollapsibleSection title="Food" subtitle={foodSummary}>
        <QuickMealLog
          logId={log.id}
          initialEntries={initialFoodEntries}
          recentMeals={recentMeals}
          onAdd={handleFoodAdd}
          onDelete={handleFoodDelete}
        />
      </CollapsibleSection>

      {/* Medications Section */}
      <CollapsibleSection title="Medications" subtitle={medSummary}>
        <MedicationEntry
          initialMedications={medications}
          onSave={handleMedicationSave}
        />
      </CollapsibleSection>

      {/* Notes Section */}
      <CollapsibleSection title="Notes" subtitle={notesSummary}>
        <div className="space-y-3">
          <div className="flex justify-end">
            <SaveIndicator show={notesSaved} />
          </div>

          <div>
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Triggers noticed
            </label>
            <textarea
              value={triggers}
              onChange={(e) => {
                setTriggers(e.target.value)
                saveNotes('triggers', e.target.value)
              }}
              placeholder="What seemed to make things worse?"
              rows={2}
              className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              What helped
            </label>
            <textarea
              value={whatHelped}
              onChange={(e) => {
                setWhatHelped(e.target.value)
                saveNotes('what_helped', e.target.value)
              }}
              placeholder="Anything that improved symptoms?"
              rows={2}
              className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Daily impact
            </label>
            <textarea
              value={dailyImpact}
              onChange={(e) => {
                setDailyImpact(e.target.value)
                saveNotes('daily_impact', e.target.value)
              }}
              placeholder="How did today affect your life?"
              rows={2}
              className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}
