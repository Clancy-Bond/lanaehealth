'use client'

/**
 * SleepContributors
 *
 * Flat ListRows summarizing last-night sleep mechanics. Tap any row
 * to open an explainer in the same NC-voiced register across the app.
 *
 * Two flavors of explainer are wired here:
 *   1. Banded explainers (REM, Deep, Latency, Regularity) live in
 *      ./MetricExplainers and use the Oura "Sleep regularity" pattern
 *      with threshold bands + a current-value tick.
 *   2. The remaining mechanics (Total sleep, HRV, RHR, body temp)
 *      stay on the lighter inline ExplainerSheet pattern because the
 *      meaningful signal is your own baseline drift, not a band.
 *
 * Every row is honest about the data source: a row with null data
 * shows "no data yet" rather than a silent empty trailing slot.
 */
import { useState } from 'react'
import type { OuraDaily } from '@/lib/types'
import { ListRow } from '@/v2/components/primitives'
import ExplainerSheet from '../../_components/ExplainerSheet'
import { secondsToHoursMinutes } from '@/lib/v2/home-signals'
import {
  RemSleepExplainer,
  DeepSleepExplainer,
  SleepLatencyExplainer,
  SleepRegularityExplainer,
} from './MetricExplainers'

export interface SleepContributorsProps {
  lastNight: OuraDaily | null
  /** Optional sleep latency in minutes; ring may not always report. */
  sleepLatencyMin?: number | null
  /** Optional rolling regularity index 0-100; computed elsewhere. */
  regularityScore?: number | null
}

type RowKey =
  | 'duration'
  | 'deep'
  | 'rem'
  | 'latency'
  | 'regularity'
  | 'hrv'
  | 'rhr'
  | 'temp'

interface InlineRow {
  key: RowKey
  label: string
  subtext: string
  trailing: string
  body: React.ReactNode
  title: string
}

export default function SleepContributors({
  lastNight,
  sleepLatencyMin = null,
  regularityScore = null,
}: SleepContributorsProps) {
  const [openKey, setOpenKey] = useState<RowKey | null>(null)
  const inlineRows = buildInlineRows(lastNight)
  const inlineActive = inlineRows.find((r) => r.key === openKey) ?? null

  const remMin = lastNight?.rem_sleep_min ?? null
  const deepMin = lastNight?.deep_sleep_min ?? null
  const totalSleepSec = lastNight?.sleep_duration ?? null
  const dateISO = lastNight?.date ?? null

  const rows: Array<{ key: RowKey; label: string; subtext: string; trailing: string }> = [
    { key: 'duration', label: 'Total sleep', subtext: 'Time spent in any sleep stage', trailing: lastNight ? secondsToHoursMinutes(lastNight.sleep_duration) : 'no data yet' },
    { key: 'deep', label: 'Deep sleep', subtext: 'Slow-wave sleep, associated with physical recovery', trailing: deepMin != null ? `${Math.round(deepMin)}m` : 'no data yet' },
    { key: 'rem', label: 'REM sleep', subtext: 'Rapid-eye-movement, linked with memory and mood', trailing: remMin != null ? `${Math.round(remMin)}m` : 'no data yet' },
    { key: 'latency', label: 'Sleep latency', subtext: 'Time to fall asleep after lying down', trailing: sleepLatencyMin != null ? `${Math.round(sleepLatencyMin)}m` : 'no data yet' },
    { key: 'regularity', label: 'Sleep regularity', subtext: 'How consistent your bed and wake times are', trailing: regularityScore != null ? `${Math.round(regularityScore)}` : 'no data yet' },
    { key: 'hrv', label: 'HRV', subtext: 'Heart rate variability, a recovery signal', trailing: lastNight?.hrv_avg != null ? Math.round(lastNight.hrv_avg).toString() : 'no data yet' },
    { key: 'rhr', label: 'Resting heart rate', subtext: 'Your calm-state pulse', trailing: lastNight?.resting_hr != null ? `${Math.round(lastNight.resting_hr)} bpm` : 'no data yet' },
    { key: 'temp', label: 'Body temperature', subtext: 'Deviation from your baseline', trailing: lastNight?.body_temp_deviation != null ? `${lastNight.body_temp_deviation >= 0 ? '+' : ''}${lastNight.body_temp_deviation.toFixed(1)}°C` : 'no data yet' },
  ]

  // Oura's contributor list (frame_0050, frame_0150) is flat rows over
  // the page gradient with hairline dividers. The previous Card wrapped
  // the list in a sunken surface that read as "another tile" instead of
  // "the next paragraph of meaning". Flatter, lighter, more Oura.
  return (
    <div>
      <div>
        {rows.map((r, i) => (
          <ListRow
            key={r.key}
            label={r.label}
            subtext={r.subtext}
            trailing={r.trailing}
            chevron
            divider={i < rows.length - 1}
            onClick={() => setOpenKey(r.key)}
          />
        ))}
      </div>

      <RemSleepExplainer
        open={openKey === 'rem'}
        onClose={() => setOpenKey(null)}
        remMinutes={remMin}
        totalSleepSeconds={totalSleepSec}
        dateISO={dateISO}
      />
      <DeepSleepExplainer
        open={openKey === 'deep'}
        onClose={() => setOpenKey(null)}
        deepMinutes={deepMin}
        totalSleepSeconds={totalSleepSec}
        dateISO={dateISO}
      />
      <SleepLatencyExplainer
        open={openKey === 'latency'}
        onClose={() => setOpenKey(null)}
        latencyMinutes={sleepLatencyMin}
        dateISO={dateISO}
      />
      <SleepRegularityExplainer
        open={openKey === 'regularity'}
        onClose={() => setOpenKey(null)}
        regularityScore={regularityScore}
        dateISO={dateISO}
      />

      <ExplainerSheet
        open={inlineActive !== null}
        onClose={() => setOpenKey(null)}
        title={inlineActive?.title ?? ''}
      >
        {inlineActive?.body}
      </ExplainerSheet>
    </div>
  )
}

function buildInlineRows(night: OuraDaily | null): InlineRow[] {
  return [
    {
      key: 'duration',
      label: 'Total sleep',
      subtext: 'Time spent in any sleep stage',
      trailing: night ? secondsToHoursMinutes(night.sleep_duration) : 'no data yet',
      title: 'Total sleep',
      body: (
        <>
          <p style={{ margin: 0 }}>
            The total time your ring detected you in any sleep stage last night, end
            to end.
          </p>
          <p style={{ margin: 0 }}>
            Longer is not always better. What matters for you is consistency, the
            feeling of a fair recovery, and waking up without strong fatigue.
          </p>
        </>
      ),
    },
    {
      key: 'hrv',
      label: 'HRV',
      subtext: 'Heart rate variability, a recovery signal',
      trailing: night?.hrv_avg != null ? Math.round(night.hrv_avg).toString() : 'no data yet',
      title: 'Heart rate variability',
      body: (
        <>
          <p style={{ margin: 0 }}>
            HRV measures tiny variations in the time between heartbeats during sleep.
            Higher generally means better recovery.
          </p>
          <p style={{ margin: 0 }}>
            Dips can show up after intense exertion, illness, a flare, or poor sleep.
            Your own baseline is what matters, not a universal target.
          </p>
        </>
      ),
    },
    {
      key: 'rhr',
      label: 'Resting heart rate',
      subtext: 'Your calm-state pulse',
      trailing: night?.resting_hr != null ? `${Math.round(night.resting_hr)} bpm` : 'no data yet',
      title: 'Resting heart rate',
      body: (
        <>
          <p style={{ margin: 0 }}>
            The lowest sustained heart rate your ring saw during sleep. A useful
            early-warning signal when something is off.
          </p>
          <p style={{ margin: 0 }}>
            A reading 5 or more beats above your usual often precedes feeling run
            down. Gentle pacing tends to help.
          </p>
        </>
      ),
    },
    {
      key: 'temp',
      label: 'Body temperature',
      subtext: 'Deviation from your baseline',
      trailing:
        night?.body_temp_deviation != null
          ? `${night.body_temp_deviation >= 0 ? '+' : ''}${night.body_temp_deviation.toFixed(1)}°C`
          : 'no data yet',
      title: 'Body temperature',
      body: (
        <>
          <p style={{ margin: 0 }}>
            Your ring tracks deviation from your usual sleeping temperature, not
            absolute temperature. Luteal-phase shifts and recent illness both show up
            here.
          </p>
          <p style={{ margin: 0 }}>
            Tiny changes are normal. Persistent elevation alongside feeling off is
            worth a check-in.
          </p>
        </>
      ),
    },
  ]
}
