'use client'

/**
 * SleepContributors
 *
 * Six ListRows summarizing last-night sleep mechanics. Tap any row
 * to open the ExplainerSheet, which defines the metric in the same
 * NC-voiced register across the app.
 *
 * Every row is honest about the data source: a row with null data
 * shows "no data yet" rather than a silent empty trailing slot.
 */
import { useState } from 'react'
import type { OuraDaily } from '@/lib/types'
import { ListRow } from '@/v2/components/primitives'
import ExplainerSheet from '../../_components/ExplainerSheet'
import { secondsToHoursMinutes } from '@/lib/v2/home-signals'

export interface SleepContributorsProps {
  lastNight: OuraDaily | null
}

interface Contributor {
  key: string
  label: string
  subtext: string
  trailing: string
  explainer: { title: string; body: React.ReactNode }
}

export default function SleepContributors({ lastNight }: SleepContributorsProps) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const contributors = buildContributors(lastNight)
  const active = contributors.find((c) => c.key === openKey) ?? null

  // Oura's contributor list (frame_0050, frame_0150) is flat rows over
  // the page gradient with hairline dividers. The previous Card wrapped
  // the list in a sunken surface that read as "another tile" instead of
  // "the next paragraph of meaning". Flatter, lighter, more Oura.
  return (
    <div>
      <div>
        {contributors.map((c, i) => (
          <ListRow
            key={c.key}
            label={c.label}
            subtext={c.subtext}
            trailing={c.trailing}
            chevron
            divider={i < contributors.length - 1}
            onClick={() => setOpenKey(c.key)}
          />
        ))}
      </div>

      <ExplainerSheet
        open={active !== null}
        onClose={() => setOpenKey(null)}
        title={active?.explainer.title ?? ''}
      >
        {active?.explainer.body}
      </ExplainerSheet>
    </div>
  )
}

function buildContributors(night: OuraDaily | null): Contributor[] {
  return [
    {
      key: 'duration',
      label: 'Total sleep',
      subtext: 'Time spent in any sleep stage',
      trailing: night ? secondsToHoursMinutes(night.sleep_duration) : 'no data yet',
      explainer: {
        title: 'Total sleep',
        body: (
          <>
            <p style={{ margin: 0 }}>
              The total time your ring detected you in any sleep stage last night,
              end to end.
            </p>
            <p style={{ margin: 0 }}>
              Longer is not always better. What matters for you is consistency,
              the feeling of a fair recovery, and waking up without strong fatigue.
            </p>
          </>
        ),
      },
    },
    {
      key: 'deep',
      label: 'Deep sleep',
      subtext: 'Slow-wave sleep, associated with physical recovery',
      trailing: night?.deep_sleep_min != null ? `${Math.round(night.deep_sleep_min)}m` : 'no data yet',
      explainer: {
        title: 'Deep sleep',
        body: (
          <>
            <p style={{ margin: 0 }}>
              Deep sleep is when your body does most of its physical maintenance,
              tissue repair, and immune consolidation.
            </p>
            <p style={{ margin: 0 }}>
              Typical adults see 15 to 25 percent of the night as deep. The number
              matters less than whether you feel rested.
            </p>
          </>
        ),
      },
    },
    {
      key: 'rem',
      label: 'REM sleep',
      subtext: 'Rapid-eye-movement, linked with memory and mood',
      trailing: night?.rem_sleep_min != null ? `${Math.round(night.rem_sleep_min)}m` : 'no data yet',
      explainer: {
        title: 'REM sleep',
        body: (
          <>
            <p style={{ margin: 0 }}>
              REM is when most dreaming happens. It has been associated with
              consolidating memories and regulating emotional processing.
            </p>
            <p style={{ margin: 0 }}>
              Big single-night swings are normal. Trends across a week or two
              tell a cleaner story than one night's number.
            </p>
          </>
        ),
      },
    },
    {
      key: 'hrv',
      label: 'HRV',
      subtext: 'Heart rate variability, a recovery signal',
      trailing: night?.hrv_avg != null ? Math.round(night.hrv_avg).toString() : 'no data yet',
      explainer: {
        title: 'Heart rate variability',
        body: (
          <>
            <p style={{ margin: 0 }}>
              HRV measures tiny variations in the time between heartbeats during
              sleep. Higher generally means better recovery.
            </p>
            <p style={{ margin: 0 }}>
              Dips can show up after intense exertion, illness, a flare, or poor
              sleep. Your own baseline is what matters, not a universal target.
            </p>
          </>
        ),
      },
    },
    {
      key: 'rhr',
      label: 'Resting heart rate',
      subtext: 'Your calm-state pulse',
      trailing: night?.resting_hr != null ? `${Math.round(night.resting_hr)} bpm` : 'no data yet',
      explainer: {
        title: 'Resting heart rate',
        body: (
          <>
            <p style={{ margin: 0 }}>
              The lowest sustained heart rate your ring saw during sleep. A
              useful early-warning signal when something is off.
            </p>
            <p style={{ margin: 0 }}>
              A reading 5 or more beats above your usual often precedes feeling
              run down. Gentle pacing tends to help.
            </p>
          </>
        ),
      },
    },
    {
      key: 'temp',
      label: 'Body temperature',
      subtext: 'Deviation from your baseline',
      trailing:
        night?.body_temp_deviation != null
          ? `${night.body_temp_deviation >= 0 ? '+' : ''}${night.body_temp_deviation.toFixed(1)}°C`
          : 'no data yet',
      explainer: {
        title: 'Body temperature',
        body: (
          <>
            <p style={{ margin: 0 }}>
              Your ring tracks deviation from your usual sleeping temperature,
              not absolute temperature. Luteal-phase shifts and recent illness
              both show up here.
            </p>
            <p style={{ margin: 0 }}>
              Tiny changes are normal. Persistent elevation alongside feeling
              off is worth a check-in.
            </p>
          </>
        ),
      },
    },
  ]
}
