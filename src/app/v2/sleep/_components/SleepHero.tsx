/**
 * SleepHero
 *
 * Large ring with the sleep score at center, plus four compact
 * tiles underneath for duration / deep / REM / HRV. The band label
 * above the ring ("Optimal / Good / Fair / Pay attention") is the
 * emotional summary; the number is just corroboration.
 */
import { MetricRing, MetricTile } from '@/v2/components/primitives'
import type { OuraDaily } from '@/lib/types'
import { bandConfig, bandForScore, secondsToHoursMinutes } from '@/lib/v2/home-signals'

export interface SleepHeroProps {
  lastNight: OuraDaily | null
  medianScore: number | null
}

export default function SleepHero({ lastNight, medianScore }: SleepHeroProps) {
  if (!lastNight || lastNight.sleep_score == null) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--v2-space-3)',
          padding: 'var(--v2-space-6) var(--v2-space-4)',
          textAlign: 'center',
        }}
      >
        <MetricRing value={0} size="lg" label="Awaiting first sync" displayValue="--" color="var(--v2-border-strong)" />
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-muted)',
            maxWidth: 280,
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          We will start showing your sleep patterns once Oura syncs the first night.
        </p>
      </div>
    )
  }

  const band = bandForScore(lastNight.sleep_score)
  const cfg = bandConfig(band)
  const reasonClause =
    medianScore != null
      ? lastNight.sleep_score > medianScore + 2
        ? ` Above your 30-day median of ${Math.round(medianScore)}.`
        : lastNight.sleep_score < medianScore - 2
          ? ` Below your 30-day median of ${Math.round(medianScore)}.`
          : ' In line with your recent pattern.'
      : ''

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--v2-space-4)',
      }}
    >
      <MetricRing
        value={lastNight.sleep_score}
        size="lg"
        color={cfg.color}
        label={cfg.label}
        displayValue={lastNight.sleep_score}
      />
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          maxWidth: 320,
          textAlign: 'center',
          lineHeight: 'var(--v2-leading-normal)',
        }}
      >
        {`${cfg.label} recovery.${reasonClause}`}
      </p>

      <div
        role="list"
        aria-label="Last night details"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--v2-space-2)',
          width: '100%',
          maxWidth: 420,
        }}
      >
        <div role="listitem">
          <MetricTile
            icon="⏱"
            value={secondsToHoursMinutes(lastNight.sleep_duration)}
            label="Duration"
          />
        </div>
        <div role="listitem">
          <MetricTile
            icon="◐"
            value={lastNight.deep_sleep_min != null ? `${Math.round(lastNight.deep_sleep_min)}m` : '--'}
            label="Deep"
            color="var(--v2-ring-sleep)"
          />
        </div>
        <div role="listitem">
          <MetricTile
            icon="◌"
            value={lastNight.rem_sleep_min != null ? `${Math.round(lastNight.rem_sleep_min)}m` : '--'}
            label="REM"
            color="var(--v2-accent-highlight)"
          />
        </div>
        <div role="listitem">
          <MetricTile
            icon="♡"
            value={lastNight.hrv_avg != null ? Math.round(lastNight.hrv_avg) : '--'}
            label="HRV"
            color="var(--v2-accent-primary)"
          />
        </div>
      </div>
    </div>
  )
}
