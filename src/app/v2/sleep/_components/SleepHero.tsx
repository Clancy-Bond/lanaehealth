'use client'

/**
 * SleepHero
 *
 * Large ring with the sleep score at center, plus four compact
 * tiles underneath for duration / deep / REM / HRV. The band label
 * above the ring ("Optimal / Good / Fair / Pay attention") is the
 * emotional summary; the number is just corroboration.
 *
 * Tap-to-explain (PR #45 pattern, extended): the score ring opens
 * SleepScoreExplainer, mirroring the home strip pattern.
 */
import { useState } from 'react'
import { AnimatedNumber, MetricRing } from '@/v2/components/primitives'
import type { OuraDaily } from '@/lib/types'
import { bandConfig, bandForScore, secondsToHoursMinutes } from '@/lib/v2/home-signals'
import { SleepScoreExplainer } from './MetricExplainers'

/**
 * Compact Oura-style stat column: number on top, uppercase tracking
 * label below. Oura's readiness/activity detail (frame_0050) does not
 * wrap each stat in a bordered tile; it lets the numbers sit flat over
 * the page gradient with the labels dimmed.
 */
function FlatStat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span
        style={{
          fontSize: 'var(--v2-text-xl)',
          fontWeight: 'var(--v2-weight-medium)',
          color: color ?? 'var(--v2-text-primary)',
          lineHeight: 1,
          letterSpacing: 'var(--v2-tracking-tight)',
        }}
      >
        {value}
      </span>
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
    </div>
  )
}

export interface SleepHeroProps {
  lastNight: OuraDaily | null
  medianScore: number | null
}

export default function SleepHero({ lastNight, medianScore }: SleepHeroProps) {
  const [explainerOpen, setExplainerOpen] = useState(false)

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
        <button
          type="button"
          aria-label="Open sleep score explainer"
          onClick={() => setExplainerOpen(true)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'inherit',
            font: 'inherit',
            lineHeight: 0,
          }}
        >
          <MetricRing value={0} size="lg" label="Awaiting first sync" displayValue="--" color="var(--v2-border-strong)" />
        </button>
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
        <SleepScoreExplainer
          open={explainerOpen}
          onClose={() => setExplainerOpen(false)}
          score={null}
          durationSeconds={null}
          medianScore={medianScore}
          dateISO={null}
        />
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
        gap: 'var(--v2-space-5)',
        paddingTop: 'var(--v2-space-4)',
        paddingBottom: 'var(--v2-space-4)',
      }}
    >
      <button
        type="button"
        aria-label="Open sleep score explainer"
        onClick={() => setExplainerOpen(true)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
          lineHeight: 0,
        }}
      >
        <MetricRing
          value={lastNight.sleep_score}
          size="lg"
          color={cfg.color}
          label={cfg.label}
          displayValue={<AnimatedNumber value={lastNight.sleep_score} duration={1.4} />}
        />
      </button>
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
          paddingTop: 'var(--v2-space-2)',
        }}
      >
        <div role="listitem">
          <FlatStat value={secondsToHoursMinutes(lastNight.sleep_duration)} label="Duration" />
        </div>
        <div role="listitem">
          <FlatStat
            value={lastNight.deep_sleep_min != null ? `${Math.round(lastNight.deep_sleep_min)}m` : '--'}
            label="Deep"
            color="var(--v2-ring-sleep)"
          />
        </div>
        <div role="listitem">
          <FlatStat
            value={lastNight.rem_sleep_min != null ? `${Math.round(lastNight.rem_sleep_min)}m` : '--'}
            label="REM"
            color="var(--v2-accent-highlight)"
          />
        </div>
        <div role="listitem">
          <FlatStat
            value={lastNight.hrv_avg != null ? Math.round(lastNight.hrv_avg).toString() : '--'}
            label="HRV"
            color="var(--v2-accent-primary)"
          />
        </div>
      </div>
      <SleepScoreExplainer
        open={explainerOpen}
        onClose={() => setExplainerOpen(false)}
        score={lastNight.sleep_score}
        durationSeconds={lastNight.sleep_duration}
        medianScore={medianScore}
        dateISO={lastNight.date}
      />
    </div>
  )
}
