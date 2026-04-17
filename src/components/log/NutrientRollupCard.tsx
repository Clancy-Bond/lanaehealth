'use client'

/**
 * NutrientRollupCard
 *
 * Log-page card that shows current-day nutrient intake against resolved
 * targets (RDA + preset + user override). Surfaces the 25 priority
 * nutrients, collapsed to priority-only by default.
 *
 * Data contract:
 *   - `targets` comes from getResolvedTargets() in api/nutrient-targets.ts
 *   - `intake` is a plain map of nutrient-key -> grams/mg/mcg already
 *     normalized to the target unit. Callers may derive from food_entries
 *     joined to food_nutrient_cache; this component is presentation only.
 *
 * The card is standalone: it does not read from the DB itself, it does
 * not mutate, and it does not import into /log/page.tsx from this file.
 * Mounting is deferred to the main session per the Wave 2a brief so the
 * contested log page stays untouched here.
 */

import { useMemo, useState } from 'react'
import type { ResolvedTarget } from '@/lib/nutrition/target-resolver'
import { NUTRIENTS } from '@/lib/nutrition/nutrients-list'

export interface NutrientRollupCardProps {
  /** Resolved targets (one per canonical nutrient). */
  targets: ResolvedTarget[]
  /** Current-day intake per nutrient key, in the canonical unit. */
  intake: Record<string, number>
  /** ISO date shown in the subheader, typically today. */
  dateISO?: string
  /** Default collapsed state. When false, card shows all 25 nutrients. */
  priorityOnlyByDefault?: boolean
}

type BarTone = 'below' | 'on-track' | 'over'

function toneFor(pct: number): BarTone {
  if (pct < 0.8) return 'below'
  if (pct > 1.2) return 'over'
  return 'on-track'
}

function toneColor(tone: BarTone): string {
  if (tone === 'below') return 'var(--accent-blush, #D4A0A0)'
  if (tone === 'over') return 'var(--pain-mild, #E8B75F)'
  return 'var(--accent-sage, #6B9080)'
}

function toneLabel(tone: BarTone): string {
  if (tone === 'below') return 'below target'
  if (tone === 'over') return 'above target'
  return 'on target'
}

function sourceLabel(source: ResolvedTarget['source']): string {
  if (source === 'user') return 'your target'
  if (source === 'preset') return 'preset'
  if (source === 'rda') return 'NIH RDA'
  return 'default'
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value >= 100) return Math.round(value).toString()
  if (value >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

export default function NutrientRollupCard({
  targets,
  intake,
  dateISO,
  priorityOnlyByDefault = true,
}: NutrientRollupCardProps) {
  const [showAll, setShowAll] = useState(!priorityOnlyByDefault)

  const rows = useMemo(() => {
    const priorityKeys = new Set(
      NUTRIENTS.filter((n) => n.priority).map((n) => n.key),
    )
    return targets.map((t) => {
      const intakeValue = Number(intake[t.nutrient] ?? 0)
      const pct = t.amount > 0 ? intakeValue / t.amount : 0
      return {
        target: t,
        intakeValue,
        pct,
        tone: toneFor(pct),
        priority: priorityKeys.has(t.nutrient),
      }
    })
  }, [targets, intake])

  const visible = showAll ? rows : rows.filter((r) => r.priority)

  const summary = useMemo(() => {
    const tracked = rows.length
    const onTrack = rows.filter((r) => r.tone === 'on-track').length
    const below = rows.filter((r) => r.tone === 'below').length
    return { tracked, onTrack, below }
  }, [rows])

  const subheader = useMemo(() => {
    const iso = dateISO ?? new Date().toISOString().slice(0, 10)
    return `Tracking ${summary.tracked} nutrients, today ${iso}`
  }, [dateISO, summary.tracked])

  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: 'var(--bg-card, #FFFFFF)',
        border: '1px solid rgba(107, 144, 128, 0.15)',
        boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
      }}
      aria-label="Nutrient daily rollup"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary, #1A1A2E)' }}
          >
            Nutrients
          </h3>
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--text-secondary, #6B7280)' }}
          >
            {subheader}
          </p>
        </div>
        <div
          className="text-xs px-2 py-1 rounded-full"
          style={{
            background: 'rgba(107, 144, 128, 0.08)',
            color: 'var(--accent-sage, #6B9080)',
          }}
          aria-label={`${summary.onTrack} of ${summary.tracked} nutrients on target`}
        >
          {summary.onTrack} / {summary.tracked} on target
        </div>
      </header>

      <ul className="mt-4 flex flex-col gap-3">
        {visible.map((row) => (
          <NutrientBarRow key={row.target.nutrient} row={row} />
        ))}
      </ul>

      <footer className="mt-4 flex items-center justify-between">
        <button
          type="button"
          className="text-sm font-medium px-3 py-1.5 rounded-full"
          onClick={() => setShowAll((v) => !v)}
          style={{
            background: 'rgba(107, 144, 128, 0.08)',
            color: 'var(--accent-sage, #6B9080)',
            minHeight: '44px',
            minWidth: '44px',
          }}
          aria-expanded={showAll}
        >
          {showAll ? 'Show priority only' : `Show all ${rows.length}`}
        </button>
        {summary.below > 0 ? (
          <span
            className="text-xs"
            style={{ color: 'var(--text-secondary, #6B7280)' }}
          >
            {summary.below} below today
          </span>
        ) : null}
      </footer>
    </section>
  )
}

interface BarRow {
  target: ResolvedTarget
  intakeValue: number
  pct: number
  tone: BarTone
  priority: boolean
}

function NutrientBarRow({ row }: { row: BarRow }) {
  const { target, intakeValue, pct, tone } = row
  const clamped = Math.min(1, Math.max(0, pct))
  const color = toneColor(tone)
  const tonText = toneLabel(tone)
  const provenance = sourceLabel(target.source)

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span
          className="font-medium"
          style={{ color: 'var(--text-primary, #1A1A2E)' }}
        >
          {target.displayName}
        </span>
        <span style={{ color: 'var(--text-secondary, #6B7280)' }}>
          {formatAmount(intakeValue)} / {formatAmount(target.amount)} {target.unit}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: 'rgba(107, 144, 128, 0.08)' }}
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${target.displayName} ${tonText}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${clamped * 100}%`, background: color }}
        />
      </div>
      <div
        className="flex items-center justify-between text-xs"
        style={{ color: 'var(--text-secondary, #6B7280)' }}
      >
        <span>{tonText}</span>
        <span>{provenance}</span>
      </div>
    </li>
  )
}
