'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import MorningCheckIn from './MorningCheckIn'
import EveningCheckIn from './EveningCheckIn'
import CheckInReminders from './CheckInReminders'
import InsightBanner from './InsightBanner'
import TodaySeveritySummary from './TodaySeveritySummary'
import WeeklySummaryCard from './WeeklySummaryCard'
import QuickImportButton from './QuickImportButton'
import LastChatCard from './LastChatCard'
import NextAppointmentCard from './NextAppointmentCard'
import OfflineQueueIndicator from './OfflineQueueIndicator'
import HydrationRow from './HydrationRow'
import AskAICta from './AskAICta'
import LogCarousel from './LogCarousel'
import { getCheckInWindow, nextWindowLabel, type CheckInWindow } from '@/lib/log/checkin-window'
import type { CheckInPrefill } from '@/lib/log/prefill'
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
} from '@/lib/types'
import type { RecentMeal } from '@/app/log/page'

interface DailyStoryClientProps {
  log: DailyLog
  prefill: CheckInPrefill
  painPoints: PainPoint[]
  symptoms: Symptom[]
  foodEntries: FoodEntry[]
  cycleEntry: CycleEntry
  recentMeals: RecentMeal[]
  ncData: NcImported | null
  streak: number
  initialMood: MoodEntry | null
  initialSleepDetail: SleepDetail | null
  initialTrackables: CustomTrackable[]
  initialTrackableEntries: CustomTrackableEntry[]
  initialGratitudes: GratitudeEntry[]
  period?: LogPeriod
  enabledModules?: string[]
}

export default function DailyStoryClient(props: DailyStoryClientProps) {
  const [initialWindow, setInitialWindow] = useState<CheckInWindow | null>(null)
  const [view, setView] = useState<'checkin' | 'details'>('checkin')
  const [manualView, setManualView] = useState<'morning' | 'evening' | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const forced = params.get('window') as CheckInWindow | null
    if (forced === 'morning' || forced === 'evening' || forced === 'offhours') {
      setInitialWindow(forced)
    } else {
      setInitialWindow(getCheckInWindow(new Date()))
    }
  }, [])

  if (initialWindow === null) {
    return (
      <div style={{ background: '#FAFAF7', minHeight: '100vh' }}>
        <OfflineQueueIndicator />
        <div className="mx-auto max-w-2xl px-4 pt-12 text-sm" style={{ color: '#8a8a8a' }}>
          Loading your day...
        </div>
      </div>
    )
  }

  const effectiveWindow = manualView ?? initialWindow

  if (view === 'details') {
    return (
      <div style={{ background: '#FAFAF7', minHeight: '100vh' }}>
        <OfflineQueueIndicator />
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <button
            onClick={() => setView('checkin')}
            className="text-sm underline"
            style={{ color: '#6B9080' }}
          >
            &larr; Back to check-in
          </button>
        </div>
        <LogCarousel {...props} />
      </div>
    )
  }

  if (effectiveWindow === 'offhours' && !manualView) {
    const dateLabel = format(new Date(props.prefill.date), 'EEEE, MMMM d')
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-28 space-y-5" style={{ background: '#FAFAF7', minHeight: '100vh' }}>
        <OfflineQueueIndicator />
        <header>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: '#3a3a3a' }}>
                Daily Story
              </h1>
              <p className="text-sm mt-1" style={{ color: '#8a8a8a' }}>{dateLabel}</p>
            </div>
            {props.streak > 0 ? (
              <div
                className="flex flex-col items-center px-3 py-2 rounded-xl"
                style={{ background: '#F5EEE6', border: '1px solid rgba(204, 177, 103, 0.3)' }}
                title={`${props.streak} day logging streak`}
              >
                <span className="text-lg font-semibold" style={{ color: '#CCB167' }}>
                  {props.streak}
                </span>
                <span className="text-[10px] uppercase tracking-wide" style={{ color: '#8a7a4a' }}>
                  day streak
                </span>
              </div>
            ) : null}
          </div>
        </header>

        <InsightBanner insight={props.prefill.insight} />

        <TodaySeveritySummary severity={props.prefill.todaySeverity} />

        <WeeklySummaryCard weekly={props.prefill.weekly} yesterdayPain={props.prefill.yesterday.overall_pain} />

        <NextAppointmentCard appointment={props.prefill.nextAppointment} />

        <HydrationRow date={props.prefill.date} />

        <LastChatCard chat={props.prefill.lastChat} />

        <QuickImportButton />

        <AskAICta context="evening" />

        <div
          className="rounded-2xl p-5"
          style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
        >
          <p className="text-sm" style={{ color: '#6a6a6a' }}>
            {nextWindowLabel()}
          </p>
          <p className="text-sm mt-2" style={{ color: '#6a6a6a' }}>
            You can still do a quick check-in now or log details anytime.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => setManualView('morning')}
              className="px-4 py-2 rounded-full text-sm font-medium"
              style={{ background: '#6B9080', color: '#fff' }}
            >
              Morning check-in
            </button>
            <button
              onClick={() => setManualView('evening')}
              className="px-4 py-2 rounded-full text-sm font-medium"
              style={{ background: '#D4A0A0', color: '#fff' }}
            >
              Evening check-in
            </button>
            <button
              onClick={() => setView('details')}
              className="px-4 py-2 rounded-full text-sm font-medium"
              style={{ background: 'transparent', color: '#6B9080', border: '1px solid rgba(107, 144, 128, 0.4)' }}
            >
              Log details
            </button>
          </div>
        </div>

        <CheckInReminders />

        {props.prefill.oura ? (
          <div
            className="rounded-2xl p-5"
            style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
          >
            <h3 className="text-sm font-medium mb-3" style={{ color: '#3a3a3a' }}>
              Today at a glance
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="block text-xs uppercase tracking-wide" style={{ color: '#8a8a8a' }}>Sleep</span>
                <span style={{ color: '#3a3a3a' }}>{props.prefill.oura.sleep_score ?? '--'}/100</span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wide" style={{ color: '#8a8a8a' }}>Readiness</span>
                <span style={{ color: '#3a3a3a' }}>{props.prefill.oura.readiness_score ?? '--'}/100</span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wide" style={{ color: '#8a8a8a' }}>Resting HR</span>
                <span style={{ color: '#3a3a3a' }}>{props.prefill.oura.resting_hr ?? '--'} bpm</span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wide" style={{ color: '#8a8a8a' }}>HRV</span>
                <span style={{ color: '#3a3a3a' }}>{props.prefill.oura.hrv_avg ?? '--'} ms</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const onOpenDetails = () => setView('details')

  return (
    <div style={{ background: '#FAFAF7', minHeight: '100vh' }}>
      <OfflineQueueIndicator />
      {effectiveWindow === 'morning' ? (
        <MorningCheckIn
          log={props.log}
          prefill={props.prefill}
          recentMeals={props.recentMeals}
          initialSymptoms={props.symptoms}
          initialPainPoints={props.painPoints}
          initialGratitudes={props.initialGratitudes}
          initialMood={props.initialMood}
          onOpenDetails={onOpenDetails}
        />
      ) : (
        <EveningCheckIn
          log={props.log}
          prefill={props.prefill}
          initialSymptoms={props.symptoms}
          initialPainPoints={props.painPoints}
          initialMood={props.initialMood}
          recentMeals={props.recentMeals}
          onOpenDetails={onOpenDetails}
        />
      )}
    </div>
  )
}
