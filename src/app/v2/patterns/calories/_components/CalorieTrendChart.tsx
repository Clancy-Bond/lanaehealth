'use client'

/**
 * CalorieTrendChart
 *
 * 30-day bar chart of daily calorie totals. Bars are color-coded by
 * whether the day had any entries at all: filled accent for logged
 * days, faint ghost for days with zero entries (honest about gaps).
 *
 * Header doubles as a tap-to-explain target: opening the explainer
 * walks the reader through how the average is computed, what the
 * ghost bars mean, and why we never panic about a single low day.
 * Mirrors the WeeklyCalorieSparkline pattern from PR #45 / #49.
 */
import { useState } from 'react'
import type { DayTotals } from '@/lib/calories/home-data'
import { Card } from '@/v2/components/primitives'
import { TrendChartExplainer } from '../../_components/MetricExplainers'

export interface CalorieTrendChartProps {
  days: DayTotals[]
}

export default function CalorieTrendChart({ days }: CalorieTrendChartProps) {
  const [open, setOpen] = useState(false)
  const logged = days.filter((d) => d.entryCount > 0)
  const maxCalories = Math.max(...logged.map((d) => d.calories), 0)
  const avg =
    logged.length > 0 ? Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length) : null
  const missing = days.length - logged.length
  const avgPct = avg && maxCalories > 0 ? (avg / maxCalories) * 100 : null

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open 30-day energy explainer"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            color: 'inherit',
            textAlign: 'left',
            font: 'inherit',
            width: '100%',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            Average over the window
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--v2-space-2)' }}>
            <span
              style={{
                fontSize: 'var(--v2-text-3xl)',
                fontWeight: 'var(--v2-weight-medium)',
                color: 'var(--v2-text-primary)',
                letterSpacing: 'var(--v2-tracking-tight)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {avg ?? '--'}
            </span>
            <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
              cal per logged day
            </span>
          </div>
        </button>

        {logged.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
            Logging a week of meals will reveal your patterns here.
          </p>
        ) : (
          <div style={{ position: 'relative' }}>
            {avgPct !== null && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: `${avgPct}%`,
                  height: 1,
                  background: 'var(--v2-border-subtle)',
                  zIndex: 1,
                }}
              />
            )}
            <div
              role="img"
              aria-label={`Daily calorie totals over ${days.length} days, average ${avg ?? 'unknown'} cal`}
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 2,
                minHeight: 100,
                position: 'relative',
                zIndex: 2,
              }}
            >
              {days.map((d) => {
                const hasData = d.entryCount > 0
                const height = hasData && maxCalories > 0 ? (d.calories / maxCalories) * 100 : 4
                return (
                  <div
                    key={d.date}
                    title={hasData ? `${d.date}: ${Math.round(d.calories)} cal (${d.entryCount} entries)` : `${d.date}: no meals logged`}
                    style={{
                      flex: 1,
                      minWidth: 3,
                      maxWidth: 16,
                      height: `${Math.max(4, height)}%`,
                      background: hasData
                        ? 'var(--v2-accent-primary-soft)'
                        : 'var(--v2-border-subtle)',
                      border: hasData
                        ? '1px solid var(--v2-accent-primary)'
                        : '1px solid var(--v2-border-subtle)',
                      borderRadius: 'var(--v2-radius-sm)',
                      opacity: hasData ? 1 : 0.5,
                      transition: 'background var(--v2-duration-medium) var(--v2-ease-standard)',
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}

        <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', lineHeight: 'var(--v2-leading-normal)' }}>
          {missing === 0
            ? `Based on ${logged.length} days, all logged. Hairline shows your average.`
            : `Based on ${logged.length} logged days. ${missing} day${missing === 1 ? '' : 's'} had no meals recorded.`}
        </p>
      </div>

      <TrendChartExplainer
        open={open}
        onClose={() => setOpen(false)}
        average={avg}
        loggedDays={logged.length}
        totalDays={days.length}
      />
    </Card>
  )
}
