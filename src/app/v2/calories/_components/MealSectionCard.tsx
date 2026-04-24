'use client'
/*
 * MealSectionCard
 *
 * One meal bucket: header (label + total cal), then either a list
 * of food rows with per-row kebab, or the empty-state line. Always
 * ends with an inline "Add to {meal}" row so Lanae can log without
 * hitting the FAB. Empty meals read as a soft nudge, not a scold:
 * "An empty meal is a signal too" preserves NC voice.
 *
 * Header kebab is reserved for a future bulk "Move" action; omitted
 * in Session 02 to keep this card simple.
 *
 * Beside the meal label sits a small info button that opens a
 * MealTimingExplainer modal in the Oura "Sleep regularity"
 * educational style established by PR #45 + #46. Splitting the info
 * tap from the expand/collapse tap keeps both interactions
 * unambiguous.
 *
 * Density (Oura-restrained):
 *   The dashboard renders four meal cards. Stacking all four expanded
 *   eats the mid-fold and reads as form-dense rather than calm. The
 *   page passes `defaultExpanded` based on time-of-day so only the
 *   current meal opens; the others render as a single row (label +
 *   total cal + chevron) and expand on tap. Matches Oura's "show the
 *   relevant signal now, drill in for the rest" pattern.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Card, ListRow } from '@/v2/components/primitives'
import MealRowKebab from './MealRowKebab'
import { MealTimingExplainer } from '../food/_components/MetricExplainers'

export interface MealSectionEntry {
  id: string
  food_items: string | null
  calories: number | null
  macros: Record<string, number> | null
}

export interface MealSectionCardProps {
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  label: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'
  date: string
  entries: MealSectionEntry[]
  /** Whether the card opens expanded. Default false; the page sets
   *  true for the meal whose time window contains "now". */
  defaultExpanded?: boolean
}

const EMPTY_COPY: Record<MealSectionCardProps['meal'], string> = {
  breakfast: 'Tap to log breakfast. An empty meal is a signal too.',
  lunch: 'Tap to log lunch. An empty meal is a signal too.',
  dinner: 'Tap to log dinner. An empty meal is a signal too.',
  snack: 'Tap to log a snack. An empty meal is a signal too.',
}

function InfoIconButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        borderRadius: 'var(--v2-radius-full)',
        background: 'transparent',
        border: '1px solid var(--v2-border)',
        padding: 0,
        margin: 0,
        cursor: 'pointer',
        color: 'var(--v2-text-muted)',
        font: 'inherit',
        flexShrink: 0,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

export default function MealSectionCard({
  meal,
  label,
  date,
  entries,
  defaultExpanded = false,
}: MealSectionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [explainerOpen, setExplainerOpen] = useState(false)
  const total = entries.reduce((acc, e) => acc + (e.calories ?? 0), 0)
  const isEmpty = entries.length === 0
  const searchHref = `/v2/calories/search?view=search&meal=${meal}&date=${date}`

  const explainer = (
    <MealTimingExplainer
      open={explainerOpen}
      onClose={() => setExplainerOpen(false)}
      meal={meal}
      entryCount={entries.length}
      totalCalories={total}
    />
  )

  // Collapsed state: render a single tappable row with chevron. Tap
  // expands in place. Keeps the page's vertical rhythm Oura-restrained.
  if (!expanded) {
    return (
      <Card padding="none">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-label={`Expand ${label.toLowerCase()}, ${Math.round(total)} calories`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: 'var(--v2-space-3) var(--v2-space-4)',
            minHeight: 'var(--v2-touch-target-min)',
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            color: 'inherit',
            fontFamily: 'inherit',
            textAlign: 'left',
            borderRadius: 'var(--v2-radius-lg)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--v2-space-2)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--v2-text-base)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
              }}
            >
              {label}
            </span>
            <InfoIconButton
              onClick={() => setExplainerOpen(true)}
              ariaLabel={`Open ${label.toLowerCase()} timing explainer`}
            />
          </span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--v2-space-2)',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>{Math.round(total)} cal</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
              style={{ flexShrink: 0 }}
            >
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
        {explainer}
      </Card>
    )
  }

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 'var(--v2-space-2)',
            width: '100%',
          }}
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-expanded={true}
            aria-label={`Collapse ${label.toLowerCase()}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--v2-space-2)',
              background: 'transparent',
              border: 0,
              padding: 0,
              cursor: 'pointer',
              color: 'inherit',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-base)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
              }}
            >
              {label}
            </h3>
            <InfoIconButton
              onClick={() => setExplainerOpen(true)}
              ariaLabel={`Open ${label.toLowerCase()} timing explainer`}
            />
          </button>
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(total)} cal
          </span>
        </div>

        {isEmpty ? (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {EMPTY_COPY[meal]}
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {entries.map((e, i) => {
              const name = e.food_items?.trim() || '(unnamed)'
              const cal = Math.round(e.calories ?? 0)
              const isLast = i === entries.length - 1
              return (
                <li key={e.id}>
                  <ListRow
                    divider={!isLast}
                    label={name}
                    subtext={`${cal} cal`}
                    trailing={
                      <MealRowKebab
                        entryId={e.id}
                        date={date}
                        meal={meal}
                        foodLabel={name}
                      />
                    }
                  />
                </li>
              )
            })}
          </ul>
        )}

        <Link
          href={searchHref}
          aria-label={`Add to ${label.toLowerCase()}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 'var(--v2-touch-target-min)',
            padding: 'var(--v2-space-3) var(--v2-space-3)',
            marginTop: isEmpty ? 'var(--v2-space-2)' : 0,
            borderRadius: 'var(--v2-radius-md)',
            background: 'var(--v2-accent-primary-soft)',
            color: 'var(--v2-accent-primary)',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            textDecoration: 'none',
          }}
        >
          <span>{`Add to ${label.toLowerCase()}`}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
      {explainer}
    </Card>
  )
}
