'use client'

/**
 * MetricStripHorizontal
 *
 * Oura's signature home chip strip: thin-bordered circles holding a
 * leading glyph and a number, with the label sitting BELOW the circle
 * (not inside a tile). Observed on frame_0001.png, frame_0010.png,
 * frame_0050.png. The card-shaped MetricTile felt heavier than Oura
 * because every chip carried its own surface lift; the circle removes
 * that lift entirely so the strip reads as data, not chrome.
 *
 * Each chip now taps to open a MetricExplainer modal in the Oura
 * "Sleep regularity" / "Body temperature" style (frame_0098-0100).
 * The reader never has to wonder what a number means without a
 * drill available in one tap. The explainer includes a "See full
 * detail" link into the relevant drill page so the old nav target
 * stays reachable without cluttering the chip itself.
 *
 * Data contract: the chips read from the already-loaded HomeContext
 * so we never fan out new queries here.
 */
import { useState, type ReactNode } from 'react'
import type { HomeContext } from '@/lib/v2/load-home-context'
import { bandConfig, bandForScore, median, secondsToHoursMinutes } from '@/lib/v2/home-signals'
import { assertSerializable } from '@/v2/lib/rsc-serialization-guard'
import {
  ReadinessExplainer,
  SleepExplainer,
  CycleExplainer,
  HRVExplainer,
  PainExplainer,
  CaloriesExplainer,
} from './MetricExplainers'

export interface MetricStripHorizontalProps {
  ctx: HomeContext
}

type ChipKey = 'readiness' | 'sleep' | 'cycle' | 'hrv' | 'pain' | 'calories'

interface Chip {
  key: ChipKey
  icon: string
  value: ReactNode
  label: string
  color: string
  ariaLabel: string
}

function buildChips(ctx: HomeContext): Chip[] {
  const latest = ctx.ouraTrend[ctx.ouraTrend.length - 1] ?? null
  const hasLatest = latest?.date === ctx.today

  const readinessChip: Chip = {
    key: 'readiness',
    icon: '◎',
    value: hasLatest && latest?.readiness_score != null ? latest.readiness_score : '--',
    label: 'Readiness',
    color: bandConfig(bandForScore(latest?.readiness_score)).color,
    ariaLabel: 'Open readiness explainer',
  }

  const sleepChip: Chip = {
    key: 'sleep',
    icon: '☾',
    value: hasLatest && latest?.sleep_score != null ? latest.sleep_score : '--',
    label: hasLatest && latest?.sleep_duration ? secondsToHoursMinutes(latest.sleep_duration) : 'Sleep',
    color: 'var(--v2-ring-sleep)',
    ariaLabel: 'Open sleep explainer',
  }

  const hrvChip: Chip = {
    key: 'hrv',
    icon: '♡',
    value: latest?.hrv_avg != null ? Math.round(latest.hrv_avg) : '--',
    label: 'HRV',
    color: 'var(--v2-accent-primary)',
    ariaLabel: 'Open HRV explainer',
  }

  const cycleDay = ctx.cycle?.current?.day
  const cyclePhase = ctx.cycle?.current?.phase
  const cycleChip: Chip = {
    key: 'cycle',
    icon: '○',
    value: cycleDay != null ? cycleDay : '--',
    label: cyclePhase ? `${cyclePhase[0].toUpperCase()}${cyclePhase.slice(1)}` : 'Log a period',
    color: ctx.cycle?.current?.isUnusuallyLong
      ? 'var(--v2-accent-warning)'
      : 'var(--v2-surface-explanatory-accent)',
    ariaLabel: 'Open cycle explainer',
  }

  const painVal = ctx.dailyLog?.overall_pain
  const painChip: Chip = {
    key: 'pain',
    icon: '~',
    value: painVal != null ? `${painVal}` : '--',
    label: ctx.dailyLog ? 'Pain' : 'Log pain',
    color:
      painVal == null
        ? 'var(--v2-text-muted)'
        : painVal >= 6
          ? 'var(--v2-accent-warning)'
          : painVal >= 3
            ? 'var(--v2-accent-highlight)'
            : 'var(--v2-accent-success)',
    ariaLabel: 'Open daily pain explainer',
  }

  const caloriesChip: Chip = {
    key: 'calories',
    icon: '⊕',
    value: ctx.calories && ctx.calories.calories > 0 ? Math.round(ctx.calories.calories) : '--',
    label: ctx.calories && ctx.calories.entryCount > 0 ? 'Calories' : 'Log a meal',
    color: 'var(--v2-accent-primary)',
    ariaLabel: 'Open calories explainer',
  }

  return [readinessChip, sleepChip, cycleChip, hrvChip, painChip, caloriesChip]
}

export default function MetricStripHorizontal(props: MetricStripHorizontalProps) {
  // Dev-only guard: this client component is imported directly by the
  // /v2 home server page and receives a deeply-nested HomeContext object.
  // PR #87 showed how a single function field nested inside a config
  // array silently breaks the entire page. Walk props in dev and warn
  // before that ever ships again.
  assertSerializable(props as unknown as Record<string, unknown>, 'MetricStripHorizontal')
  const { ctx } = props
  const chips = buildChips(ctx)
  const [openKey, setOpenKey] = useState<ChipKey | null>(null)
  const latest = ctx.ouraTrend[ctx.ouraTrend.length - 1] ?? null
  const hasLatest = latest?.date === ctx.today
  const close = () => setOpenKey(null)

  // For HRV, a recent-median gives the explainer enough context to
  // say whether tonight is up or down versus the reader's own baseline.
  const hrvMedian = median(ctx.ouraTrend.map((d) => d.hrv_avg))

  return (
    <div
      role="list"
      aria-label="Today's metrics"
      style={{
        display: 'flex',
        gap: 'var(--v2-space-4)',
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingBottom: 'var(--v2-space-2)',
        scrollSnapType: 'x proximity',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {chips.map((chip) => (
        <button
          type="button"
          key={chip.key}
          role="listitem"
          aria-label={chip.ariaLabel}
          onClick={() => setOpenKey(chip.key)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--v2-space-1)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: 'inherit',
            cursor: 'pointer',
            scrollSnapAlign: 'start',
            flexShrink: 0,
            minWidth: 64,
            font: 'inherit',
          }}
        >
          <span
            style={{
              width: 64,
              height: 64,
              borderRadius: 'var(--v2-radius-full)',
              border: '1px solid var(--v2-border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'transparent',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1, color: 'var(--v2-text-muted)' }}>
              {chip.icon}
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-lg)',
                fontWeight: 'var(--v2-weight-medium)',
                color: chip.color,
                lineHeight: 1,
                letterSpacing: 'var(--v2-tracking-tight)',
              }}
            >
              {chip.value}
            </span>
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 1.2,
              textAlign: 'center',
              maxWidth: 80,
            }}
          >
            {chip.label}
          </span>
        </button>
      ))}

      <ReadinessExplainer
        open={openKey === 'readiness'}
        onClose={close}
        value={hasLatest ? latest?.readiness_score : null}
        dateISO={hasLatest ? ctx.today : null}
      />
      <SleepExplainer
        open={openKey === 'sleep'}
        onClose={close}
        score={hasLatest ? latest?.sleep_score : null}
        durationSeconds={hasLatest ? latest?.sleep_duration : null}
        dateISO={hasLatest ? ctx.today : null}
      />
      <CycleExplainer
        open={openKey === 'cycle'}
        onClose={close}
        day={ctx.cycle?.current?.day}
        phase={ctx.cycle?.current?.phase}
        isUnusuallyLong={ctx.cycle?.current?.isUnusuallyLong}
        lastPeriodISO={ctx.cycle?.current?.lastPeriodStart ?? null}
      />
      <HRVExplainer
        open={openKey === 'hrv'}
        onClose={close}
        value={latest?.hrv_avg}
        medianRecent={hrvMedian}
        dateISO={hasLatest ? ctx.today : null}
      />
      <PainExplainer
        open={openKey === 'pain'}
        onClose={close}
        value={ctx.dailyLog?.overall_pain}
        dateISO={ctx.dailyLog ? ctx.today : null}
      />
      <CaloriesExplainer
        open={openKey === 'calories'}
        onClose={close}
        calories={ctx.calories?.calories}
        entryCount={ctx.calories?.entryCount}
        dateISO={ctx.calories && ctx.calories.entryCount > 0 ? ctx.today : null}
      />
    </div>
  )
}
