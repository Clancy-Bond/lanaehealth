'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import type {
  DailyLog,
  PainPoint,
  Symptom,
  FoodEntry,
  CycleEntry,
  NcImported,
  MoodEntry,
  SleepDetail,
  CustomTrackable,
  CustomTrackableEntry,
  GratitudeEntry,
  LogPeriod,
  SymptomCategory,
  Severity,
  MealType,
} from '@/lib/types'
import type { RecentMeal } from '@/app/log/page'
import { updateDailyLog } from '@/lib/api/logs'
import { saveSymptomsBatch } from '@/lib/api/symptoms'
import { addFoodEntry, deleteFoodEntry } from '@/lib/api/food'
import { updateCycleEntry } from '@/lib/api/cycle'

// New carousel card components
import MoodCard from './MoodCard'
import CoreVitalsCard from './CoreVitalsCard'
import SleepDetailCard from './SleepDetailCard'
import GratitudeCard from './GratitudeCard'
import CustomFactorsCard from './CustomFactorsCard'

// Phase 2: Enhanced tracker cards
import CycleCard from './CycleCard'
import VitalsCard from './VitalsCard'
import MedicationCard from './MedicationCard'
import WorkoutCard from './WorkoutCard'

// Existing components (we wrap them, not re-create them)
import BodyPainMap from './BodyPainMap'
import SymptomPills from './SymptomPills'
import QuickMealLog from './QuickMealLog'
import CycleQuickEntry from './CycleQuickEntry'
import MedicationEntry from './MedicationEntry'
import BowelEntry from './BowelEntry'
import SaveIndicator from './SaveIndicator'

// ── Props ───────────────────────────────────────────────────────────

interface LogCarouselProps {
  log: DailyLog
  painPoints: PainPoint[]
  symptoms: Symptom[]
  foodEntries: FoodEntry[]
  cycleEntry: CycleEntry
  recentMeals: RecentMeal[]
  ncData: NcImported | null
  streak: number
  // New data
  initialMood: MoodEntry | null
  initialSleepDetail: SleepDetail | null
  initialTrackables: CustomTrackable[]
  initialTrackableEntries: CustomTrackableEntry[]
  initialGratitudes: GratitudeEntry[]
  period?: LogPeriod
}

// ── Medication type (matches DailyLogClient) ────────────────────────

interface MedicationObject {
  name: string
  time: string
}

// ── Bowel type (matches BowelEntry) ─────────────────────────────────

interface BowelData {
  type: number | null
  urgency: boolean
  pain: boolean
  blood: boolean
}

// ── Card Section Definition ─────────────────────────────────────────

interface CardSection {
  id: string
  title: string
  periods: LogPeriod[] // which periods show this card
  hasData: () => boolean
  render: () => React.ReactNode
}

// ── Component ───────────────────────────────────────────────────────

export default function LogCarousel({
  log,
  painPoints: initialPainPoints,
  symptoms: initialSymptoms,
  foodEntries: initialFoodEntries,
  cycleEntry: initialCycleEntry,
  recentMeals,
  ncData,
  streak,
  initialMood,
  initialSleepDetail,
  initialTrackables,
  initialTrackableEntries,
  initialGratitudes,
  period,
}: LogCarouselProps) {
  // ── State ──

  const [painPointCount, setPainPointCount] = useState(initialPainPoints.length)
  const [symptomCount, setSymptomCount] = useState(initialSymptoms.length)
  const [foodCount, setFoodCount] = useState(initialFoodEntries.length)
  const [cycleData, setCycleData] = useState({
    menstruation: initialCycleEntry.menstruation,
    flowLevel: initialCycleEntry.flow_level,
  })
  const [medications, setMedications] = useState<MedicationObject[]>(() => {
    const raw = (log as unknown as Record<string, unknown>).medications
    if (Array.isArray(raw)) return raw as MedicationObject[]
    return []
  })
  const [bowelData, setBowelData] = useState<BowelData>(() => {
    const raw = (log as unknown as Record<string, unknown>).bowel
    if (raw && typeof raw === 'object') return raw as BowelData
    return { type: null, urgency: false, pain: false, blood: false }
  })

  // Notes
  const [triggers, setTriggers] = useState(log.triggers ?? '')
  const [whatHelped, setWhatHelped] = useState(log.what_helped ?? '')
  const [dailyImpact, setDailyImpact] = useState(log.daily_impact ?? '')
  const [notesSaved, setNotesSaved] = useState(false)
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mood state (placeholder -- MoodCard is a separate component)
  const [moodScore, setMoodScore] = useState<number | null>(initialMood?.mood_score ?? null)

  // Carousel tracking
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const observerRef = useRef<IntersectionObserver | null>(null)

  const today = format(new Date(), 'EEEE, MMMM d')

  // ── Save handlers (identical patterns to DailyLogClient) ──

  // Core vitals (pain, energy, stress) are now handled by CoreVitalsCard internally

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

  const handleMedicationSave = useCallback(
    async (meds: MedicationObject[]) => {
      setMedications(meds)
      await updateDailyLog(
        log.id,
        { medications: meds } as unknown as Parameters<typeof updateDailyLog>[1]
      )
    },
    [log.id]
  )

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

  // ── Card section definitions ──

  const allSections: CardSection[] = useMemo(
    () => [
      // 1. MoodCard
      {
        id: 'mood',
        title: 'Mood',
        periods: ['morning', 'full_day'],
        hasData: () => moodScore !== null,
        render: () => (
          <MoodCard
            logId={log.id}
            initialMood={initialMood}
            onComplete={() => setMoodScore(initialMood?.mood_score ?? 1)}
          />
        ),
      },
      // 2. CoreVitalsCard (pain + energy + stress)
      {
        id: 'core-vitals',
        title: 'Core Vitals',
        periods: ['morning', 'afternoon', 'evening', 'full_day'],
        hasData: () =>
          log.overall_pain !== null ||
          log.fatigue !== null ||
          log.stress !== null,
        render: () => (
          <CoreVitalsCard
            logId={log.id}
            initialPain={log.overall_pain}
            initialFatigue={log.fatigue}
            initialStress={log.stress}
          />
        ),
      },
      // 3. BodyPainMap
      {
        id: 'pain-map',
        title: 'Pain Map',
        periods: ['full_day'],
        hasData: () => painPointCount > 0,
        render: () => (
          <BodyPainMap
            logId={log.id}
            initialPainPoints={initialPainPoints}
            onCountChange={setPainPointCount}
          />
        ),
      },
      // 4. SymptomPills
      {
        id: 'symptoms',
        title: 'Symptoms',
        periods: ['afternoon', 'full_day'],
        hasData: () => symptomCount > 0,
        render: () => (
          <SymptomPills
            logId={log.id}
            initialSymptoms={initialSymptoms}
            onSaveBatch={handleSymptomSave}
          />
        ),
      },
      // 5. SleepDetailCard
      {
        id: 'sleep',
        title: 'Sleep Details',
        periods: ['morning', 'full_day'],
        hasData: () => initialSleepDetail !== null,
        render: () => (
          <SleepDetailCard
            logId={log.id}
            initialSleepDetail={initialSleepDetail}
          />
        ),
      },
      // 6. CycleQuickEntry
      {
        id: 'cycle',
        title: 'Cycle',
        periods: ['full_day'],
        hasData: () => cycleData.menstruation || cycleData.flowLevel !== null,
        render: () => (
          <CycleQuickEntry
            initialEntry={initialCycleEntry}
            onSave={handleCycleSave}
            ncData={ncData}
          />
        ),
      },
      // 7. QuickMealLog
      {
        id: 'food',
        title: 'Food',
        periods: ['afternoon', 'evening', 'full_day'],
        hasData: () => foodCount > 0,
        render: () => (
          <QuickMealLog
            logId={log.id}
            initialEntries={initialFoodEntries}
            recentMeals={recentMeals}
            onAdd={handleFoodAdd}
            onDelete={handleFoodDelete}
          />
        ),
      },
      // 8. MedicationEntry
      {
        id: 'medications',
        title: 'Medications',
        periods: ['evening', 'full_day'],
        hasData: () => medications.length > 0,
        render: () => (
          <MedicationEntry
            initialMedications={medications}
            onSave={handleMedicationSave}
          />
        ),
      },
      // 9. BowelEntry
      {
        id: 'bowel',
        title: 'Bowel',
        periods: ['evening', 'full_day'],
        hasData: () => bowelData.type !== null,
        render: () => (
          <BowelEntry
            initialData={bowelData}
            onSave={handleBowelSave}
          />
        ),
      },
      // 10. Enhanced Cycle Tracking (multi-signal)
      {
        id: 'cycle-enhanced',
        title: 'Cycle Tracking',
        periods: ['full_day'],
        hasData: () => cycleData.menstruation || cycleData.flowLevel !== null,
        render: () => (
          <CycleCard
            date={log.date}
            initialEntry={initialCycleEntry}
            ouraTemp={null}
            ouraHrv={null}
            ouraRhr={null}
          />
        ),
      },
      // 11. Positional Vitals (POTS)
      {
        id: 'vitals',
        title: 'Vitals',
        periods: ['morning', 'full_day'],
        hasData: () => false,
        render: () => (
          <VitalsCard date={log.date} />
        ),
      },
      // 12. Enhanced Medication Tracking
      {
        id: 'medications-enhanced',
        title: 'Medications',
        periods: ['morning', 'evening', 'full_day'],
        hasData: () => medications.length > 0,
        render: () => (
          <MedicationCard date={log.date} />
        ),
      },
      // 13. Workout / Activity
      {
        id: 'workout',
        title: 'Activity',
        periods: ['afternoon', 'evening', 'full_day'],
        hasData: () => false,
        render: () => (
          <WorkoutCard date={log.date} />
        ),
      },
      // 14. CustomFactorsCard
      {
        id: 'custom-factors',
        title: 'My Factors',
        periods: ['afternoon', 'full_day'],
        hasData: () =>
          initialTrackableEntries.length > 0 || initialTrackables.length > 0,
        render: () => (
          <CustomFactorsCard
            logId={log.id}
            initialTrackables={initialTrackables}
            initialEntries={initialTrackableEntries}
          />
        ),
      },
      // 11. Gratitude + Notes
      {
        id: 'gratitude-notes',
        title: 'Gratitude & Notes',
        periods: ['evening', 'full_day'],
        hasData: () =>
          initialGratitudes.length > 0 ||
          Boolean(triggers) ||
          Boolean(whatHelped) ||
          Boolean(dailyImpact),
        render: () => (
          <div className="space-y-5">
            <GratitudeCard logId={log.id} initialGratitudes={initialGratitudes} />

            {/* Notes section */}
            <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Notes
                </h3>
                <SaveIndicator show={notesSaved} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Triggers noticed
                </label>
                <textarea
                  value={triggers}
                  onChange={(e) => { setTriggers(e.target.value); saveNotes('triggers', e.target.value) }}
                  placeholder="What might have caused symptoms today?"
                  rows={2}
                  className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  What helped
                </label>
                <textarea
                  value={whatHelped}
                  onChange={(e) => { setWhatHelped(e.target.value); saveNotes('what_helped', e.target.value) }}
                  placeholder="What made you feel better?"
                  rows={2}
                  className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Daily impact
                </label>
                <textarea
                  value={dailyImpact}
                  onChange={(e) => { setDailyImpact(e.target.value); saveNotes('daily_impact', e.target.value) }}
                  placeholder="How did symptoms affect your day?"
                  rows={2}
                  className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      log,
      initialPainPoints,
      initialSymptoms,
      initialFoodEntries,
      initialCycleEntry,
      recentMeals,
      ncData,
      initialMood,
      initialSleepDetail,
      initialTrackables,
      initialTrackableEntries,
      initialGratitudes,
      medications,
      bowelData,
      moodScore,
      painPointCount,
      symptomCount,
      foodCount,
      cycleData,
      triggers,
      whatHelped,
      dailyImpact,
      notesSaved,
    ]
  )

  // Filter sections by period
  const activePeriod: LogPeriod = period ?? 'full_day'
  const visibleSections = useMemo(
    () => allSections.filter((s) => s.periods.includes(activePeriod)),
    [allSections, activePeriod]
  )

  // ── IntersectionObserver for active card tracking ──

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = cardRefs.current.indexOf(entry.target as HTMLDivElement)
            if (idx !== -1) {
              setActiveIndex(idx)
            }
          }
        }
      },
      {
        root: scrollRef.current,
        threshold: 0.6,
      }
    )

    cardRefs.current.forEach((ref) => {
      if (ref) observerRef.current?.observe(ref)
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [visibleSections.length])

  // ── Jump to card on dot tap ──

  const scrollToCard = useCallback((index: number) => {
    const card = cardRefs.current[index]
    if (card && scrollRef.current) {
      const containerRect = scrollRef.current.getBoundingClientRect()
      const cardRect = card.getBoundingClientRect()
      const scrollLeft =
        scrollRef.current.scrollLeft +
        cardRect.left -
        containerRect.left -
        (containerRect.width - cardRect.width) / 2
      scrollRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
    }
  }, [])

  // ── Render ──

  return (
    <div className="flex flex-col pb-safe" style={{ minHeight: '100dvh' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
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
              <>&#x1F525; {streak} day streak</>
            ) : (
              'Start your streak!'
            )}
          </span>
        </div>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {today}
        </p>
      </div>

      {/* Progress dots -- smart scaling for many cards (Instagram-style) */}
      <div className="flex items-center justify-center gap-1 px-4 py-2">
        {visibleSections.map((section, i) => {
          const distance = Math.abs(i - activeIndex)
          const total = visibleSections.length
          // For 10+ cards, scale down dots far from active
          const isManyCards = total > 9
          const isActive = i === activeIndex
          const isNear = distance <= 2
          const isMid = distance <= 4
          // Determine dot size
          let dotWidth = isActive ? 18 : 6
          let dotHeight = 6
          let dotOpacity = 1
          if (isManyCards && !isActive) {
            if (isNear) { dotWidth = 6; dotOpacity = 1 }
            else if (isMid) { dotWidth = 4; dotHeight = 4; dotOpacity = 0.6 }
            else { dotWidth = 3; dotHeight = 3; dotOpacity = 0.3 }
          }

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToCard(i)}
              className="rounded-full"
              style={{
                width: dotWidth,
                height: dotHeight,
                opacity: dotOpacity,
                background:
                  isActive
                    ? 'var(--accent-sage)'
                    : section.hasData()
                    ? 'var(--accent-sage)'
                    : 'var(--border)',
                transition: 'all 0.2s ease',
                border: 'none',
                padding: 0,
                minWidth: 0,
                minHeight: 0,
              }}
              aria-label={`Go to ${section.title}${section.hasData() ? ' (has data)' : ''}`}
            />
          )
        })}
      </div>

      {/* Card label + swipe hint */}
      <div className="px-4 pb-1 flex items-center justify-center gap-2">
        <p
          className="text-xs font-medium text-center"
          style={{ color: 'var(--text-muted)' }}
        >
          {visibleSections[activeIndex]?.title ?? ''}
          <span style={{ opacity: 0.5 }}>
            {' '}
            {activeIndex + 1}/{visibleSections.length}
          </span>
        </p>
        {activeIndex === 0 && (
          <span
            className="swipe-hint text-[10px] font-medium"
            style={{ color: 'var(--accent-sage)', opacity: 0.6 }}
          >
            swipe &rarr;
          </span>
        )}
      </div>

      {/* Carousel container */}
      <div
        ref={scrollRef}
        className="hide-scrollbar overflow-x-auto overflow-y-auto pb-4"
        style={{
          scrollSnapType: 'x mandatory',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          paddingLeft: 16,
          paddingRight: 16,
          scrollPaddingLeft: 16,
          scrollPaddingRight: 16,
          WebkitOverflowScrolling: 'touch',
          flex: 1,
        }}
      >
        {visibleSections.map((section, i) => (
          <div
            key={section.id}
            ref={(el) => {
              cardRefs.current[i] = el
            }}
            className="rounded-2xl border p-5"
            style={{
              scrollSnapAlign: 'start',
              flexShrink: 0,
              width: 'calc(100vw - 44px)',
              maxWidth: 560,
              background: 'var(--bg-card)',
              borderColor: 'var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Card title (skip for sections that render their own, like CustomFactorsCard) */}
            {section.id !== 'custom-factors' && section.id !== 'gratitude-notes' && (
              <h2
                className="mb-4 text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {section.title}
              </h2>
            )}
            {section.render()}

            {/* Card navigation buttons */}
            <div
              className="flex items-center justify-between mt-5 pt-4"
              style={{ borderTop: '1px solid var(--border-light)' }}
            >
              {i > 0 ? (
                <button
                  type="button"
                  onClick={() => scrollToCard(i - 1)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium"
                  style={{
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-elevated)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Back
                </button>
              ) : (
                <div />
              )}

              {i < visibleSections.length - 1 ? (
                <button
                  type="button"
                  onClick={() => scrollToCard(i + 1)}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{
                    color: 'var(--text-inverse)',
                    background: 'var(--accent-sage)',
                    boxShadow: '0 2px 8px rgba(107, 144, 128, 0.25)',
                  }}
                >
                  Next
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <a
                  href="/"
                  className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{
                    color: 'var(--text-inverse)',
                    background: 'var(--accent-sage)',
                    boxShadow: '0 2px 8px rgba(107, 144, 128, 0.25)',
                    textDecoration: 'none',
                  }}
                >
                  Done
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// No more inline placeholder components - using real MoodCard, SleepDetailCard, GratitudeCard
